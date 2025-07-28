import { commands, ExtensionContext, window, workspace } from 'vscode';
import { createJavaProject, reinstallJars } from './createProject';
import { AssignmentProvider, downloadAssignment, setDownloadUrl, openView } from './AssignmentProvider';

export function activate(context: ExtensionContext) {
    console.log("========Extension Activated========")
    const assignmentProvider = new AssignmentProvider();
    window.createTreeView('itsc2214ExplorerView', { treeDataProvider: assignmentProvider });

    workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('itsc2214.downloadURL')) {
            assignmentProvider.refresh();
        }
    });

    context.subscriptions.push(
        commands.registerCommand('itsc2214.createJavaProject', () => createJavaProject(context)),
        commands.registerCommand('itsc2214.reinstallJars', () => reinstallJars(context)),
        commands.registerCommand('itsc2214.setDownloadUrl', () => setDownloadUrl()),
        commands.registerCommand('itsc2214.downloadAssignment', (item) => downloadAssignment(item, context)),
        commands.registerCommand('itsc2214.refreshAssignments', () => assignmentProvider.refresh()),
        commands.registerCommand('itsc2214.openView', openView)
    );
}