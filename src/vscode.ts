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

'use strict';

import * as path from 'path';
import * as fs from 'fs';
import { ToolName } from 'cppbuild';

export async function findToolCommand(rootPath: string): Promise<string> {
	let cmd: string;
	let platform = process.platform;
	if (platform === 'win32' && await fileExists(path.join(rootPath, 'node_modules', '.bin', `${ToolName}.cmd`))) {
		const globalCmd = path.join(process.env.APPDATA ? process.env.APPDATA : '', 'npm', `${ToolName}.cmd`);
		if (await fileExists(globalCmd)) {
			cmd = '"' + globalCmd + '"';
		} else {
			cmd = path.join('.', 'node_modules', '.bin', `${ToolName}.cmd`);
		}
	} else if ((platform === 'linux' || platform === 'darwin') && await fileExists(path.join(rootPath, 'node_modules', '.bin', ToolName))) {
		cmd = path.join('.', 'node_modules', '.bin', ToolName);
	} else {
		cmd = ToolName;
	}
	return cmd;
}

function fileExists(file: string): Promise<boolean> {
	return new Promise<boolean>((resolve, _reject) => {
		fs.exists(file, (value) => {
			resolve(value);
		});
	});
}
