import * as fs from 'fs';
import * as path from 'path';
import { FolderNode } from './folderScanner';

/**
 * Get the structure and file list of a folder
 */
export async function getFolderStructure(folderPath: string): Promise<string> {
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
export async function getSubfolderAgentsDocs(folderNode: FolderNode): Promise<Map<string, string>> {
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
