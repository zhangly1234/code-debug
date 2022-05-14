import * as vscode from "vscode";
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { DebugSession } from "vscode-debugadapter";
import { Session } from "inspector";
import { DebugProtocol } from "vscode-debugprotocol";
import { MI2DebugSession } from "../mibase"
import { isNullOrUndefined } from "util";
import { resolve } from "dns";
import { resolveCliPathFromVSCodeExecutablePath } from "vscode-test";
import { rejects } from "assert";
import { Z_NO_COMPRESSION } from "zlib";
import {riscvRegNames} from "./webview"

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("debugmemory", new MemoryContentProvider()));
	context.subscriptions.push(vscode.commands.registerCommand("code-debug.examineMemoryLocation", examineMemory));
	context.subscriptions.push(vscode.commands.registerCommand("code-debug.getFileNameNoExt", () => {
		if (!vscode.window.activeTextEditor || !vscode.window.activeTextEditor.document || !vscode.window.activeTextEditor.document.fileName) {
			vscode.window.showErrorMessage("No editor with valid file name active");
			return;
		}
		const fileName = vscode.window.activeTextEditor.document.fileName;
		const ext = path.extname(fileName);
		return fileName.substr(0, fileName.length - ext.length);
	}));
	context.subscriptions.push(vscode.commands.registerCommand("code-debug.getFileBasenameNoExt", () => {
		if (!vscode.window.activeTextEditor || !vscode.window.activeTextEditor.document || !vscode.window.activeTextEditor.document.fileName) {
			vscode.window.showErrorMessage("No editor with valid file name active");
			return;
		}
		const fileName = path.basename(vscode.window.activeTextEditor.document.fileName);
		const ext = path.extname(fileName);
		return fileName.substr(0, fileName.length - ext.length);
	}));

//=========================================================================================
	let currentPanel: vscode.WebviewPanel | undefined = undefined;
	let webviewMemState=[{from:0x80200000,length:16},{from:0x80201000,length:32}];
	let inKernel:boolean = true;
//========================================================================================


	context.subscriptions.push(
		vscode.commands.registerCommand('core-debugger.startPanel', () => {
			// Create and show a new webview
			currentPanel = vscode.window.createWebviewPanel(
				'core-debugger', // Identifies the type of the webview. Used internally
				'core-debugger', // Title of the panel displayed to the user
				vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
				{
					// Enable scripts in the webview
					enableScripts: true
				} // Webview options. More on these later.
			);
			// And set its HTML content
			currentPanel.webview.html = getWebviewContent("loading reg names", "loading reg values");
		})
	);
	let disposable = vscode.debug.registerDebugAdapterTrackerFactory("*", {
		createDebugAdapterTracker() {
			return {
				onWillStartSession: () => { console.log("session started") },
				onDidSendMessage: (message) => {
					
					try{
					if(message.body.reason==="breakpoint"){
						console.log("got breakpoint:");
						console.log(message);
						if(inKernel===true){
							inKernel=false;
						}
						else{
							inKernel=true;
						}
					}
					}catch(e){

					}
					if (message.type === "event") {
						if (message.event === "stopped") {
							//console.log("webview should update now. sending eventTest");
							vscode.debug.activeDebugSession?.customRequest("eventTest");
							//console.log("evenTest sent. Requesting registersNamesRequest and registersValuesRequest. ")
							vscode.debug.activeDebugSession?.customRequest("registersNamesRequest");
							vscode.debug.activeDebugSession?.customRequest("registersValuesRequest");
							//console.log("registersNamesRequest and registersValuesRequest sent. events will come later.");
							webviewMemState.forEach(element => {
								vscode.debug.activeDebugSession?.customRequest("memValuesRequest",element);
							});
							currentPanel.webview.postMessage({ inKernel: inKernel});
							
						}
						else if (message.event === "eventTest") {
							//console.log("Extension Received eventTest");
						}
						else if (message.event === "updateRegistersValuesEvent") {
							//console.log("Extension Received updateRegistersValuesEvent");
							currentPanel.webview.postMessage({ regValues: message.body});
							// currentPanel.webview.html=getWebviewContent( "todo",JSON.stringify(message.body));
							//console.log(message.body);
						}
						else if (message.event === "updateRegistersNamesEvent") {
							//console.log("Extension Received updateRegistersNamesEvent");
							currentPanel.webview.postMessage({ regNames: message.body });
							//console.log(message.body);
						}
						else if (message.event === "messagesByEvent") {
							//console.log("Extension Just Received a messagesByEvent");
						}
						else if (message.event === "memValues") {
							//console.log("Extension Just Received a memValues Event");
							currentPanel.webview.postMessage({ memValues: message.body });
							//console.log(message.body);
						}
					}
					//vscode.debug.activeDebugSession?.customRequest("envokeUpdateDebugWebviewEvent");},
					//onWillReceiveMessage:(message) => {console.log(message);/*vscode.debug.activeDebugSession?.customRequest("envokeUpdateDebugWebviewEvent")*/}

				}
			}
		}
	});

	currentPanel.webview.onDidReceiveMessage(
        message => {

		/* TODO
			switch (message.command) {
            case 'alert':
              vscode.window.showErrorMessage(message.text);
              return;
          }*/

          webviewMemState=message;
        },
        undefined,
        context.subscriptions
      );


	/* NOT WORKING
		context.subscriptions.push(vscode.debug.onDidReceiveDebugSessionCustomEvent((customEvent) => {
			/// czy TODO filters: if event ok then =>
			/// not care about event. just to know something happened.
			/// better way: 
			/// currentPanel.webview.postMessage(getDebugPanelInfo(customEvent));
			console.log("Extension Received Custom Command");
	
			if(customEvent.event==="eventTest"){
	
			// currentPanel.webview.html=getWebviewContent(getDebugPanelInfo());
			
	
			// violent way: currentPanel.webview.html=getDebugPanelInfo(customEvent).toString();
			}
			else{
				currentPanel.webview.html=getWebviewContent( JSON.stringify(customEvent.body));
			}
			
		}));
	*/

}

