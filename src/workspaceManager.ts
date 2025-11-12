import * as vscode from 'vscode';
import { buildFolderTree, flattenFoldersByDepth, FolderNode } from './folderScanner';
import { GenerationStatus } from './statusTypes';
import { updatePortalStatus } from './statusManager';
import { PortalViewProvider } from './portalViewProvider';

export interface RefreshOptions {
	resetStatuses?: boolean;
}

/**
 * Refresh workspace folders and update status
 */
export async function refreshWorkspaceFolders(
	portalViewProvider: PortalViewProvider | undefined,
	discoveredFolders: FolderNode[],
	folderStatusMap: Map<string, GenerationStatus>,
	workspaceRootPath: string,
	options: RefreshOptions = {}
): Promise<{ 
	discoveredFolders: FolderNode[]; 
	folderStatusMap: Map<string, GenerationStatus>; 
	workspaceRootPath: string 
}> {
	const { resetStatuses = false } = options;

	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		const emptyState = {
			workspaceRootPath: '',
			discoveredFolders: [],
			folderStatusMap: new Map<string, GenerationStatus>()
		};
		await updatePortalStatus(portalViewProvider, emptyState.discoveredFolders, emptyState.folderStatusMap, emptyState.workspaceRootPath);
		return emptyState;
	}

	const newWorkspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

	try {
		const rootNode = await buildFolderTree(newWorkspaceRootPath);
		const flattened = flattenFoldersByDepth(rootNode);
		const previousStatuses = folderStatusMap;
		const nextStatusMap = new Map<string, GenerationStatus>();

		for (const folder of flattened) {
			const existing = previousStatuses.get(folder.path);
			const status = resetStatuses ? GenerationStatus.NotStarted : (existing ?? GenerationStatus.NotStarted);
			nextStatusMap.set(folder.path, status);
		}

		const newState = {
			discoveredFolders: flattened,
			folderStatusMap: nextStatusMap,
			workspaceRootPath: newWorkspaceRootPath
		};

		await updatePortalStatus(portalViewProvider, newState.discoveredFolders, newState.folderStatusMap, newState.workspaceRootPath);
		return newState;
	} catch (error) {
		console.error('Error building folder tree for workspace snapshot:', error);
		const errorState = {
			discoveredFolders: [],
			folderStatusMap: new Map<string, GenerationStatus>(),
			workspaceRootPath: newWorkspaceRootPath
		};
		await updatePortalStatus(portalViewProvider, errorState.discoveredFolders, errorState.folderStatusMap, errorState.workspaceRootPath);
		return errorState;
	}
}
