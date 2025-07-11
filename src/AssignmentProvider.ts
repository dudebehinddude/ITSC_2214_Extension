import {
    commands,
    Uri,
    window,
    workspace,
    TreeDataProvider,
    EventEmitter,
    Event,
    TreeItem,
    TreeItemCollapsibleState,
    ThemeIcon
} from 'vscode';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';
import * as unzip from 'unzip-stream';

type AssignmentItemData = {
    '@_category': string;
    '@_name': string;
    '@_version': string;
    description: string;
    entry: { '@_url': string };
};

class AssignmentTreeItem extends TreeItem {
    children?: AssignmentTreeItem[];
    itemData?: AssignmentItemData;

    constructor(
        label: string,
        collapsibleState: TreeItemCollapsibleState,
        iconId?: string,
        children?: AssignmentTreeItem[],
        itemData?: AssignmentItemData
    ) {
        super(label, collapsibleState);
        this.children = children;
        this.itemData = itemData;
        if (iconId) {
            this.iconPath = new ThemeIcon(iconId);
        }
        if (itemData) {
            this.contextValue = 'assignment';
            this.description = itemData['@_version'];
            this.tooltip = itemData.description;
        }
    }
}

const parser = new XMLParser({ ignoreAttributes: false });

export class AssignmentProvider implements TreeDataProvider<AssignmentTreeItem> {
    private _onDidChangeTreeData: EventEmitter<AssignmentTreeItem | undefined | null | void> = new EventEmitter();
    readonly onDidChangeTreeData: Event<AssignmentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AssignmentTreeItem): TreeItem {
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
            window.showErrorMessage(`Failed to fetch assignments from ${url}. Check the URL and your internet connection.`);
            return { label: 'Error', packages: [] };
        }

        const content = await resp.text();
        const xml = parser.parse(content);
        const site = xml.snarf_site;

        let packages = [];
        if (site && site.package) {
            packages = Array.isArray(site.package) ? site.package : [site.package];
        }

        return {
            label: site ? site['@_name'] : 'Unnamed Site',
            packages: packages,
        };
    }

    private async fetchData(): Promise<AssignmentTreeItem[]> {
        const config = workspace.getConfiguration('itsc2214');
        const downloadURL = config.get<string>('downloadURL');

        if (!downloadURL) {
            window.showWarningMessage('Assignment download URL is not configured.');
            return [];
        }

        const { label, packages } = await this.fetchSite(downloadURL);

        const itemsByCategory = packages.reduce<{ [key: string]: AssignmentTreeItem[] }>((acc, pkg) => {
            const category = pkg['@_category'];
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(new AssignmentTreeItem(pkg['@_name'], TreeItemCollapsibleState.None, 'package', undefined, pkg));
            return acc;
        }, {});

        const categoryItems = Object.entries(itemsByCategory).map(([categoryLabel, children]) => {
            children.sort((a, b) => (a.label! as string).localeCompare(b.label! as string));
            return new AssignmentTreeItem(categoryLabel, TreeItemCollapsibleState.Collapsed, 'folder', children);
        });

        categoryItems.sort((a, b) => (a.label! as string).localeCompare(b.label! as string));

        const rootItem = new AssignmentTreeItem(label, TreeItemCollapsibleState.Expanded, 'project', categoryItems);
        return [rootItem];
    }
}

async function downloadAndUnzip(itemData: AssignmentItemData): Promise<string | undefined> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        window.showInformationMessage('Please open a folder to download the assignment into.');
        return undefined;
    }
    const targetDir = workspaceFolders[0].uri.fsPath;
    const unzipPath = path.join(targetDir, itemData['@_name']);

    if (fs.existsSync(unzipPath)) {
        const choice = await window.showWarningMessage(`Directory "${itemData['@_name']}" already exists. Overwrite?`, "Yes", "No");
        if (choice !== 'Yes') {
            return undefined;
        }
    } else {
        fs.mkdirSync(unzipPath, { recursive: true });
    }

    const resp = await fetch(itemData.entry['@_url']);
    if (!resp.ok) {
        window.showErrorMessage(`Failed to download assignment: ${resp.statusText}`);
        return undefined;
    }

    return new Promise((resolve, reject) => {
        const extractStream = unzip.Extract({ path: unzipPath });
        resp.body.pipe(extractStream);
        extractStream.on('finish', () => resolve(unzipPath));
        extractStream.on('error', reject);
    });
}

export async function downloadAssignment(item: AssignmentTreeItem) {
    if (!item || !item.itemData) {
        return;
    }
    const itemData = item.itemData;

    try {
        const unzipPath = await window.withProgress(
            {
                location: { viewId: 'itsc2214ExplorerView' },
                title: `Downloading ${itemData['@_name']}...`,
                cancellable: false
            },
            () => downloadAndUnzip(itemData)
        );

        if (!unzipPath) {
            return;
        }

        const selection = await window.showInformationMessage(`Successfully downloaded "${itemData['@_name']}".`, 'Open Folder');
        if (selection === 'Open Folder') {
            await commands.executeCommand('vscode.openFolder', Uri.file(unzipPath), { forceNewWindow: false });
        }
    } catch (err: any) {
        window.showErrorMessage(`An error occurred: ${err.message}`);
        console.error(err);
    }
}

export async function setDownloadUrl() {
    const config = workspace.getConfiguration('itsc2214');
    const currentUrl = config.get<string>('downloadURL') || '';

    const newUrl = await window.showInputBox({
        prompt: 'Enter the assignment download URL (snarf.xml)',
        value: currentUrl,
        validateInput: value => (!value || value.trim().length === 0) ? 'URL cannot be empty.' : null
    });

    if (newUrl) {
        await config.update('downloadURL', newUrl, true);
        window.showInformationMessage('Download URL updated.');
        commands.executeCommand('itsc2214.refreshAssignments');
    }
}

export function openView() {
    commands.executeCommand('workbench.view.extension.itsc2214Explorer');
}