const memoryLocationRegex = /^0x[0-9a-f]+$/;

function getMemoryRange(range: string) {
	if (!range)
		return undefined;
	range = range.replace(/\s+/g, "").toLowerCase();
	let index;
	if ((index = range.indexOf("+")) != -1) {
		const from = range.substr(0, index);
		let length = range.substr(index + 1);
		if (!memoryLocationRegex.exec(from))
			return undefined;
		if (memoryLocationRegex.exec(length))
			length = parseInt(length.substr(2), 16).toString();
		return "from=" + encodeURIComponent(from) + "&length=" + encodeURIComponent(length);
	} else if ((index = range.indexOf("-")) != -1) {
		const from = range.substr(0, index);
		const to = range.substr(index + 1);
		if (!memoryLocationRegex.exec(from))
			return undefined;
		if (!memoryLocationRegex.exec(to))
			return undefined;
		return "from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to);
	} else if (memoryLocationRegex.exec(range))
		return "at=" + encodeURIComponent(range);
	else return undefined;
}

function examineMemory() {
	const socketlists = path.join(os.tmpdir(), "code-debug-sockets");
	if (!fs.existsSync(socketlists)) {
		if (process.platform == "win32")
			return vscode.window.showErrorMessage("This command is not available on windows");
		else
			return vscode.window.showErrorMessage("No debugging sessions available");
	}
	fs.readdir(socketlists, (err, files) => {
		if (err) {
			if (process.platform == "win32")
				return vscode.window.showErrorMessage("This command is not available on windows");
			else
				return vscode.window.showErrorMessage("No debugging sessions available");
		}
		const pickedFile = (file) => {
			vscode.window.showInputBox({ placeHolder: "Memory Location or Range", validateInput: range => getMemoryRange(range) === undefined ? "Range must either be in format 0xF00-0xF01, 0xF100+32 or 0xABC154" : "" }).then(range => {
				vscode.window.showTextDocument(vscode.Uri.parse("debugmemory://" + file + "?" + getMemoryRange(range)));
			});
		};
		if (files.length == 1)
			pickedFile(files[0]);
		else if (files.length > 0)
			vscode.window.showQuickPick(files, { placeHolder: "Running debugging instance" }).then(file => pickedFile(file));
		else if (process.platform == "win32")
			return vscode.window.showErrorMessage("This command is not available on windows");
		else
			vscode.window.showErrorMessage("No debugging sessions available");
	});
}

