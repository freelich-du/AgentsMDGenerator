// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FolderNode } from './folderScanner';
import { PortalViewProvider } from './portalViewProvider';
import { GenerationStatus } from './statusTypes';
import { updateIgnoreConfig, getIgnoreConfig } from './ignoreConfig';
import { updatePromptConfig, getPromptConfig, PromptConfig } from './promptConfig';
import { getAvailableModels, getDefaultModelId } from './modelSelector';
import { generateAgentsMdForFolder } from './documentationGenerator';
import { updatePortalStatus, getFolderStatusDetails } from './statusManager';
import { refreshWorkspaceFolders } from './workspaceManager';

let portalViewProvider: PortalViewProvider | undefined;
let folderStatusMap: Map<string, GenerationStatus> = new Map();
let discoveredFolders: FolderNode[] = [];
let workspaceRootPath = '';
let selectedModelId: string | undefined;

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

	// Helper function to refresh workspace state
	const doRefreshWorkspaceFolders = async (options = {}) => {
		const result = await refreshWorkspaceFolders(
			portalViewProvider,
			discoveredFolders,
			folderStatusMap,
			workspaceRootPath,
			options
		);
		discoveredFolders = result.discoveredFolders;
		folderStatusMap = result.folderStatusMap;
		workspaceRootPath = result.workspaceRootPath;
	};

	// Helper function to update portal
	const doUpdatePortalStatus = async () => {
		await updatePortalStatus(portalViewProvider, discoveredFolders, folderStatusMap, workspaceRootPath);
	};

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
					await doRefreshWorkspaceFolders();
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
			await doRefreshWorkspaceFolders();
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

	void doRefreshWorkspaceFolders().catch((error) => {
		console.error('Failed to refresh workspace folders during activation:', error);
	});

	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			void doRefreshWorkspaceFolders().catch((error) => {
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

			await doRefreshWorkspaceFolders({ resetStatuses: true });
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
					await doUpdatePortalStatus();
					
					const success = await generateAgentsMdForFolder(folderNode, selectedModelId);
					
					folderStatusMap.set(
						folderNode.path,
						success ? GenerationStatus.Completed : GenerationStatus.Failed
					);
					await doUpdatePortalStatus();
					
					processed++;
				}

				vscode.window.showInformationMessage(`Successfully generated AGENTS.md for ${processed} folders!`);
			});

		} catch (error) {
			vscode.window.showErrorMessage(`Error generating AGENTS.md: ${error}`);
		}
	});

	context.subscriptions.push(generateCommand);

	const generateOutdatedCommand = vscode.commands.registerCommand('AgentsMDGenerator.generateOutdatedFolders', async () => {
		try {
			if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
				workspaceRootPath = '';
				vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
				return;
			}

			await doRefreshWorkspaceFolders();
			const availableModels = await getAvailableModels();
			const ignoreConfig = getIgnoreConfig();
			const promptConfig = getPromptConfig();
			portalViewProvider?.showPortal(availableModels, selectedModelId, ignoreConfig, promptConfig);

			const detailsList = await Promise.all(discoveredFolders.map(async (folderNode) => ({
				folderNode,
				details: await getFolderStatusDetails(folderNode.path)
			})));
			const outdatedFolders = detailsList
				.filter((entry) => !entry.details.isUpToDate)
				.map((entry) => entry.folderNode);

			if (outdatedFolders.length === 0) {
				vscode.window.showInformationMessage('All folders appear up to date. No generation needed.');
				return;
			}

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Generating AGENTS.md for out-of-date folders',
				cancellable: true
			}, async (progress, token) => {
				const totalFolders = outdatedFolders.length;
				progress.report({ message: `Found ${totalFolders} folder(s) needing updates (leaf to root)` });

				let processed = 0;

				for (const folderNode of outdatedFolders) {
					if (token.isCancellationRequested) {
						vscode.window.showWarningMessage('Out-of-date folder generation cancelled');
						return;
					}

					progress.report({
						message: `Processing folder ${processed + 1}/${totalFolders}: ${folderNode.name}`,
						increment: (100 / totalFolders)
					});

					folderStatusMap.set(folderNode.path, GenerationStatus.InProgress);
					await doUpdatePortalStatus();

					const success = await generateAgentsMdForFolder(folderNode, selectedModelId);

					folderStatusMap.set(
						folderNode.path,
						success ? GenerationStatus.Completed : GenerationStatus.Failed
					);
					await doUpdatePortalStatus();

					processed++;
				}

				vscode.window.showInformationMessage(`Finished processing ${processed} out-of-date folder(s).`);
			});
		} catch (error) {
			vscode.window.showErrorMessage(`Error generating AGENTS.md for out-of-date folders: ${error}`);
		}
	});

	context.subscriptions.push(generateOutdatedCommand);

	const refreshStatusCommand = vscode.commands.registerCommand('AgentsMDGenerator.refreshStatusSnapshot', async () => {
		try {
			if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
				workspaceRootPath = '';
				vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
				return;
			}

			await doRefreshWorkspaceFolders();
		} catch (error) {
			vscode.window.showErrorMessage(`Error refreshing folder status: ${error}`);
		}
	});

	context.subscriptions.push(refreshStatusCommand);

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
				await doUpdatePortalStatus();

				const success = await generateAgentsMdForFolder(folderNode, selectedModelId);

				folderStatusMap.set(
					folderNode.path,
					success ? GenerationStatus.Completed : GenerationStatus.Failed
				);
				await doUpdatePortalStatus();

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

// This method is called when your extension is deactivated
export function deactivate() {}
