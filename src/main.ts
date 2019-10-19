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

export const ExtensionName: string = "CPP Tools Build";
export const ToolName = cppt.ToolName;

let _taskDetector: TaskDetector;
let _channel: vscode.OutputChannel;

export function activate(_context: vscode.ExtensionContext): void {

	createInitialBuildFile().then((value) => {
		_taskDetector = new TaskDetector(computeTasks);
		_taskDetector.start();
	});
}

export function deactivate(): void {
	_taskDetector.dispose();
}

async function createInitialBuildFile(): Promise<boolean> {
	const folders = vscode.workspace.workspaceFolders;
	const rootFolder = folders![0];
	if (!rootFolder) return false;
	const rootPath = rootFolder.uri.scheme === 'file' ? rootFolder.uri.fsPath : undefined;
	if (!rootPath) return false;
	const buildStepsPath: string = path.join(rootPath, cppt.PropertiesFolder, cppt.BuildStepsFile);
	if (await cppt.checkFileExists(buildStepsPath)) return false;
	const propertiesPath: string = path.join(rootPath, cppt.PropertiesFolder, cppt.PropertiesFile);
	if (! await cppt.checkFileExists(propertiesPath)) return false;
	const cppConfig: cppt.ConfigurationJson | undefined = cppt.getJsonObject(propertiesPath);
	if (!cppConfig) return false;
	const bConfigs: cppt.BuildConfiguration[] = [];

	cppConfig.configurations.forEach(c => {
		let command: string;
		let cmd: string | undefined;
		const bSteps: cppt.BuildStep[] = [];
		const bTypes: cppt.BuildType[] = [];
		const problemMatchers: string[] = [];

		switch (c.intelliSenseMode) {
			case 'gcc-x64':
				cmd = 'g++';
			case 'clang-x64':
				cmd = cmd || 'clang++';
				bTypes.push({ name: 'debug', params: { buildTypeParams: '-O0 -g' } });
				bTypes.push({ name: 'release', params: { buildTypeParams: '-O2 -g0' } });
				command = cmd + ' -c -std=c++17 ${buildTypeParams} (-I[$${includePath}]) (-D$${defines}) (-include [$${forcedInclude}]) [${filePath}] -o [${outputDirectory}/${fileName}.o]';
				bSteps.push({ name: 'C++ Compile Sample Step', filePattern: '**/*.cpp', outputDirectory: "build/${buildTypeName}/${fileDirectory}", command: command });
				command = cmd + ' [$${filePath}] -o [build/${buildTypeName}/main.exe]';
				bSteps.push({ name: 'C++ Link Sample Step', fileList: 'build/${buildTypeName}/**/*.o', command: command });
				problemMatchers.push('$gcc');
				break;
			case 'msvc-x64':
				bSteps.push({ name: 'Test if \'ScopeCppSDK\' path variable is set.', command: 'cmd.exe /C \"echo %ScopeCppSDK%\"' });
				bTypes.push({ name: 'debug', params: { buildTypeParams: '/MDd /Od /RTCsu /Zi /Fd[build/${buildTypeName}/main.pdb]', linkTypeParams: '/DEBUG' } });
				bTypes.push({ name: 'release', params: { buildTypeParams: '/MD /Ox', linkTypeParams: '' } });
				command = 'cl.exe ${buildTypeParams} /nologo /EHs /GR /GF /W3 /EHsc /FS /c (/I[$${includePath}]) (/D\"$${defines}\") (/FI[$${forcedInclude}]) [${filePath}] /Fo[${outputDirectory}/${fileName}.o]';
				bSteps.push({ name: 'C++ Compile Sample Step', filePattern: '**/*.cpp', outputDirectory: "build/${buildTypeName}/${fileDirectory}", command: command });
				command = 'link.exe /NOLOGO ${linkTypeParams} [$${filePath}] /OUT:[build/${buildTypeName}/main.exe] /LIBPATH:[${env:ScopeCppSDK}/VC/lib] /LIBPATH:[${env:ScopeCppSDK}/SDK/lib]';
				bSteps.push({ name: 'C++ Link Sample Step', fileList: 'build/${buildTypeName}/**/*.o', command: command });
				problemMatchers.push('$msCompile');
				break;
			default:
				return;
		}

		const bConfig: cppt.BuildConfiguration = { name: c.name, buildTypes: bTypes, buildSteps: bSteps, problemMatchers: problemMatchers };
		bConfigs.push(bConfig);
	});

	const bc: cppt.BuildConfigurations = { version: 1, configurations: bConfigs };
	const text = JSON.stringify(bc, null, '\t');

	try {
		fs.writeFileSync(buildStepsPath, text);
	} catch (e) {
		logError(`Error writing ${buildStepsPath} file.\n${e.message}`);
	}
	return true;
}

async function computeTasks(workspaceFolder: vscode.WorkspaceFolder): Promise<vscode.Task[]> {
	const rootPath = workspaceFolder.uri.scheme === 'file' ? workspaceFolder.uri.fsPath : undefined;
	const tasks: vscode.Task[] = [];
	if (!rootPath) return tasks;

	const propertiesPath: string = path.join(rootPath, cppt.PropertiesFolder, cppt.PropertiesFile);
	const buildStepsPath: string = path.join(rootPath, cppt.PropertiesFolder, cppt.BuildStepsFile);
	let infos: cppt.BuildInfo[];

	try {
		infos = await cppt.getBuildInfos(propertiesPath, buildStepsPath);
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
			const task = buildTask(workspaceFolder, toolCommand, i.name, i.problemMatchers);
			tasks.push(task);
		} else {
			i.buildTypes.forEach(buildType => {
				const task = buildTask(workspaceFolder, toolCommand, i.name, i.problemMatchers, buildType);
				tasks.push(task);
			});
		}
	});

	return tasks;
}

function buildTask(rootFolder: vscode.WorkspaceFolder, cmd: string, configName: string, problemMatchers?: string[], buildType?: string): vscode.Task {
	const options: vscode.ShellExecutionOptions = { cwd: rootFolder.uri.fsPath };
	const args: string[] = [];
	cmd += ' "' + configName + '"' + (buildType ? ' "' + buildType + '"' : '');
	const execution = new vscode.ShellExecution(cmd, args, options);
	const kind: TaskDefinition = { type: 'shell' };
	const name = `${configName}${buildType ? ' - ' + buildType : ''}`;
	const task = new vscode.Task(kind, rootFolder, name, ToolName, execution);
	task.group = vscode.TaskGroup.Build; // this does not seem to work
	task.source = cppt.ToolName;
	// note: matcher needs to be specified, otherwise user has to select it from the list, task entry is created
	// and extension stops working in debug - tasks list appears empty, probably VS Code bug
	task.problemMatchers = problemMatchers || []; // FIXME: this does not seem to work
	return task;
}

function logError(message: string) {
	getOutputChannel().appendLine(message);
	showError();
}

function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Build Auto Detection');
	}
	return _channel;
}

function showError() {
	vscode.window.showWarningMessage('Problem finding build tasks. See the output for more information.', 'Go to output').then(() => {
		_channel.show(true);
	});
}
