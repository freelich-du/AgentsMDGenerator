# AGENTS.md Generator

A VS Code extension that automatically generates AGENTS.md documentation files for all folders in your project using GitHub Copilot Chat.

## Features

- **Automatic Folder Analysis**: Recursively scans all folders in your workspace
- **AI-Powered Documentation**: Uses GitHub Copilot Chat to analyze folder contents and generate comprehensive documentation
- **Progress Tracking**: Visual progress indicator shows generation status
- **Smart Filtering**: Automatically excludes common build and dependency folders (node_modules, .git, dist, etc.)
- **Fallback Support**: Creates basic documentation if Copilot is unavailable

## Requirements

- VS Code version 1.105.0 or higher
- **GitHub Copilot** extension must be installed and active
- Active GitHub Copilot subscription

## Usage

1. Open a workspace/folder in VS Code
2. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac)
3. Type and select: **"Generate AGENTS.md files for all folders"**
4. Wait for the extension to process all folders
5. AGENTS.md files will be created in each folder

## What Gets Generated

Each AGENTS.md file includes:
- Brief description of the folder/module
- Main purpose and responsibilities
- Key files and their roles
- Dependencies and relationships
- Usage instructions or examples

## Extension Settings

This extension currently has no configurable settings.

## Known Issues

- Large projects with many folders may take some time to process
- Token limits may truncate analysis of folders with very large files
- Requires active GitHub Copilot subscription

## Release Notes

### 0.0.1

Initial release:
- Recursive folder scanning
- GitHub Copilot Chat integration
- AGENTS.md generation for all folders
- Progress tracking and error handling

## Development

To test this extension locally:

1. Clone the repository
2. Run `npm install` to install dependencies
3. Press `F5` to open a new VS Code window with the extension loaded
4. Open a folder/workspace in the extension development host
5. Run the "Generate AGENTS.md files for all folders" command

## Building

```bash
npm run compile
```

## License

See LICENSE file for details.
