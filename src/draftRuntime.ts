/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { exec, ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { OutputChannel } from 'vscode';

/**
 * Draft runtime
 */
export class DraftRuntime extends EventEmitter {

	constructor() {
		super();
	}

	public start() {

	}

	public async draftUpDebug() {

		let output = vscode.window.createOutputChannel("draft")
		output.show()

		promiseFromChildProcess(executeCmd('draft up', output)).then((result) => {
			promiseFromChildProcess(executeCmd('draft connect --dry-run', output)).then(async (result) => {
				// async process, we don't wait for it
				const term = vscode.window.createTerminal('draft connect', `bash`, ['-c', `draft connect ; bash`]);
				term.show(true);

				// we know there is a ready pod, this shoud be enough time for
				// the portforward stuff to create the connection
				// TODO - how can this be avoided? what happens if network is busy?
				await sleep(5000)
				vscode.window.showInformationMessage(`attaching debugger`)

				const debugConfiguration = {
					type: 'node',
					request: 'attach',
					name: 'NodeJS application',
					address: 'localhost',
					// TODO - make this configurable - part of draft.toml?
					port: 9229,
					localRoot: vscode.workspace.rootPath,
					remoteRoot: '/usr/src/app'
				};

				vscode.debug.startDebugging(undefined, debugConfiguration)
				vscode.debug.onDidTerminateDebugSession((e) => {
					term.dispose()
				})
			})
		})

	}
}

function executeCmd(cmd: string, output: OutputChannel): ChildProcess {
	// notify that cmd started
	console.log(`started ${cmd}`);
	vscode.window.showInformationMessage(`starting ${cmd}`)

	let proc = exec(cmd, { cwd: vscode.workspace.rootPath });

	// output data on the tab
	subscribeToDataEvent(proc.stdout, output)
	subscribeToDataEvent(proc.stderr, output)


	proc.on('exit', (code) => {
		vscode.window.showInformationMessage(`finished ${cmd}`)
		console.log(`finished ${cmd} with exit code ${code}`);
	})

	return proc
}

function promiseFromChildProcess(child) {
	return new Promise(function (resolve, reject) {
		child.addListener("error", reject);
		child.addListener("exit", resolve);
	});
}

function subscribeToDataEvent(readable: Readable, outputChannel: OutputChannel): void {
	readable.on('data', chunk => {
		const chunkAsString = typeof chunk === 'string' ? chunk : chunk.toString();
		outputChannel.append(chunkAsString);
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}
