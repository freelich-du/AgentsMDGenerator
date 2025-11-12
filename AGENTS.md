# AGENTS.md Generator

## Overview

This VS Code extension automates the generation of AGENTS.md documentation files for all folders in a workspace using GitHub Copilot Chat. It features a webview-based portal interface for configuration and monitoring, supports customizable ignore patterns and prompt templates, and processes folders in a leaf-to-root order to ensure parent folders can reference child documentation. The extension leverages the VS Code Language Model API to provide intelligent, context-aware documentation generation with real-time progress tracking.

## Key Components

- **extension.ts**: Main extension entry point that handles activation, command registration, and orchestrates the documentation generation process. Key functions include `activate()` for initialization, `generateAgentsMdForFolder()` for AI-powered content generation using GitHub Copilot, `getFolderStructure()` for analyzing code files (up to 10 files with 2500 chars each), and `refreshWorkspaceFolders()` for workspace state management. Manages global state persistence for user settings.

- **portalViewProvider.ts**: Webview panel provider that renders the interactive portal UI with HTML/CSS/JavaScript. Implements `PortalViewProvider` class with `showPortal()` to display the interface and `getHtml()` to generate the complete webview content. Handles bidirectional message passing between webview and extension for actions like model selection, ignore configuration updates, and generation triggering. Features expandable settings sections and real-time status updates.

- **folderScanner.ts**: Recursive folder tree builder that creates a hierarchical structure of workspace folders. Key functions: `buildFolderTree()` initiates scanning from workspace root, `buildFolderNode()` recursively traverses directories while respecting ignore patterns, and `flattenFoldersByDepth()` sorts folders by depth (deepest first) for leaf-to-root processing. Integrates with ignoreConfig for pattern-based filtering.

- **ignoreConfig.ts**: Manages folder exclusion logic with support for exact name matching, wildcard patterns, and path-based patterns. Exports `DEFAULT_IGNORED_FOLDER_NAMES` (40+ common folders like node_modules, .git, dist) and `DEFAULT_IGNORED_FOLDER_PATTERNS` for wildcard matching. Key functions: `shouldIgnoreFolder()` checks both folder names and relative paths against patterns, `matchesPattern()` implements wildcard regex conversion, and `updateIgnoreConfig()`/`getIgnoreConfig()` for runtime configuration management.

- **promptConfig.ts**: Defines and manages AI prompt templates for documentation generation. Exports `DEFAULT_PROMPT_TEMPLATE` with comprehensive instructions for 5 sections (Overview, Key Components, Sub-folders, Related Folders/Files, For More Details) and `DEFAULT_SUBFOLDER_CONTEXT_TEMPLATE` for child folder context. `buildPrompt()` function replaces placeholders with actual folder structure and subfolder documentation, ensuring the AI receives proper context for analysis.

- **statusTypes.ts**: TypeScript type definitions for tracking generation status. Defines `GenerationStatus` enum (NotStarted, InProgress, Completed, Failed), `StatusItem` interface for individual folder tracking, and `StatusSnapshot` interface for aggregated portal state with metrics and timestamp.

- **esbuild.js**: Build configuration script that bundles the TypeScript extension into a single JavaScript file for distribution. Configures esbuild with production minification, source map generation, and watch mode support. Includes custom problem matcher plugin for development workflow integration.

## Related Folders/Files

- **package.json**: Extension manifest defining commands (`AgentsMDGenerator.openPortal`), scripts (compile, watch, package, vsce:package), and dependencies. Specifies VS Code engine requirement (^1.105.0) and repository URL.
- **tsconfig.json**: TypeScript compiler configuration for ES2022 target with strict type checking and Node.js module resolution.
- **eslint.config.mjs**: ESLint configuration for code quality enforcement across the TypeScript codebase.
- **.vscode/**: VS Code workspace settings and launch configurations for F5 debugging of extension development.
- **dist/**: Output directory containing bundled extension.js from esbuild compilation.

## For More Details

- For user documentation and setup instructions: See README.md
- For build and packaging process: See package.json scripts section
- No sub-folder documentation available yet.
