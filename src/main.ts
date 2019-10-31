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
const MinCppBuildVersion = '1.2.0';

let _taskDetector: TaskDetector;
let _channel: vscode.OutputChannel;
let _cppBuildVersion: string | undefined;

export function activate(_context: vscode.ExtensionContext): void {
	getCppBuildVersion().then((value) => {
		_cppBuildVersion = value;

		if (!_cppBuildVersion) {
			logError(`Install CppBuild: nmp install ${cppt.ToolName} -g`);
			return;
		} else {
			if (semver.gt(MinCppBuildVersion, _cppBuildVersion)) {
				logError(`The minimum version of ${cppt.ToolName} is ${MinCppBuildVersion} and you have ${_cppBuildVersion}.\nUpdate it now: npm install -g ${cppt.ToolName}`);
			}
		}
	}).finally(() => {
		createInitialBuildFile().then((value) => {
			_taskDetector = new TaskDetector(computeTasks);
			_taskDetector.start();
		});
	});
}

export function deactivate(): void {
	_taskDetector.dispose();
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

async function createInitialBuildFile(): Promise<boolean> {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders) return false;
	const rootFolder = folders[0];
	if (!rootFolder) return false;
	const rootPath = rootFolder.uri.scheme === 'file' ? rootFolder.uri.fsPath : undefined;
	if (!rootPath) return false;
	const buildStepsPath: string = path.join(rootPath, cppt.PropertiesFolder, cppt.BuildStepsFile);
	if (await cppt.checkFileExists(buildStepsPath)) return false;

	const propertiesPath: string = path.join(rootPath, cppt.PropertiesFolder, cppt.PropertiesFile);
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

		const bConfig: cppt.BuildConfiguration = { name: "GCC", params: cParams, buildTypes: bTypes, buildSteps: bSteps, problemMatchers: problemMatchers };
		bConfigs.push(bConfig);
		problemMatchers.push('$gcc');
	}

	const bc: cppt.BuildConfigurations = { version: 1, params: { buildDir: "build/${configName}" }, configurations: bConfigs };
	const text = JSON.stringify(bc, null, '\t');

	try {
		fs.writeFileSync(buildStepsPath, text);
	} catch (e) {
		logError(`Error writing ${buildStepsPath} file.\n${e.message}`);
	}

	return true;
}

async function getCppBuildVersion(): Promise<string | undefined> {
	try {
		const result = await cppt.execCmd(`${cppt.ToolName} --version`, {});
		if (result.error) return undefined;
		return result.stdout.split(/[\r\n]/).filter(line => !!line)[0];
	} catch {
		return undefined;
	}
}

async function computeTasks(workspaceFolder: vscode.WorkspaceFolder): Promise<vscode.Task[]> {
	const rootPath = workspaceFolder.uri.scheme === 'file' ? workspaceFolder.uri.fsPath : undefined;
	const tasks: vscode.Task[] = [];
	if (!rootPath) return tasks;

	const buildStepsPath: string = path.join(rootPath, cppt.PropertiesFolder, cppt.BuildStepsFile);
	let propertiesPath: string | undefined = path.join(rootPath, cppt.PropertiesFolder, cppt.PropertiesFile);
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
	cmd += ' "' + configName + '"' + (buildType ? ' "' + buildType + '"' : '') + (propertiesPath ? "" : " -p");
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
