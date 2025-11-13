import * as fs from 'fs';
import * as path from 'path';
import { FolderNode } from './folderScanner';
import { GenerationStatus, StatusSnapshot } from './statusTypes';
import { PortalViewProvider } from './portalViewProvider';

const TIMESTAMP_IGNORED_DIRECTORIES = new Set([
	'node_modules',
	'.git',
	'dist',
	'out',
	'build',
	'.vscode',
	'coverage'
]);

export interface FolderDocStatusDetails {
	hasAgentsFile: boolean;
	agentsUpdatedAt?: string;
	contentUpdatedAt?: string;
	isUpToDate: boolean;
}

/**
 * Update portal with current status
 */
export async function updatePortalStatus(
	portalViewProvider: PortalViewProvider | undefined,
	discoveredFolders: FolderNode[],
	folderStatusMap: Map<string, GenerationStatus>,
	workspaceRootPath: string
): Promise<void> {
	if (!portalViewProvider) {
		return;
	}
	const snapshot = await buildStatusSnapshot(discoveredFolders, folderStatusMap, workspaceRootPath);
	portalViewProvider.update(snapshot);
}

/**
 * Build status snapshot for portal display
 */
async function buildStatusSnapshot(
	discoveredFolders: FolderNode[],
	folderStatusMap: Map<string, GenerationStatus>,
	workspaceRootPath: string
): Promise<StatusSnapshot> {
	const total = discoveredFolders.length;
	const sortedForDisplay = [...discoveredFolders].sort((a, b) =>
		a.path.localeCompare(b.path)
	);

	const items = await Promise.all(sortedForDisplay.map(async (folder) => {
		const status = folderStatusMap.get(folder.path) ?? GenerationStatus.NotStarted;
		const relativePath = computeRelativeFolderPath(folder.path, workspaceRootPath);
		const details = await getFolderStatusDetails(folder.path);
		return {
			path: folder.path,
			name: folder.name,
			relativePath,
			depth: computeFolderDepth(relativePath, workspaceRootPath),
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
 * Get status details for a folder
 */
export async function getFolderStatusDetails(folderPath: string): Promise<FolderDocStatusDetails> {
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

/**
 * Compute relative folder path from workspace root
 */
function computeRelativeFolderPath(folderPath: string, workspaceRootPath: string): string {
	if (!workspaceRootPath) {
		return folderPath;
	}
	const relative = path.relative(workspaceRootPath, folderPath);
	return relative === '' ? '.' : relative;
}

/**
 * Compute folder depth from relative path
 */
function computeFolderDepth(relativePath: string, workspaceRootPath: string): number {
	if (!relativePath || relativePath === '.' || !workspaceRootPath) {
		return 0;
	}
	const segments = relativePath.split(path.sep).filter((segment) => segment.length > 0);
	return segments.length;
}

/**
 * Get the latest modification time of content in a folder (recursive)
 */
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
