import * as vscode from "vscode";
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { DebugSession } from "vscode-debugadapter";
import { Session } from "inspector";
import { DebugProtocol } from "vscode-debugprotocol";
import { MI2DebugSession } from "../mibase";
import { isNullOrUndefined } from "util";
import { resolve } from "dns";
import { rejects } from "assert";
import { Z_NO_COMPRESSION } from "zlib";
import { riscvRegNames } from "./webview";
import { startupCmd } from "./fakeMakefile";

export function activate(context: vscode.ExtensionContext) {
	let NEXT_TERM_ID = 1;
	context.subscriptions.push(
		vscode.commands.registerCommand("core-debugger.launchCoreDebugger", () => {
			vscode.commands.executeCommand("core-debugger.startPanel"); //当启动插件时
			const terminal = vscode.window.createTerminal(`CoreDebugger Ext Terminal #${NEXT_TERM_ID++}`); //创建新终端
			terminal.sendText(startupCmd); //启动qemu
			vscode.commands.executeCommand("workbench.action.debug.start");
		})
	);
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider("debugmemory", new MemoryContentProvider())
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("code-debug.examineMemoryLocation", examineMemory)
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("code-debug.getFileNameNoExt", () => {
			if (
				!vscode.window.activeTextEditor ||
				!vscode.window.activeTextEditor.document ||
				!vscode.window.activeTextEditor.document.fileName
			) {
				vscode.window.showErrorMessage("No editor with valid file name active");
				return;
			}
			const fileName = vscode.window.activeTextEditor.document.fileName;
			const ext = path.extname(fileName);
			return fileName.substring(0, fileName.length - ext.length);
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("code-debug.getFileBasenameNoExt", () => {
			if (
				!vscode.window.activeTextEditor ||
				!vscode.window.activeTextEditor.document ||
				!vscode.window.activeTextEditor.document.fileName
			) {
				vscode.window.showErrorMessage("No editor with valid file name active");
				return;
			}
			const fileName = path.basename(vscode.window.activeTextEditor.document.fileName);
			const ext = path.extname(fileName);
			return fileName.substring(0, fileName.length - ext.length);
		})
	);

	//=========================================================================================
	let currentPanel: vscode.WebviewPanel | undefined = undefined;
	let webviewMemState = [
		{ from: 0x80200000, length: 16 },
		{ from: 0x80201000, length: 32 },
	];
	const kernelInOutBreakpointArgs = 1;
	const userDebugFile = "initproc"; //可以修改为其它用户程序名，如matrix
	//========================================================================================

	context.subscriptions.push(
		vscode.commands.registerCommand("core-debugger.startPanel", () => {
			// Create and show a new webview
			currentPanel = vscode.window.createWebviewPanel(
				"core-debugger", // Identifies the type of the webview. Used internally
				"core-debugger", // Title of the panel displayed to the user
				vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
				{
					// Enable scripts in the webview
					enableScripts: true,
				} // Webview options. More on these later.
			);
			// And set its HTML content
			currentPanel.webview.html = getWebviewContent("loading reg names", "loading reg values");
			//处理从WebView中传递出的消息
			currentPanel.webview.onDidReceiveMessage(
				(message) => {
					// vscode.window.showErrorMessage("message");
					if (message.memRangeQuery) {
						webviewMemState = message.memRangeQuery;
					}
					if (message.removeDebugFile) {
						//自定义请求.customRequest函数见/src/mibase.ts
						vscode.debug.activeDebugSession?.customRequest("removeDebugFile", {
							debugFilepath:
								os.homedir() +
								"/rCore-Tutorial-v3/user/target/riscv64gc-unknown-none-elf/release/initproc",
						});
						//弹出窗口
						vscode.window.showInformationMessage("symbol file `initproc` removed");
					}
					if (message.setKernelInOutBreakpoints) {
						vscode.debug.activeDebugSession?.customRequest("setKernelInOutBreakpoints");
						vscode.window.showInformationMessage("Kernel In Out Breakpoints Set");
					}
					if (message.removeAllCliBreakpoints) {
						removeAllCliBreakpoints();
						vscode.window.showInformationMessage(
							"All breakpoints including hidden ones are removed."
						);
					}
					if (message.disableCurrentSpaceBreakpoints) {
						vscode.window.showInformationMessage("disableCurrentSpaceBreakpoints received");
						vscode.debug.activeDebugSession?.customRequest("disableCurrentSpaceBreakpoints");
					}
					if (message.updateAllSpacesBreakpointsInfo) {
						vscode.debug.activeDebugSession?.customRequest("listBreakpoints");
					}
				},
				undefined,
				context.subscriptions
			);
			///备用
			// vscode.debug.onDidChangeBreakpoints((e)=>{
			// 	vscode.window.showInformationMessage("onDidChangeBreakpoints");
			// })
		})
	);
	const disposable = vscode.debug.registerDebugAdapterTrackerFactory("*", {
		createDebugAdapterTracker() {
			return {
				//监听VSCode即将发送给Debug Adapter的消息
				onWillReceiveMessage: (message) => {
					//console.log("//////////RECEIVED FROM EDITOR///////////\n "+JSON.stringify(message)+"\n//////////////////\n ");
				},
				onWillStartSession: () => {
					console.log("session started");
				},
				//监听Debug Adapter发送给VSCode的消息
				onDidSendMessage: (message) => {
					//console.log("//////////MESSAGE///////////\n "+JSON.stringify(message)+"\n//////////////////\n ");
					//TODO use switch case
					if (message.command === "setBreakpoints") {
						//如果Debug Adapter设置了一个断点
						vscode.debug.activeDebugSession?.customRequest("listBreakpoints");
					}
					if (message.type === "event") {
						//如果（因为断点等）停下
						if (message.event === "stopped") {
							//console.log("webview should update now. sending eventTest");
							vscode.debug.activeDebugSession?.customRequest("eventTest");
							//console.log("evenTest sent. Requesting registersNamesRequest and registersValuesRequest. ")
							//请求寄存器信息
							vscode.debug.activeDebugSession?.customRequest("registersNamesRequest");
							vscode.debug.activeDebugSession?.customRequest("registersValuesRequest");
							//请求内存数据
							webviewMemState.forEach((element) => {
								vscode.debug.activeDebugSession?.customRequest("memValuesRequest", element);
							});
							//更新WebView中的断点信息
							vscode.debug.activeDebugSession?.customRequest("listBreakpoints");
						} //处理自定义事件
						else if (message.event === "eventTest") {
							//console.log("Extension Received eventTest");
						} else if (message.event === "updateRegistersValuesEvent") {
							//向WebView传递消息
							currentPanel.webview.postMessage({ regValues: message.body });
						} else if (message.event === "updateRegistersNamesEvent") {
							currentPanel.webview.postMessage({ regNames: message.body });
						} else if (message.event === "memValues") {
							currentPanel.webview.postMessage({ memValues: message.body });
						}
						//到达内核态->用户态的边界
						else if (message.event === "kernelToUserBorder") {
							webviewMemState = []; //TODO applyMemStateSet
							// removeAllCliBreakpoints();
							vscode.window.showInformationMessage("switched to " + userDebugFile + " breakpoints");
							vscode.debug.activeDebugSession?.customRequest("addDebugFile", {
								debugFilepath:
									os.homedir() +
									"/rCore-Tutorial-v3/user/target/riscv64gc-unknown-none-elf/release/" +
									userDebugFile,
							});
							vscode.debug.activeDebugSession?.customRequest(
								"updateCurrentSpace",
								"src/bin/" + userDebugFile + ".rs"
							);
							currentPanel.webview.postMessage({ kernelToUserBorder: true });
							vscode.window.showInformationMessage(
								"All breakpoints removed. Symbol file " +
									userDebugFile +
									" added. Now you can set user program breakpoints.  line 13 println!(\"aaaaa... recommemded if it's initproc.rs"
							);
							console.log("/////////////////////////kernelToUserBorder///////////////////");
						}
						//当前在内核态
						else if (message.event === "inKernel") {
							currentPanel.webview.postMessage({ inKernel: true });
							//removeAllCliBreakpoints();
							vscode.window.showInformationMessage("switched to kernel breakpoints");
							console.log("/////////////////////////INKERNEL///////////////////");
						} else if (message.event === "info") {
							console.log("//////////////INFO///////////");
							console.log(message.body);
						} else if (message.event === "showInformationMessage") {
							vscode.window.showInformationMessage(message.body);
						} else if (message.event === "listBreakpoints") {
							vscode.window.showInformationMessage("断点信息表格已经更新");
							currentPanel.webview.postMessage({ breakpointsInfo: message.body.data });
						}
					}
					//vscode.debug.activeDebugSession?.customRequest("envokeUpdateDebugWebviewEvent");},
					//onWillReceiveMessage:(message) => {console.log(message);/*vscode.debug.activeDebugSession?.customRequest("envokeUpdateDebugWebviewEvent")*/}
				},
			};
		},
	});
}

const memoryLocationRegex = /^0x[0-9a-f]+$/;

function getMemoryRange(range: string) {
	if (!range) return undefined;
	range = range.replace(/\s+/g, "").toLowerCase();
	let index;
	if ((index = range.indexOf("+")) != -1) {
		const from = range.substring(0, index);
		let length = range.substring(index + 1);
		if (!memoryLocationRegex.exec(from)) return undefined;
		if (memoryLocationRegex.exec(length)) length = parseInt(length.substring(2), 16).toString();
		return "from=" + encodeURIComponent(from) + "&length=" + encodeURIComponent(length);
	} else if ((index = range.indexOf("-")) != -1) {
		const from = range.substring(0, index);
		const to = range.substring(index + 1);
		if (!memoryLocationRegex.exec(from)) return undefined;
		if (!memoryLocationRegex.exec(to)) return undefined;
		return "from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to);
	} else if (memoryLocationRegex.exec(range)) return "at=" + encodeURIComponent(range);
	else return undefined;
}

function examineMemory() {
	const socketlists = path.join(os.tmpdir(), "code-debug-sockets");
	if (!fs.existsSync(socketlists)) {
		if (process.platform == "win32")
			return vscode.window.showErrorMessage("This command is not available on windows");
		else return vscode.window.showErrorMessage("No debugging sessions available");
	}
	fs.readdir(socketlists, (err, files) => {
		if (err) {
			if (process.platform == "win32")
				return vscode.window.showErrorMessage("This command is not available on windows");
			else return vscode.window.showErrorMessage("No debugging sessions available");
		}
		const pickedFile = (file) => {
			vscode.window
				.showInputBox({
					placeHolder: "Memory Location or Range",
					validateInput: (range) =>
						getMemoryRange(range) === undefined
							? "Range must either be in format 0xF00-0xF01, 0xF100+32 or 0xABC154"
							: "",
				})
				.then((range) => {
					vscode.window.showTextDocument(
						vscode.Uri.parse("debugmemory://" + file + "?" + getMemoryRange(range))
					);
				});
		};
		if (files.length == 1) pickedFile(files[0]);
		else if (files.length > 0)
			vscode.window
				.showQuickPick(files, { placeHolder: "Running debugging instance" })
				.then((file) => pickedFile(file));
		else if (process.platform == "win32")
			return vscode.window.showErrorMessage("This command is not available on windows");
		else vscode.window.showErrorMessage("No debugging sessions available");
	});
}

class MemoryContentProvider implements vscode.TextDocumentContentProvider {
	provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Thenable<string> {
		return new Promise((resolve, reject) => {
			const conn = net.connect(
				path.join(os.tmpdir(), "code-debug-sockets", uri.authority.toLowerCase())
			);
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
			if (to < from) return reject("Negative Range");
			conn.write("examineMemory " + JSON.stringify([from, to - from + 1]));
			conn.once("data", (data) => {
				let formattedCode = "                  00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F\n";
				let index: number = from;
				const hexString = data.toString();
				let x = 0;
				let asciiLine = "";
				let byteNo = 0;
				for (let i = 0; i < hexString.length; i += 2) {
					if (x == 0) {
						let addr = index.toString(16);
						while (addr.length < 16) addr = "0" + addr;
						formattedCode += addr + "  ";
					}
					index++;

					const digit = hexString.substring(i, i + 2);
					const digitNum = parseInt(digit, 16);
					if (digitNum >= 32 && digitNum <= 126) asciiLine += String.fromCharCode(digitNum);
					else asciiLine += ".";

					if (highlightAt == byteNo) {
						formattedCode = formattedCode.slice(0, -1) + "[" + digit + "]";
					} else {
						formattedCode += digit + " ";
					}

					if (x == 7) formattedCode += " ";

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
					if (x >= 8) formattedCode = formattedCode.slice(0, -2);
					else formattedCode = formattedCode.slice(0, -1);
					formattedCode += asciiLine;
				}
				resolve(
					center("Memory Range from 0x" + from.toString(16) + " to 0x" + to.toString(16), 84) +
						"\n\n" +
						formattedCode
				);
				conn.destroy();
			});
		});
	}
}

function center(str: string, width: number): string {
	let left = true;
	while (str.length < width) {
		if (left) str = " " + str;
		else str = str + " ";
		left = !left;
	}
	return str;
}
//WebView HTML
function getWebviewContent(regNames?: string, regValues?: string) {
	return `<!DOCTYPE html>
	<html lang="zh-CN">
	
	<head>
		<meta charset="utf-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<!-- The above 3 meta tags *must* come first in the head; any other head content must come *after* these tags -->
		<meta name="description" content="">
		<meta name="author" content="">
		<link rel="icon" href="https://fastly.jsdelivr.net/npm/@bootcss/v3.bootcss.com@1.0.35/favicon.ico">
		<link rel="canonical" href="https://getbootstrap.com/docs/3.4/examples/theme/">
	
		<title>CoreDebugger</title>
	
		<!-- Bootstrap core CSS -->
		<link href="https://fastly.jsdelivr.net/npm/@bootcss/v3.bootcss.com@1.0.35/dist/css/bootstrap.min.css"
			rel="stylesheet">
		<!-- Bootstrap theme -->
		<link href="https://fastly.jsdelivr.net/npm/@bootcss/v3.bootcss.com@1.0.35/dist/css/bootstrap-theme.min.css"
			rel="stylesheet">
		<!-- IE10 viewport hack for Surface/desktop Windows 8 bug -->
		<link
			href="https://fastly.jsdelivr.net/npm/@bootcss/v3.bootcss.com@1.0.35/assets/css/ie10-viewport-bug-workaround.css"
			rel="stylesheet">
	
		<!-- Custom styles for this template -->
		<link href="https://fastly.jsdelivr.net/npm/@bootcss/v3.bootcss.com@1.0.35/examples/theme/theme.css"
			rel="stylesheet">
	
		<script
			src="https://fastly.jsdelivr.net/npm/@bootcss/v3.bootcss.com@1.0.35/assets/js/ie-emulation-modes-warning.js">
			</script>
		<script src="http://libs.baidu.com/jquery/2.0.0/jquery.min.js"></script>
		<style>
			* {
				margin: 0;
				padding: 0;
				border: none
			}
	
			body,
			html {
				height: 100%;
				width: 100%;
			}
	
			.drag-box {
				user-select: none;
				background: #f0f0f0;
				z-index: 2147483647;
				position: fixed;
				left: 40%;
				top: 10px;
				width: 242px;
	
			}
	
	
			#dragBoxBar {
				align-items: center;
				display: flex;
				justify-content: space-between;
				background: #ccc;
				width: 100%;
				height: 10px;
				cursor: move;
				user-select: none;
	
			}
	
			.no-select {
				user-select: none;
			}
	
			.pointer-events {
				pointer-events: none;
			}
	
	
			.no-border {
				border: none;
			}
	
	
			#injectedBox {
				/* height: 160px; */
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 2rem;
				background: rgb(255, 255, 255);
				padding: 2px;
	
			}
		</style>
	</head>
	
	<body>
		<div class="container">
	
			<!-- navbar -->
			<nav class="navbar  navbar-fixed-top">
				<ul class="nav nav-tabs">
					<li role="presentation" class="active" id="nav_reg"><a href="#">Regester</a></li>
					<li role="presentation"><a href="#" id="nav_mem">Memory</a></li>
					<li role="presentation"><a href="#" id="nav_bre">Breakpoint</a></li>
				</ul>
			</nav>
			<i class="bi bi-1-circle"></i>
			<!-- button group -->
			<!-- 
			<div>
				<button type="button" class="btn btn-info" onclick="removeDebugFile()">remove Debug File (initproc only for
					now)</button>&nbsp;&nbsp;&nbsp;&nbsp;
				<button type="button" class="btn btn-info" onclick="setKernelInOutBreakpoints()">set kernel in/out
					breakpoints</button>&nbsp;&nbsp;&nbsp;&nbsp;
				<button type="button" class="btn btn-info"
					onclick="removeAllCliBreakpoints()">removeAllCliBreakpoints</button>&nbsp;&nbsp;&nbsp;&nbsp;
				<button type="button" class="btn btn-info"
					onclick="disableCurrentSpaceBreakpoints()">disableCurrentSpaceBreakpoints</button>&nbsp;&nbsp;&nbsp;&nbsp;
				<button type="button" class="btn btn-info"
					onclick="updateAllSpacesBreakpointsInfo()">updateAllSpacesBreakpointsInfo</button><br>
			</div>
			-->
			<!--寄存器-->
			<div class="table-responsive" id="div_reg">
				<table class="table table-striped table-sm">
					<thead>
						<tr>
							<th>name</th>
							<th>value</th>
						</tr>
					</thead>
	
					<tbody id="reg">
					</tbody>
				</table>
			</div>
	
			<!--  存储器 -->
			<div class="table-responsive" id="div_mem">
				<table class="table table-striped table-sm">
					<thead>
						<tr>
							<th>data</th>
							<th>from</th>
							<th>length</th>
						</tr>
					</thead>
	
					<tbody id="mem">
					</tbody>
				</table>
			</div>
	
			<!--  断点 -->
			<div id="breakpointsInfo"><br>
				current:<span id="currentSpace"></span><br>
				<div class="table-responsive">
					<table class="table" id="spacesTable">
	
					</table>
				</div>
			</div>
	</body>
	<script>
	
		function init() {
			var register = $(".navbar ul li :eq(0)");
			var memory = $(".navbar ul li :eq(1)");
			var breakpoints = $(".navbar ul li :eq(2)");
			register.addClass('active');
			memory.removeClass('active');
			breakpoints.removeClass('active')
			$("#div_reg").css('display', 'block');
			$("#div_mem").css('display', 'none');
			$("#breakpointsInfo").css('display', 'none');
	
		}
		init();
	


		function dragbox() {
			var injectedHTML = document.createElement("DIV");
			injectedHTML.innerHTML = '<dragBox id="dragBox" class="drag-box">\
	  <dragBoxBar id="dragBoxBar" class="no-select"></dragBoxBar>\
	  <injectedBox id="injectedBox"><div>\
	<span title="remove Debug File (initproc only for now)">\
		<button type="button" onclick="removeDebugFile()" class="btn btn-default" aria-label="Left Align">\
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-archive"\
				viewBox="0 0 16 16">\
				<path\
					d="M0 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5V5a1 1 0 0 1-1-1V2zm2 3v7.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V5H2zm13-3H1v2h14V2zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z" />\
			</svg>\
		</button>\
	</span>\
	<span title="set kernel in/out breakpoints">\
		<button type="button" onclick="setKernelInOutBreakpoints()" class="btn btn-default" aria-label="Left Align">\
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"\
				class="bi bi-arrow-counterclockwise" viewBox="0 0 16 16">\
				<path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z" />\
				<path\
					d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z" />\
			</svg>\
		</button>\
	</span>\
	<span title="removeAllCliBreakpoints">\
		<button type="button" onclick="removeAllCliBreakpoints()"  class="btn btn-default" aria-label="Left Align">\
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"\
				class="bi bi-trash-fill" viewBox="0 0 16 16">\
				<path\
					d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z" />\
			</svg>\
		</button>\
	</span>\
	<span title="disableCurrentSpaceBreakpoints">\
		<button type="button" onclick="disableCurrentSpaceBreakpoints()" class="btn btn-default" aria-label="Left Align">\
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"\
				class="bi bi-x-circle-fill" viewBox="0 0 16 16">\
				<path\
					d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z" />\
			</svg>\
		</button>\
	</span>\
	<span title="updateAllSpacesBreakpointsInfo">\
		<button type="button" onclick="updateAllSpacesBreakpointsInfo()" class="btn btn-default" aria-label="Left Align">\
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-gear"\
				viewBox="0 0 16 16">\
				<path\
					d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />\
				<path\
					d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" />\
			</svg>\
		</button>\
	</span>\
	</div></injectedBox>\
	  </dragBox>';
	
			document.body.appendChild(injectedHTML);
	
			var isMouseDown,
				initX,
				initY,
				height = injectedBox.offsetHeight,
				width = injectedBox.offsetWidth,
				dragBoxBar = document.getElementById('dragBoxBar');
	
	
			dragBoxBar.addEventListener('mousedown', function (e) {
				isMouseDown = true;
				document.body.classList.add('no-select');
				injectedBox.classList.add('pointer-events');
				initX = e.offsetX;
				initY = e.offsetY;
				dragBox.style.opacity = 0.5;
			})
	
			dragBoxBar.addEventListener('mouseup', function (e) {
				mouseupHandler();
			})
	
			document.addEventListener('mousemove', function (e) {
				if (isMouseDown) {
					var cx = e.clientX - initX,
						cy = e.clientY - initY;
					if (cx < 0) {
						cx = 0;
					}
					if (cy < 0) {
						cy = 0;
					}
					if (window.innerWidth - e.clientX + initX < width + 16) {
						cx = window.innerWidth - width;
					}
					if (e.clientY > window.innerHeight - height - dragBoxBar.offsetHeight + initY) {
						cy = window.innerHeight - dragBoxBar.offsetHeight - height;
					}
					dragBox.style.left = cx + 'px';
					dragBox.style.top = cy + 'px';
				}
			})
	
	
			document.addEventListener('mouseup', function (e) {
				if (e.clientY > window.innerWidth || e.clientY < 0 || e.clientX < 0 || e.clientX > window.innerHeight) {
					mouseupHandler();
				}
			});
	
			function mouseupHandler() {
				isMouseDown = false;
				document.body.classList.remove('no-select');
				injectedBox.classList.remove('pointer-events');
				dragBox.style.opacity = 1;
			}
		}
		dragbox();
		 const riscvRegNames = ${riscvRegNames};
		 const vscode = acquireVsCodeApi();
		function getMemRangeList() {
			return [{ from: 0x80200000, length: 16 }, { from: 0x80201000, length: 32 }];
		}
		function memRangeQuery() {
			vscode.postMessage({ memRangeQuery: getMemRangeList() });
		}
		function removeDebugFile() {
			vscode.postMessage({ removeDebugFile: true });
		}
		function setKernelInOutBreakpoints() {
			vscode.postMessage({ setKernelInOutBreakpoints: true });
		}
		function removeAllCliBreakpoints() {
			vscode.postMessage({ removeAllCliBreakpoints: true });
		}
		function disableCurrentSpaceBreakpoints() {//不是GDB的disable breakpoints
			vscode.postMessage({ disableCurrentSpaceBreakpoints: true });
		}
		function updateAllSpacesBreakpointsInfo() {
			vscode.postMessage({ updateAllSpacesBreakpointsInfo: true });
		}
		function navbar_change() {//导航栏切换
			var register = $(".navbar ul li :eq(0)");
			var memory = $(".navbar ul li :eq(1)");
			var breakpoints = $(".navbar ul li :eq(2)");
			register.click(function (can) {
				console.log("11")
				register.addClass('active');
				memory.removeClass('active');
				breakpoints.removeClass('active')
				$("#div_reg").css('display', 'block');
				$("#div_mem").css('display', 'none');
				$("#breakpointsInfo").css('display', 'none');
	
			});
			memory.click(function () {
				memory.addClass('active');
				register.removeClass('active');
				breakpoints.removeClass('active')
				$("#div_mem").css('display', 'block');
				$("#div_reg").css('display', 'none');
				$("#breakpointsInfo").css('display', 'none');
			})
			breakpoints.click(function () {
				breakpoints.addClass('active');
				register.removeClass('active');
				memory.removeClass('active')
				$("#breakpointsInfo").css('display', 'block');
				$("#div_mem").css('display', 'none');
				$("#div_reg").css('display', 'none');
				// flag = 0;
	
			})
		}
		navbar_change();
	
	
		window.addEventListener('message', event => {
			const message = event.data; // The JSON data our extension sent
			if (message.regValues) {
				$("#reg").html("");
				for (var i = 0; i < 33; i++) {
					$("#reg").append("<tr><td>" + riscvRegNames[message.regValues[i][0][1]] + "</td><td>" + message.regValues[i][1][1] + "</td></tr>");
				}
			}
			if (message.memValues) {
				let memValues = message.memValues;
				$("#mem").append("<tr><td>" + memValues.data + "</td><td>" + memValues.from + "</td><td>" + memValues.length + "</td></tr>");
			}
			if (message.kernelToUserBorder) {
				document.getElementById('privilege').innerHTML = 'U';
			}
			if (message.inKernel) {
				document.getElementById('privilege').innerHTML = 'S';
			}
			if (message.breakpointsInfo) {
				let info = JSON.parse(message.breakpointsInfo);
				document.getElementById('currentSpace').innerHTML = info.current;
				document.getElementById('spacesTable').innerHTML = "";
				document.getElementById('spacesTable').innerHTML += "<tr><th>Space</th><th>Path</th><th>breakpoints</th></tr>";
				for (let i = 0; i < info.spaces.length; i++) {
					for (let j = 0; j < info.spaces[i].setBreakpointsArguments.length; j++) {
						// let brkptStatus = "table-secondary";
						let brkptStatus = "active";
						if (info.spaces[i].name === info.current) {
							brkptStatus = "success";
						}
						document.getElementById('spacesTable').innerHTML += "<tr class=" + brkptStatus + "><th>" + info.spaces[i].name + "</th><th>" + info.spaces[i].setBreakpointsArguments[j].source.path + "</th><th>" + JSON.stringify(info.spaces[i].setBreakpointsArguments[j].breakpoints) + "</th></tr>"
					}
				}
	
	
			}
		});
	
	
	</script>
	
	</html>`;
}

// reset breakpoints in VSCode, Debug Adapter, GDB
function removeAllCliBreakpoints() {
	vscode.commands.executeCommand("workbench.debug.viewlet.action.removeAllBreakpoints"); //VSCode
	vscode.debug.activeDebugSession?.customRequest("removeAllCliBreakpoints"); //Debug Adapter, GDB
}

function getDebugPanelInfo() {
	const result = {
		registers: [{ number: "unknown", value: "loading" }],
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
