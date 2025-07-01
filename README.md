# itsc2214-create-java-project README

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
* `itsc2214-create-java-project.createJavaProject`: Create a new pure Java project referencing local JARS.
* `itsc2214-create-java-project.reinstallJars`: Reinstalls the 2214 JARS to the user's current itsc2214/JARS folder, or a custom.


## Release Notes

### 1.0.0

Initial release of itsc2214-java-create-project
\nAdded proper filepath checking features.
Added project creation with JAR reference.
Planning to add webcat submitter without snarfer.



---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)



