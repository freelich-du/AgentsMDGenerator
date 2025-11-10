# AGENTS.md Generator

A VS Code extension that automatically generates AGENTS.md documentation files for all folders in your project using GitHub Copilot Chat. Features intelligent **leaf-to-root** traversal and a **portal dashboard** to track generation status.

## Features

- **🪟 Portal Dashboard**: Dedicated sidebar view with a "Generate" button and live status cards
- **📊 Real-time Status Tracking**: Watch generation progress with live summaries and folder list
- **🍃 Leaf-to-Root Processing**: Processes deepest folders first, so parent folders can reference child documentation
- **🧠 Contextual Documentation**: Parent folders include summaries of sub-folder AGENTS.md files
- **⚙️ Configurable Prompts**: Easy-to-customize prompt templates in `promptConfig.ts`
- **🎯 Smart Filtering**: Automatically excludes common build and dependency folders (node_modules, .git, dist, etc.)
- **🔄 Fallback Support**: Creates basic documentation if Copilot is unavailable
- **✨ Progress Tracking**: Visual progress indicator shows generation status

## Requirements

- VS Code version 1.105.0 or higher
- **GitHub Copilot** extension must be installed and active
- Active GitHub Copilot subscription

## Usage

### Using the Portal (Recommended)

1. Open a workspace/folder in VS Code
2. Click the **"AGENTS.md"** icon in the activity bar (left edge) to open the portal
3. Press the **"Generate AGENTS.md Files"** button in the portal view
4. Watch the dashboard update with live metrics and a folder status list
5. Re-run the button any time to regenerate documentation

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

### Customizable Prompts

Edit `src/promptConfig.ts` to customize the prompt template:

```typescript
export const DEFAULT_PROMPT_TEMPLATE = `...your template...`;
```

The template supports variables:
- `{{FOLDER_STRUCTURE}}` - Folder contents and file previews
- `{{SUBFOLDER_CONTEXT}}` - AGENTS.md content from sub-folders
- `{{SUBFOLDER_DOCS}}` - Individual sub-folder documentation

## What Gets Generated

Each AGENTS.md file includes:
1. **Overview**: Brief description of the folder/module
2. **Purpose**: Main responsibilities of this folder
3. **Key Files**: Important files and their roles
4. **Sub-folders**: Summary of documented sub-folders (for parent folders)
5. **Dependencies**: Relationships with other parts of the project
6. **Usage**: Instructions or examples if applicable

## Extension Settings

This extension currently has no configurable settings. Customize prompts by editing `src/promptConfig.ts`.

## Known Issues

- Large projects with many folders may take some time to process
- Token limits may truncate analysis of folders with very large files
- Requires active GitHub Copilot subscription

## Release Notes

### 0.0.2

Major feature update:
- 🪟 **Portal Dashboard**: Replaced tree view with a webview portal and one-click generation button
- 🍃 **Leaf-to-Root Processing**: Folders now processed from deepest to shallowest
- 📚 **Contextual Documentation**: Parent folders include summaries of sub-folder docs
- ⚙️ **Configurable Prompts**: Easy-to-edit prompt templates in `promptConfig.ts`
- 📊 **Live Metrics**: Portal cards show totals for completed, in-progress, and failed folders
- � **Status List**: Scrollable list of folder statuses within the portal

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
