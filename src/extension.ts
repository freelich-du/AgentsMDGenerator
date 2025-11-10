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

	portalViewProvider = new PortalViewProvider();
	context.subscriptions.push(portalViewProvider);

	context.subscriptions.push(
		vscode.commands.registerCommand('AgentsMDGenerator.openPortal', async () => {
			if (!portalViewProvider) {
				return;
			}
			await refreshWorkspaceFolders();
			const availableModels = await getAvailableModels();
			const ignoreConfig = getIgnoreConfig();
			portalViewProvider.showPortal(availableModels, selectedModelId, ignoreConfig);
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
			portalViewProvider?.showPortal(availableModels, selectedModelId, ignoreConfig);

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
}

/**
 * Get available language models from GitHub Copilot
 */
async function getAvailableModels(): Promise<Array<{ id: string; name: string; family: string; vendor: string }>> {
	try {
		const allModels = await vscode.lm.selectChatModels();
		
		// Map models to a simplified format
		return allModels.map(model => ({
			id: model.id,
			name: model.name,
			family: model.family,
			vendor: model.vendor
		}));
	} catch (error) {
		console.error('Error fetching available models:', error);
		return [];
	}
}

/**
 * Get the structure and file list of a folder
 */
async function getFolderStructure(folderPath: string): Promise<string> {
	let structure = '';
	
	try {
		const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
		
		structure += `Folder: ${folderPath}\n`;
		structure += `Contents:\n`;
		
		for (const entry of entries) {
			const type = entry.isDirectory() ? '[DIR]' : '[FILE]';
			structure += `  ${type} ${entry.name}\n`;
		}
		
		// Get file contents for analysis (limited to reasonable files)
		const codeFiles = entries.filter(e => 
			!e.isDirectory() && 
			(e.name.endsWith('.ts') || e.name.endsWith('.js') || 
			 e.name.endsWith('.py') || e.name.endsWith('.md') ||
			 e.name.endsWith('.json') || e.name.endsWith('.tsx') || 
			 e.name.endsWith('.jsx'))
		);
		
		if (codeFiles.length > 0) {
			structure += `\nRelevant files:\n`;
			for (const file of codeFiles.slice(0, 5)) { // Limit to first 5 files
				const filePath = path.join(folderPath, file.name);
				try {
					const content = await fs.promises.readFile(filePath, 'utf-8');
					// Limit content size to avoid token limits
					const truncatedContent = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
					structure += `\n--- ${file.name} ---\n${truncatedContent}\n`;
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
				// Limit content to avoid token overflow
				const truncatedContent = content.length > 2000 ? content.substring(0, 2000) + '...' : content;
				subfolderDocs.set(child.name, truncatedContent);
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
 * Generate AGENTS.md file for a specific folder using GitHub Copilot Chat
 */
async function generateAgentsMdForFolder(folderNode: FolderNode): Promise<boolean> {
	try {
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
			}
		}
		
		// Fallback to default model if selected model not available
		if (!model) {
			const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
			if (models.length === 0) {
				throw new Error('No Copilot models available. Please ensure GitHub Copilot is installed and active.');
			}
			model = models[0];
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
		
		// Write AGENTS.md file
		const agentsFilePath = path.join(folderNode.path, 'AGENTS.md');
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
