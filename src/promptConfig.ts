
export const DEFAULT_PROMPT_TEMPLATE = `You are a technical documentation expert. Analyze the following folder and generate a concise AGENTS.md file.

CRITICAL INSTRUCTIONS:
1. READ AND ANALYZE the actual code content provided, not just file names
2. Study the sub-folder AGENTS.md files to understand the complete context
3. For sub-folders WITHOUT AGENTS.md, analyze their code files (provided in the folder structure)
4. Keep the documentation CONCISE but informative
5. ONLY include redirect links to sub-folders that actually have AGENTS.md files (provided below)
6. **You MUST NOT mention or describe any function, class, file, or symbol unless it actually exists in the provided code context. Do NOT invent, guess, or hallucinate names.**

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
	- Key functions/classes/exports (list 2-3 most important ones; only mention those that actually exist in the code)
	- How it fits in the overall architecture

NOTE: Include files from sub-folders that don't have AGENTS.md yet (format as "subfolder/filename.ext"). **Do not mention any function, class, or symbol unless it is present in the provided code.**

## Sub-folders (CONDITIONAL - see instructions below)
{{SUBFOLDER_CONTEXT}}

## For More Details (CONDITIONAL - see instructions below)
This section is for providing links to sub-folder documentation. Instructions will be provided above.

## Related Folders/Files (CONDITIONAL - only if there are external dependencies)
ONLY include this section if there are meaningful external dependencies or relationships with other parts of the project.
List critical dependencies discovered from import/require statements:
- **Path/to/folder**: Brief description of the relationship (imports from, exports to, depends on, etc.)
- **Path/to/file**: Why this external file/folder is important to this folder

If there are no significant external dependencies, SKIP this entire section (do not include the heading).

Folder Information:
{{FOLDER_STRUCTURE}}

IMPORTANT: 
- Analyze actual code content, especially function/class definitions and imports
- Include 2-3 key functions/classes per file in Key Components, but ONLY if they exist in the code
- Identify external dependencies from import/require statements in the code
- Document files from sub-folders WITHOUT AGENTS.md in the Key Components section
- ONLY reference sub-folders that are listed in the Sub-folders section above
- Be thorough and comprehensive - if there are many files or complex/critical files, provide more detailed documentation as needed
- Quality and completeness are more important than brevity
- **Never mention or describe any function, class, file, or symbol unless it is present in the provided code context.**

After generating the above sections, ALWAYS append this maintenance section at the end:

---

## 📝 Maintenance Instructions
**When making changes to this folder, please update this AGENTS.md file:**
- Add new files to the Key Components section
- Update descriptions if file responsibilities change significantly
- Document new sub-folders when they are added
- Keep the overview current with architectural changes

This documentation helps future developers (and AI agents) understand the codebase quickly.`;


export const DEFAULT_SUBFOLDER_CONTEXT_TEMPLATE = `
The following sub-folders have AGENTS.md documentation:

{{SUBFOLDER_DOCS}}

INSTRUCTIONS for Sub-folders sections:
1. Replace "## Sub-folders (CONDITIONAL - see instructions below)" with "## Sub-folders"
2. List and briefly describe the documented sub-folders above. **Only mention sub-folders and their contents if they actually exist in the provided context. Do not invent or guess names.**
3. Replace "## For More Details (CONDITIONAL - see instructions below)" with "## For More Details"
4. In the "For More Details" section, provide links to each subfolder's AGENTS.md
	Format: "- For [topic covered in that subfolder]: See [subfolder-name]/AGENTS.md"`;

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
		// No sub-folders with AGENTS.md - instruct to skip those sections
		const noSubfoldersMessage = `No sub-folders have AGENTS.md files.

INSTRUCTIONS: 
- COMPLETELY REMOVE the "## Sub-folders (CONDITIONAL - see instructions below)" section (heading and placeholder text)
- COMPLETELY REMOVE the "## For More Details (CONDITIONAL - see instructions below)" section (heading and placeholder text)
- Continue directly to the next section (Related Folders/Files)`;
		prompt = prompt.replace('{{SUBFOLDER_CONTEXT}}', noSubfoldersMessage);
	}

	// Add folder structure
	prompt = prompt.replace('{{FOLDER_STRUCTURE}}', folderStructure);

	return prompt;
}
