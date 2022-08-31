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
import { ValuesFormattingMode } from "./backend/backend";

export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
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
	valuesFormatting: ValuesFormattingMode;
	printCalls: boolean;
	showDevDebugOutput: boolean;
	qemuPath: string;
	qemuArgs: string[];
	userSpaceDebuggeeFiles: string[];
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
		response.body.supportsReadMemoryRequest = true;
		response.body.supportsWriteMemoryRequest = true;
		this.sendResponse(response);
	}

	protected launchRequest(
		response: DebugProtocol.LaunchResponse,
		args: LaunchRequestArguments
	): void {
		const converted_args = this.getQemuLaunchCmd(args);
		if (converted_args.length == 0) {
			this.sendErrorResponse(
				response,
				103,
				"`qemuPath` and `qemuArgs` property must be set in `launch.json`"
			);
			return;
		}

		this.runInTerminalRequest(
			{
				kind: "integrated",
				title: `CoreDebugger Ext Terminal #${NEXT_TERM_ID++}`,
				cwd: "",
				args: converted_args,
			},
			10,
			undefined
		);

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
		this.initialRunCommand = args.stopAtConnect ? RunCommand.NONE : RunCommand.CONTINUE;

		this.setValuesFormattingMode(args.valuesFormatting);
		this.miDebugger.printCalls = !!args.printCalls;
		this.miDebugger.debugOutput = !!args.showDevDebugOutput;
		this.stopAtEntry = args.stopAtEntry;

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
					this.sendErrorResponse(response, 102, `Failed to attach: ${err.toString()}`);
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
					this.sendErrorResponse(response, 101, `Failed to attach: ${err.toString()}`);
				}
			);
		}
	}

	// Add extra commands for source file path substitution in GDB-specific syntax
	protected setPathSubstitutions(substitutions: { [index: string]: string }): void {
		if (substitutions) {
			Object.keys(substitutions).forEach((source) => {
				this.miDebugger.extraCommands.push(
					'gdb-set substitute-path "' + escape(source) + '" "' + escape(substitutions[source]) + '"'
				);
			});
		}
	}

	private getQemuLaunchCmd(args: LaunchRequestArguments): string[] {
		if (!args.qemuArgs?.length || !args.qemuPath?.length) {
			return [];
		}
		let r = [args.qemuPath];
		r = r.concat(args.qemuArgs);
		return r;
	}
}

DebugSession.run(GDBDebugSession);
