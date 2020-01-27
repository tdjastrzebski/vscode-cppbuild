/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2019 Tomasz Jastrzębski. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import * as cppb from 'cppbuild';
import * as semver from 'semver';
import { TaskDefinition } from 'vscode';
import { TaskDetector } from './TaskDetector';
import { findToolCommand } from './vscode';

const ExtensionName: string = "Build++";
const MinToolVersion = '1.3.0';
const MinNodeVersion = '10.0.0';
let _taskDetector: TaskDetector;
let _channel: vscode.OutputChannel;

// TODO: test out: vscode.commands.executeCommand('cpptools.activeConfigName')
// and output build tasks relevant to the current config only

export function activate(_context: vscode.ExtensionContext): void {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders) return;
	const rootFolder = folders[0];
	if (!rootFolder) return;
	if (rootFolder.uri.scheme !== 'file') return;

	if (!isEnabled(rootFolder)) return;

	(async () => {
		const nodeVersion = await getToolVersion('node');

		if (!nodeVersion) {
			logError(`Install node.js version ${MinNodeVersion} or newer.`);
		} else if (semver.gt(MinNodeVersion, nodeVersion)) {
			logError(`Update node.js to version ${MinNodeVersion} or newer.`);
		} else {
			const cppbuildVersion = await getToolVersion(cppb.ToolName);

			if (!cppbuildVersion) {
				logError(`Install CppBuild: npm install ${cppb.ToolName} -g`);
			} else if (semver.gt(MinToolVersion, cppbuildVersion)) {
				logError(`The minimum version of ${cppb.ToolName} is ${MinToolVersion} and you have ${cppbuildVersion}.\nUpdate it now: npm install ${cppb.ToolName} -g`);
			}
		}

		const buildStepsPath = getBuildStepsPath(rootFolder);
		if (!buildStepsPath) return;

		if (!await cppb.checkFileExists(buildStepsPath)) {
			// build file does not exits yet
			let value = await showDialog(rootFolder);

			if (value === true) {
				// create build file
				const commands = await vscode.commands.getCommands(true);

				if (commands.indexOf("workbench.action.problems.focus") >= 0) {
					vscode.commands.executeCommand("workbench.action.problems.focus");
				}

				if (await createInitialBuildFile(rootFolder)) {
					const document = await vscode.workspace.openTextDocument(vscode.Uri.file(buildStepsPath));
					vscode.window.showTextDocument(document);
				}
			} else if (value === false) {
				// disable this extension
				await setEnabled(rootFolder, false);
				return; // do not activate
			}
		}

		_taskDetector = new TaskDetector(computeTasks);
		_taskDetector.start();
	})();
}

export function deactivate(): void {
	if (_taskDetector) _taskDetector.dispose();
}

async function showDialog(rootFolder: vscode.WorkspaceFolder): Promise<boolean | undefined> {
	const fallbackMsg = 'Configure your Build++ steps';
	const configJSON: string = 'Configure (JSON)';
	//const configUI: string = 'Configure (UI)';
	const dontShowAgain: string = "Don't Show Again";
	const value = await vscode.window.showInformationMessage(fallbackMsg, configJSON, dontShowAgain);

	switch (value) {
		case configJSON:
			return true;
		case dontShowAgain:
			return false;
		default:
			return undefined;
	}
}

function getVscodeFolderPath(rootFolder: vscode.WorkspaceFolder): string | undefined {
	if (!rootFolder) return undefined;
	const rootPath = rootFolder.uri.scheme === 'file' ? rootFolder.uri.fsPath : undefined;
	if (!rootPath) return undefined;
	const vscodeFolderPath = path.join(rootPath, cppb.VscodeFolder);
	return vscodeFolderPath;
}

function getBuildStepsPath(rootFolder: vscode.WorkspaceFolder): string | undefined {
	const vscodeFolderPath = getVscodeFolderPath(rootFolder);
	if (!vscodeFolderPath) return undefined;
	const buildStepsPath: string = path.join(vscodeFolderPath, cppb.BuildStepsFile);
	return buildStepsPath;
}

function logError(message: string) {
	getOutputChannel().appendLine(message);
	showError();
}

function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel(`${ExtensionName} messages`);
	}
	return _channel;
}

function showError() {
	vscode.window.showErrorMessage(`${ExtensionName} problem detected`, 'Go to output for details').then(() => {
		_channel.show(true);
	});
}

