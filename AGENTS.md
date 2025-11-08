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
- **activate()**: Registers the portal webview and generation command
- **buildStatusSnapshot()**: Compiles folder status metrics for the portal dashboard
- **generateAgentsMdForFolder()**: Integrates with Copilot Chat API to generate documentation
- **updatePortalStatus()**: Streams progress updates to the portal UI

### `src/folderScanner.ts`
Builds a filtered folder tree and provides leaf-to-root ordering for documentation generation.

### `src/portalViewProvider.ts`
Creates the portal dashboard webview with a generate button, live metrics, and folder status list.

### `src/statusTypes.ts`
Shared status enums and interfaces for keeping the portal and generator in sync.

### `package.json`
Extension manifest defining:
- Extension metadata (name, version, description)
- Portal view container contribution: `agentsPortalView`
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
1. User opens the AGENTS.md portal and clicks **Generate AGENTS.md Files** (or runs the command)
2. Extension validates workspace is open and builds the folder tree
3. Portal dashboard initializes counts and folder statuses
4. For each folder (leaf-to-root order):
   - Reads directory structure and file contents
   - Uses sub-folder AGENTS.md files for context when available
   - Calls Copilot Chat API with assembled prompt
   - Streams response and writes AGENTS.md
   - Updates portal metrics and status list in real time
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