class MemoryContentProvider implements vscode.TextDocumentContentProvider {
	provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Thenable<string> {
		return new Promise((resolve, reject) => {
			const conn = net.connect(path.join(os.tmpdir(), "code-debug-sockets", uri.authority.toLowerCase()));
			let from, to;
			let highlightAt = -1;
			const splits = uri.query.split("&");
			if (splits[0].split("=")[0] == "at") {
				const loc = parseInt(splits[0].split("=")[1].substr(2), 16);
				highlightAt = 64;
				from = Math.max(loc - 64, 0);
				to = Math.max(loc + 768, 0);
			} else if (splits[0].split("=")[0] == "from") {
				from = parseInt(splits[0].split("=")[1].substr(2), 16);
				if (splits[1].split("=")[0] == "to") {
					to = parseInt(splits[1].split("=")[1].substr(2), 16);
				} else if (splits[1].split("=")[0] == "length") {
					to = from + parseInt(splits[1].split("=")[1]);
				} else return reject("Invalid Range");
			} else return reject("Invalid Range");
			if (to < from)
				return reject("Negative Range");
			conn.write("examineMemory " + JSON.stringify([from, to - from + 1]));
			conn.once("data", data => {
				let formattedCode = "                  00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F\n";
				var index: number = from;
				const hexString = data.toString();
				let x = 0;
				let asciiLine = "";
				let byteNo = 0;
				for (let i = 0; i < hexString.length; i += 2) {
					if (x == 0) {
						var addr = index.toString(16);
						while (addr.length < 16) addr = '0' + addr;
						formattedCode += addr + "  ";
					}
					index++;

					const digit = hexString.substr(i, 2);
					const digitNum = parseInt(digit, 16);
					if (digitNum >= 32 && digitNum <= 126)
						asciiLine += String.fromCharCode(digitNum);
					else
						asciiLine += ".";

					if (highlightAt == byteNo) {
						formattedCode = formattedCode.slice(0, -1) + "[" + digit + "]";
					} else {
						formattedCode += digit + " ";
					}

					if (x == 7)
						formattedCode += " ";

					if (++x >= 16) {
						formattedCode += " " + asciiLine + "\n";
						x = 0;
						asciiLine = "";
					}
					byteNo++;
				}
				if (x > 0) {
					for (let i = 0; i <= 16 - x; i++) {
						formattedCode += "   ";
					}
					if (x >= 8)
						formattedCode = formattedCode.slice(0, -2);
					else
						formattedCode = formattedCode.slice(0, -1);
					formattedCode += asciiLine;
				}
				resolve(center("Memory Range from 0x" + from.toString(16) + " to 0x" + to.toString(16), 84) + "\n\n" + formattedCode);
				conn.destroy();
			});
		});
	}
}

function center(str: string, width: number): string {
	var left = true;
	while (str.length < width) {
		if (left) str = ' ' + str;
		else str = str + ' ';
		left = !left;
	}
	return str;
}
function getWebviewContent(regNames?: string, regValues?: string) {
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Cat Coding</title>
	</head>
	<body>
	<div>
	<table id="regTable" style="float: left;">

	

	</table>
	<div>
	<table id="memTable">

	

	</table>

	<h2>pc:       </h2><h4 id="pc">loading</h4>
	<h2>inSBI:    </h2><h4 id="sbi">loading</h4>
	<h2>inKernel: </h2><h4 id="inKernel">loading</h4>
	</div>
</div>
</body>
<script>

	const riscvRegNames = ${riscvRegNames};
	const vscode = acquireVsCodeApi();
	function getMemRangeList(){

		return [{from:0x80200000,length:16},{from:0x80201000,length:32}];
	}
	function memRangeQuery(){
		vscode.postMessage(getMemRangeList());
	}
	window.addEventListener('message', event => {
		const message = event.data; // The JSON data our extension sent
		if(message.regValues){
			document.getElementById('regTable').innerHTML="";
			document.getElementById('regTable').innerHTML+=JSON.stringify(message.regValues);
			try{
			document.getElementById('pc').innerHTML=message.regValues[32][1][1];
			document.getElementById('sbi').innerHTML=message.regValues[32][1][1]<0x80200000;
			
			}catch(e){}
		}
		if(message.memValues){
			let memValues = message.memValues;
			// document.getElementById('memTable').innerHTML+=JSON.stringify(message.memValues)+"<br>";
			document.getElementById('memTable').innerHTML+=JSON.stringify(memValues.data)+" ";
			document.getElementById('memTable').innerHTML+=JSON.stringify(memValues.from)+" ";
			document.getElementById('memTable').innerHTML+=JSON.stringify(memValues.length)+" <br>";
			
		}
		if(message.inKernel){
			document.getElementById('inKernel').innerHTML=JSON.stringify(message.inKernel);
		}
	});
    </script>

	</html>`



}



function getDebugPanelInfo() {

	let result = {
		registers: [{ number: "unknown", value: "loading" }]
	};
	// vscode.debug.activeDebugSession?.customRequest("registersRequest");
	/*
	.then(
		response=>{
			if (response && response.success) {
				console.log("response success. Registers are:");
				console.log(JSON.stringify(response.body.registers));

				result['registers']= response.body.registers;

			} else {
				console.log("response not success! ");
			}
		},
		rejects=>{
			console.log(rejects);
		}
	);
	*/


	//return JSON.stringify(result.registers);
}

