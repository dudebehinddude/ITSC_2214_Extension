# itsc2214 README

This is the ITSC2214 vscode extension for students at UNC Charlotte.

## Features
* Custom ITSC2214 JAR environment.
* Custom ITSC2214 Java Project Creation.


## Requirements

Currently none.

## Extension Settings

This extension contributes the following settings:
* itsc2214.downloadURL: The URL for downloading projects to the IDE.
* itsc2214.signonURL: The URL for signing into WebCat

This extension contributes the following commands:
* `itsc2214.createJavaProject`: Create a new pure Java project referencing local JARS.
* `itsc2214.reinstallJars`: Reinstalls the 2214 JARS to the user's current itsc2214/JARS directory, or a custom directory.
* 'itsc2214.refreshAssignments': Fetchs the assignment list from the downloadURL
* 'itsc2214.openView': Builds and opens the assignment fileview.
* 'itsc2214.downloadAssignment': Downloads and unpacks the zip project.


## Release Notes

### 1.0.0

Initial release of itsc2214-java-create-project:
* Working JAR environment
* Custom ITSC2214 folder
* Project Upload/Download
* Create Java Project

### 1.0.1
* Removed upload project
* Simplified dependencies



---