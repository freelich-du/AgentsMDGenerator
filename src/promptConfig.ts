export const DEFAULT_PROMPT_TEMPLATE = `Analyze the following folder and generate an AGENTS.md file.

The AGENTS.md file should include:
1. **Overview**: A brief description of what this folder/module contains
2. **Purpose**: The main purpose and responsibilities of this folder
3. **Key Files**: List and describe the important files in this folder and their roles
4. **Sub-folders**: If this folder has sub-folders with AGENTS.md files, summarize their purposes
5. **Dependencies**: Any dependencies or relationships with other parts of the project
6. **Usage**: Usage instructions or examples if applicable

{{SUBFOLDER_CONTEXT}}

Folder Information:
{{FOLDER_STRUCTURE}}

Please generate a well-structured AGENTS.md file in markdown format. Be concise but comprehensive.`;

export const DEFAULT_SUBFOLDER_CONTEXT_TEMPLATE = `
Sub-folder Documentation:
The following sub-folders have been documented:

{{SUBFOLDER_DOCS}}

Use this information to provide a higher-level overview of this folder's structure and organization.
`;

export interface PromptConfig {
	mainTemplate: string;
	subfolderContextTemplate: string;
}

// Runtime configuration
let runtimePromptConfig: PromptConfig = {
	mainTemplate: DEFAULT_PROMPT_TEMPLATE,
	subfolderContextTemplate: DEFAULT_SUBFOLDER_CONTEXT_TEMPLATE
};

/**
 * Update the runtime prompt configuration
 */
export function updatePromptConfig(config: PromptConfig): void {
	runtimePromptConfig = config;
}

/**
 * Get current prompt configuration
 */
export function getPromptConfig(): PromptConfig {
	return {
		mainTemplate: runtimePromptConfig.mainTemplate,
		subfolderContextTemplate: runtimePromptConfig.subfolderContextTemplate
	};
}

export function buildPrompt(
	folderStructure: string,
	subfolderDocs?: Map<string, string>
): string {
	const config = getPromptConfig();
	let prompt = config.mainTemplate;

	// Add subfolder context if available
	if (subfolderDocs && subfolderDocs.size > 0) {
		let subfolderContent = '';
		for (const [folderName, agentsMdContent] of subfolderDocs.entries()) {
			subfolderContent += `\n### ${folderName}\n${agentsMdContent}\n`;
		}
		
		const subfolderContext = config.subfolderContextTemplate.replace(
			'{{SUBFOLDER_DOCS}}',
			subfolderContent
		);
		
		prompt = prompt.replace('{{SUBFOLDER_CONTEXT}}', subfolderContext);
	} else {
		prompt = prompt.replace('{{SUBFOLDER_CONTEXT}}', '');
	}

	// Add folder structure
	prompt = prompt.replace('{{FOLDER_STRUCTURE}}', folderStructure);

	return prompt;
}
