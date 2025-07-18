import * as vscode from 'vscode'; // Changed to import the entire vscode namespace
import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';
import * as unzip from 'unzip-stream';

type AssignmentItemData = {
    label: string;
    description: string;
    url: string;
};

class AssignmentTreeItem extends vscode.TreeItem { // Use vscode.TreeItem
    children?: AssignmentTreeItem[];
    itemData?: AssignmentItemData;

    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState, // Use vscode.TreeItemCollapsibleState
        iconId?: string,
        children?: AssignmentTreeItem[],
        itemData?: AssignmentItemData
    ) {
        super(label, collapsibleState);
        this.children = children;
        this.itemData = itemData;
        if (iconId) {
            this.iconPath = new vscode.ThemeIcon(iconId); // Use vscode.ThemeIcon
        }
        if (itemData) {
            this.contextValue = 'assignment';
            this.description = itemData.description;
            this.tooltip = itemData.description;
        }
    }
}

export class AssignmentProvider implements vscode.TreeDataProvider<AssignmentTreeItem> { // Use vscode.TreeDataProvider
    private _onDidChangeTreeData: vscode.EventEmitter<AssignmentTreeItem | undefined | null | void> = new vscode.EventEmitter(); // Use vscode.EventEmitter
    readonly onDidChangeTreeData: vscode.Event<AssignmentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event; // Use vscode.Event

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AssignmentTreeItem): vscode.TreeItem { // Use vscode.TreeItem
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
            vscode.window.showErrorMessage(`Failed to fetch assignments from ${url}. Check the URL and your internet connection.`); // Use vscode.window
            return { label: 'Error', packages: [] };
        }

        const content = await resp.json();
        
        if (!Array.isArray(content)) {
            vscode.window.showErrorMessage('Invalid assignment data format: Expected an array of assignments.'); // Use vscode.window
            return { label: 'Error', packages: [] };
        }

        return {
            label: 'Available Assignments',
            packages: content as AssignmentItemData[],
        };
    }

    private async fetchData(): Promise<AssignmentTreeItem[]> {
        const config = vscode.workspace.getConfiguration('itsc2214'); // Use vscode.workspace
        const downloadURL = config.get<string>('downloadURL');

        if (!downloadURL) {
            vscode.window.showWarningMessage('Assignment download URL is not configured.'); // Use vscode.window
            return [];
        }

        const { label, packages } = await this.fetchSite(downloadURL);

        const assignmentItems = packages.map(pkg =>
            new AssignmentTreeItem(pkg.label, vscode.TreeItemCollapsibleState.None, 'package', undefined, pkg) // Use vscode.TreeItemCollapsibleState
        );

        assignmentItems.sort((a, b) => (a.label! as string).localeCompare(b.label! as string));

        const rootItem = new AssignmentTreeItem(label, vscode.TreeItemCollapsibleState.Expanded, 'project', assignmentItems); // Use vscode.TreeItemCollapsibleState
        return [rootItem];
    }
}

async function downloadAndUnzip(itemData: AssignmentItemData, context: vscode.ExtensionContext): Promise<string | undefined> {
    const itsc2214Dir = context.globalState.get<string>('itsc2214Dir');

    let targetDir: string;
    if (itsc2214Dir && fs.existsSync(itsc2214Dir)) {
        targetDir = itsc2214Dir;
    } else {
        vscode.window.showErrorMessage('ITSC2214 project directory not set or does not exist. Please create a project first using "ITSC2214: Create Java Project".'); // Use vscode.window
        return undefined;
    }
    
    const unzipPath = path.join(targetDir, itemData.label.replace(/[^a-zA-Z0-9- ]/g, '').replace(/\s+/g, '-'));

    if (fs.existsSync(unzipPath)) {
        const choice = await vscode.window.showWarningMessage(`Directory "${itemData.label}" already exists. Overwrite?`, "Yes", "No"); // Use vscode.window
        if (choice !== 'Yes') {
            return undefined;
        }
    } else {
        fs.mkdirSync(unzipPath, { recursive: true });
    }

    const resp = await fetch(itemData.url);
    if (!resp.ok) {
        vscode.window.showErrorMessage(`Failed to download assignment: ${resp.statusText}`); // Use vscode.window
        return undefined;
    }

    return new Promise((resolve, reject) => {
        const extractStream = unzip.Extract({ path: unzipPath });
        resp.body.pipe(extractStream);
        extractStream.on('finish', () => resolve(unzipPath));
        extractStream.on('error', reject);
    });
}

export async function downloadAssignment(item: AssignmentTreeItem, context: vscode.ExtensionContext) {
    if (!item || !item.itemData) {
        return;
    }
    const itemData = item.itemData;

    const unzipPath = await vscode.window.withProgress( // Use vscode.window
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

    const selection = await vscode.window.showInformationMessage(`Successfully downloaded "${itemData.label}".`, 'Open Folder'); // Use vscode.window
    if (selection === 'Open Folder') {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(unzipPath), { forceNewWindow: true }); // Use vscode.commands and vscode.Uri
    }
}

export async function setDownloadUrl() {
    const config = vscode.workspace.getConfiguration('itsc2214'); // Use vscode.workspace
    const currentUrl = config.get<string>('downloadURL') || '';

    const newUrl = await vscode.window.showInputBox({ // Use vscode.window
        prompt: 'Enter the assignment download URL (snarf.json)',
        value: currentUrl,
        validateInput: value => (!value || value.trim().length === 0) ? 'URL cannot be empty.' : null
    });

    if (newUrl) {
        await config.update('downloadURL', newUrl, true);
        vscode.window.showInformationMessage('Download URL updated.'); // Use vscode.window
        vscode.commands.executeCommand('itsc2214.refreshAssignments'); // Use vscode.commands
    }
}

export function openView() {
    vscode.commands.executeCommand('workbench.view.extension.itsc2214Explorer'); // Use vscode.commands
}
