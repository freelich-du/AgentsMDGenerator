# AGENTS.md Generator

## Overview

This VS Code extension automates the generation of AGENTS.md documentation files for all folders in a workspace using GitHub Copilot Chat. It features a webview-based portal interface for configuration and monitoring, supports customizable ignore patterns and prompt templates, and processes folders in a leaf-to-root order to ensure parent folders can reference child documentation. The extension leverages the VS Code Language Model API to provide intelligent, context-aware documentation generation with real-time progress tracking. The codebase follows a modular architecture with separate concerns for model selection, folder analysis, documentation generation, status management, and workspace coordination.

## Key Components

- **extension.ts** (~270 lines): Main extension entry point that handles activation, command registration, and orchestrates the workflow. Key functions include `activate()` for initialization and command registration (`openPortal`, `selectModel`, `generateAgentsMd`, `generateSingleFolder`), plus helper functions for state management (`doRefreshWorkspaceFolders()`, `doUpdatePortalStatus()`). Manages global state variables (`discoveredFolders`, `folderStatusMap`, `workspaceRootPath`, `selectedModelId`) and persists user preferences to VS Code globalState.

- **modelSelector.ts**: Handles LLM model discovery and default selection logic. Exports `getAvailableModels()` to fetch all available models from VS Code Language Model API with debugging logs, and `getDefaultModelId()` implementing priority-based selection (Claude Sonnet 4.5 > GPT-5-Codex > Auto) using exact ID matching to avoid relying on model names or families that may change.

- **folderAnalyzer.ts** (~180 lines): Analyzes folder contents and builds structured context for AI prompts. Exports `getFolderStructure()` which reads up to 10 code files (2500 chars each), 3 config files (1000 chars), and 2 doc files (800 chars), plus analyzes sub-folders without AGENTS.md (3 files per folder, 1500 chars). Also exports `getSubfolderAgentsDocs()` to collect existing AGENTS.md content from child folders (up to 3000 chars each) for parent folder context.

- **documentationGenerator.ts**: Core generation logic using GitHub Copilot. Exports `generateAgentsMdForFolder()` which orchestrates the generation workflow: reads existing AGENTS.md if present, calls `getFolderStructure()` and `getSubfolderAgentsDocs()`, builds prompt via `buildPrompt()`, invokes LLM with selected model, and writes output. Also exports `mergeWithExistingContent()` which uses LLM to intelligently merge new content with existing custom sections while updating standard sections.

- **statusManager.ts** (~170 lines): Tracks generation status and manages folder metadata for portal display. Exports `updatePortalStatus()` as main entry point, plus `FolderDocStatusDetails` interface. Key functions: `buildStatusSnapshot()` aggregates status for all folders with metrics (total, completed, inProgress, failed), `getFolderStatusDetails()` checks AGENTS.md existence and freshness, `getLatestContentMtime()` recursively finds newest file modification time while respecting TIMESTAMP_IGNORED_DIRECTORIES.

- **workspaceManager.ts**: Handles workspace scanning and folder tree initialization. Exports `refreshWorkspaceFolders()` which calls `buildFolderTree()` from folderScanner, flattens to depth-ordered array, preserves or resets generation status based on options, and updates portal. Returns new state object with `discoveredFolders`, `folderStatusMap`, and `workspaceRootPath` for extension.ts to update global state.

- **portalViewProvider.ts** (~1100 lines): Webview panel provider that renders the interactive portal UI with HTML/CSS/JavaScript. Implements `PortalViewProvider` class with `showPortal()` to display interface immediately (non-blocking), `getHtml()` to generate complete webview content, and message handlers for bidirectional communication (generate, selectModel, updateIgnoreConfig, updatePromptConfig, openAgentsFile, generateSingleFolder). Features expandable settings sections, loading spinner with proper timing, and real-time status table with folder depth indentation.

- **folderScanner.ts**: Recursive folder tree builder that creates hierarchical structure of workspace folders. Key functions: `buildFolderTree()` initiates scanning from workspace root, `buildFolderNode()` recursively traverses directories while respecting ignore patterns, and `flattenFoldersByDepth()` sorts folders by depth (deepest first) for leaf-to-root processing. Integrates with ignoreConfig for pattern-based filtering.

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
