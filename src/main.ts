/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2019 Tomasz Jastrzębski. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as cppt from 'cppbuild';
import { TaskDefinition } from 'vscode';
import { TaskDetector } from './TaskDetector';
import { findToolCommand } from './vscode';
import * as semver from 'semver';

const ExtensionName: string = "Build++";
const MinToolVersion = '1.2.8';
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
			const cppbuildVersion = await getToolVersion(cppt.ToolName);

			if (!cppbuildVersion) {
				logError(`Install CppBuild: npm install ${cppt.ToolName} -g`);
			} else if (semver.gt(MinToolVersion, cppbuildVersion)) {
				logError(`The minimum version of ${cppt.ToolName} is ${MinToolVersion} and you have ${cppbuildVersion}.\nUpdate it now: npm install ${cppt.ToolName} -g`);
			}
		}

		const buildStepsPath = getBuildStepsPath(rootFolder);
		if (!buildStepsPath) return;

		if (!await cppt.checkFileExists(buildStepsPath)) {
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
	const vscodeFolderPath = path.join(rootPath, cppt.VscodeFolder);
	return vscodeFolderPath;
}

function getBuildStepsPath(rootFolder: vscode.WorkspaceFolder): string | undefined {
	const vscodeFolderPath = getVscodeFolderPath(rootFolder);
	if (!vscodeFolderPath) return undefined;
	const buildStepsPath: string = path.join(vscodeFolderPath, cppt.BuildStepsFile);
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
	if (await cppt.checkFileExists(buildStepsPath)) return false;

	const propertiesPath: string = path.join(vscodeFolderPath, cppt.PropertiesFile);
	let cppConfig: cppt.ConfigurationJson | undefined;

	if (await cppt.checkFileExists(propertiesPath)) {
		cppConfig = cppt.getJsonObject(propertiesPath);
	}

	const bConfigs: cppt.BuildConfiguration[] = [];

	if (cppConfig) {
		cppConfig.configurations.forEach(c => {
			let command: string;
			let cmd: string | undefined;
			const bSteps: cppt.BuildStep[] = [];
			const bTypes: cppt.BuildType[] = [];
			const problemMatchers: string[] = [];
			let cParams: { [key: string]: string | string[] } | undefined;

			switch (c.intelliSenseMode) {
				case 'gcc-x64':
					cmd = 'g++';
				case 'clang-x64':
					cmd = cmd || 'clang++';
					bTypes.push({ name: 'debug', params: { buildTypeParams: '-O0 -g' } });
					bTypes.push({ name: 'release', params: { buildTypeParams: '-O2 -g0' } });
					command = cmd + ' -c -std=c++17 ${buildTypeParams} (-I[$${includePath}]) (-D$${defines}) (-include [$${forcedInclude}]) [${filePath}] -o [${outputFile}]';
					bSteps.push({ name: 'C++ Compile Sample Step', filePattern: '**/*.cpp', outputFile: "${buildDir}/${buildTypeName}/${fileDirectory}/${fileName}.o", command: command });
					command = cmd + ' [$${filePath}] -o [${buildDir}/${buildTypeName}/main.exe]';
					bSteps.push({ name: 'C++ Link Sample Step', fileList: '${buildDir}/${buildTypeName}/**/*.o', command: command });
					problemMatchers.push('$gcc');
					break;
				case 'msvc-x64':
					bTypes.push({ name: 'debug', params: { buildTypeParams: '/MDd /Od /RTCsu /Zi /Fd[${buildDir}/${buildTypeName}/main.pdb]', linkTypeParams: '/DEBUG' } });
					bTypes.push({ name: 'release', params: { buildTypeParams: '/MD /Ox', linkTypeParams: '' } });
					command = 'cl.exe ${buildTypeParams} /nologo /EHs /GR /GF /W3 /EHsc /FS /c (/I[$${includePath}]) (/D\"$${defines}\") (/FI[$${forcedInclude}]) [${filePath}] /Fo[${outputFile}]';
					bSteps.push({ name: 'C++ Compile Sample Step', filePattern: '**/*.cpp', outputFile: "${buildDir}/${buildTypeName}/${fileDirectory}/${fileName}.o", command: command });
					command = 'link.exe /NOLOGO ${linkTypeParams} [$${filePath}] /OUT:[${buildDir}/${buildTypeName}/main.exe] /LIBPATH:[${ScopeCppSDK}/VC/lib] /LIBPATH:[${ScopeCppSDK}/SDK/lib]';
					bSteps.push({ name: 'C++ Link Sample Step', fileList: '${buildDir}/${buildTypeName}/**/*.o', command: command });
					problemMatchers.push('$msCompile');
					cParams = { ScopeCppSDK: "C:/Program Files (x86)/Microsoft Visual Studio/2019/Enterprise/SDK/ScopeCppSDK" };
					break;
				default:
					return;
			}
			const bConfig: cppt.BuildConfiguration = { name: c.name, params: cParams, buildTypes: bTypes, buildSteps: bSteps, problemMatchers: problemMatchers };
			bConfigs.push(bConfig);
		});
	} else {
		let command: string;
		const bSteps: cppt.BuildStep[] = [];
		const bTypes: cppt.BuildType[] = [];
		const problemMatchers: string[] = [];
		let cParams: { [key: string]: string | string[] } | undefined;

		bTypes.push({ name: 'debug', params: { buildTypeParams: '-O0 -g', defines: ["_DEBUG"] } });
		bTypes.push({ name: 'release', params: { buildTypeParams: '-O2 -g0', defines: [] } });
		command = 'g++ -c -std=c++17 ${buildTypeParams} (-D$${defines}) [${filePath}] -o [${outputFile}]';
		bSteps.push({ name: 'C++ Compile Sample Step', filePattern: '**/*.cpp', outputFile: "${buildDir}/${buildTypeName}/${fileDirectory}/${fileName}.o", command: command });
		command = 'g++ [$${filePath}] -o [${buildDir}/${buildTypeName}/main.exe]';
		bSteps.push({ name: 'C++ Link Sample Step', fileList: '${buildDir}/${buildTypeName}/**/*.o', command: command });

		const bConfig: cppt.BuildConfiguration = { name: "gcc", params: cParams, buildTypes: bTypes, buildSteps: bSteps, problemMatchers: problemMatchers };
		bConfigs.push(bConfig);
		problemMatchers.push('$gcc');
	}

	const bc: cppt.BuildConfigurations = { version: 1, params: { buildDir: "build/${configName}" }, configurations: bConfigs };
	const text = JSON.stringify(bc, null, '\t');

	if (!await cppt.checkDirectoryExists(vscodeFolderPath)) {
		try {
			await cppt.makeDirectory(vscodeFolderPath, { recursive: true });
		} catch (e) {
			logError(`Error creating ${vscodeFolderPath} folder.\n${e.message}`);
			return false;
		}
	}

	try {
		fs.writeFileSync(buildStepsPath, text);
	} catch (e) {
		logError(`Error writing ${buildStepsPath} file.\n${e.message}`);
		return false;
	}

	return true;
}

