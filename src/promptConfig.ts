export const DEFAULT_PROMPT_TEMPLATE = `You are a technical documentation expert. Analyze the following folder and generate a concise AGENTS.md file.

CRITICAL INSTRUCTIONS:
1. READ AND ANALYZE the actual code content provided, not just file names
2. Study the sub-folder AGENTS.md files to understand the complete context
3. For sub-folders WITHOUT AGENTS.md, analyze their code files (provided in the folder structure)
4. Keep the documentation CONCISE but informative
5. ONLY include redirect links to sub-folders that actually have AGENTS.md files (provided below)

Required Sections:

## Overview
Comprehensive description (3-5 sentences) covering:
- What this folder contains and its main purpose
- Key responsibilities and functionality
- High-level architecture or data flow (if applicable)
- How it fits into the larger project

## Key Components
List the main files/modules with their specific roles (based on actual code analysis):
- **filename.ext**: Brief description (2-3 sentences) including:
  - Primary responsibility
  - Key functions/classes/exports (list 2-3 most important ones)
  - How it fits in the overall architecture

NOTE: Include files from sub-folders that don't have AGENTS.md yet (format as "subfolder/filename.ext")

## Sub-folders
{{SUBFOLDER_CONTEXT}}

## Related Folders/Files
List critical dependencies and relationships with other parts of the project:
- **Path/to/folder**: Brief description of the relationship (imports from, exports to, depends on, etc.)
- **Path/to/file**: Why this external file/folder is important to this folder

If no significant external dependencies, write: "Self-contained folder with no major external dependencies."

## For More Details
IMPORTANT: Only list sub-folders that actually have AGENTS.md files (these are provided in the Sub-folders section above).
Format: "- For [topic covered in that subfolder]: See [subfolder-name]/AGENTS.md"

If no sub-folders have AGENTS.md files yet, write: "No sub-folder documentation available yet."

Folder Information:
{{FOLDER_STRUCTURE}}

IMPORTANT: 
- Analyze actual code content, especially function/class definitions and imports
- Include 2-3 key functions/classes per file in Key Components
- Identify external dependencies from import/require statements in the code
- Document files from sub-folders WITHOUT AGENTS.md in the Key Components section
- ONLY reference sub-folders that are listed in the Sub-folders section above
- Keep total document under 350 words`;

export const DEFAULT_SUBFOLDER_CONTEXT_TEMPLATE = `
**Documented sub-folders with AGENTS.md files:**

{{SUBFOLDER_DOCS}}

REMINDER: In the "For More Details" section, ONLY reference the sub-folders listed above. These are the only ones with AGENTS.md files.`;

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
		const folderNames: string[] = [];
		
		for (const [folderPath, agentsMdContent] of subfolderDocs.entries()) {
			folderNames.push(folderPath);
			subfolderContent += `\n### ${folderPath}/\n`;
			subfolderContent += `Location: ${folderPath}/AGENTS.md\n`;
			subfolderContent += `Summary from this sub-folder:\n${agentsMdContent}\n\n`;
		}
		
		// Add clear list of folders with AGENTS.md
		let folderList = '\nSub-folders with AGENTS.md files:\n';
		folderNames.forEach(name => {
			folderList += `- ${name}/\n`;
		});
		subfolderContent = folderList + '\n' + subfolderContent;
		
		const subfolderContext = config.subfolderContextTemplate.replace(
			'{{SUBFOLDER_DOCS}}',
			subfolderContent
		);
		
		prompt = prompt.replace('{{SUBFOLDER_CONTEXT}}', subfolderContext);
	} else {
		const noSubfoldersMessage = 'No sub-folders have AGENTS.md files yet.\n\nIn the "For More Details" section, write: "No sub-folder documentation available yet."';
		prompt = prompt.replace('{{SUBFOLDER_CONTEXT}}', noSubfoldersMessage);
	}

	// Add folder structure
	prompt = prompt.replace('{{FOLDER_STRUCTURE}}', folderStructure);

	return prompt;
}
