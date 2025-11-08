// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('AGENTS.md Generator extension is now active!');

	// Register the command to generate AGENTS.md files
	const disposable = vscode.commands.registerCommand('AgentsMDGenerator.generateAgentsMd', async () => {
		try {
			// Check if workspace is open
			if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
				vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
				return;
			}

			const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
			
			// Show progress indicator
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Generating AGENTS.md files",
				cancellable: true
			}, async (progress, token) => {
				// Get all folders in the workspace
				const folders = await getAllFolders(workspaceRoot);
				
				progress.report({ message: `Found ${folders.length} folders to process` });
				
				let processed = 0;
				const totalFolders = folders.length;

				// Process each folder
				for (const folder of folders) {
					if (token.isCancellationRequested) {
						vscode.window.showWarningMessage('AGENTS.md generation cancelled');
						return;
					}

					progress.report({ 
						message: `Processing folder ${processed + 1}/${totalFolders}: ${path.basename(folder)}`,
						increment: (100 / totalFolders)
					});

					await generateAgentsMdForFolder(folder);
					processed++;
				}

				vscode.window.showInformationMessage(`Successfully generated AGENTS.md for ${processed} folders!`);
			});

		} catch (error) {
			vscode.window.showErrorMessage(`Error generating AGENTS.md: ${error}`);
		}
	});

	context.subscriptions.push(disposable);
}

/**
 * Get all folders recursively in the workspace, excluding common ignored directories
 */
async function getAllFolders(rootPath: string): Promise<string[]> {
	const folders: string[] = [];
	const ignoredDirs = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.vscode', 'coverage']);

	async function traverseDirectory(dirPath: string) {
		try {
			const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
			
			for (const entry of entries) {
				if (entry.isDirectory() && !ignoredDirs.has(entry.name)) {
					const fullPath = path.join(dirPath, entry.name);
					folders.push(fullPath);
					await traverseDirectory(fullPath);
				}
			}
		} catch (error) {
			console.error(`Error reading directory ${dirPath}:`, error);
		}
	}

	// Start traversal from root and include root itself
	folders.push(rootPath);
	await traverseDirectory(rootPath);
	
	return folders;
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
 * Generate AGENTS.md file for a specific folder using GitHub Copilot Chat
 */
async function generateAgentsMdForFolder(folderPath: string) {
	try {
		// Get folder structure and contents
		const folderStructure = await getFolderStructure(folderPath);
		
		// Select Copilot model
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
		
		if (models.length === 0) {
			throw new Error('No Copilot models available. Please ensure GitHub Copilot is installed and active.');
		}
		
		const model = models[0];
		
		// Create prompt for analysis
		const prompt = `Analyze the following folder structure and generate an AGENTS.md file.

The AGENTS.md file should include:
1. A brief description of what this folder/module contains
2. The main purpose and responsibilities
3. Key files and their roles
4. Any dependencies or relationships with other parts of the project
5. Usage instructions or examples if applicable

Folder Information:
${folderStructure}

Please generate a well-structured AGENTS.md file in markdown format.`;

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
		const agentsFilePath = path.join(folderPath, 'AGENTS.md');
		await fs.promises.writeFile(agentsFilePath, agentsContent, 'utf-8');
		
		console.log(`Generated AGENTS.md for ${folderPath}`);
		
	} catch (error) {
		if (error instanceof vscode.LanguageModelError) {
			console.error(`Language Model Error in ${folderPath}:`, error.message, error.code);
			
			if (error.cause instanceof Error && error.cause.message.includes('off_topic')) {
				console.log('Request was considered off-topic');
			}
		} else {
			console.error(`Error generating AGENTS.md for ${folderPath}:`, error);
		}
		
		// Create a basic AGENTS.md if Copilot fails
		const fallbackContent = `# ${path.basename(folderPath)}\n\n*This folder requires documentation. AGENTS.md generation encountered an error.*\n\nPlease manually document this folder's purpose and contents.`;
		const agentsFilePath = path.join(folderPath, 'AGENTS.md');
		await fs.promises.writeFile(agentsFilePath, fallbackContent, 'utf-8');
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