async function getToolVersion(toolName: string): Promise<string | undefined> {
	try {
		const result = await cppt.execCmd(`${toolName} --version`, {});
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
	let result = vscode.workspace.getConfiguration(cppt.ToolName, rootFolder.uri).get<boolean>('isEnabled', true) === true;
	return result;
}

async function setEnabled(rootFolder: vscode.WorkspaceFolder, value: boolean) {
	// https://code.visualstudio.com/api/references/vscode-api
	await vscode.workspace.getConfiguration(cppt.ToolName, rootFolder.uri).update('isEnabled', value, false);
}

async function computeTasks(workspaceFolder: vscode.WorkspaceFolder): Promise<vscode.Task[]> {
	const rootPath = workspaceFolder.uri.scheme === 'file' ? workspaceFolder.uri.fsPath : undefined;
	const tasks: vscode.Task[] = [];
	if (!rootPath) return tasks;
	const buildStepsPath = getBuildStepsPath(workspaceFolder);
	if (!buildStepsPath) return tasks;
	const vscodeFolderPath = getVscodeFolderPath(workspaceFolder);
	if (!vscodeFolderPath) return tasks;
	let propertiesPath: string | undefined = path.join(vscodeFolderPath, cppt.PropertiesFile);
	let infos: cppt.BuildInfo[];

	if (! await cppt.checkFileExists(propertiesPath)) propertiesPath = undefined;

	try {
		infos = await cppt.getBuildInfos(buildStepsPath, propertiesPath);
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
	const task = new vscode.Task(kind, rootFolder, name, cppt.ToolName, execution);
	task.group = vscode.TaskGroup.Build; // this does not seem to work
	task.source = cppt.ToolName;
	// note: matcher needs to be specified, otherwise user has to select it from the list, task entry is created
	// and extension stops working in debug - tasks list appears empty, probably it is VS Code bug
	task.problemMatchers = problemMatchers || []; // FIXME: this does not seem to work
	return task;
}
