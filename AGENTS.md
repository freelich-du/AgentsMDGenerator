# AGENTS.md Generator Extension

## Overview
This folder contains a complete VS Code extension that generates AGENTS.md documentation files for all folders in a workspace using GitHub Copilot Chat integration.

## Purpose
The extension provides automated documentation generation by:
- Recursively scanning workspace folders
- Analyzing folder contents and structure
- Using GitHub Copilot's Language Model API to generate contextual documentation
- Creating AGENTS.md files in each folder with AI-generated insights

## Key Files

### `src/extension.ts`
Main extension implementation containing:
- **activate()**: Extension activation and command registration
- **getAllFolders()**: Recursive folder traversal with smart filtering (excludes node_modules, .git, dist, etc.)
- **getFolderStructure()**: Analyzes folder contents and reads relevant source files
- **generateAgentsMdForFolder()**: Integrates with Copilot Chat API to generate documentation

### `package.json`
Extension manifest defining:
- Extension metadata (name, version, description)
- Activation events
- Command contributions: `AgentsMDGenerator.generateAgentsMd`
- Dependencies and build scripts

### `tsconfig.json`
TypeScript compiler configuration for VS Code extension development

### `esbuild.js`
Build configuration for bundling the extension using esbuild

### `.vscode/`
VS Code workspace settings including:
- `launch.json`: Debug configuration for F5 extension testing
- `tasks.json`: Build tasks for compilation
- `settings.json`: Editor settings

## Dependencies
- **vscode**: VS Code extensibility API (^1.105.0)
- **TypeScript**: Type-safe development
- **esbuild**: Fast bundling and compilation
- **GitHub Copilot**: Required for AI-powered documentation generation

## Usage Flow
1. User invokes command via Command Palette
2. Extension validates workspace is open
3. Recursive folder scan identifies all directories
4. For each folder:
   - Reads directory structure and file contents
   - Constructs analysis prompt
   - Calls Copilot Chat API with folder context
   - Streams response and writes AGENTS.md
5. Progress notifications keep user informed
6. Error handling provides fallback documentation

## VS Code APIs Used
- `vscode.commands.registerCommand`: Command registration
- `vscode.window.withProgress`: Progress UI
- `vscode.lm.selectChatModels`: Copilot model selection
- `vscode.LanguageModelChatMessage`: Chat message construction
- `model.sendRequest`: Copilot API interaction
- `vscode.workspace.workspaceFolders`: Workspace access

## Testing
Press **F5** to launch Extension Development Host and test the extension in a new VS Code window.

## Build Commands
- `npm run compile`: Type-check, lint, and build
- `npm run watch`: Watch mode for development
- `npm run package`: Production build
