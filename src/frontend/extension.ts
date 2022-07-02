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
import { riscvRegNames } from "./webview"
import {startupCmd} from "./fakeMakefile"

export function activate(context: vscode.ExtensionContext) {
	let NEXT_TERM_ID = 1;
	context.subscriptions.push(vscode.commands.registerCommand('core-debugger.launchCoreDebugger', () => {
		vscode.commands.executeCommand("core-debugger.startPanel");
		const terminal = vscode.window.createTerminal(`CoreDebugger Ext Terminal #${NEXT_TERM_ID++}`);
		terminal.sendText(startupCmd);
		vscode.commands.executeCommand("workbench.action.debug.start");
	}));
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("debugmemory", new MemoryContentProvider()));
	context.subscriptions.push(vscode.commands.registerCommand("code-debug.examineMemoryLocation", examineMemory));
	context.subscriptions.push(vscode.commands.registerCommand("code-debug.getFileNameNoExt", () => {
		if (!vscode.window.activeTextEditor || !vscode.window.activeTextEditor.document || !vscode.window.activeTextEditor.document.fileName) {
			vscode.window.showErrorMessage("No editor with valid file name active");
			return;
		}
		const fileName = vscode.window.activeTextEditor.document.fileName;
		const ext = path.extname(fileName);
		return fileName.substring(0, fileName.length - ext.length);
	}));
	context.subscriptions.push(vscode.commands.registerCommand("code-debug.getFileBasenameNoExt", () => {
		if (!vscode.window.activeTextEditor || !vscode.window.activeTextEditor.document || !vscode.window.activeTextEditor.document.fileName) {
			vscode.window.showErrorMessage("No editor with valid file name active");
			return;
		}
		const fileName = path.basename(vscode.window.activeTextEditor.document.fileName);
		const ext = path.extname(fileName);
		return fileName.substring(0, fileName.length - ext.length);
	}));

	//=========================================================================================
	let currentPanel: vscode.WebviewPanel | undefined = undefined;
	let webviewMemState = [{ from: 0x80200000, length: 16 }, { from: 0x80201000, length: 32 }];
	let kernelInOutBreakpointArgs=1;
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
			currentPanel.webview.onDidReceiveMessage(
				message => {
					// vscode.window.showErrorMessage("message");
					if (message.memRangeQuery) {
						webviewMemState = message.memRangeQuery;
					}
					if (message.removeDebugFile) {
						//TODO save current breakpoints
						//TODO support multiple debug files of user programs
						vscode.debug.activeDebugSession?.customRequest("removeDebugFile", { debugFilepath: os.homedir() + "/rCore-Tutorial-v3/user/target/riscv64gc-unknown-none-elf/release/initproc" });
						vscode.window.showInformationMessage("symbol file `initproc` removed");
					}
					if(message.setKernelInOutBreakpoints){
						vscode.debug.activeDebugSession?.customRequest("setKernelInOutBreakpoints");
						vscode.window.showInformationMessage("Kernel In Out Breakpoints Set")
					}
					if(message.removeAllCliBreakpoints){
						removeAllCliBreakpoints();
						vscode.window.showInformationMessage("All breakpoints including hidden ones are removed.");
					}
				},
				undefined,
				context.subscriptions
			);
		})
	);

	let disposable = vscode.debug.registerDebugAdapterTrackerFactory("*", {
		createDebugAdapterTracker() {
			return {
				onWillStartSession: () => { console.log("session started") },
				onDidSendMessage: (message) => {


					if (message.type === "event") {
						if (message.event === "stopped") {//czy move this section to mi2.ts later
							//console.log("webview should update now. sending eventTest");
							vscode.debug.activeDebugSession?.customRequest("eventTest");
							//console.log("evenTest sent. Requesting registersNamesRequest and registersValuesRequest. ")
							vscode.debug.activeDebugSession?.customRequest("registersNamesRequest");
							vscode.debug.activeDebugSession?.customRequest("registersValuesRequest");
							//console.log("registersNamesRequest and registersValuesRequest sent. events will come later.");
							webviewMemState.forEach(element => {
								vscode.debug.activeDebugSession?.customRequest("memValuesRequest",element);
							});

						}
						else if (message.event === "eventTest") {
							//console.log("Extension Received eventTest");
						}
						else if (message.event === "updateRegistersValuesEvent") {
							//console.log("Extension Received updateRegistersValuesEvent");
							currentPanel.webview.postMessage({ regValues: message.body });
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
						else if (message.event === "inUser") {
							//TODO save current breakpoints and webviewMemState
							webviewMemState = [];
							removeAllCliBreakpoints();
							//czy TODO support many debug files 
							vscode.debug.activeDebugSession?.customRequest("addDebugFile", { debugFilepath: os.homedir() + "/rCore-Tutorial-v3/user/target/riscv64gc-unknown-none-elf/release/initproc" });
							currentPanel.webview.postMessage({ inUser: true });
							vscode.window.showInformationMessage("All breakpoints removed. Symbol file `initproc`added. Now you can set breakpoints in initproc.rs (line 13 println!(\"aaaaa recommemded)");
							console.log("/////////////////////////INUSER///////////////////");
						}
						else if (message.event === "inKernel") {
							currentPanel.webview.postMessage({ inKernel: true });
							console.log("/////////////////////////INKERNEL///////////////////");
						}
						else if (message.event === "info") {
							console.log("//////////////INFO///////////");
							console.log(message.body);
						}
					}
					//vscode.debug.activeDebugSession?.customRequest("envokeUpdateDebugWebviewEvent");},
					//onWillReceiveMessage:(message) => {console.log(message);/*vscode.debug.activeDebugSession?.customRequest("envokeUpdateDebugWebviewEvent")*/}

				}
			}
		}
	});




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
		const from = range.substring(0, index);
		let length = range.substring(index + 1);
		if (!memoryLocationRegex.exec(from))
			return undefined;
		if (memoryLocationRegex.exec(length))
			length = parseInt(length.substring(2), 16).toString();
		return "from=" + encodeURIComponent(from) + "&length=" + encodeURIComponent(length);
	} else if ((index = range.indexOf("-")) != -1) {
		const from = range.substring(0, index);
		const to = range.substring(index + 1);
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
				const loc = parseInt(splits[0].split("=")[1].substring(2), 16);
				highlightAt = 64;
				from = Math.max(loc - 64, 0);
				to = Math.max(loc + 768, 0);
			} else if (splits[0].split("=")[0] == "from") {
				from = parseInt(splits[0].split("=")[1].substring(2), 16);
				if (splits[1].split("=")[0] == "to") {
					to = parseInt(splits[1].split("=")[1].substring(2), 16);
				} else if (splits[1].split("=")[0] == "length") {
					to = from + parseInt(splits[1].split("=")[1]);
				} else return reject("Invalid Range");
			} else return reject("Invalid Range");
			if (to < from)
				return reject("Negative Range");
			conn.write("examineMemory " + JSON.stringify([from, to - from + 1]));
			conn.once("data", data => {
				let formattedCode = "                  00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F\n";
				let index: number = from;
				const hexString = data.toString();
				let x = 0;
				let asciiLine = "";
				let byteNo = 0;
				for (let i = 0; i < hexString.length; i += 2) {
					if (x == 0) {
						let addr = index.toString(16);
						while (addr.length < 16) addr = '0' + addr;
						formattedCode += addr + "  ";
					}
					index++;

					const digit = hexString.substring(i, i + 2);
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
	let left = true;
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
		<title>CoreDebugger</title>
	</head>
	<body>
	<div>
	<button type="button" onclick="removeDebugFile()">remove Debug File (initproc only for now)</button><br>
	<button type="button" onclick="setKernelInOutBreakpoints()">set kernel in/out breakpoints</button><br>
	<button type="button" onclick="removeAllCliBreakpoints()">removeAllCliBreakpoints</button><br>
	<table id="regTable" style="float: left;">

	

	</table>
	<div>
	<table id="memTable">

	

	</table>

	<h2>pc:       </h2><h4 id="pc">loading</h4>
	<h2>Privilege: </h2><h4 id="privilege">loading</h4>
	<h4>if in out breakpoints hit, privilege changed.</h4>
	<h4>in out breakpoints configuration:</h4>
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
		vscode.postMessage({memRangeQuery:getMemRangeList()});
	}
	function removeDebugFile(){
		vscode.postMessage({removeDebugFile:true});
	}
	function setKernelInOutBreakpoints(){
		vscode.postMessage({setKernelInOutBreakpoints:true});
	}
	function removeAllCliBreakpoints(){
		vscode.postMessage({removeAllCliBreakpoints:true});
	}
	window.addEventListener('message', event => {
		const message = event.data; // The JSON data our extension sent
		if(message.regValues){
			document.getElementById('regTable').innerHTML="";
			document.getElementById('regTable').innerHTML+=JSON.stringify(message.regValues);
			try{
			document.getElementById('pc').innerHTML=message.regValues[32][1][1];
			}catch(e){}
		}
		if(message.memValues){
			let memValues = message.memValues;
			// document.getElementById('memTable').innerHTML+=JSON.stringify(message.memValues)+"<br>";
			document.getElementById('memTable').innerHTML+=JSON.stringify(memValues.data)+" ";
			document.getElementById('memTable').innerHTML+=JSON.stringify(memValues.from)+" ";
			document.getElementById('memTable').innerHTML+=JSON.stringify(memValues.length)+" <br>";
			
		}
		if(message.inUser){
			document.getElementById('privilege').innerHTML='U';
		}
		if(message.inKernel){
			document.getElementById('privilege').innerHTML='S';
		}
	});
    </script>

	</html>`



}

// send del to terminal
function removeAllCliBreakpoints(){ 
	vscode.commands.executeCommand("workbench.debug.viewlet.action.removeAllBreakpoints");
	vscode.debug.activeDebugSession?.customRequest("removeAllCliBreakpoints");
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