async function createInitialBuildFile(rootFolder: vscode.WorkspaceFolder): Promise<boolean> {
	const vscodeFolderPath = getVscodeFolderPath(rootFolder);
	if (!vscodeFolderPath) return false;
	const buildStepsPath = getBuildStepsPath(rootFolder);
	if (!buildStepsPath) return false;
	if (await cppb.checkFileExists(buildStepsPath)) return false;

	const propertiesPath: string = path.join(vscodeFolderPath, cppb.PropertiesFile);
	let cppConfig: cppb.ConfigurationJson | undefined;

	if (await cppb.checkFileExists(propertiesPath)) {
		cppConfig = cppb.getJsonObject(propertiesPath);
	}

	const stringToEnumValue = <ET, T>(enumObj: ET, str: string): T => (enumObj as any)[Object.keys(enumObj).filter(k => (enumObj as any)[k] === str)[0]];

	if (cppConfig) {
		for (const config of cppConfig.configurations) {
			if (config.intelliSenseMode === undefined) continue; // skip this config
			const compilerType = stringToEnumValue<typeof cppb.CompilerType, cppb.CompilerType>(cppb.CompilerType, config.intelliSenseMode); // convert string enum name to enum value
			switch (compilerType) {
				case cppb.CompilerType.gcc:
				case cppb.CompilerType.clang:
				case cppb.CompilerType.msvc:
					await cppb.setSampleBuildConfig(buildStepsPath, config.name, compilerType);
					break;
				default:
					continue; // unsupported compiler type - skip this config
			}

		}
	} else {
		await cppb.setSampleBuildConfig(buildStepsPath, 'gcc', cppb.CompilerType.gcc);
		await cppb.setSampleBuildConfig(buildStepsPath, 'clang', cppb.CompilerType.clang);
		await cppb.setSampleBuildConfig(buildStepsPath, 'msvc', cppb.CompilerType.msvc);
	}
	return true;
}

async function getToolVersion(toolName: string): Promise<string | undefined> {
	try {
		const result = await cppb.execCmd(`${toolName} --version`, {});
		if (result.error) return undefined;
		let version = result.stdout.split(/[\r\n]/).filter(line => !!line)[0];
		if (version.substr(0, 1) == 'v') version = version.substr(1);
		return version;
	} catch {
		return undefined;
	}
}

function isEnabled(rootFolder: vscode.WorkspaceFolder): boolean {
	// https://code.visualstudio.com/api/references/vscode-api
	let result = vscode.workspace.getConfiguration(cppb.ToolName, rootFolder.uri).get<boolean>('isEnabled', true) === true;
	return result;
}

async function setEnabled(rootFolder: vscode.WorkspaceFolder, value: boolean) {
	// https://code.visualstudio.com/api/references/vscode-api
	await vscode.workspace.getConfiguration(cppb.ToolName, rootFolder.uri).update('isEnabled', value, false);
}

async function computeTasks(workspaceFolder: vscode.WorkspaceFolder): Promise<vscode.Task[]> {
	const rootPath = workspaceFolder.uri.scheme === 'file' ? workspaceFolder.uri.fsPath : undefined;
	const tasks: vscode.Task[] = [];
	if (!rootPath) return tasks;
	const buildStepsPath = getBuildStepsPath(workspaceFolder);
	if (!buildStepsPath) return tasks;
	const vscodeFolderPath = getVscodeFolderPath(workspaceFolder);
	if (!vscodeFolderPath) return tasks;
	let propertiesPath: string | undefined = path.join(vscodeFolderPath, cppb.PropertiesFile);
	let infos: cppb.BuildInfo[];

	if (! await cppb.checkFileExists(propertiesPath)) propertiesPath = undefined;

	try {
		infos = await cppb.getBuildInfos(buildStepsPath, propertiesPath);
	} catch (e) {
		const error = e as Error;
		if (error) logError(error.message);
		return tasks;
	}

	if (!infos) return tasks;

	const toolCommand: string = await findToolCommand(rootPath);

	// create tasks
	infos.forEach(i => {
		// for each config
		if (i.buildTypes === undefined || i.buildTypes.length == 0) {
			// no build types defined for config
			const task = buildTask(workspaceFolder, toolCommand, i.name, buildStepsPath, propertiesPath, i.problemMatchers);
			tasks.push(task);
		} else {
			i.buildTypes.forEach(buildType => {
				const task = buildTask(workspaceFolder, toolCommand, i.name, buildStepsPath, propertiesPath, i.problemMatchers, buildType);
				tasks.push(task);
			});
		}
	});

	return tasks;
}

function buildTask(rootFolder: vscode.WorkspaceFolder, cmd: string, configName: string, buildStepsPath: string, propertiesPath?: string, problemMatchers?: string[], buildType?: string): vscode.Task {
	const options: vscode.ShellExecutionOptions = { cwd: rootFolder.uri.fsPath };
	const args: string[] = [];
	cmd += ` "${configName}" ${buildType ? `"${buildType}"` : ''} -w "${rootFolder.uri.fsPath}" ${propertiesPath ? "" : "-p"}`;
	const execution = new vscode.ShellExecution(cmd, args, options);
	const kind: TaskDefinition = { type: 'shell' };
	const name = `${configName}${buildType ? ' - ' + buildType : ''}`;
	const task = new vscode.Task(kind, rootFolder, name, cppb.ToolName, execution);
	task.group = vscode.TaskGroup.Build; // this does not seem to work
	task.source = cppb.ToolName;
	// note: matcher needs to be specified, otherwise user has to select it from the list, task entry is created
	// and extension stops working in debug - tasks list appears empty, probably it is VS Code bug
	task.problemMatchers = problemMatchers || [];
	return task;
}
