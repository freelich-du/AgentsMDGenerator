# Testing the AGENTS.md Generator Extension

## Quick Start

1. **Open this project in VS Code** (you're already here!)

2. **Press F5** to launch the Extension Development Host
   - A new VS Code window will open with your extension loaded
   - This is a separate instance for testing

3. **In the new window:**
   - Open a folder/workspace (File > Open Folder)
   - Open the **AGENTS.md** portal from the activity bar
   - Click **Generate AGENTS.md Files** inside the portal **or** run the command manually:
     - Open Command Palette: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
     - Type: **"Generate AGENTS.md files for all folders"**
     - Select the command

4. **Watch the magic happen:**
   - Progress notification appears
   - Portal dashboard shows live totals and folder statuses
   - Extension scans all folders
   - GitHub Copilot analyzes each folder
   - AGENTS.md files are created

## Prerequisites

✅ **GitHub Copilot Extension** must be installed and active
✅ **Active GitHub Copilot subscription**
✅ You must consent to Copilot usage on first run

## What to Expect

- The extension will skip common folders: `node_modules`, `.git`, `dist`, `out`, `build`, `.vscode`, `coverage`
- Progress shows: "Processing folder X/Y: foldername"
- Each folder gets an AGENTS.md file with AI-generated documentation
- If Copilot fails, a fallback template is created

## Debugging

- Set breakpoints in `src/extension.ts`
- Check Debug Console for logs
- Watch for errors in the Extension Development Host

## Making Changes

1. Edit code in `src/extension.ts`
2. Save the file
3. In Extension Development Host: `Ctrl+R` / `Cmd+R` to reload
4. Or stop debugging (Shift+F5) and press F5 again

## Build for Distribution

```bash
npm run package
```

This creates a production build in `dist/extension.js`.

## Common Issues

**"No Copilot models available"**
- Ensure GitHub Copilot extension is installed
- Check your Copilot subscription is active
- Sign in to GitHub in VS Code

**"No workspace folder is open"**
- You must open a folder before running the command
- Single files won't work - need a workspace

**Extension not appearing**
- Check the command is registered in `package.json`
- Verify extension compiled without errors
- Reload the Extension Development Host
