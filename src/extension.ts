import { window as vs_window, commands as vs_commands, ExtensionContext} from 'vscode';
import { reinstallJars, areJarsPresent } from "./CreateProject";
import { AssignmentProvider } from "./AssignmentProvider";


export const activate = (context: ExtensionContext) {
    console.log('ITSC2214: Extension is now active!');

    const assignmentProvider = new AssignmentProvider();
    vs_window.createTreeView('itsc2214ExplorerView', { treeDataProvider: assignmentProvider });

    context.subscriptions.push(
        vs_commands.registerCommand("itsc2214.createJavaProject", createJavaProject), 
        vs_commands.registerCommand("itsc2214.reinstallJars", reinstallJars), 
        vs_commands.registerCommand("itsc2214.downloadAssignment", downloadAssignment), 
        vs_commands.registerCommand("itsc2214.setDownloadUrl", setDownloadUrl), 
        vs_commands.registerCommand("itsc2214.setUploadUrl", setUploadUrlCommand), 
        vs_commands.registerCommand("itsc2214.uploadProject", uploadProject), 
        vs_commands.registerCommand("itsc2214.openView", openView),
        vs_commands.registerCommand("itsc2214.refreshDownloads", assignmentProvider.refresh())
    );
}