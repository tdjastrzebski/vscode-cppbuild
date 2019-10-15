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
// TaskDetector class factored out

'use strict';

import * as vscode from 'vscode';
import { FolderDetector } from './FolderDetector';
import { ToolName } from 'cppbuild';

export class TaskDetector {
	private taskProvider: vscode.Disposable | undefined;
	private detectors: Map<string, FolderDetector> = new Map();

	constructor(private _computeTasks: (workspaceFolder: vscode.WorkspaceFolder) => Promise<vscode.Task[]>) {
	}

	public start(): void {
		let folders = vscode.workspace.workspaceFolders;
		if (folders) {
			this.updateWorkspaceFolders(folders, []);
		}
		vscode.workspace.onDidChangeWorkspaceFolders((event) => this.updateWorkspaceFolders(event.added, event.removed));
		vscode.workspace.onDidChangeConfiguration(this.updateConfiguration, this);
	}

	public dispose(): void {
		if (this.taskProvider) {
			this.taskProvider.dispose();
			this.taskProvider = undefined;
		}
		this.detectors.clear();
	}

	private updateWorkspaceFolders(added: readonly vscode.WorkspaceFolder[], removed: readonly vscode.WorkspaceFolder[]): void {
		for (const remove of removed) {
			const folderPath = remove.uri.toString();
			const detector = this.detectors.get(folderPath);
			if (detector) {
				detector.dispose();
				this.detectors.delete(folderPath);
			}
		}
		for (const add of added) {
			const folderPath = add.uri.toString();
			const detector = new FolderDetector(add, this._computeTasks);
			this.detectors.set(folderPath, detector);
			if (detector.isEnabled()) {
				detector.start();
			}
		}
		this.updateProvider();
	}

	private updateConfiguration(): void {
		for (const detector of this.detectors.values()) {
			detector.dispose();
			this.detectors.delete(detector.workspaceFolder.uri.toString());
		}
		const folders = vscode.workspace.workspaceFolders;
		if (folders) {
			for (const folder of folders) {
				const folderPath = folder.uri.toString();
				if (!this.detectors.has(folderPath)) {
					const detector = new FolderDetector(folder, this._computeTasks);
					this.detectors.set(folderPath, detector);
					if (detector.isEnabled()) {
						detector.start();
					}
				}
			}
		}
		this.updateProvider();
	}

	private updateProvider(): void {
		if (!this.taskProvider && this.detectors.size > 0) {
			const thisCapture = this;
			this.taskProvider = vscode.workspace.registerTaskProvider(ToolName, {
				provideTasks(): Promise<vscode.Task[]> {
					return thisCapture.getTasks();
				},
				resolveTask(_task: vscode.Task): Promise<vscode.Task | undefined> {
					//return thisCapture.getTask(_task);
					return new Promise<undefined>(() => { return undefined; }); // do not resolve tasks
				}
			});
		}
		else if (this.taskProvider && this.detectors.size === 0) {
			this.taskProvider.dispose();
			this.taskProvider = undefined;
		}
	}

	public getTasks(): Promise<vscode.Task[]> {
		const tasks = this.computeTasks();
		return tasks;
	}

	private async computeTasks(): Promise<vscode.Task[]> {
		if (this.detectors.size === 0) {
			return Promise.resolve([]);
		} else if (this.detectors.size === 1) {
			const detector: FolderDetector = this.detectors.values().next().value;
			const tasks = detector.getTasks();
			return tasks;
		} else {
			const promises: Promise<vscode.Task[]>[] = [];
			for (const detector of this.detectors.values()) {
				const tasks = detector.getTasks();
				promises.push(tasks.then((value) => value, () => []));
			}
			const values = await Promise.all(promises);
			const result_1: vscode.Task[] = [];
			for (const tasks_2 of values) {
				if (tasks_2 && tasks_2.length > 0) {
					result_1.push(...tasks_2);
				}
			}
			return result_1;
		}
	}

	/*
	public async getTask(task: vscode.Task): Promise<vscode.Task | undefined> {
		if (this.detectors.size === 0) {
			return undefined;
		} else if (this.detectors.size === 1) {
			return this.detectors.values().next().value.getTask(task);
		} else {
			if ((task.scope === vscode.TaskScope.Workspace) || (task.scope === vscode.TaskScope.Global)) {
				// Not supported, we don't have enough info to create the task.
				return undefined;
			} else if (task.scope) {
				const detector = this.detectors.get(task.scope.uri.toString());
				if (detector) {
					return detector.getTask(task);
				}
			}
			return undefined;
		}
	}
	*/
}
