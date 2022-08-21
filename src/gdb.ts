import { MI2DebugSession, RunCommand } from "./mibase";
import {
	DebugSession,
	InitializedEvent,
	TerminatedEvent,
	StoppedEvent,
	OutputEvent,
	Thread,
	StackFrame,
	Scope,
	Source,
	Handles,
} from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { MI2, escape } from "./backend/mi2/mi2";
import { SSHArguments, ValuesFormattingMode } from "./backend/backend";

export interface LaunchRequestArguments
	extends DebugProtocol.LaunchRequestArguments {
	cwd: string;
	target: string;
	gdbpath: string;
	env: any;
	debugger_args: string[];
	pathSubstitutions: { [index: string]: string };
	arguments: string;
	terminal: string;
	executable: string;
	remote: boolean;
	autorun: string[];
	stopAtConnect: boolean;
	stopAtEntry: boolean | string;
	ssh: SSHArguments;
	valuesFormatting: ValuesFormattingMode;
	printCalls: boolean;
	showDevDebugOutput: boolean;
	qemuPath: string,
	qemuArgs: string[],
	userSpaceDebuggeeFiles: string[],
}

export interface AttachRequestArguments
	extends DebugProtocol.AttachRequestArguments {
	cwd: string;
	target: string;
	gdbpath: string;
	env: any;
	debugger_args: string[];
	pathSubstitutions: { [index: string]: string };
	executable: string;
	remote: boolean;
	autorun: string[];
	stopAtConnect: boolean;
	stopAtEntry: boolean | string;
	ssh: SSHArguments;
	valuesFormatting: ValuesFormattingMode;
	printCalls: boolean;
	showDevDebugOutput: boolean;
}

let NEXT_TERM_ID = 1;
export class GDBDebugSession extends MI2DebugSession {
	protected initializeRequest(
		response: DebugProtocol.InitializeResponse,
		args: DebugProtocol.InitializeRequestArguments
	): void {
		response.body.supportsGotoTargetsRequest = true;
		response.body.supportsHitConditionalBreakpoints = true;
		response.body.supportsConfigurationDoneRequest = true;
		response.body.supportsConditionalBreakpoints = true;
		response.body.supportsFunctionBreakpoints = true;
		response.body.supportsEvaluateForHovers = true;
		response.body.supportsSetVariable = true;
		response.body.supportsStepBack = true;
		this.sendResponse(response);
	}

	protected launchRequest(
		response: DebugProtocol.LaunchResponse,
		args: LaunchRequestArguments
	): void {

		const converted_args = this.getQemuLaunchCmd(args);
		if (converted_args.length == 0) {
			this.sendErrorResponse(response, 103, "`qemuPath` and `qemuArgs` property must be set in `launch.json`");
			return;
		}

		this.runInTerminalRequest({
			kind: 'integrated',
			title: `CoreDebugger Ext Terminal #${NEXT_TERM_ID++}`,
			cwd: '',
			args: converted_args,
		}, 10, undefined);

		this.miDebugger = new MI2(
			args.gdbpath || "gdb",
			["-q", "--interpreter=mi2"],
			args.debugger_args,
			args.env
		);
		this.setPathSubstitutions(args.pathSubstitutions);
		this.initDebugger();
		this.quit = false;
		this.attached = !args.remote;
		this.initialRunCommand = args.stopAtConnect
			? RunCommand.NONE
			: RunCommand.CONTINUE;
		this.isSSH = false;
		this.setValuesFormattingMode(args.valuesFormatting);
		this.miDebugger.printCalls = !!args.printCalls;
		this.miDebugger.debugOutput = !!args.showDevDebugOutput;
		this.stopAtEntry = args.stopAtEntry;
		if (args.ssh !== undefined) {
			if (args.ssh.forwardX11 === undefined) args.ssh.forwardX11 = true;
			if (args.ssh.port === undefined) args.ssh.port = 22;
			if (args.ssh.x11port === undefined) args.ssh.x11port = 6000;
			if (args.ssh.x11host === undefined) args.ssh.x11host = "localhost";
			if (args.ssh.remotex11screen === undefined) args.ssh.remotex11screen = 0;
			this.isSSH = true;
			this.setSourceFileMap(args.ssh.sourceFileMap, args.ssh.cwd, args.cwd);
			this.miDebugger
				.ssh(args.ssh, args.ssh.cwd, args.target, "", undefined, true)
				.then(
					() => {
						if (args.autorun)
							args.autorun.forEach((command) => {
								this.miDebugger.sendUserInput(command);
							});
						this.sendResponse(response);
					},
					(err) => {
						this.sendErrorResponse(
							response,
							102,
							`Failed to SSH: ${err.toString()}`
						);
					}
				);
		} else {
			if (args.remote) {
				this.miDebugger.connect(args.cwd, args.executable, args.target).then(
					() => {
						if (args.autorun)
							args.autorun.forEach((command) => {
								this.miDebugger.sendUserInput(command);
							});
						this.sendResponse(response);
					},
					(err) => {
						this.sendErrorResponse(
							response,
							102,
							`Failed to attach: ${err.toString()}`
						);
					}
				);
			} else {
				this.miDebugger.attach(args.cwd, args.executable, args.target).then(
					() => {
						if (args.autorun)
							args.autorun.forEach((command) => {
								this.miDebugger.sendUserInput(command);
							});
						this.sendResponse(response);
					},
					(err) => {
						this.sendErrorResponse(
							response,
							101,
							`Failed to attach: ${err.toString()}`
						);
					}
				);
			}
		}
	}

