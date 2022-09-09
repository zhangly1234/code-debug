import * as vscode from "vscode";
import * as os from "os";

export function activate(context: vscode.ExtensionContext) {
	vscode.debug.onDidStartDebugSession((e: vscode.DebugSession) => {
		vscode.commands.executeCommand("core-debugger.startPanel"); //当启动调试会话时
	});

	context.subscriptions.push(
		vscode.commands.registerCommand("code-debug.examineMemoryLocation", examineMemory)
	);

	//=========================================================================================
	const kernelInOutBreakpointArgs = 1;
	const userDebugFile = "initproc"; //可以修改为其它用户程序名，如matrix
	//========================================================================================

	const removeDebugFileCmd = vscode.commands.registerCommand("code-debug.removeDebugFile", () => {
		// 自定义请求.customRequest函数见/src/mibase.ts
		vscode.debug.activeDebugSession?.customRequest("removeDebugFile", {
			debugFilepath:
				os.homedir() + "/rCore-Tutorial-v3/user/target/riscv64gc-unknown-none-elf/release/initproc",
		});
		// 弹出窗口
		vscode.window.showInformationMessage("symbol file `initproc` removed");
	});

	const setKernelInOutBreakpointsCmd = vscode.commands.registerCommand(
		"code-debug.setKernelInOutBreakpoints",
		() => {
			vscode.debug.activeDebugSession?.customRequest("setKernelInOutBreakpoints");
			vscode.window.showInformationMessage("Kernel In Out Breakpoints Set");
		}
	);

	const removeAllCliBreakpointsCmd = vscode.commands.registerCommand(
		"code-debug.removeAllCliBreakpoints",
		() => {
			removeAllCliBreakpoints();
			vscode.window.showInformationMessage("All breakpoints including hidden ones are removed.");
		}
	);

	const disableCurrentSpaceBreakpointsCmd = vscode.commands.registerCommand(
		"code-debug.disableCurrentSpaceBreakpoints",
		() => {
			vscode.window.showInformationMessage("disableCurrentSpaceBreakpoints received");
			vscode.debug.activeDebugSession?.customRequest("disableCurrentSpaceBreakpoints");
		}
	);

	const updateAllSpacesBreakpointsInfoCmd = vscode.commands.registerCommand(
		"updateAllSpacesBreakpointsInfo",
		() => {
			vscode.debug.activeDebugSession?.customRequest("listBreakpoints");
		}
	);
	context.subscriptions.push(
		removeDebugFileCmd,
		setKernelInOutBreakpointsCmd,
		removeAllCliBreakpointsCmd,
		disableCurrentSpaceBreakpointsCmd,
		updateAllSpacesBreakpointsInfoCmd
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
							//更新WebView中的断点信息
							vscode.debug.activeDebugSession?.customRequest("listBreakpoints");
						} //处理自定义事件
						else if (message.event === "eventTest") {
							//console.log("Extension Received eventTest");
						} else if (message.event === "kernelToUserBorder") {
							//到达内核态->用户态的边界
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
							// TODO@werifu: show User space
							vscode.window.showInformationMessage(
								"All breakpoints removed. Symbol file " +
									userDebugFile +
									" added. Now you can set user program breakpoints.  line 13 println!(\"aaaaa... recommemded if it's initproc.rs"
							);
							console.log("/////////////////////////kernelToUserBorder///////////////////");
						}
						//当前在内核态
						else if (message.event === "inKernel") {
							// TODO@werifu: show Kernel space
							//removeAllCliBreakpoints();
							vscode.window.showInformationMessage("switched to kernel breakpoints");
							console.log("/////////////////////////INKERNEL///////////////////");
						} else if (message.event === "info") {
							console.log("//////////////INFO///////////");
							console.log(message.body);
						} else if (message.event === "showInformationMessage") {
							vscode.window.showInformationMessage(message.body);
						} else if (message.event === "showErrorMessage") {
							vscode.window.showErrorMessage(message.body);
						} else if (message.event === "listBreakpoints") {
							vscode.window.showInformationMessage("断点信息表格已经更新");
						}
					}
				},
			};
		},
	});
}

function examineMemory() {
	vscode.window
		.showInputBox({
			placeHolder: "Memory Location Reference",
			validateInput: () => "",
		})
		.then((ref_addr) => {
			const x = getUriForDebugMemory(vscode.debug.activeDebugSession?.id, ref_addr, {
				fromOffset: 0x00,
				toOffset: 0x2000,
			});
			const y = vscode.Uri.parse(x);
			vscode.commands.executeCommand("vscode.openWith", y, "hexEditor.hexedit");
		});
}

// reset breakpoints in VSCode, Debug Adapter, GDB
function removeAllCliBreakpoints() {
	vscode.commands.executeCommand("workbench.debug.viewlet.action.removeAllBreakpoints"); //VSCode
	vscode.debug.activeDebugSession?.customRequest("removeAllCliBreakpoints"); //Debug Adapter, GDB
}

export const getUriForDebugMemory = (
	sessionId: string,
	memoryReference: string,
	range: { fromOffset: number; toOffset: number },
	displayName = "memory"
) => {
	return (
		"vscode-debug-memory://" +
		sessionId +
		"/" +
		encodeURIComponent(memoryReference) +
		`/${encodeURIComponent(displayName)}.bin` +
		(range ? `?range=${range.fromOffset}:${range.toOffset}` : "")
	);
};
