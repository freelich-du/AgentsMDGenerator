import * as fs from 'fs';
import * as path from 'path';

const IGNORED_DIRECTORIES = new Set([
	'node_modules',
	'.git',
	'dist',
	'out',
	'build',
	'.vscode',
	'coverage'
]);

export interface FolderNode {
	path: string;
	name: string;
	children: FolderNode[];
}

export async function buildFolderTree(rootPath: string): Promise<FolderNode> {
	return buildFolderNode(rootPath);
}

async function buildFolderNode(folderPath: string): Promise<FolderNode> {
	const node: FolderNode = {
		path: folderPath,
		name: path.basename(folderPath),
		children: []
	};

	try {
		const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isDirectory() && !IGNORED_DIRECTORIES.has(entry.name)) {
				const childPath = path.join(folderPath, entry.name);
				const childNode = await buildFolderNode(childPath);
				node.children.push(childNode);
			}
		}
	} catch (error) {
		console.error(`Error reading directory ${folderPath}:`, error);
	}

	return node;
}

export function flattenFoldersByDepth(rootNode: FolderNode): FolderNode[] {
	const folders: FolderNode[] = [];

	const collect = (node: FolderNode) => {
		folders.push(node);
		node.children.forEach(collect);
	};

	collect(rootNode);

	folders.sort((a, b) => {
		const depthA = a.path.split(path.sep).length;
		const depthB = b.path.split(path.sep).length;
		return depthB - depthA;
	});

	return folders;
}
