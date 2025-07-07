import {commands as vs_commands} from 'vscode';

const downloadAssignmentCommand = vs_commands.registerCommand('itsc2214-create-java-project.downloadAssignment', async (assignment?: Assignment) => {
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
}