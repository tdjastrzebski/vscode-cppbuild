/*---------------------------------------------------------------------------------------------
MIT License

Copyright (c) 2015 - present Microsoft Corporation

All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*--------------------------------------------------------------------------------------------*/

// Source: https://github.com/microsoft/vscode/blob/master/extensions/gulp/src/main.ts
// FolderDetector class factored out

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as cppt from 'cppbuild';

type AutoDetect = 'on' | 'off';

export class FolderDetector {
	private fileWatcher: vscode.FileSystemWatcher | undefined;
	private promise: Thenable<vscode.Task[]> | undefined;

	constructor(
		private _workspaceFolder: vscode.WorkspaceFolder,
		private _computeTasks: (workspaceFolder: vscode.WorkspaceFolder) => Promise<vscode.Task[]>) {
	}

	public get workspaceFolder(): vscode.WorkspaceFolder {
		return this._workspaceFolder;
	}

	public isEnabled(): boolean {
		return true; // TODO: consider implementing
		// return vscode.workspace.getConfiguration(ToolName, this._workspaceFolder.uri).get<AutoDetect>('autoDetect') === 'on';
	}

	public start(): void {
		let pattern = path.join(this._workspaceFolder.uri.fsPath, cppt.VscodeFolder, `{${cppt.PropertiesFile},${cppt.BuildStepsFile}}`);
		this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		this.fileWatcher.onDidChange(() => this.promise = undefined);
		this.fileWatcher.onDidCreate(() => this.promise = undefined);
		this.fileWatcher.onDidDelete(() => this.promise = undefined);
	}

	public async getTasks(): Promise<vscode.Task[]> {
		const enabled = this.isEnabled();
		if (enabled) {
			if (!this.promise) {
				this.promise = this._computeTasks(this._workspaceFolder);
			}
			return this.promise;
		} else {
			return [];
		}
	}

	/*
	public async getTask(_task: vscode.Task): Promise<vscode.Task | undefined> {
		const toolTask = (<any>_task.definition).task;
		if (toolTask) {
			let kind: BuildTaskDefinition = (<any>_task.definition);
			let options: vscode.ShellExecutionOptions = { cwd: this.workspaceFolder.uri.fsPath };
			let task = new vscode.Task(kind, this.workspaceFolder, toolTask, ToolName, new vscode.ShellExecution(await this._toolCommand, [toolTask], options));
			return task;
		}
		return undefined;
	}
	*/

	/* no need to support resolveTask()
	public async resolveTask(_task: vscode.Task): Promise<vscode.Task|undefined> {
		// resolve tasks defined in tasks.json
		// note: this did not work prior to vscode 1.37
		console.log(`resolving task: ${_task.name}`);
		const taskDefinition = _task.definition as TaskDefinition;
		const workspaceFolder: vscode.WorkspaceFolder = _task.scope as vscode.WorkspaceFolder;

		if (taskDefinition && workspaceFolder) {
			console.log(`creating task: ${_task.name}`);
			return this.getTask(_task);
		} else {
			console.log(`returning undefined`);
			return undefined;
		}
	}
	*/

	public dispose() {
		this.promise = undefined;
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
		}
	}
}
