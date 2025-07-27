# ITSC 2214 Project Creator

A Visual Studio Code extension for creating ITSC 2214 projects.

## Features

- **Java Project Creation**: Quickly scaffolds a new Java project with the necessary directory structure and build configurations.
- **Assignment Downloader**: Downloads and sets up assignments from a remote server. Supports XML-based assignment lists.
- **JAR Management**: Automatically includes required JAR files for course projects.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd your-repo-name
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Open the project in Visual Studio Code.
5.  Press `F5` to run the extension in a new Extension Development Host window.

## Usage

1.  Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows).
2.  Run the "ITSC2214: Create Java Project" command.
3.  Follow the prompts to specify the project name and location.
4.  Use the "ITSC2214: Assignments" view in the Explorer to browse and download assignments.

## Dependencies

-   `node-fetch`: For making HTTP requests to download assignments.
-   `unzip-stream`: For unzipping downloaded assignment files.
-   `xml2js`: For parsing XML-based assignment lists.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with any improvements.

## License

This project is licensed under the MIT License.