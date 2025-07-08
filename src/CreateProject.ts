// This file contains logic for creating projects

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function areJarsPresent(itsc2214Dir: string): boolean {
    const projectJarsPath = path.join(itsc2214Dir, 'JARS');
    if (!fs.existsSync(projectJarsPath)) {
        return false;
    }
    const jarFiles = fs.readdirSync(projectJarsPath).filter(file => file.endsWith('.jar'));
    return jarFiles.length > 0;
}

export async function reinstallJars(itsc2214Dir: string): Promise<JarInstallResult> {
    const extensionJarsPath = path.join(context.extensionPath, 'src', 'JARS');
    if (!fs.existsSync(extensionJarsPath)) {
        vscode.window.showErrorMessage('FATAL: Extension JARs source not found. Please reinstall the extension.');
        return { success: false, jarsCopied: 0 };
    }

    const projectJarsPath = path.join(itsc2214Dir, 'JARS');
    if (!fs.existsSync(projectJarsPath)) {
        fs.mkdirSync(projectJarsPath, { recursive: true });
    }

    try {
        fs.readdirSync(projectJarsPath).forEach(file => {
            if (file.endsWith('.jar')) {
                fs.unlinkSync(path.join(projectJarsPath, file));
            }
        });

        const jarFiles = fs.readdirSync(extensionJarsPath).filter(file => file.endsWith('.jar'));
        for (const jarFile of jarFiles) {
            const sourcePath = path.join(extensionJarsPath, jarFile);
            const destPath = path.join(projectJarsPath, jarFile);
            fs.copyFileSync(sourcePath, destPath);
        }
        return { success: true, jarsCopied: jarFiles.length };
    } catch (error) {
        console.error("Error during JAR reinstallation:", error);
        vscode.window.showErrorMessage('An error occurred while reinstalling JARs. Check the logs for details.');
        return { success: false, jarsCopied: 0 };
    }
}

const reinstallJarsCommand = vscode.commands.registerCommand('itsc2214-create-java-project.reinstallJars', async () => {
    const itsc2214Dir = context.globalState.get<string>('itsc2214Dir');
    if (!itsc2214Dir || !fs.existsSync(itsc2214Dir)) {
        vscode.window.showErrorMessage('ITSC2214 directory not found. Please create a project first to set the location.');
        return;
    }

    vscode.window.showInformationMessage('Reinstalling JARs...');
    const result = await reinstallJars(itsc2214Dir);
    if (result.success) {
        if (result.jarsCopied > 0) {
            vscode.window.showInformationMessage(`${result.jarsCopied} JARs reinstalled successfully.`);
        } else {
            vscode.window.showWarningMessage('No source JARs found in the extension. JARS folder is now empty.');
        }
    }
});