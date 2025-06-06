// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "itsc2214-create-java-project" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('itsc2214-create-java-project.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Create Java Project!');
	});

	const createJavaProjectDisposable = vscode.commands.registerCommand('itsc2214-create-java-project.createJavaProject', async () => {
		vscode.window.showInformationMessage('Create Java Project command executed!');
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(createJavaProjectDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
