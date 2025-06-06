// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('itsc2214-create-java-project is now active!');


	const createJavaProjectDisposable = vscode.commands.registerCommand('itsc2214-create-java-project.createJavaProject', async () => {
		const os = require('os');
		const path = require('path');
		const fs = require('fs');

		// Get the local Desktop path
		let desktopDir: string;
		if (process.platform === 'win32') {
			desktopDir = require('path').join(process.env.USERPROFILE || '', 'Desktop');
		} else {
			desktopDir = require('path').join(require('os').homedir(), 'Desktop');
		}
		let itsc2214Dir = path.join(desktopDir, 'itsc2214');

		if (!fs.existsSync(itsc2214Dir)) {
			const createFolder = await vscode.window.showInformationMessage(
				"No 'itsc2214' folder found on your Desktop. Would you like to select a location to create one?",
				'Yes', 'No'
			);
			if (createFolder === 'Yes') {
				const folderUris = await vscode.window.showOpenDialog({
					canSelectFolders: true,
					canSelectFiles: false,
					canSelectMany: false,
					openLabel: 'Select location for itsc2214 folder'
				});
				if (folderUris && folderUris[0]) {
					itsc2214Dir = path.join(folderUris[0].fsPath, 'itsc2214');
					if (!fs.existsSync(itsc2214Dir)) {
						fs.mkdirSync(itsc2214Dir);
						const jarsDir = path.join(itsc2214Dir, 'JARS');
						fs.mkdirSync(jarsDir);
						vscode.window.showInformationMessage(`Created itsc2214 folder and JARS folder at: ${itsc2214Dir}`);
					} else {
						vscode.window.showInformationMessage(`itsc2214 folder already exists at: ${itsc2214Dir}`);
					}
				} else {
					vscode.window.showWarningMessage('No location selected. Command cancelled.');
					return;
				}
			} else {
				vscode.window.showWarningMessage('Command cancelled.');
				return;
			}
		}

		const jarsDir = path.join(itsc2214Dir, 'JARS');
		if (!fs.existsSync(jarsDir)) {
			const selectJars = await vscode.window.showInformationMessage(
				"No 'JARS' folder found in the itsc2214 folder. Would you like to select a JARS folder?",
				'Yes', 'No'
			);
			if (selectJars === 'Yes') {
				const jarsUris = await vscode.window.showOpenDialog({
					canSelectFolders: true,
					canSelectFiles: false,
					canSelectMany: false,
					openLabel: 'Select JARS folder'
				});
				if (jarsUris && jarsUris[0]) {
					vscode.window.showInformationMessage(`JARS folder selected: ${jarsUris[0].fsPath}`);
				} else {
					vscode.window.showWarningMessage('No JARS folder selected. Command cancelled.');
					return;
				}
			} else {
				vscode.window.showWarningMessage('Command cancelled.');
				return;
			}
		} else {
			vscode.window.showInformationMessage('Found JARS folder in itsc2214.');

			// Check for JAR files in the JARS folder
			const jarFiles = fs.readdirSync(jarsDir).filter((file: string) => file.endsWith('.jar'));
			if (jarFiles.length === 0) {
				vscode.window.showWarningMessage('No JAR files found in the JARS folder. The project will be created, but no libraries will be referenced.');
			}

			// Prompt for new project name
			const projectName = await vscode.window.showInputBox({
				prompt: 'Enter a name for your new Java project',
				placeHolder: 'MyJavaProject',
				validateInput: (value) => {
					if (!value || value.trim().length === 0) {
						return 'Project name cannot be empty';
					}
					if (/[/\\:*?"<>|]/.test(value)) {
						return 'Project name contains invalid characters';
					}
					return null;
				}
			});
			if (!projectName) {
				vscode.window.showWarningMessage('No project name provided. Command cancelled.');
				return;
			}

			const projectDir = path.join(itsc2214Dir, projectName);
			if (fs.existsSync(projectDir)) {
				vscode.window.showWarningMessage(`A project named "${projectName}" already exists.`);
				return;
			}

			// Create project structure
			fs.mkdirSync(projectDir);
			fs.mkdirSync(path.join(projectDir, 'src'));
			fs.mkdirSync(path.join(projectDir, 'lib'));
			fs.mkdirSync(path.join(projectDir, '.vscode'));

			const mainJavaPath = path.join(projectDir, 'src', 'Main.java');
			fs.writeFileSync(mainJavaPath, `public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, ITSC2214!\");\n    }\n}`);


			// Create a basic .vscode/settings.json referencing the JARS folder for Java classpath
			const settingsJsonPath = path.join(projectDir, '.vscode', 'settings.json');
			const settingsJson = {
				"java.project.referencedLibraries": [
					path.join(jarsDir, "*.jar")
				]
			};
			fs.writeFileSync(settingsJsonPath, JSON.stringify(settingsJson, null, 4));

			vscode.window.showInformationMessage(`Java project '${projectName}' created in itsc2214.`);

			// Reveal the new project in the file explorer and open Main.java
			const mainJavaUri = vscode.Uri.file(mainJavaPath);
			await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectDir), false);
			// Wait a bit for the folder to open, then open Main.java
			setTimeout(() => {
				vscode.window.showTextDocument(mainJavaUri);
			}, 1000);
		}
	});

	context.subscriptions.push(createJavaProjectDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
