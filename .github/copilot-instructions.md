# AGENTS.md Generator Extension

This VS Code extension generates AGENTS.md documentation files for all folders in a workspace using GitHub Copilot Chat.

## Project Structure

- `src/extension.ts` - Main extension code with command registration and implementation
- `package.json` - Extension manifest and dependencies
- `tsconfig.json` - TypeScript configuration
- `esbuild.js` - Build configuration for bundling

## Key Features

- Recursive folder traversal with smart filtering
- GitHub Copilot Chat API integration for AI-powered analysis
- Progress tracking and error handling
- Fallback documentation generation

## Development Guidelines

- Use VS Code Language Model Chat API for Copilot integration
- Handle errors gracefully with fallback content
- Respect cancellation tokens for long-running operations
- Exclude common build/dependency folders from processing

## Testing

Press F5 to launch the extension in debug mode in a new VS Code window.
