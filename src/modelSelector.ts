import * as vscode from 'vscode';

/**
 * Get available language models from GitHub Copilot
 */
export async function getAvailableModels(): Promise<Array<{ id: string; name: string; family: string; vendor: string }>> {
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
export function getDefaultModelId(models: Array<{ id: string; name: string; family: string; vendor: string }>): string | undefined {
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
	
	console.log('No preferred model found, no default model selected');
	return undefined;
}
