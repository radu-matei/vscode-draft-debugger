/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { DraftDebugSession } from './draftDebug';
import * as Net from 'net';
/*
 * Set the following compile time flag to true if the
 * debug adapter should run inside the extension host.
 * Please note: the test suite does no longer work in this mode.
 */
const EMBED_DEBUG_ADAPTER = true;

export function activate(context: vscode.ExtensionContext) {

	// register a configuration provider for 'draft' debug type
	const provider = new DraftConfigurationProvider()
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('draft', provider));
	context.subscriptions.push(provider);

	draftWatch(context)
}

function draftWatch(context: vscode.ExtensionContext) {

	var d: vscode.DebugSession

	vscode.debug.onDidChangeActiveDebugSession(e => {
		if (e != undefined) {
			// keep a copy of the draft debug session
			if (e.name == "draft"){
				d = e
			}
		}
	})
	var onSave = vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
		const session = vscode.debug.activeDebugSession;
		// if there is a debug session and it is not draft when a file is saved
		if ((session!= undefined) && (session.name != "draft")) {
			// send a custom request to restart the Draft cycle
			d.customRequest("evaluate", {"draft-up-again": ""})
		}
	});
	context.subscriptions.push(onSave);
}

export function deactivate() {
	// nothing to do
}

class DraftConfigurationProvider implements vscode.DebugConfigurationProvider {

	private _server?: Net.Server;

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {

		if (EMBED_DEBUG_ADAPTER) {
			// start port listener on launch of first debug session
			if (!this._server) {

				// start listening on a random port
				this._server = Net.createServer(socket => {
					const session = new DraftDebugSession();
					session.setRunAsServer(true);
					session.start(<NodeJS.ReadableStream>socket, socket);
				}).listen(0);
			}

			// make VS Code connect to debug server instead of launching debug adapter
			config.debugServer = this._server.address().port;
		}

		return config;
	}

	dispose() {
		if (this._server) {
			this._server.close();
		}
	}
}
