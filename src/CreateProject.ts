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

async function copyJarsToDir(targetBaseDir: string, destinationFolderName: string, context: vscode.ExtensionContext): Promise<{ success: boolean; jarsCopied: number }> {
    const extensionJarsPath = path.join(context.extensionPath, 'src', 'JARS');
    const targetJarsPath = path.join(targetBaseDir, destinationFolderName);
    let jarsCopiedCount = 0;

    fs.mkdirSync(targetJarsPath, { recursive: true });

    const jarFiles = fs.readdirSync(extensionJarsPath);

    for (const file of jarFiles) {
        if (file.endsWith('.jar')) {
            const sourcePath = path.join(extensionJarsPath, file);
            const destinationPath = path.join(targetJarsPath, file);
            fs.copyFileSync(sourcePath, destinationPath);
            jarsCopiedCount++;
        }
    }

    return { success: true, jarsCopied: jarsCopiedCount };
}

export async function reinstallJars(context: vscode.ExtensionContext) {
    let totalJarsReinstalled = 0;
    let anyOperationPerformed = false;

    // Reinstall JARs for the globally tracked ITSC2214 project (into 'JARS' folder)
    const itsc2214Dir = context.globalState.get<string>('itsc2214Dir');
    if (itsc2214Dir) {
        anyOperationPerformed = true;
        const result = await copyJarsToDir(itsc2214Dir, 'JARS', context);
        if (result.success) {
            totalJarsReinstalled += result.jarsCopied;
            if (result.jarsCopied > 0) {
                vscode.window.showInformationMessage(`ITSC2214 project: ${result.jarsCopied} JARs reinstalled into 'JARS' folder.`);
            } else {
                vscode.window.showWarningMessage(`ITSC2214 project: No JARs found in extension to reinstall into 'JARS' folder.`);
            }
        }
    } else {
        vscode.window.showWarningMessage('ITSC2214 project directory not set. Skipping JAR reinstallation for it.');
    }

    // Reinstall JARs for the currently opened workspace folder (into 'lib' folder)
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        const currentProjectDir = workspaceFolders[0].uri.fsPath;
        anyOperationPerformed = true;
        const result = await copyJarsToDir(currentProjectDir, 'lib', context);
        if (result.success) {
            totalJarsReinstalled += result.jarsCopied;
            if (result.jarsCopied > 0) {
                vscode.window.showInformationMessage(`Current workspace: ${result.jarsCopied} JARs reinstalled into 'lib' folder.`);
            } else {
                vscode.window.showWarningMessage(`Current workspace: No JARs found in extension to reinstall into 'lib' folder.`);
            }
        }
    } else {
        vscode.window.showWarningMessage('No workspace folder open. Skipping JAR reinstallation for current project.');
    }

    if (!anyOperationPerformed) {
        vscode.window.showInformationMessage('No eligible projects found for JAR reinstallation.');
    } else if (totalJarsReinstalled === 0) {
        vscode.window.showInformationMessage('Reinstall JARs completed, but no JARs were copied in any location.');
    } else {
        vscode.window.showInformationMessage(`Total ${totalJarsReinstalled} JARs reinstalled across eligible projects.`);
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

        const result = await copyJarsToDir(itsc2214Dir, 'JARS', context);
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
    const testJavaContent = 'import org.junit.*;'
    fs.writeFileSync(path.join(srcDir, 'Main.java'), mainJavaContent);
    fs.writeFileSync(path.join(srcDir, 'MainTest.java'), testJavaContent);

    const settings = { 'java.project.referencedLibraries': [ 'lib/**/*.jar' ] };
    const vscodeDir = path.join(projectDir, '.vscode');
    fs.mkdirSync(vscodeDir, { recursive: true });
    fs.writeFileSync(path.join(vscodeDir, 'settings.json'), JSON.stringify(settings, null, 4));

    vscode.window.showInformationMessage(`Successfully created project: ${projectName}`);
    const projectUri = vscode.Uri.file(projectDir);
    await vscode.commands.executeCommand('vscode.openFolder', projectUri, { forceNewWindow: true });
}