import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

function areJarsPresent(itsc2214Dir: string): boolean {
    const projectJarsPath = path.join(itsc2214Dir, 'JARS');
    if (!fs.existsSync(projectJarsPath)) {
        return false;
    }
    const jarFiles = fs.readdirSync(projectJarsPath).filter(file => file.endsWith('.jar'));
    return jarFiles.length > 0;
}

async function copyJarsToDir(itsc2214Dir: string, context: vscode.ExtensionContext) {
    const extensionJarsPath = path.join(context.extensionPath, 'src', 'JARS');
    const projectJarsPath = path.join(itsc2214Dir, 'JARS');

    if (!fs.existsSync(extensionJarsPath)) {
        return { success: true, jarsCopied: 0 };
    }
    if (!fs.existsSync(projectJarsPath)) {
        fs.mkdirSync(projectJarsPath, { recursive: true });
    }

    const jarFiles = fs.readdirSync(extensionJarsPath).filter(file => file.endsWith('.jar'));
    for (const jarFile of jarFiles) {
        const sourcePath = path.join(extensionJarsPath, jarFile);
        const destPath = path.join(projectJarsPath, jarFile);
        fs.copyFileSync(sourcePath, destPath);
    }
    return { success: true, jarsCopied: jarFiles.length };
}

export async function reinstallJars(context: vscode.ExtensionContext) {
    const itsc2214Dir = context.globalState.get<string>('itsc2214Dir');
    if (!itsc2214Dir) {
        vscode.window.showErrorMessage('ITSC2214 project directory not set. Please create a project first.');
        return;
    }

    const result = await copyJarsToDir(itsc2214Dir, context);
    if (result.success && result.jarsCopied > 0) {
        vscode.window.showInformationMessage(`${result.jarsCopied} JARs reinstalled successfully.`);
    } else if (result.success) {
        vscode.window.showWarningMessage('No JARs found in the extension to reinstall.');
    }
}

export async function createJavaProject(context: vscode.ExtensionContext) {
    let itsc2214Dir = context.globalState.get<string>('itsc2214Dir');

    if (!itsc2214Dir || !fs.existsSync(itsc2214Dir)) {
        const items: vscode.QuickPickItem[] = [
            { label: 'Desktop', description: 'Create itsc2214 folder on your Desktop' },
            { label: 'Custom Location', description: 'Choose a folder for your itsc2214 directory' },
        ];
        const locationChoice = await vscode.window.showQuickPick(items, { placeHolder: 'Set up your ITSC2214 projects folder. This is a one-time setup.' });

        if (!locationChoice) {
            vscode.window.showWarningMessage('Project creation cancelled.');
            return;
        }

        let baseDir: string | undefined;
        if (locationChoice.label === 'Desktop') {
            baseDir = path.join(os.homedir(), 'Desktop', 'itsc2214');
        } else {
            const result = await vscode.window.showOpenDialog({
                canSelectFiles: false, canSelectFolders: true, canSelectMany: false,
                openLabel: 'Select Parent Folder'
            });
            if (result && result.length > 0) {
                baseDir = path.join(result[0].fsPath, 'itsc2214');
            }
        }

        if (!baseDir) {
            vscode.window.showWarningMessage('Project creation cancelled.');
            return;
        }

        itsc2214Dir = baseDir;
        fs.mkdirSync(itsc2214Dir, { recursive: true });
        await context.globalState.update('itsc2214Dir', itsc2214Dir);

        const result = await copyJarsToDir(itsc2214Dir, context);
        let message = `✅ ITSC2214 folder created at ${itsc2214Dir}.`;
        if (result.jarsCopied > 0) {
            message += ` ${result.jarsCopied} JARs were installed.`;
        }
        vscode.window.showInformationMessage(message);

    } else if (!areJarsPresent(itsc2214Dir)) {
        const choice = await vscode.window.showWarningMessage(
            'Required JARs are missing from your ITSC2214 folder.',
            { modal: true },
            'Reinstall JARs'
        );
        if (choice === 'Reinstall JARs') {
            await reinstallJars(context);
        }
    }

    const projectName = await vscode.window.showInputBox({
        prompt: 'Enter a name for your new Java project',
        placeHolder: 'MyAwesomeProject',
        validateInput: value => {
            if (!value || value.trim().length === 0) { return 'Project name cannot be empty.'; }
            if (/[/\\:*?"<>|]/.test(value)) { return 'Project name contains invalid characters.'; }
            if (fs.existsSync(path.join(itsc2214Dir as string, value))) { return 'A project with this name already exists.'; }
            return null;
        }
    });

    if (!projectName) {
        vscode.window.showWarningMessage('No project name entered. Command cancelled.');
        return;
    }

    const projectDir = path.join(itsc2214Dir, projectName);
    const srcDir = path.join(projectDir, 'src');
    const libDir = path.join(projectDir, 'lib');

    [projectDir, srcDir, libDir].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

    const sourceJarsPath = path.join(itsc2214Dir, 'JARS');
    if (fs.existsSync(sourceJarsPath)) {
        const jarFiles = fs.readdirSync(sourceJarsPath).filter(file => file.endsWith('.jar'));
        for (const jarFile of jarFiles) {
            fs.copyFileSync(path.join(sourceJarsPath, jarFile), path.join(libDir, jarFile));
        }
    }

    const mainJavaContent = 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, ITSC2214!");\n    }\n}';
    fs.writeFileSync(path.join(srcDir, 'Main.java'), mainJavaContent);

    const settings = { 'java.project.referencedLibraries': [ 'lib/**/*.jar' ] };
    const vscodeDir = path.join(projectDir, '.vscode');
    fs.mkdirSync(vscodeDir, { recursive: true });
    fs.writeFileSync(path.join(vscodeDir, 'settings.json'), JSON.stringify(settings, null, 4));

    vscode.window.showInformationMessage(`Successfully created project: ${projectName}`);
    const projectUri = vscode.Uri.file(projectDir);
    await vscode.commands.executeCommand('vscode.openFolder', projectUri, { forceNewWindow: true });
}