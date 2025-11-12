// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { buildFolderTree, flattenFoldersByDepth, FolderNode } from './folderScanner';
import { buildPrompt } from './promptConfig';
import { PortalViewProvider } from './portalViewProvider';
import { GenerationStatus, StatusSnapshot } from './statusTypes';
import { 
	DEFAULT_IGNORED_FOLDER_NAMES, 
	DEFAULT_IGNORED_FOLDER_PATTERNS,
	updateIgnoreConfig,
	getIgnoreConfig
} from './ignoreConfig';
import {
	DEFAULT_PROMPT_TEMPLATE,
	DEFAULT_SUBFOLDER_CONTEXT_TEMPLATE,
	updatePromptConfig,
	getPromptConfig,
	PromptConfig
} from './promptConfig';

let portalViewProvider: PortalViewProvider | undefined;
let folderStatusMap: Map<string, GenerationStatus> = new Map();
let discoveredFolders: FolderNode[] = [];
let workspaceRootPath = '';
let selectedModelId: string | undefined;

const TIMESTAMP_IGNORED_DIRECTORIES = new Set([
	'node_modules',
	'.git',
	'dist',
	'out',
	'build',
	'.vscode',
	'coverage'
]);

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('AGENTS.md Generator extension is now active!');

	// Load selected model from global state
	selectedModelId = context.globalState.get<string>('selectedModelId');

	// Load ignore configuration from global state
	const savedIgnoreNames = context.globalState.get<string[]>('ignoreNames');
	const savedIgnorePatterns = context.globalState.get<string[]>('ignorePatterns');
	if (savedIgnoreNames && savedIgnorePatterns) {
		updateIgnoreConfig(savedIgnoreNames, savedIgnorePatterns);
	}

	// Load prompt configuration from global state
	const savedPromptConfig = context.globalState.get<PromptConfig>('promptConfig');
	if (savedPromptConfig) {
		updatePromptConfig(savedPromptConfig);
	}

	portalViewProvider = new PortalViewProvider();
	context.subscriptions.push(portalViewProvider);

	context.subscriptions.push(
		vscode.commands.registerCommand('AgentsMDGenerator.openPortal', async () => {
			if (!portalViewProvider) {
				return;
			}
			
			// Open portal immediately without waiting for data
			portalViewProvider.showPortal();
			
			// Load data asynchronously in the background
			void (async () => {
				try {
					await refreshWorkspaceFolders();
					const availableModels = await getAvailableModels();
					const ignoreConfig = getIgnoreConfig();
					const promptConfig = getPromptConfig();
					
					// Set default model if none selected
					if (!selectedModelId && availableModels.length > 0) {
						const defaultModelId = getDefaultModelId(availableModels);
						if (defaultModelId) {
							selectedModelId = defaultModelId;
							await context.globalState.update('selectedModelId', defaultModelId);
							console.log('Auto-selected default model:', defaultModelId);
						}
					}
					
					// Update portal with loaded data
					portalViewProvider.showPortal(availableModels, selectedModelId, ignoreConfig, promptConfig);
				} catch (error) {
					console.error('Error loading portal data:', error);
				}
			})();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('AgentsMDGenerator.selectModel', async (modelId: string) => {
			selectedModelId = modelId;
			await context.globalState.update('selectedModelId', modelId);
			vscode.window.showInformationMessage(`Selected model: ${modelId}`);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('AgentsMDGenerator.updateIgnoreConfig', async (names: string[], patterns: string[]) => {
			updateIgnoreConfig(names, patterns);
			await context.globalState.update('ignoreNames', names);
			await context.globalState.update('ignorePatterns', patterns);
			await refreshWorkspaceFolders();
			vscode.window.showInformationMessage('Ignore configuration updated');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('AgentsMDGenerator.updatePromptConfig', async (config: PromptConfig) => {
			updatePromptConfig(config);
			await context.globalState.update('promptConfig', config);
			vscode.window.showInformationMessage('Prompt configuration updated');
		})
	);

	void refreshWorkspaceFolders().catch((error) => {
		console.error('Failed to refresh workspace folders during activation:', error);
	});

	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			void refreshWorkspaceFolders().catch((error) => {
				console.error('Failed to refresh workspace folders after change:', error);
			});
		})
	);

	// Register the command to generate AGENTS.md files
	const generateCommand = vscode.commands.registerCommand('AgentsMDGenerator.generateAgentsMd', async () => {
		try {
			// Check if workspace is open
			if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
				workspaceRootPath = '';
				vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
				return;
			}

			await refreshWorkspaceFolders({ resetStatuses: true });
			const availableModels = await getAvailableModels();
			const ignoreConfig = getIgnoreConfig();
			const promptConfig = getPromptConfig();
			portalViewProvider?.showPortal(availableModels, selectedModelId, ignoreConfig, promptConfig);

			// Show progress indicator
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Generating AGENTS.md files",
				cancellable: true
			}, async (progress, token) => {
				const totalFolders = discoveredFolders.length;
				progress.report({ message: `Found ${totalFolders} folders to process (leaf to root)` });

				if (totalFolders === 0) {
					vscode.window.showInformationMessage('No eligible folders found to document.');
					return;
				}

				let processed = 0;

				// Process each folder from leaf to root
				for (const folderNode of discoveredFolders) {
					if (token.isCancellationRequested) {
						vscode.window.showWarningMessage('AGENTS.md generation cancelled');
						return;
					}

					progress.report({ 
						message: `Processing folder ${processed + 1}/${totalFolders}: ${folderNode.name}`,
						increment: (100 / totalFolders)
					});

					folderStatusMap.set(folderNode.path, GenerationStatus.InProgress);
					await updatePortalStatus();
					
					const success = await generateAgentsMdForFolder(folderNode);
					
					folderStatusMap.set(
						folderNode.path,
						success ? GenerationStatus.Completed : GenerationStatus.Failed
					);
					await updatePortalStatus();
					
					processed++;
				}

				vscode.window.showInformationMessage(`Successfully generated AGENTS.md for ${processed} folders!`);
			});

		} catch (error) {
			vscode.window.showErrorMessage(`Error generating AGENTS.md: ${error}`);
		}
	});

	context.subscriptions.push(generateCommand);

	// Register the command to generate AGENTS.md for a single folder
	const generateSingleFolderCommand = vscode.commands.registerCommand('AgentsMDGenerator.generateSingleFolder', async (folderPath: string) => {
		try {
			// Find the folder node for this path
			const folderNode = discoveredFolders.find(f => f.path === folderPath);
			if (!folderNode) {
				vscode.window.showErrorMessage('Folder not found in workspace.');
				return;
			}

			// Show progress indicator
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Generating AGENTS.md for ${folderNode.name}`,
				cancellable: false
			}, async (progress) => {
				progress.report({ message: 'Processing...' });

				folderStatusMap.set(folderNode.path, GenerationStatus.InProgress);
				await updatePortalStatus();

				const success = await generateAgentsMdForFolder(folderNode);

				folderStatusMap.set(
					folderNode.path,
					success ? GenerationStatus.Completed : GenerationStatus.Failed
				);
				await updatePortalStatus();

				if (success) {
					vscode.window.showInformationMessage(`Successfully generated AGENTS.md for ${folderNode.name}!`);
				} else {
					vscode.window.showWarningMessage(`Failed to generate AGENTS.md for ${folderNode.name}.`);
				}
			});

		} catch (error) {
			vscode.window.showErrorMessage(`Error generating AGENTS.md: ${error}`);
		}
	});

	context.subscriptions.push(generateSingleFolderCommand);
}

/**
 * Get available language models from GitHub Copilot
 */
async function getAvailableModels(): Promise<Array<{ id: string; name: string; family: string; vendor: string }>> {
	try {
		const allModels = await vscode.lm.selectChatModels();
		
		// Map models to a simplified format
		const models = allModels.map(model => ({
			id: model.id,
			name: model.name,
			family: model.family,
			vendor: model.vendor
		}));
		
		// Log available models for debugging
		console.log('Available LLM models:', JSON.stringify(models, null, 2));
		
		return models;
	} catch (error) {
		console.error('Error fetching available models:', error);
		return [];
	}
}

/**
 * Get default model ID based on priority: Claude Sonnet 4.5 > GPT-5-Codex > auto
 */
function getDefaultModelId(models: Array<{ id: string; name: string; family: string; vendor: string }>): string | undefined {
	// Priority 1: Claude Sonnet 4.5
	const claudeSonnet = models.find(m => m.id === 'claude-sonnet-4.5');
	
	if (claudeSonnet) {
		console.log('Using default model: Claude Sonnet 4.5 -', claudeSonnet.id);
		return claudeSonnet.id;
	}
	
	// Priority 2: GPT-5-Codex
	const gpt5Codex = models.find(m => m.id === 'gpt-5-codex');
	
	if (gpt5Codex) {
		console.log('Using default model: GPT-5-Codex -', gpt5Codex.id);
		return gpt5Codex.id;
	}
	
	// Priority 3: Auto
	const autoModel = models.find(m => m.id === 'auto');
	if (autoModel) {
		console.log('Using default model: Auto -', autoModel.id);
		return autoModel.id;
	}
	
	console.log('No preferred model found, using undefined (will fallback to gpt-4o)');
	return undefined;
}

/**
 * Get the structure and file list of a folder
 */
async function getFolderStructure(folderPath: string): Promise<string> {
	let structure = '';
	
	try {
		const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
		
		structure += `## Folder Structure: ${path.basename(folderPath)}\n\n`;
		
		// Separate directories and files
		const directories = entries.filter(e => e.isDirectory());
		const files = entries.filter(e => !e.isDirectory());
		
		if (directories.length > 0) {
			structure += `### Sub-directories:\n`;
			for (const dir of directories) {
				const agentsPath = path.join(folderPath, dir.name, 'AGENTS.md');
				const hasAgents = fs.existsSync(agentsPath);
				structure += `- ${dir.name}/ ${hasAgents ? '(has AGENTS.md)' : '(no AGENTS.md - will analyze contents)'}\n`;
			}
			structure += '\n';
		}
		
		if (files.length > 0) {
			structure += `### Files in this folder:\n`;
			for (const file of files) {
				structure += `- ${file.name}\n`;
			}
			structure += '\n';
		}
		
		// Get file contents for analysis - prioritize code files
		const codeFiles = files.filter(e => 
			e.name.endsWith('.ts') || e.name.endsWith('.js') || 
			e.name.endsWith('.py') || e.name.endsWith('.java') ||
			e.name.endsWith('.tsx') || e.name.endsWith('.jsx') ||
			e.name.endsWith('.cs') || e.name.endsWith('.go') ||
			e.name.endsWith('.cpp') || e.name.endsWith('.c') ||
			e.name.endsWith('.rs') || e.name.endsWith('.rb')
		);
		
		const configFiles = files.filter(e =>
			e.name.endsWith('.json') || e.name.endsWith('.yaml') ||
			e.name.endsWith('.yml') || e.name.endsWith('.toml') ||
			e.name.endsWith('.xml') || e.name === 'Dockerfile' ||
			e.name.endsWith('.config.js') || e.name.endsWith('.config.ts')
		);
		
		const docFiles = files.filter(e =>
			e.name.endsWith('.md') && e.name !== 'AGENTS.md'
		);
		
		// Include up to 10 code files from this folder with more content
		if (codeFiles.length > 0) {
			structure += `## Code Files in This Folder (for analysis):\n\n`;
			for (const file of codeFiles.slice(0, 10)) {
				const filePath = path.join(folderPath, file.name);
				try {
					const content = await fs.promises.readFile(filePath, 'utf-8');
					// Increase limit to capture more code context
					const truncatedContent = content.length > 2500 ? content.substring(0, 2500) + '\n... (truncated)' : content;
					structure += `### File: ${file.name}\n\`\`\`\n${truncatedContent}\n\`\`\`\n\n`;
				} catch (err) {
					structure += `### File: ${file.name}\n(Unable to read file)\n\n`;
				}
			}
		}
		
		// Now analyze sub-folders that don't have AGENTS.md
		const subfoldersWithoutAgents = directories.filter(dir => {
			const agentsPath = path.join(folderPath, dir.name, 'AGENTS.md');
			return !fs.existsSync(agentsPath);
		});
		
		if (subfoldersWithoutAgents.length > 0) {
			structure += `## Code Files in Sub-folders Without AGENTS.md:\n\n`;
			
			for (const dir of subfoldersWithoutAgents) {
				const subfolderPath = path.join(folderPath, dir.name);
				
				try {
					const subEntries = await fs.promises.readdir(subfolderPath, { withFileTypes: true });
					const subCodeFiles = subEntries.filter(e =>
						!e.isDirectory() && (
							e.name.endsWith('.ts') || e.name.endsWith('.js') ||
							e.name.endsWith('.py') || e.name.endsWith('.java') ||
							e.name.endsWith('.tsx') || e.name.endsWith('.jsx') ||
							e.name.endsWith('.cs') || e.name.endsWith('.go') ||
							e.name.endsWith('.cpp') || e.name.endsWith('.c') ||
							e.name.endsWith('.rs') || e.name.endsWith('.rb')
						)
					);
					
					if (subCodeFiles.length > 0) {
						structure += `### Sub-folder: ${dir.name}/\n`;
						
						// Read up to 3 code files from each sub-folder
						for (const file of subCodeFiles.slice(0, 3)) {
							const filePath = path.join(subfolderPath, file.name);
							try {
								const content = await fs.promises.readFile(filePath, 'utf-8');
								const truncatedContent = content.length > 1500 ? content.substring(0, 1500) + '\n... (truncated)' : content;
								structure += `\n#### File: ${dir.name}/${file.name}\n\`\`\`\n${truncatedContent}\n\`\`\`\n\n`;
							} catch (err) {
								structure += `\n#### File: ${dir.name}/${file.name}\n(Unable to read file)\n\n`;
							}
						}
						
						if (subCodeFiles.length > 3) {
							structure += `... and ${subCodeFiles.length - 3} more files in ${dir.name}/\n\n`;
						}
					}
				} catch (err) {
					console.error(`Error reading sub-folder ${subfolderPath}:`, err);
				}
			}
		}
		
		// Include important config files
		if (configFiles.length > 0) {
			structure += `## Configuration Files:\n\n`;
			for (const file of configFiles.slice(0, 3)) {
				const filePath = path.join(folderPath, file.name);
				try {
					const content = await fs.promises.readFile(filePath, 'utf-8');
					const truncatedContent = content.length > 1000 ? content.substring(0, 1000) + '\n... (truncated)' : content;
					structure += `### ${file.name}\n\`\`\`\n${truncatedContent}\n\`\`\`\n\n`;
				} catch (err) {
					// Skip files that can't be read
				}
			}
		}
		
		// Include documentation files
		if (docFiles.length > 0) {
			structure += `## Documentation Files:\n\n`;
			for (const file of docFiles.slice(0, 2)) {
				const filePath = path.join(folderPath, file.name);
				try {
					const content = await fs.promises.readFile(filePath, 'utf-8');
					const truncatedContent = content.length > 800 ? content.substring(0, 800) + '\n... (truncated)' : content;
					structure += `### ${file.name}\n${truncatedContent}\n\n`;
				} catch (err) {
					// Skip files that can't be read
				}
			}
		}
		
	} catch (error) {
		console.error(`Error getting folder structure for ${folderPath}:`, error);
	}
	
	return structure;
}

/**
 * Get AGENTS.md content from direct sub-folders
 */
async function getSubfolderAgentsDocs(folderNode: FolderNode): Promise<Map<string, string>> {
	const subfolderDocs = new Map<string, string>();
	
	for (const child of folderNode.children) {
		const agentsPath = path.join(child.path, 'AGENTS.md');
		if (fs.existsSync(agentsPath)) {
			try {
				const content = await fs.promises.readFile(agentsPath, 'utf-8');
				// Keep full content for better context, but still limit for token management
				const truncatedContent = content.length > 3000 ? content.substring(0, 3000) + '\n... (see full file for more details)' : content;
				// Store with relative path for redirect links
				const relativePath = path.relative(folderNode.path, child.path);
				subfolderDocs.set(relativePath, truncatedContent);
			} catch (err) {
				console.error(`Error reading AGENTS.md from ${child.path}:`, err);
			}
		}
	}
	
	return subfolderDocs;
}

async function updatePortalStatus() {
	if (!portalViewProvider) {
		return;
	}
	const snapshot = await buildStatusSnapshot();
	portalViewProvider.update(snapshot);
}

async function buildStatusSnapshot(): Promise<StatusSnapshot> {
	const total = discoveredFolders.length;
	const sortedForDisplay = [...discoveredFolders].sort((a, b) =>
		a.path.localeCompare(b.path)
	);

	const items = await Promise.all(sortedForDisplay.map(async (folder) => {
		const status = folderStatusMap.get(folder.path) ?? GenerationStatus.NotStarted;
		const relativePath = computeRelativeFolderPath(folder.path);
		const details = await getFolderStatusDetails(folder.path);
		return {
			path: folder.path,
			name: folder.name,
			relativePath,
			depth: computeFolderDepth(relativePath),
			status,
			...details
		};
	}));

	let completed = 0;
	let inProgress = 0;
	let failed = 0;

	for (const item of items) {
		switch (item.status) {
			case GenerationStatus.Completed:
				completed++;
				break;
			case GenerationStatus.InProgress:
				inProgress++;
				break;
			case GenerationStatus.Failed:
				failed++;
				break;
		}
	}

	return {
		total,
		completed,
		inProgress,
		failed,
		items,
		lastUpdated: new Date().toLocaleTimeString()
	};
}

/**
 * Use LLM to intelligently merge existing content with newly generated content
 * This preserves custom sections while updating standard sections
 */
async function mergeWithExistingContent(
	existingContent: string, 
	newContent: string,
	model: vscode.LanguageModelChat
): Promise<string> {
	const mergePrompt = `You are a documentation merge assistant. You need to intelligently merge an existing AGENTS.md file with newly generated content.

INSTRUCTIONS:
1. The NEW content contains updated information about the folder structure, files, and components
2. The EXISTING content may have custom sections (like "Coding Styles", "Architecture Decisions", "Testing Guidelines", etc.) that should be PRESERVED
3. Standard sections (like Overview, Key Components, Sub-folders, etc.) should be REPLACED with the new content
4. Custom sections that don't appear in the new content should be KEPT and placed after the standard sections
5. If the existing content has a custom section that seems to overlap with standard content, prefer the NEW content but keep any unique information
6. Maintain the same markdown formatting and structure
7. Do NOT add any explanatory text - just output the merged markdown content

EXISTING CONTENT:
${existingContent}

---

NEW CONTENT:
${newContent}

---

OUTPUT THE MERGED CONTENT (just the markdown, no explanations):`;

	try {
		const messages = [
			vscode.LanguageModelChatMessage.User(mergePrompt)
		];
		
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
		
		let mergedContent = '';
		for await (const fragment of response.text) {
			mergedContent += fragment;
		}
		
		return mergedContent.trim();
	} catch (error) {
		console.error('Error merging content with LLM:', error);
		// Fallback: just append existing custom sections to new content
		return newContent + '\n\n---\n\n## Previous Custom Content\n\n' + existingContent;
	}
}

/**
 * Generate AGENTS.md file for a specific folder using GitHub Copilot Chat
 */
async function generateAgentsMdForFolder(folderNode: FolderNode): Promise<boolean> {
	try {
		const agentsFilePath = path.join(folderNode.path, 'AGENTS.md');
		
		// Check if AGENTS.md already exists
		let existingContent: string | undefined;
		if (fs.existsSync(agentsFilePath)) {
			try {
				existingContent = await fs.promises.readFile(agentsFilePath, 'utf-8');
				console.log(`Found existing AGENTS.md in ${folderNode.path}, will merge with new content`);
			} catch (err) {
				console.error(`Error reading existing AGENTS.md for ${folderNode.path}:`, err);
			}
		}
		
		// Get folder structure and contents
		const folderStructure = await getFolderStructure(folderNode.path);
		
		// Get AGENTS.md from direct sub-folders (they were processed first due to leaf-to-root order)
		const subfolderDocs = await getSubfolderAgentsDocs(folderNode);
		
		// Build prompt using configurable template
		const prompt = buildPrompt(folderStructure, subfolderDocs);
		
		// Select Copilot model
		let model: vscode.LanguageModelChat | undefined;
		
		if (selectedModelId) {
			// Try to use the user-selected model
			const models = await vscode.lm.selectChatModels({ id: selectedModelId });
			if (models.length > 0) {
				model = models[0];
			} else {
				throw new Error(`Selected model '${selectedModelId}' is not available. Please select a different model.`);
			}
		} else {
			throw new Error('No model selected. Please select a model from the portal before generating documentation.');
		}
		
		// Create chat message
		const messages = [
			vscode.LanguageModelChatMessage.User(prompt)
		];
		
		// Send request to Copilot
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
		
		// Collect the response
		let agentsContent = '';
		for await (const fragment of response.text) {
			agentsContent += fragment;
		}
		
		// If there's existing content, use LLM to intelligently merge it
		if (existingContent) {
			console.log(`Merging existing content with new content for ${folderNode.path}`);
			agentsContent = await mergeWithExistingContent(existingContent, agentsContent, model);
		}
		
		// Write AGENTS.md file
		await fs.promises.writeFile(agentsFilePath, agentsContent, 'utf-8');
		
		console.log(`Generated AGENTS.md for ${folderNode.path}`);
		return true;
		
	} catch (error) {
		if (error instanceof vscode.LanguageModelError) {
			console.error(`Language Model Error in ${folderNode.path}:`, error.message, error.code);
			
			if (error.cause instanceof Error && error.cause.message.includes('off_topic')) {
				console.log('Request was considered off-topic');
			}
		} else {
			console.error(`Error generating AGENTS.md for ${folderNode.path}:`, error);
		}
		
		// Create a basic AGENTS.md if Copilot fails
		const fallbackContent = `# ${folderNode.name}\n\n*This folder requires documentation. AGENTS.md generation encountered an error.*\n\nPlease manually document this folder's purpose and contents.`;
		const agentsFilePath = path.join(folderNode.path, 'AGENTS.md');
		await fs.promises.writeFile(agentsFilePath, fallbackContent, 'utf-8');
		return false;
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}

interface FolderDocStatusDetails {
	hasAgentsFile: boolean;
	agentsUpdatedAt?: string;
	contentUpdatedAt?: string;
	isUpToDate: boolean;
}

interface RefreshOptions {
	resetStatuses?: boolean;
}

async function refreshWorkspaceFolders(options: RefreshOptions = {}): Promise<void> {
	const { resetStatuses = false } = options;

	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		workspaceRootPath = '';
		discoveredFolders = [];
		folderStatusMap = new Map();
		await updatePortalStatus();
		return;
	}

	const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
	workspaceRootPath = workspaceRoot;

	try {
		const rootNode = await buildFolderTree(workspaceRoot);
		const flattened = flattenFoldersByDepth(rootNode);
		const previousStatuses = folderStatusMap;
		const nextStatusMap = new Map<string, GenerationStatus>();

		for (const folder of flattened) {
			const existing = previousStatuses.get(folder.path);
			const status = resetStatuses ? GenerationStatus.NotStarted : (existing ?? GenerationStatus.NotStarted);
			nextStatusMap.set(folder.path, status);
		}

		discoveredFolders = flattened;
		folderStatusMap = nextStatusMap;
	} catch (error) {
		console.error('Error building folder tree for workspace snapshot:', error);
		discoveredFolders = [];
		folderStatusMap = new Map();
	}

	await updatePortalStatus();
}

async function getFolderStatusDetails(folderPath: string): Promise<FolderDocStatusDetails> {
	const agentsPath = path.join(folderPath, 'AGENTS.md');
	let agentsMtimeMs: number | undefined;

	try {
		const stat = await fs.promises.stat(agentsPath);
		if (stat.isFile()) {
			agentsMtimeMs = stat.mtimeMs;
		}
	} catch (error) {
		// File might not exist – that's acceptable
	}

	const contentMtimeMs = await getLatestContentMtime(folderPath);
	const hasAgentsFile = typeof agentsMtimeMs === 'number';
	const isUpToDate = hasAgentsFile
		? (typeof contentMtimeMs === 'number' ? agentsMtimeMs! >= contentMtimeMs : true)
		: false;

	return {
		hasAgentsFile,
		agentsUpdatedAt: agentsMtimeMs ? new Date(agentsMtimeMs).toISOString() : undefined,
		contentUpdatedAt: contentMtimeMs ? new Date(contentMtimeMs).toISOString() : undefined,
		isUpToDate
	};
}

function computeRelativeFolderPath(folderPath: string): string {
	if (!workspaceRootPath) {
		return folderPath;
	}
	const relative = path.relative(workspaceRootPath, folderPath);
	return relative === '' ? '.' : relative;
}

function computeFolderDepth(relativePath: string): number {
	if (!relativePath || relativePath === '.' || !workspaceRootPath) {
		return 0;
	}
	const segments = relativePath.split(path.sep).filter((segment) => segment.length > 0);
	return segments.length;
}

async function getLatestContentMtime(folderPath: string): Promise<number | undefined> {
	let latest: number | undefined;

	let entries: fs.Dirent[];
	try {
		entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
	} catch (error) {
		console.error(`Error reading directory metadata for ${folderPath}:`, error);
		return undefined;
	}

	for (const entry of entries) {
		const entryPath = path.join(folderPath, entry.name);

		if (entry.isSymbolicLink()) {
			continue;
		}

		if (entry.isDirectory()) {
			if (TIMESTAMP_IGNORED_DIRECTORIES.has(entry.name)) {
				continue;
			}
			const childLatest = await getLatestContentMtime(entryPath);
			if (typeof childLatest === 'number') {
				latest = typeof latest === 'number' ? Math.max(latest, childLatest) : childLatest;
			}
			continue;
		}

		if (entry.name === 'AGENTS.md') {
			continue;
		}

		try {
			const stat = await fs.promises.stat(entryPath);
			latest = typeof latest === 'number' ? Math.max(latest, stat.mtimeMs) : stat.mtimeMs;
		} catch (error) {
			console.error(`Error reading file metadata for ${entryPath}:`, error);
		}
	}

	return latest;
}
