# AGENTS.md Generator

A VS Code extension that automatically generates AGENTS.md documentation files for all folders in your project using GitHub Copilot Chat.

## Requirements

- VS Code version 1.105.0 or higher
- **GitHub Copilot** extension must be installed and active
- Active GitHub Copilot subscription

## Quick start

### Using the Portal (Recommended)

1. Open a workspace/folder in VS Code
2. **Open the AGENTS.md Portal** (one of the following):
   - Use Command Palette: `Ctrl+Shift+P` → "AGENTS.md: Open AGENTS.md Portal"
   - **One-click**: [Open Portal](command:AgentsMDGenerator.openPortal)
3. Configure settings if needed (ignore patterns, prompts, LLM model)
4. Click **"Generate AGENTS.md Files"** button
5. Monitor real-time progress with live metrics and folder status updates
6. Re-run generation any time to update documentation

> 💡 **Tip**: The portal provides configurable ignore patterns (to exclude folders like `node_modules`) and customizable prompt templates for AI-generated documentation.

### Using Command Palette

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac)
2. Type: **"Generate AGENTS.md files for all folders"**
3. Select the command
4. Wait for processing to complete

## How It Works

### Leaf-to-Root Processing

The extension processes folders from **deepest to shallowest** (leaf to root):

1. Identifies all folders in workspace
2. Sorts by depth (deepest first)
3. Generates AGENTS.md for leaf folders first
4. Parent folders can then reference their children's AGENTS.md content
5. Root folder gets highest-level overview based on all sub-folders

### Contextual Documentation

When generating AGENTS.md for a folder:
- **Direct files** in the folder are analyzed
- **Sub-folder AGENTS.md files** are included as context
- Copilot generates a higher-level overview that summarizes both

## What Gets Generated

Each AGENTS.md file includes:

1. **Overview**: Purpose, responsibilities, architecture, and how it fits in the project (3-5 sentences)
2. **Key Components**: Main files with their roles, key functions/classes, and architectural fit
3. **Sub-folders**: Summary of documented sub-folders
4. **Related Folders/Files**: Dependencies and relationships with other parts of the project
5. **For More Details**: Links to sub-folder documentation

The AI analyzes actual code content to generate comprehensive, context-aware documentation.

## Development

To develop and test this extension locally:

1. Clone the repository
2. Run `npm install` to install dependencies
3. Press `F5` to launch the Extension Development Host (new VS Code window)
4. In the Extension Development Host:
   - Open a folder/workspace to test with
   - Run command: "Open AGENTS.md Portal"
5. Test generation, configuration changes, and UI interactions
6. Check the Debug Console in the main VS Code window for logs

## Building

```bash
npm run compile
```

## Packaging as VSIX

To create a distributable VSIX file that can be installed in VS Code:

```bash
npm run vsce:package
```

This will create a `.vsix` file in the root directory (e.g., `agents-md-generator-0.0.1.vsix`).

### Installing the VSIX

1. In VS Code, open the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
2. Click the `...` menu at the top of the Extensions view
3. Select **"Install from VSIX..."**
4. Browse to and select your `.vsix` file

Or install via command line:

```bash
code --install-extension agents-md-generator-0.0.1.vsix
```

## License

See LICENSE file for details.