	protected attachRequest(
		response: DebugProtocol.AttachResponse,
		args: AttachRequestArguments
	): void {
		this.miDebugger = new MI2(
			args.gdbpath || "gdb",
			["-q", "--interpreter=mi2"],
			args.debugger_args,
			args.env
		);
		this.setPathSubstitutions(args.pathSubstitutions);
		this.initDebugger();
		this.quit = false;
		this.attached = !args.remote;
		this.initialRunCommand = args.stopAtConnect
			? RunCommand.NONE
			: RunCommand.CONTINUE;
		this.isSSH = false;
		this.setValuesFormattingMode(args.valuesFormatting);
		this.miDebugger.printCalls = !!args.printCalls;
		this.miDebugger.debugOutput = !!args.showDevDebugOutput;
		this.stopAtEntry = args.stopAtEntry;
		if (args.ssh !== undefined) {
			if (args.ssh.forwardX11 === undefined) args.ssh.forwardX11 = true;
			if (args.ssh.port === undefined) args.ssh.port = 22;
			if (args.ssh.x11port === undefined) args.ssh.x11port = 6000;
			if (args.ssh.x11host === undefined) args.ssh.x11host = "localhost";
			if (args.ssh.remotex11screen === undefined) args.ssh.remotex11screen = 0;
			this.isSSH = true;
			this.setSourceFileMap(args.ssh.sourceFileMap, args.ssh.cwd, args.cwd);
			this.miDebugger
				.ssh(args.ssh, args.ssh.cwd, args.target, "", undefined, true)
				.then(
					() => {
						if (args.autorun)
							args.autorun.forEach((command) => {
								this.miDebugger.sendUserInput(command);
							});
						this.sendResponse(response);
					},
					(err) => {
						this.sendErrorResponse(
							response,
							102,
							`Failed to SSH: ${err.toString()}`
						);
					}
				);
		} else {
			if (args.remote) {
				this.miDebugger.connect(args.cwd, args.executable, args.target).then(
					() => {
						if (args.autorun)
							args.autorun.forEach((command) => {
								this.miDebugger.sendUserInput(command);
							});
						this.sendResponse(response);
					},
					(err) => {
						this.sendErrorResponse(
							response,
							102,
							`Failed to attach: ${err.toString()}`
						);
					}
				);
			} else {
				this.miDebugger.attach(args.cwd, args.executable, args.target).then(
					() => {
						if (args.autorun)
							args.autorun.forEach((command) => {
								this.miDebugger.sendUserInput(command);
							});
						this.sendResponse(response);
					},
					(err) => {
						this.sendErrorResponse(
							response,
							101,
							`Failed to attach: ${err.toString()}`
						);
					}
				);
			}
		}
	}

	// Add extra commands for source file path substitution in GDB-specific syntax
	protected setPathSubstitutions(substitutions: {
		[index: string]: string;
	}): void {
		if (substitutions) {
			Object.keys(substitutions).forEach((source) => {
				this.miDebugger.extraCommands.push(
					'gdb-set substitute-path "' +
						escape(source) +
						'" "' +
						escape(substitutions[source]) +
						'"'
				);
			});
		}
	}


	private getQemuLaunchCmd(args: LaunchRequestArguments): string[] {
		if (!args.qemuArgs?.length || !args.qemuPath?.length) {
			return [];
		}
		let r = [
			args.qemuPath
		];
		r = r.concat(args.qemuArgs);
		return r;
	}

}

DebugSession.run(GDBDebugSession);
