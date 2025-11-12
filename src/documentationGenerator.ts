import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FolderNode } from './folderScanner';
import { buildPrompt } from './promptConfig';
import { getFolderStructure, getSubfolderAgentsDocs } from './folderAnalyzer';

/**
 * Use LLM to intelligently merge existing content with newly generated content
 * This preserves custom sections while updating standard sections
 */
export async function mergeWithExistingContent(
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
export async function generateAgentsMdForFolder(
	folderNode: FolderNode,
	selectedModelId: string | undefined
): Promise<boolean> {
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
