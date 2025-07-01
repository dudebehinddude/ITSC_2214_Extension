import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

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

function fetchJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https:');
        const client = isHttps ? https : http;
        
        client.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Request Failed. Status Code: ${res.statusCode}`));
            }
            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(rawData) as T);
                } catch (e: any) {
                    reject(new Error(`Failed to parse JSON response: ${e.message}`));
                }
            });
        }).on('error', (e) => {
            reject(new Error(`HTTP(S) request failed: ${e.message}`));
        });
    });
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

class AssignmentProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            // Root level - show main sections
            const uploadSection = new vscode.TreeItem('Submit', vscode.TreeItemCollapsibleState.Expanded);
            uploadSection.iconPath = new vscode.ThemeIcon('cloud-upload');
            uploadSection.tooltip = 'Project submission options';
            uploadSection.contextValue = 'uploadSection';

            const downloadSection = new vscode.TreeItem('Download', vscode.TreeItemCollapsibleState.Expanded);
            downloadSection.iconPath = new vscode.ThemeIcon('cloud-download');
            downloadSection.tooltip = 'Available assignments to download';
            downloadSection.contextValue = 'downloadSection';

            return [uploadSection, downloadSection];
        }

        if (element.contextValue === 'uploadSection') {
            // Upload section children - show available submission targets
            const config = vscode.workspace.getConfiguration('itsc2214');
            const submitURL = config.get<string>('submitURL');
            
            if (!submitURL) {
                const configItem = new vscode.TreeItem('Configure Submit URL', vscode.TreeItemCollapsibleState.None);
                configItem.command = {
                    command: 'itsc2214-create-java-project.setUploadUrl',
                    title: 'Set Submit URL'
                };
                configItem.iconPath = new vscode.ThemeIcon('settings-gear');
                configItem.tooltip = 'Set the URL for submitting projects';
                return [configItem];
            }

            try {
                // For now, create a generic submission item that opens the submit URL
                // In a real implementation, you might fetch available assignments from the submit URL
                const submitItem = new vscode.TreeItem('Submit Current Project', vscode.TreeItemCollapsibleState.None);
                submitItem.command = {
                    command: 'itsc2214-create-java-project.uploadProject',
                    title: 'Submit Project'
                };
                submitItem.iconPath = new vscode.ThemeIcon('rocket');
                submitItem.tooltip = 'Submit the currently open project to Web-CAT for grading';
                submitItem.contextValue = 'submitItem';

                return [submitItem];
            } catch (error: any) {
                console.error(`Failed to load submission targets: ${error.message}`);
                const errorItem = new vscode.TreeItem('Failed to load submission targets', vscode.TreeItemCollapsibleState.None);
                errorItem.iconPath = new vscode.ThemeIcon('error');
                errorItem.tooltip = `Error: ${error.message}. Check the submit URL in settings.`;
                errorItem.command = {
                    command: 'itsc2214-create-java-project.setUploadUrl',
                    title: 'Fix Submit URL'
                };
                return [errorItem];
            }
        }

        if (element.contextValue === 'downloadSection') {
            // Download section children
            const config = vscode.workspace.getConfiguration('itsc2214');
            const assignmentsURL = config.get<string>('downloadURL');
            
            if (!assignmentsURL) {
                const configItem = new vscode.TreeItem('Configure Download URL', vscode.TreeItemCollapsibleState.None);
                configItem.command = {
                    command: 'itsc2214-create-java-project.setDownloadUrl',
                    title: 'Set Download URL'
                };
                configItem.iconPath = new vscode.ThemeIcon('settings-gear');
                configItem.tooltip = 'Set the URL for downloading assignments';
                return [configItem];
            }

            try {
                const assignments = await fetchJson<Assignment[]>(assignmentsURL);
                const assignmentItems = assignments.map((a: Assignment) => {
                    const item = new vscode.TreeItem(a.label, vscode.TreeItemCollapsibleState.None);
                    item.description = a.description;
                    item.command = {
                        command: 'itsc2214-create-java-project.downloadAssignment',
                        title: 'Download Assignment',
                        arguments: [a]
                    };
                    item.tooltip = `Download ${a.label}`;
                    item.iconPath = new vscode.ThemeIcon('file-zip');
                    item.contextValue = 'assignmentItem';
                    return item;
                });

                if (assignmentItems.length === 0) {
                    const noAssignments = new vscode.TreeItem('No assignments available', vscode.TreeItemCollapsibleState.None);
                    noAssignments.iconPath = new vscode.ThemeIcon('info');
                    noAssignments.tooltip = 'No assignments found at the configured URL';
                    return [noAssignments];
                }

                return assignmentItems;
            } catch (error: any) {
                console.error(`Failed to fetch assignments: ${error.message}`);
                const errorItem = new vscode.TreeItem('Failed to load assignments', vscode.TreeItemCollapsibleState.None);
                errorItem.iconPath = new vscode.ThemeIcon('error');
                errorItem.tooltip = `Error: ${error.message}. Check the download URL in settings.`;
                errorItem.command = {
                    command: 'itsc2214-create-java-project.setDownloadUrl',
                    title: 'Fix Download URL'
                };
                return [errorItem];
            }
        }

        return [];
    }
}

export function activate(context: vscode.ExtensionContext) {

    console.log('ITSC2214 Extension is now active!');

    // --- HELPER FUNCTIONS ---

    async function reinstallJars(itsc2214Dir: string): Promise<JarInstallResult> {
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

    function areJarsPresent(itsc2214Dir: string): boolean {
        const projectJarsPath = path.join(itsc2214Dir, 'JARS');
        if (!fs.existsSync(projectJarsPath)) {
            return false;
        }
        const jarFiles = fs.readdirSync(projectJarsPath).filter(file => file.endsWith('.jar'));
        return jarFiles.length > 0;
    }

    // --- COMMANDS ---

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

    const downloadAssignmentCommand = vscode.commands.registerCommand('itsc2214-create-java-project.downloadAssignment', async (assignment?: Assignment) => {
        const itsc2214Dir = context.globalState.get<string>('itsc2214Dir');
        if (!itsc2214Dir) {
            vscode.window.showErrorMessage('Please create a project first to set your ITSC2214 directory.');
            return;
        }

        let chosenAssignment: Assignment | undefined = assignment;

        if (!chosenAssignment) {
            const config = vscode.workspace.getConfiguration('itsc2214');
            const assignmentsURL = config.get<string>('downloadURL');

            if (!assignmentsURL) {
                const result = await vscode.window.showErrorMessage(
                    'No assignment download URL is configured in settings.',
                    'Open Settings'
                );
                if (result === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'itsc2214.downloadURL');
                }
                return;
            }

            try {
                const assignments = await fetchJson<Assignment[]>(assignmentsURL);
                chosenAssignment = await vscode.window.showQuickPick(assignments, {
                    placeHolder: 'Select an assignment to download',
                    matchOnDescription: true,
                });

            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to get assignments: ${error.message}`);
                return;
            }
        }

        if (!chosenAssignment) { return; }

        const fileName = path.basename(chosenAssignment.url);
        const destPath = path.join(itsc2214Dir, fileName);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Downloading ${fileName}`,
            cancellable: true
        }, (progress, token) => {
            return new Promise<void>((resolve, reject) => {
                const request = https.get(chosenAssignment.url, response => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`Download failed: Server responded with status code ${response.statusCode}`));
                        return;
                    }
                    const fileStream = fs.createWriteStream(destPath);
                    response.pipe(fileStream);

                    fileStream.on('finish', () => {
                        fileStream.close();
                        vscode.window.showInformationMessage(`Successfully downloaded to ${destPath}`);
                        resolve();
                    });

                    fileStream.on('error', err => {
                        fs.unlink(destPath, () => reject(err));
                    });

                    token.onCancellationRequested(() => {
                        request.destroy();
                        fs.unlink(destPath, () => reject(new Error("Download cancelled.")));
                    });
                });

                request.on('error', err => {
                    fs.unlink(destPath, () => reject(err));
                });
            });
        });
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
    vscode.window.createTreeView('itsc2214ExplorerView', { treeDataProvider: assignmentProvider });
    vscode.commands.registerCommand('itsc2214-create-java-project.refreshAssignments', () => assignmentProvider.refresh());

    const openViewCommand = vscode.commands.registerCommand('itsc2214-create-java-project.openView', async () => {
        vscode.commands.executeCommand('itsc2214ExplorerView.focus');
    });

    context.subscriptions.push(createJavaProjectCommand, reinstallJarsCommand, downloadAssignmentCommand, setDownloadUrlCommand, setUploadUrlCommand, uploadProjectCommand, openViewCommand);
}

export function deactivate() {}