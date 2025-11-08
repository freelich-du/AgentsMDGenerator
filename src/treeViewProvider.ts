import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export enum GenerationStatus {
	NotStarted = 'not-started',
	InProgress = 'in-progress',
	Completed = 'completed',
	Failed = 'failed'
}

export interface FolderNode {
	path: string;
	name: string;
	status: GenerationStatus;
	children: FolderNode[];
	hasAgentsMd: boolean;
}

export class AgentsTreeDataProvider implements vscode.TreeDataProvider<FolderNode> {
	private _onDidChangeTreeData: vscode.EventEmitter<FolderNode | undefined | null | void> = new vscode.EventEmitter<FolderNode | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<FolderNode | undefined | null | void> = this._onDidChangeTreeData.event;

	private rootPath: string | undefined;
	private folderStatusMap: Map<string, GenerationStatus> = new Map();
	private rootNode: FolderNode | undefined;

	constructor(workspaceRoot: string | undefined) {
		this.rootPath = workspaceRoot;
		if (workspaceRoot) {
			this.buildTree();
		}
	}

	refresh(): void {
		this.buildTree();
		this._onDidChangeTreeData.fire();
	}

	updateStatus(folderPath: string, status: GenerationStatus): void {
		this.folderStatusMap.set(folderPath, status);
		this._onDidChangeTreeData.fire();
	}

	getStatus(folderPath: string): GenerationStatus {
		return this.folderStatusMap.get(folderPath) || GenerationStatus.NotStarted;
	}

	private async buildTree(): Promise<void> {
		if (!this.rootPath) {
			return;
		}
		this.rootNode = await this.buildFolderNode(this.rootPath);
	}

	private async buildFolderNode(folderPath: string): Promise<FolderNode> {
		const ignoredDirs = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.vscode', 'coverage']);
		const name = path.basename(folderPath);
		const hasAgentsMd = fs.existsSync(path.join(folderPath, 'AGENTS.md'));
		const status = this.folderStatusMap.get(folderPath) || GenerationStatus.NotStarted;

		const node: FolderNode = {
			path: folderPath,
			name,
			status,
			hasAgentsMd,
			children: []
		};

		try {
			const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isDirectory() && !ignoredDirs.has(entry.name)) {
					const childPath = path.join(folderPath, entry.name);
					const childNode = await this.buildFolderNode(childPath);
					node.children.push(childNode);
				}
			}
		} catch (error) {
			console.error(`Error building tree for ${folderPath}:`, error);
		}

		return node;
	}

	getTreeItem(element: FolderNode): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(
			element.name,
			element.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
		);

		treeItem.contextValue = 'folder';
		treeItem.tooltip = this.getTooltip(element);
		treeItem.description = this.getDescription(element);
		treeItem.iconPath = this.getIcon(element);
		
		return treeItem;
	}

	getChildren(element?: FolderNode): Thenable<FolderNode[]> {
		if (!this.rootPath) {
			return Promise.resolve([]);
		}

		if (element) {
			return Promise.resolve(element.children);
		} else {
			return Promise.resolve(this.rootNode ? [this.rootNode] : []);
		}
	}

	private getTooltip(node: FolderNode): string {
		const statusText = this.getStatusText(node.status);
		const agentsText = node.hasAgentsMd ? '✓ Has AGENTS.md' : '✗ No AGENTS.md';
		return `${node.path}\n${statusText}\n${agentsText}`;
	}

	private getDescription(node: FolderNode): string {
		switch (node.status) {
			case GenerationStatus.InProgress:
				return '⏳ Generating...';
			case GenerationStatus.Completed:
				return '✓ Done';
			case GenerationStatus.Failed:
				return '✗ Failed';
			default:
				return node.hasAgentsMd ? '✓' : '';
		}
	}

	private getStatusText(status: GenerationStatus): string {
		switch (status) {
			case GenerationStatus.NotStarted:
				return 'Status: Not Started';
			case GenerationStatus.InProgress:
				return 'Status: Generating...';
			case GenerationStatus.Completed:
				return 'Status: Completed';
			case GenerationStatus.Failed:
				return 'Status: Failed';
		}
	}

	private getIcon(node: FolderNode): vscode.ThemeIcon {
		switch (node.status) {
			case GenerationStatus.InProgress:
				return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.yellow'));
			case GenerationStatus.Completed:
				return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
			case GenerationStatus.Failed:
				return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
			default:
				return node.hasAgentsMd 
					? new vscode.ThemeIcon('file', new vscode.ThemeColor('charts.blue'))
					: new vscode.ThemeIcon('folder');
		}
	}

	getRootNode(): FolderNode | undefined {
		return this.rootNode;
	}

	getAllFoldersSortedByDepth(): FolderNode[] {
		const folders: FolderNode[] = [];
		
		const collectFolders = (node: FolderNode, depth: number) => {
			folders.push(node);
			for (const child of node.children) {
				collectFolders(child, depth + 1);
			}
		};

		if (this.rootNode) {
			collectFolders(this.rootNode, 0);
		}

		// Sort by depth (deepest first - leaf to root)
		folders.sort((a, b) => {
			const depthA = a.path.split(path.sep).length;
			const depthB = b.path.split(path.sep).length;
			return depthB - depthA; // Descending order - deepest first
		});

		return folders;
	}
}
