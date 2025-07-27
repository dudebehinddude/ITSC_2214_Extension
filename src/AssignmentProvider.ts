import * as vscode from 'vscode';
import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';
import * as os from 'os';
import * as unzip from 'unzip-stream';
import { Parser, parseStringPromise } from 'xml2js';

type AssignmentItemData = {
    label: string;
    description: string;
    url: string;
};

class AssignmentTreeItem extends vscode.TreeItem {
    children?: AssignmentTreeItem[];
    itemData?: AssignmentItemData;

    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        iconId?: string,
        children?: AssignmentTreeItem[],
        itemData?: AssignmentItemData
    ) {
        super(label, collapsibleState);
        this.children = children;
        this.itemData = itemData;
        if (iconId) {
            this.iconPath = new vscode.ThemeIcon(iconId);
        }
        if (itemData) {
            this.contextValue = 'assignment';
            this.description = itemData.description;
            this.tooltip = itemData.description;
        }
    }
}

export class AssignmentProvider implements vscode.TreeDataProvider<AssignmentTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AssignmentTreeItem | undefined | null | void> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<AssignmentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AssignmentTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: AssignmentTreeItem): Thenable<AssignmentTreeItem[]> {
        if (element) {
            return Promise.resolve(element.children || []);
        }
        return this.fetchData();
    }

    private async fetchSite(url: string): Promise<{ label: string; packages: AssignmentItemData[] }> {
        const resp = await fetch(url);
        if (!resp.ok) {
            vscode.window.showErrorMessage(`Failed to fetch assignments from ${url}. Check the URL and your internet connection.`);
            return { label: 'Error', packages: [] };
        }

        const content = await resp.text();
        try {
            const result = await parseStringPromise(content);
            const siteName = result.snarf_site.$.name;
            const packages = result.snarf_site.package.map((p: any) => ({
                label: p.$.name,
                description: p.description[0],
                url: p.entry[0].$.url,
            }));
            return { label: siteName, packages };
        } catch (error) {
            vscode.window.showErrorMessage('Failed to parse assignment data.');
            return { label: 'Error', packages: [] };
        }
    }

    private async fetchData(): Promise<AssignmentTreeItem[]> {
        const config = vscode.workspace.getConfiguration('itsc2214');
        const downloadURL = config.get<string>('downloadURL');

        if (!downloadURL) {
            vscode.window.showWarningMessage('Assignment download URL is not configured.');
            return [];
        }

        const { label, packages } = await this.fetchSite(downloadURL);

        const assignmentItems = packages.map(pkg =>
            new AssignmentTreeItem(pkg.label, vscode.TreeItemCollapsibleState.None, undefined, undefined, pkg)
        );

        assignmentItems.sort((a, b) => (a.label! as string).localeCompare(b.label! as string));

        const rootItem = new AssignmentTreeItem(label, vscode.TreeItemCollapsibleState.Expanded, 'project', assignmentItems);
        return [rootItem];
    }
}

async function downloadAndUnzip(itemData: AssignmentItemData, context: vscode.ExtensionContext): Promise<string | undefined> {
    const itsc2214Dir = context.globalState.get<string>('itsc2214Dir');

    let targetDir: string;
    if (itsc2214Dir && fs.existsSync(itsc2214Dir)) {
        targetDir = path.join(itsc2214Dir, 'projects');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
    } else {
        vscode.window.showErrorMessage('ITSC2214 project directory not set or does not exist. Please create a project first using "ITSC2214: Create Java Project".');
        return undefined;
    }
    
    const unzipPath = path.join(targetDir, itemData.label.replace(/[^a-zA-Z0-9- ]/g, '').replace(/\s+/g, '-'));

    if (fs.existsSync(unzipPath)) {
        const choice = await vscode.window.showWarningMessage(`Directory "${itemData.label}" already exists. Overwrite?`, "Yes", "No");
        if (choice !== 'Yes') {
            return undefined;
        }
        fs.rmSync(unzipPath, { recursive: true, force: true });
    }
    
    fs.mkdirSync(unzipPath, { recursive: true });

    const resp = await fetch(itemData.url);
    if (!resp.ok) {
        vscode.window.showErrorMessage(`Failed to download assignment: ${resp.statusText}`);
        return undefined;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itsc2214-unzip-'));

    return new Promise((resolve, reject) => {
        const extractStream = unzip.Extract({ path: tempDir });
        resp.body.pipe(extractStream);
        extractStream.on('error', reject);
        extractStream.on('finish', () => {
            try {
                const topLevelFiles = fs.readdirSync(tempDir);
                const macosxPath = path.join(tempDir, '__MACOSX');
                if (fs.existsSync(macosxPath)) {
                    fs.rmSync(macosxPath, { recursive: true, force: true });
                }

                topLevelFiles.forEach(file => {
                    if (file.startsWith('._')) {
                        fs.rmSync(path.join(tempDir, file), { recursive: true, force: true });
                    }
                });

                let projectRoot = tempDir;
                const remainingFiles = fs.readdirSync(tempDir);
                if (remainingFiles.length === 1 && fs.statSync(path.join(tempDir, remainingFiles[0])).isDirectory()) {
                    projectRoot = path.join(tempDir, remainingFiles[0]);
                }

                const projectFiles = fs.readdirSync(projectRoot);
                for (const file of projectFiles) {
                    const oldPath = path.join(projectRoot, file);
                    const newPath = path.join(unzipPath, file);
                    fs.renameSync(oldPath, newPath);
                }

                fs.rmSync(tempDir, { recursive: true, force: true });
                
                resolve(unzipPath);
            } catch (e) {
                reject(e);
            }
        });
    });
}

export async function downloadAssignment(item: AssignmentTreeItem, context: vscode.ExtensionContext) {
    if (!item || !item.itemData) {
        return;
    }
    const itemData = item.itemData;

    const unzipPath = await vscode.window.withProgress(
        {
            location: { viewId: 'itsc2214ExplorerView' },
            title: `Downloading ${itemData.label}...`,
            cancellable: false
        },
        () => downloadAndUnzip(itemData, context)
    );

    if (!unzipPath) {
        return;
    }

    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(unzipPath), { forceNewWindow: true });
}

export async function setDownloadUrl() {
    const config = vscode.workspace.getConfiguration('itsc2214');
    const currentUrl = config.get<string>('downloadURL') || '';

    const newUrl = await vscode.window.showInputBox({
        prompt: 'Enter the assignment download URL (snarf.json)',
        value: currentUrl,
        validateInput: value => (!value || value.trim().length === 0) ? 'URL cannot be empty.' : null
    });

    if (newUrl) {
        await config.update('downloadURL', newUrl, true);
        vscode.window.showInformationMessage('Download URL updated.');
        vscode.commands.executeCommand('itsc2214.refreshAssignments');
    }
}

export function openView() {
    vscode.commands.executeCommand('workbench.view.extension.itsc2214Explorer');
}
