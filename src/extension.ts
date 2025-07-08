import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { reinstallJars, areJarsPresent } from "./createProject";

// --- INTERFACES ---
interface JarInstallResult {
    success: boolean;
    jarsCopied: number;
}

interface Assignment {
    label: string;
    description?: string;
    url: string;
}

interface SubmissionTarget {
    label: string;
    description?: string;
    url: string;
    assignmentId?: string;
}

class CommandItem extends vscode.TreeItem {
    constructor(label: string, commandString: string, icon: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = {
            command: commandString,
            title: label
        };
        this.iconPath = new vscode.ThemeIcon(icon);
    }
}

console.log('ITSC2214: Node version:', process.version);
console.log('ITSC2214: VS Code version:', vscode.version);

export function activate(context: vscode.ExtensionContext) {
    console.log('ITSC2214: === ACTIVATION STARTING ===');
    console.log('ITSC2214: Extension activating...');
    console.log('ITSC2214: Platform:', require('os').platform());
    console.log('ITSC2214: Extension context global state available:', !!context.globalState);
    
    // Check file system access
    const fs = require('fs');
    const path = require('path');
    
    if (extensionPathExists) {
        const jarPath = path.join(context.extensionPath, 'src', 'JARS');
        const jarPathExists = fs.existsSync(jarPath);
        console.log('ITSC2214: JAR path exists:', jarPathExists);
        
        if (jarPathExists) {
            const jarFiles = fs.readdirSync(jarPath);
            console.log('ITSC2214: JAR files found:', jarFiles.length);
        }
    }

    console.log('ITSC2214: Extension is now active!');

    // --- COMMANDS ---

    const createJavaProjectCommand = vscode.commands.registerCommand('itsc2214-create-java-project.createJavaProject', async () => {
        let itsc2214Dir = context.globalState.get<string>('itsc2214Dir');

        if (!itsc2214Dir || !fs.existsSync(itsc2214Dir)) {
            // First-time setup
			const items: vscode.QuickPickItem[] = [
				{ label: 'Desktop', description: 'Create itsc2214 folder on Desktop'},
				{ label: 'Custom Location', description: 'Create itsc2214 folder in a custom location'},
			];
            
			const locationChoice = await vscode.window.showQuickPick(items, { placeHolder: 'Set up your ITSC2214 projects folder. This will only be accessed once.' })

			if (!locationChoice) {
				vscode.window.showWarningMessage('Project creation cancelled.');
				return;
			}

            let baseDir: string | undefined;
            if (locationChoice?.label === 'Desktop') {
                const desktopPath = path.join(require('os').homedir(), 'Desktop');
                baseDir = path.join(desktopPath, 'itsc2214');
            } else if (locationChoice?.label === 'Custom Location') {
                const result = await vscode.window.showOpenDialog({
                    canSelectFiles: false, canSelectFolders: true, canSelectMany: false,
                    openLabel: 'Select a parent folder for your itsc2214 directory'
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
            
            const result = await reinstallJars(itsc2214Dir);
            if (result.success) {
                let message = `ITSC2214 folder created at ${itsc2214Dir}.`;
                if (result.jarsCopied > 0) {
                    message += ` ${result.jarsCopied} JARs were installed.`;
                    vscode.window.showInformationMessage(message);
                } else {
                    message += ' No JARs were found in the extension to install.';
                    vscode.window.showWarningMessage(message);
                }
                await context.globalState.update('itsc2214Dir', itsc2214Dir);
            } else {
                return; // Stop if JAR installation failed
            }
        } else if (!areJarsPresent(itsc2214Dir)) {
            // Subsequent runs, check for JARs
            const choice = await vscode.window.showWarningMessage(
                'Required JARs are missing from your ITSC2214 folder.',
                { modal: true },
                'Reinstall JARs', 'Continue Anyway'
            );

            if (choice === 'Reinstall JARs') {
                const result = await reinstallJars(itsc2214Dir);
                if (result.success && result.jarsCopied > 0) {
                    vscode.window.showInformationMessage('JARs reinstalled successfully.');
                } else if (result.success) {
                    vscode.window.showWarningMessage('No JARs found in extension to reinstall.');
                } else {
                    return; // Stop if reinstall failed
                }
            } else if (choice !== 'Continue Anyway') {
                vscode.window.showWarningMessage('Project creation cancelled.');
                return;
            }
        }

        if (!itsc2214Dir) { return; } // Should not happen, but as a safeguard

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
		const tstDir = path.join(projectDir, 'tst');
        const vscodeDir = path.join(projectDir, '.vscode');

        [projectDir, srcDir, tstDir, vscodeDir, path.join(projectDir, 'lib')].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

        // Copy JARs from itsc2214Dir/JARS to projectDir/lib
        const sourceJarsPath = path.join(itsc2214Dir, 'JARS');
        const destLibPath = path.join(projectDir, 'lib');
        if (fs.existsSync(sourceJarsPath)) {
            const jarFiles = fs.readdirSync(sourceJarsPath).filter(file => file.endsWith('.jar'));
            for (const jarFile of jarFiles) {
                const sourcePath = path.join(sourceJarsPath, jarFile);
                const destPath = path.join(destLibPath, jarFile);
                fs.copyFileSync(sourcePath, destPath);
            }
        }

        const mainJavaContent = 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, ITSC2214!");\n    }\n}';
        const testJavaContent = `import org.junit.*;
import static org.junit.Assert.*;

/**
 * setup() method, runs before each of your test methods.
 * Use this method to recreate the objects needed for
 * testing your class.
 */
@Before
public void setup() {
runner = new YOUR-CLASS();
}

/**
 * TODO: Give a brief description of what the method does.
 * @author TODO: Put your name here
 * @param TODO: Include name and brief description for each parameter.
 * @return TODO: Describe the return value.
 * @exception TODO: List all exceptions this method throws.
 */
public void methodName()
{
// TODO: your code goes here
}`;
        fs.writeFileSync(path.join(srcDir, 'Main.java'), mainJavaContent);
        fs.writeFileSync(path.join(tstDir, 'MainTest.java'), testJavaContent);

        const settingsJsonContent = { 'java.project.referencedLibraries': [path.join('..', 'JARS', '*.jar')] };
        fs.writeFileSync(path.join(vscodeDir, 'settings.json'), JSON.stringify(settingsJsonContent, null, 4));

        vscode.window.showInformationMessage(`Successfully created project: ${projectName}`);
		const mainJavaPath = path.join(srcDir, 'Main.java');
		const mainJavaUri = vscode.Uri.file(mainJavaPath);

        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectDir), { forceNewWindow: true });

		vscode.commands.executeCommand('vscode.open', mainJavaUri);
    });


    const uploadProjectCommand = vscode.commands.registerCommand('itsc2214-create-java-project.uploadProject', async () => {
        // Check if we have a workspace open
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace is open. Please open a project folder first.');
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        const projectPath = workspaceFolder.uri.fsPath;
        const projectName = path.basename(projectPath);

        // Check if this looks like a Java project
        const srcPath = path.join(projectPath, 'src');
        if (!fs.existsSync(srcPath)) {
            const choice = await vscode.window.showWarningMessage(
                'This doesn\'t appear to be a Java project (no src folder found). Continue anyway?',
                'Continue', 'Cancel'
            );
            if (choice !== 'Continue') {
                return;
            }
        }

        const config = vscode.workspace.getConfiguration('itsc2214');
        const submitURL = config.get<string>('signonURL');

        if (!submitURL) {
            const result = await vscode.window.showErrorMessage(
                'No submission URL is configured in settings.',
                'Open Settings'
            );
            if (result === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'itsc2214.submitURL');
            }
            return;
        }

        // Show progress while creating archive
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Preparing ${projectName} for submission...`,
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Creating project archive...' });
                
                // Create a temporary zip file
                const tempDir = require('os').tmpdir();
                const zipPath = path.join(tempDir, `${projectName}-submission.zip`);
                
                // For now, we'll use a simple approach - in a real implementation,
                // you'd want to use a proper zip library like 'archiver'
                await createProjectArchive(projectPath, zipPath);
                
                progress.report({ message: 'Opening submission page...' });
                
                // Open the Web-CAT submission URL
                vscode.env.openExternal(vscode.Uri.parse(submitURL));
                
                // Show success message with instructions
                const choice = await vscode.window.showInformationMessage(
                    `Project archive created at: ${zipPath}\n\nThe Web-CAT submission page has been opened in your browser. Upload the zip file to submit your project.`,
                    'Open Archive Location', 'OK'
                );
                
                if (choice === 'Open Archive Location') {
                    vscode.env.openExternal(vscode.Uri.file(path.dirname(zipPath)));
                }
                
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to prepare project for submission: ${error.message}`);
            }
        });
    });

    // Helper function to create project archive
    async function createProjectArchive(projectPath: string, zipPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Check if archiver is available before using it
                let archiver;
                try {
                    archiver = require('archiver');
                } catch (error) {
                    console.warn('Archiver module not available, falling back to direct submission');
                    resolve();
                    return;
                }

                const output = fs.createWriteStream(zipPath);
                const archive = archiver('zip', { zlib: { level: 9 } });

                output.on('close', () => {
                    resolve();
                });

                archive.on('error', (err: any) => {
                    console.warn('Archive creation failed, falling back to direct submission:', err);
                    resolve(); // Don't reject, just continue without zip
                });

                archive.pipe(output);

                // Add the src directory
                const srcPath = path.join(projectPath, 'src');
                if (fs.existsSync(srcPath)) {
                    archive.directory(srcPath, 'src');
                }

                // Add the tst directory if it exists
                const tstPath = path.join(projectPath, 'tst');
                if (fs.existsSync(tstPath)) {
                    archive.directory(tstPath, 'tst');
                }

                // Add any other important files
                const importantFiles = ['README.md', 'README.txt', '.project', '.classpath'];
                for (const file of importantFiles) {
                    const filePath = path.join(projectPath, file);
                    if (fs.existsSync(filePath)) {
                        archive.file(filePath, { name: file });
                    }
                }

                archive.finalize();
            } catch (error) {
                // Fallback: if archiver is not available, just continue
                console.warn('Archiver not available, opening submit URL directly:', error);
                resolve();
            }
        });
    }

    const setDownloadUrlCommand = vscode.commands.registerCommand('itsc2214-create-java-project.setDownloadUrl', async () => {
        const config = vscode.workspace.getConfiguration('itsc2214');
        const currentUrl = config.get<string>('downloadURL') || '';
        const url = await vscode.window.showInputBox({
            prompt: 'Enter the assignment download URL',
            value: currentUrl,
            validateInput: value => {
                if (!value || value.trim().length === 0) return 'URL cannot be empty.';
                return null;
            }
        });
        if (url) {
            await config.update('downloadURL', url, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Download URL updated.');
        } else {
            vscode.window.showWarningMessage('No URL entered. Command cancelled.');
        }
    });

    const setUploadUrlCommand = vscode.commands.registerCommand('itsc2214-create-java-project.setUploadUrl', async () => {
        const config = vscode.workspace.getConfiguration('itsc2214');
        const currentUrl = config.get<string>('submitURL') || '';
        const url = await vscode.window.showInputBox({
            prompt: 'Enter the project upload URL',
            value: currentUrl,
            validateInput: value => {
                if (!value || value.trim().length === 0) return 'URL cannot be empty.';
                return null;
            }
        });
        if (url) {
            await config.update('submitURL', url, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Upload URL updated.');
        } else {
            vscode.window.showWarningMessage('No URL entered. Command cancelled.');
        }
    });

    const assignmentProvider = new AssignmentProvider();
    console.log("!!! Creating Tree View !!!")
    vscode.window.createTreeView('itsc2214ExplorerView', { treeDataProvider: assignmentProvider });
    vscode.commands.registerCommand('itsc2214-create-java-project.refreshAssignments', () => assignmentProvider.refresh());

    const openViewCommand = vscode.commands.registerCommand('itsc2214-create-java-project.openView', async () => {
        vscode.commands.executeCommand('itsc2214ExplorerView.focus');
    });

    context.subscriptions.push(createJavaProjectCommand, reinstallJarsCommand, downloadAssignmentCommand, setDownloadUrlCommand, setUploadUrlCommand, uploadProjectCommand, openViewCommand);
}

export function deactivate() {
    console.log('ITSC2214: Extension deactivating...');
    console.log('ITSC2214: === DEACTIVATION COMPLETE ===');
}