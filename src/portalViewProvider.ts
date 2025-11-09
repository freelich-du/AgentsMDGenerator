import * as vscode from 'vscode';
import { StatusSnapshot } from './statusTypes';

export class PortalViewProvider implements vscode.Disposable {
	public static readonly viewType = 'agentsPortalPanel';
	private panel?: vscode.WebviewPanel;
	private disposables: vscode.Disposable[] = [];
	private latestSnapshot: StatusSnapshot = {
		total: 0,
		completed: 0,
		inProgress: 0,
		failed: 0,
		items: [],
		lastUpdated: ''
	};
	private availableModels: Array<{ id: string; name: string; family: string; vendor: string }> = [];
	private selectedModelId?: string;

	constructor() {}

	public showPortal(
		availableModels?: Array<{ id: string; name: string; family: string; vendor: string }>,
		selectedModelId?: string
	): void {
		if (availableModels) {
			this.availableModels = availableModels;
		}
		if (selectedModelId !== undefined) {
			this.selectedModelId = selectedModelId;
		}

		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.One);
			this.postSnapshot();
			this.postModels();
			return;
		}

		this.panel = vscode.window.createWebviewPanel(
			PortalViewProvider.viewType,
			'AGENTS.md Portal',
			{ viewColumn: vscode.ViewColumn.One, preserveFocus: false },
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		this.panel.webview.html = this.getHtml(this.panel.webview);

		this.disposables.push(
			this.panel.webview.onDidReceiveMessage(async (message) => {
				switch (message?.type) {
					case 'generate':
						await vscode.commands.executeCommand('AgentsMDGenerator.generateAgentsMd');
						break;
					case 'selectModel':
						if (message.modelId) {
							this.selectedModelId = message.modelId;
							await vscode.commands.executeCommand('AgentsMDGenerator.selectModel', message.modelId);
						}
						break;
				}
			})
		);

		this.panel.onDidDispose(() => this.clearPanel());
		this.postSnapshot();
		this.postModels();
	}

	public update(snapshot: StatusSnapshot) {
		this.latestSnapshot = snapshot;
		this.postSnapshot();
	}

	public dispose(): void {
		if (this.panel) {
			const existingPanel = this.panel;
			this.panel = undefined;
			existingPanel.dispose();
		}
		this.clearPanel();
	}

	private postSnapshot() {
		if (this.panel) {
			void this.panel.webview.postMessage({
				type: 'statusUpdate',
				data: this.latestSnapshot
			});
		}
	}

	private postModels() {
		if (this.panel) {
			void this.panel.webview.postMessage({
				type: 'modelsUpdate',
				data: {
					models: this.availableModels,
					selectedModelId: this.selectedModelId
				}
			});
		}
	}

	private clearPanel() {
		while (this.disposables.length > 0) {
			const disposable = this.disposables.pop();
			try {
				disposable?.dispose();
			} catch (error) {
				console.error('Error disposing portal webview listener:', error);
			}
		}
		this.panel = undefined;
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = getNonce();
		const styles = `
			<style>
				body {
					margin: 0;
					padding: 0;
					background-color: var(--vscode-sideBar-background);
					color: var(--vscode-foreground);
					font-family: var(--vscode-font-family);
				}
				.portal {
					padding: 14px 16px 18px;
					box-sizing: border-box;
					display: flex;
					flex-direction: column;
					gap: 14px;
					min-height: 100vh;
				}
				.portal__header {
					display: flex;
					align-items: flex-start;
					justify-content: space-between;
					gap: 12px;
				}
				.portal__header-left {
					flex: 1;
					display: flex;
					flex-direction: column;
					gap: 2px;
				}
				.portal__header-right {
					display: flex;
					flex-direction: column;
					gap: 8px;
					align-items: flex-end;
				}
				.portal__header h1 {
					margin: 0;
					font-size: 20px;
					font-weight: 600;
				}
				.portal__header p {
					margin: 2px 0 0;
					color: var(--vscode-descriptionForeground);
					font-size: 12px;
				}
				.model-selector {
					display: flex;
					flex-direction: column;
					gap: 4px;
					min-width: 200px;
				}
				.model-selector-label {
					font-size: 11px;
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: 0.04em;
					color: var(--vscode-descriptionForeground);
				}
				.model-select {
					background: var(--vscode-dropdown-background);
					color: var(--vscode-dropdown-foreground);
					border: 1px solid var(--vscode-dropdown-border);
					border-radius: 4px;
					padding: 6px 8px;
					font-size: 13px;
					cursor: pointer;
					font-family: var(--vscode-font-family);
				}
				.model-select:hover {
					background: var(--vscode-dropdown-listBackground);
				}
				.model-select:focus {
					outline: 1px solid var(--vscode-focusBorder);
					outline-offset: -1px;
				}
				.generate-btn {
					display: inline-flex;
					align-items: center;
					gap: 8px;
					background: var(--vscode-button-background, #0277bd);
					color: var(--vscode-button-foreground, #ffffff);
					border: none;
					border-radius: 6px;
					padding: 8px 14px;
					cursor: pointer;
					font-weight: 600;
					transition: background 0.2s ease, transform 0.2s ease;
				}
				.generate-btn:hover {
					background: var(--vscode-button-hoverBackground, #015a8c);
					transform: translateY(-1px);
				}
				.portal__metrics {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
					gap: 8px;
				}
				.metric-card {
					display: flex;
					flex-direction: column;
					gap: 4px;
					background: var(--vscode-editorWidget-background);
					border-radius: 10px;
					padding: 10px 12px;
					border: 1px solid var(--vscode-editorGroup-border);
				}
				.metric-title {
					font-size: 11px;
					font-weight: 600;
					letter-spacing: 0.04em;
					text-transform: uppercase;
					color: var(--vscode-descriptionForeground);
				}
				.metric-value {
					font-size: 19px;
					font-weight: 700;
				}
				.portal__status {
					display: flex;
					flex-direction: column;
					gap: 12px;
				}
				.status-header {
					display: flex;
					flex-direction: column;
					gap: 4px;
				}
				.status-header h2 {
					margin: 0;
					font-size: 16px;
					font-weight: 600;
				}
				.status-header__hint {
					color: var(--vscode-descriptionForeground);
					font-size: 12px;
				}
				.table-container {
					background: var(--vscode-editorWidget-background);
					border: 1px solid var(--vscode-editorGroup-border);
					border-radius: 12px;
					overflow: hidden;
				}
				.status-table {
					width: 100%;
					border-collapse: collapse;
				}
				.status-table thead {
					background: rgba(255, 255, 255, 0.04);
				}
				.status-table th,
				.status-table td {
					padding: 10px 14px;
					font-size: 12px;
					text-align: left;
					border-bottom: 1px solid var(--vscode-editorGroup-border);
				}
				.status-table tbody tr:hover {
					background: rgba(255, 255, 255, 0.04);
				}
				.status-table tbody tr:last-child td {
					border-bottom: none;
				}
				.status-table .empty-row td {
					text-align: center;
					padding: 28px;
					color: var(--vscode-descriptionForeground);
				}
				.folder-label {
					display: grid;
					gap: 2px;
				}
				.folder-label__name {
					font-weight: 600;
				}
				.folder-label__path {
					font-size: 11px;
					color: var(--vscode-descriptionForeground);
				}
				.status-badge,
				.doc-tag {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					border-radius: 999px;
					padding: 2px 10px;
					font-size: 12px;
					font-weight: 600;
					text-transform: capitalize;
				}
				.status-badge--completed {
					background: rgba(76, 175, 80, 0.18);
					color: #4caf50;
				}
				.status-badge--in-progress {
					background: rgba(33, 150, 243, 0.18);
					color: #2196f3;
				}
				.status-badge--failed {
					background: rgba(244, 67, 54, 0.18);
					color: #f44336;
				}
				.status-badge--not-started {
					background: rgba(158, 158, 158, 0.18);
					color: var(--vscode-descriptionForeground);
				}
				.doc-tag--success {
					background: rgba(67, 160, 71, 0.18);
					color: #43a047;
				}
				.doc-tag--warning {
					background: rgba(255, 193, 7, 0.25);
					color: #ffb300;
				}
				.doc-tag--error {
					background: rgba(239, 83, 80, 0.2);
					color: #e53935;
				}
				.status-dot {
					width: 8px;
					height: 8px;
					border-radius: 50%;
					background: currentColor;
				}
				.status-footer {
					font-size: 12px;
					color: var(--vscode-descriptionForeground);
				}
				@media (max-width: 520px) {
					.portal__header {
						flex-direction: column;
						align-items: flex-start;
					}
					.portal__header-right {
						width: 100%;
						align-items: stretch;
					}
					.generate-btn {
						width: 100%;
						justify-content: center;
					}
					.model-selector {
						width: 100%;
					}
				}
			</style>
		`;

		const script = `
			<script nonce="${nonce}">
				(() => {
					const vscode = acquireVsCodeApi();
					const generateButton = document.getElementById('generateButton');
					const modelSelect = document.getElementById('modelSelect');
					const totalCountEl = document.getElementById('totalCount');
					const completedCountEl = document.getElementById('completedCount');
					const inProgressCountEl = document.getElementById('inProgressCount');
					const failedCountEl = document.getElementById('failedCount');
					const tableBody = document.getElementById('folderTableBody');
					const lastUpdatedEl = document.getElementById('lastUpdated');

					generateButton.addEventListener('click', () => {
						vscode.postMessage({ type: 'generate' });
					});

					modelSelect.addEventListener('change', (event) => {
						const modelId = event.target.value;
						vscode.postMessage({ type: 'selectModel', modelId: modelId });
					});

					window.addEventListener('message', event => {
						const { type, data } = event.data ?? {};
						if (type === 'statusUpdate') {
							renderStatus(data);
						} else if (type === 'modelsUpdate') {
							renderModels(data);
						}
					});

					function renderStatus(snapshot) {
						totalCountEl.textContent = String(snapshot?.total ?? 0);
						completedCountEl.textContent = String(snapshot?.completed ?? 0);
						inProgressCountEl.textContent = String(snapshot?.inProgress ?? 0);
						failedCountEl.textContent = String(snapshot?.failed ?? 0);
						lastUpdatedEl.textContent = snapshot?.lastUpdated || '--';

						tableBody.innerHTML = '';

						if (!snapshot?.items || snapshot.items.length === 0) {
							const emptyRow = document.createElement('tr');
							emptyRow.className = 'empty-row';
							const cell = document.createElement('td');
							cell.colSpan = 5;
							cell.textContent = 'Workspace has no folders to display.';
							emptyRow.appendChild(cell);
							tableBody.appendChild(emptyRow);
							return;
						}

						snapshot.items.forEach(item => {
							const row = document.createElement('tr');
							row.title = item.path;

							const folderCell = document.createElement('td');
							const folderLabel = document.createElement('div');
							folderLabel.className = 'folder-label';
							folderLabel.style.paddingLeft = String((item.depth ?? 0) * 16) + 'px';

							const folderName = document.createElement('span');
							folderName.className = 'folder-label__name';
							folderName.textContent = item.name || item.relativePath || item.path;
							folderLabel.appendChild(folderName);

							if (item.depth > 0 && item.relativePath && item.relativePath !== item.name) {
								const folderPath = document.createElement('span');
								folderPath.className = 'folder-label__path';
								folderPath.textContent = item.relativePath;
								folderLabel.appendChild(folderPath);
							}

							folderCell.appendChild(folderLabel);
							row.appendChild(folderCell);

							const statusCell = document.createElement('td');
							statusCell.appendChild(createStatusBadge(item.status));
							row.appendChild(statusCell);

							const docsUpdatedCell = document.createElement('td');
							docsUpdatedCell.textContent = formatTimestamp(item.agentsUpdatedAt);
							row.appendChild(docsUpdatedCell);

							const contentUpdatedCell = document.createElement('td');
							contentUpdatedCell.textContent = formatTimestamp(item.contentUpdatedAt);
							row.appendChild(contentUpdatedCell);

							const docStateCell = document.createElement('td');
							docStateCell.appendChild(createDocTag(item));
							row.appendChild(docStateCell);

							tableBody.appendChild(row);
						});
					}

					function renderModels(data) {
						const models = data?.models || [];
						const selectedId = data?.selectedModelId;
						
						modelSelect.innerHTML = '';
						
						if (models.length === 0) {
							const option = document.createElement('option');
							option.value = '';
							option.textContent = 'No models available';
							modelSelect.appendChild(option);
							modelSelect.disabled = true;
							return;
						}
						
						modelSelect.disabled = false;
						
						// Add default option
						const defaultOption = document.createElement('option');
						defaultOption.value = '';
						defaultOption.textContent = 'Auto (gpt-4o)';
						modelSelect.appendChild(defaultOption);
						
						// Add available models
						models.forEach(model => {
							const option = document.createElement('option');
							option.value = model.id;
							option.textContent = model.name + ' (' + model.family + ')';
							if (model.id === selectedId) {
								option.selected = true;
							}
							modelSelect.appendChild(option);
						});
						
						// Select the default if no model is selected
						if (!selectedId) {
							defaultOption.selected = true;
						}
					}

					function formatTimestamp(value) {
						if (!value) {
							return '--';
						}
						const date = new Date(value);
						if (Number.isNaN(date.getTime())) {
							return value;
						}
						return date.toLocaleString();
					}

					function createStatusBadge(status) {
						const span = document.createElement('span');
						const normalized = typeof status === 'string' ? status : 'not-started';
						span.className = 'status-badge status-badge--' + normalized;
						span.appendChild(createDot());
						span.appendChild(document.createTextNode(statusLabel(normalized)));
						return span;
					}

					function createDocTag(item) {
						const span = document.createElement('span');
						let variant;
						let label;

						if (!item.hasAgentsFile) {
							variant = 'error';
							label = 'Missing';
						} else if (item.isUpToDate) {
							variant = 'success';
							label = 'Up to date';
						} else {
							variant = 'warning';
							label = 'Needs update';
						}

						span.className = 'doc-tag doc-tag--' + variant;
						span.appendChild(createDot());
						span.appendChild(document.createTextNode(label));
						return span;
					}

					function createDot() {
						const dot = document.createElement('span');
						dot.className = 'status-dot';
						return dot;
					}

					function statusLabel(status) {
						switch (status) {
							case 'completed':
								return 'Completed';
							case 'in-progress':
								return 'In progress';
							case 'failed':
								return 'Failed';
							default:
								return 'Not started';
						}
					}
				})();
			</script>
		`;

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>AGENTS.md Portal</title>
	${styles}
</head>
	<body>
		<div class="portal">
			<div class="portal__header">
				<div class="portal__header-left">
					<h1>AGENTS.md Portal</h1>
					<p>AI-powered documentation overview</p>
				</div>
				<div class="portal__header-right">
					<div class="model-selector">
						<label class="model-selector-label" for="modelSelect">LLM Model</label>
						<select id="modelSelect" class="model-select">
							<option value="">Loading models...</option>
						</select>
					</div>
					<button id="generateButton" class="generate-btn">Generate AGENTS.md Files</button>
				</div>
			</div>

			<section class="portal__metrics">
				<div class="metric-card">
					<span class="metric-title">Total Folders</span>
					<span class="metric-value" id="totalCount">0</span>
				</div>
				<div class="metric-card">
					<span class="metric-title">Completed</span>
					<span class="metric-value" id="completedCount">0</span>
				</div>
				<div class="metric-card">
					<span class="metric-title">In Progress</span>
					<span class="metric-value" id="inProgressCount">0</span>
				</div>
				<div class="metric-card">
					<span class="metric-title">Failed</span>
					<span class="metric-value" id="failedCount">0</span>
				</div>
			</section>

			<section class="portal__status">
				<div class="status-header">
					<h2>Folder Status</h2>
					<span class="status-header__hint">Live view of documentation freshness</span>
				</div>
				<div class="table-container">
					<table class="status-table">
						<thead>
							<tr>
								<th>Folder</th>
								<th>Generation</th>
								<th>Docs Updated</th>
								<th>Content Updated</th>
								<th>Documentation</th>
							</tr>
						</thead>
						<tbody id="folderTableBody">
							<tr class="empty-row">
								<td colspan="5">Workspace has no folders to display.</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="status-footer">Last updated: <span id="lastUpdated">--</span></div>
			</section>
		</div>
	${script}
</body>
</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 16; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
