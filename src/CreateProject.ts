import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

async function areJarsPresent(itsc2214DirUri: vscode.Uri): Promise<boolean> {
    const projectJarsUri = vscode.Uri.joinPath(itsc2214DirUri, 'JARS');
    try {
        const entries = await vscode.workspace.fs.readDirectory(projectJarsUri);
        return entries.some(entry => entry[0].endsWith('.jar') && entry[1] === vscode.FileType.File);
    } catch (error) {
        return false;
    }
}

export async function copyJarsToDir(targetBaseUri: vscode.Uri, destinationFolderName: string, context: vscode.ExtensionContext): Promise<{ success: boolean; jarsCopied: number }> {
    const extensionJarsUri = vscode.Uri.joinPath(context.extensionUri, 'src', 'JARS');
    const targetJarsUri = vscode.Uri.joinPath(targetBaseUri, destinationFolderName);
    let jarsCopiedCount = 0;

    await vscode.workspace.fs.createDirectory(targetJarsUri);

    try {
        const jarFiles = await vscode.workspace.fs.readDirectory(extensionJarsUri);
        for (const [fileName, fileType] of jarFiles) {
            if (fileType === vscode.FileType.File && fileName.endsWith('.jar')) {
                const sourceUri = vscode.Uri.joinPath(extensionJarsUri, fileName);
                const destinationUri = vscode.Uri.joinPath(targetJarsUri, fileName);
                await vscode.workspace.fs.copy(sourceUri, destinationUri, { overwrite: true });
                jarsCopiedCount++;
            }
        }
        return { success: true, jarsCopied: jarsCopiedCount };
    } catch (error) {
        console.error('Error copying JARs:', error);
        return { success: false, jarsCopied: 0 };
    }
}

export async function reinstallJars(context: vscode.ExtensionContext) {
    let totalJarsReinstalled = 0;
    let anyOperationPerformed = false;

    const itsc2214Dir = context.globalState.get<string>('itsc2214Dir');
    if (itsc2214Dir) {
        anyOperationPerformed = true;
        const itsc2214DirUri = vscode.Uri.file(itsc2214Dir);
        const result = await copyJarsToDir(itsc2214DirUri, 'JARS', context);
        if (result.success && result.jarsCopied > 0) {
            totalJarsReinstalled += result.jarsCopied;
            vscode.window.showInformationMessage(`ITSC2214 project: ${result.jarsCopied} JARs reinstalled.`);
        }
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        anyOperationPerformed = true;
        const currentProjectUri = workspaceFolders[0].uri;
        const result = await copyJarsToDir(currentProjectUri, 'lib', context);
        if (result.success && result.jarsCopied > 0) {
            totalJarsReinstalled += result.jarsCopied;
            vscode.window.showInformationMessage(`Current workspace: ${result.jarsCopied} JARs reinstalled.`);
        }
    }

    if (!anyOperationPerformed) {
        vscode.window.showInformationMessage('No eligible projects found for JAR reinstallation.');
    } else if (totalJarsReinstalled === 0) {
        vscode.window.showInformationMessage('Reinstall JARs completed, but no JARs were copied.');
    } else {
        vscode.window.showInformationMessage(`Total ${totalJarsReinstalled} JARs reinstalled.`);
    }
}

export async function createJavaProject(context: vscode.ExtensionContext) {
    let itsc2214Dir: string | undefined = context.globalState.get('itsc2214Dir');

    if (itsc2214Dir) {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(itsc2214Dir));
        } catch {
            await context.globalState.update('itsc2214Dir', undefined);
            itsc2214Dir = undefined;
        }
    }

    if (!itsc2214Dir) {
        const locationChoice = await vscode.window.showQuickPick([
            { label: 'Desktop', description: 'Create itsc2214 folder on your Desktop' },
            { label: 'Custom Location', description: 'Choose a folder' }
        ], { placeHolder: 'Set up your ITSC2214 projects folder' });

        if (!locationChoice) return;

        let baseUri;
        if (locationChoice.label === 'Desktop') {
            const homeUri = vscode.Uri.file(os.homedir());
            baseUri = vscode.Uri.joinPath(homeUri, 'Desktop', 'itsc2214');
        } else {
            const result = await vscode.window.showOpenDialog({ canSelectFolders: true, openLabel: 'Select Parent Folder' });
            if (result) {
                baseUri = vscode.Uri.joinPath(result[0], 'itsc2214');
            }
        }

        if (!baseUri) return;

        await vscode.workspace.fs.createDirectory(baseUri);
        itsc2214Dir = baseUri.fsPath;
        await context.globalState.update('itsc2214Dir', itsc2214Dir);
        const result = await copyJarsToDir(baseUri, 'JARS', context);
        if (result.success) {
            vscode.window.showInformationMessage(`✅ ITSC2214 folder created at ${itsc2214Dir} with ${result.jarsCopied} JARs.`);
        }
    }
    const itsc2214DirUri = vscode.Uri.file(itsc2214Dir);

    if (!await areJarsPresent(itsc2214DirUri)) {
        if (await vscode.window.showWarningMessage('Required JARs are missing.', { modal: true }, 'Reinstall JARs') === 'Reinstall JARs') {
            await reinstallJars(context);
        }
    }

    const projectName = await vscode.window.showInputBox({
        prompt: 'Enter a name for your new Java project',
        validateInput: async value => {
            if (!value) return 'Project name cannot be empty.';
            if (/[/\\:*?"<>|]/.test(value)) return 'Invalid characters in project name.';
            try {
                const projectsUri = vscode.Uri.joinPath(itsc2214DirUri, 'projects', value);
                await vscode.workspace.fs.stat(projectsUri);
                return 'A project with this name already exists.';
            } catch {
                return null;
            }
        }
    });

    if (!projectName) return;

    const projectsDirUri = vscode.Uri.joinPath(itsc2214DirUri, 'projects');
    const projectUri = vscode.Uri.joinPath(projectsDirUri, projectName);
    const srcUri = vscode.Uri.joinPath(projectUri, 'src');
    const libUri = vscode.Uri.joinPath(projectUri, 'lib');

    await Promise.all([
        vscode.workspace.fs.createDirectory(srcUri),
        vscode.workspace.fs.createDirectory(libUri)
    ]);

    await copyJarsToDir(projectUri, 'lib', context);

    const mainJavaContent = 'public class Main {\n    public static void main(String[] args) {\n        console.log("Hello, ITSC2214!");\n    }\n}';
    await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(srcUri, 'Main.java'), Buffer.from(mainJavaContent, 'utf8'));

    const settings = { 'java.project.referencedLibraries': [ 'lib/**/*.jar' ] };
    const settingsUri = vscode.Uri.joinPath(projectUri, '.vscode', 'settings.json');
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(projectUri, '.vscode'));
    await vscode.workspace.fs.writeFile(settingsUri, Buffer.from(JSON.stringify(settings, null, 4), 'utf8'));

    vscode.window.showInformationMessage(`Successfully created project ${projectName}.`);
    await vscode.commands.executeCommand('vscode.openFolder', projectUri, { forceNewWindow: true });
}