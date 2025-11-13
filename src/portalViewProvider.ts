import * as vscode from 'vscode';
import { StatusSnapshot } from './statusTypes';

interface PromptConfig {
	mainTemplate: string;
	subfolderContextTemplate: string;
}

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
	private ignoreConfig: { names: string[]; patterns: string[] } = { names: [], patterns: [] };
	private promptConfig: PromptConfig = { mainTemplate: '', subfolderContextTemplate: '' };

	constructor() {}

	public showPortal(
		availableModels?: Array<{ id: string; name: string; family: string; vendor: string }>,
		selectedModelId?: string,
		ignoreConfig?: { names: string[]; patterns: string[] },
		promptConfig?: PromptConfig
	): void {
		if (availableModels) {
			this.availableModels = availableModels;
		}
		if (selectedModelId !== undefined) {
			this.selectedModelId = selectedModelId;
		}
		if (ignoreConfig) {
			this.ignoreConfig = ignoreConfig;
		}
		if (promptConfig) {
			this.promptConfig = promptConfig;
		}

		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.One);
			// Post updates only if we have data
			if (availableModels || selectedModelId !== undefined || ignoreConfig || promptConfig) {
				this.postSnapshot();
				this.postModels();
				this.postIgnoreConfig();
				this.postPromptConfig();
			}
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
					case 'generateOutdated':
						await vscode.commands.executeCommand('AgentsMDGenerator.generateOutdatedFolders');
						break;
					case 'refreshStatus':
						await vscode.commands.executeCommand('AgentsMDGenerator.refreshStatusSnapshot');
						break;
					case 'selectModel':
						if (message.modelId) {
							this.selectedModelId = message.modelId;
							await vscode.commands.executeCommand('AgentsMDGenerator.selectModel', message.modelId);
						}
						break;
					case 'updateIgnoreConfig':
						if (message.names && message.patterns) {
							this.ignoreConfig = { names: message.names, patterns: message.patterns };
							await vscode.commands.executeCommand('AgentsMDGenerator.updateIgnoreConfig', message.names, message.patterns);
						}
						break;
					case 'updatePromptConfig':
						if (message.mainTemplate !== undefined && message.subfolderContextTemplate !== undefined) {
							this.promptConfig = { 
								mainTemplate: message.mainTemplate, 
								subfolderContextTemplate: message.subfolderContextTemplate 
							};
							await vscode.commands.executeCommand('AgentsMDGenerator.updatePromptConfig', this.promptConfig);
						}
						break;
					case 'ready':
						// WebView is ready, send initial data
						this.postSnapshot();
						this.postModels();
						this.postIgnoreConfig();
						this.postPromptConfig();
						break;
					case 'openAgentsFile':
						if (message.path) {
							const agentsFilePath = vscode.Uri.file(message.path + '/AGENTS.md');
							try {
								const doc = await vscode.workspace.openTextDocument(agentsFilePath);
								await vscode.window.showTextDocument(doc, { preview: false });
							} catch (error) {
								vscode.window.showErrorMessage(`Failed to open AGENTS.md: ${error}`);
							}
						}
						break;
					case 'generateSingleFolder':
						if (message.path) {
							await vscode.commands.executeCommand('AgentsMDGenerator.generateSingleFolder', message.path);
						}
						break;
				}
			})
		);

		this.panel.onDidDispose(() => this.clearPanel());
		// Don't post data here - wait for 'ready' message from webview
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

	private postIgnoreConfig() {
		if (this.panel) {
			void this.panel.webview.postMessage({
				type: 'ignoreConfigUpdate',
				data: this.ignoreConfig
			});
		}
	}

	private postPromptConfig() {
		if (this.panel) {
			void this.panel.webview.postMessage({
				type: 'promptConfigUpdate',
				data: this.promptConfig
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
					gap: 16px;
				}
				.portal__header-left {
					flex: 1;
					display: flex;
					flex-direction: column;
					gap: 8px;
				}
				.portal__header-top {
					display: flex;
					align-items: center;
					gap: 12px;
				}
				.portal__header-title {
					display: flex;
					flex-direction: column;
					gap: 2px;
					flex: 1;
				}
				.portal__header-right {
					display: flex;
					align-items: center;
					gap: 12px;
					flex-wrap: wrap;
					justify-content: flex-end;
				}
				.portal__header h1 {
					margin: 0;
					font-size: 20px;
					font-weight: 600;
				}
				.portal__header p {
					margin: 0;
					color: var(--vscode-descriptionForeground);
					font-size: 12px;
				}
				.model-selector {
					display: flex;
					align-items: center;
					gap: 8px;
					min-width: auto;
				}
				.model-selector-label {
					font-size: 13px;
					font-weight: 600;
					color: var(--vscode-foreground);
					white-space: nowrap;
				}
				.model-select {
					background: var(--vscode-dropdown-background);
					color: var(--vscode-dropdown-foreground);
					border: 1px solid var(--vscode-dropdown-border);
					border-radius: 4px;
					padding: 7px 8px;
					font-size: 13px;
					cursor: pointer;
					font-family: var(--vscode-font-family);
					min-width: 200px;
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
					padding: 8px 16px;
					cursor: pointer;
					font-weight: 600;
					font-size: 13px;
					transition: background 0.2s ease, transform 0.2s ease;
					white-space: nowrap;
				}
				.generate-btn:hover {
					background: var(--vscode-button-hoverBackground, #015a8c);
					transform: translateY(-1px);
				}
				.generate-btn:disabled {
					opacity: 0.6;
					cursor: not-allowed;
					transform: none;
				}
				.generate-btn--secondary {
					background: var(--vscode-button-background, #0277bd);
					color: var(--vscode-button-foreground, #ffffff);
				}
				.generate-btn--secondary:hover {
					background: var(--vscode-button-hoverBackground, #015a8c);
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
					align-items: center;
					justify-content: space-between;
					gap: 8px;
					flex-wrap: wrap;
				}
				.status-header__text {
					display: flex;
					flex-direction: column;
					gap: 4px;
				}
				.status-header__text h2 {
					margin: 0;
					font-size: 16px;
					font-weight: 600;
				}
				.status-header__hint {
					color: var(--vscode-descriptionForeground);
					font-size: 12px;
				}
				.status-refresh-btn {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					background: var(--vscode-button-background, #0277bd);
					color: var(--vscode-button-foreground, #ffffff);
					border: none;
					border-radius: 6px;
					padding: 6px 12px;
					cursor: pointer;
					font-size: 12px;
					font-weight: 600;
					transition: background 0.2s ease, transform 0.2s ease;
					white-space: nowrap;
				}
				.status-refresh-btn:hover {
					background: var(--vscode-button-hoverBackground, #015a8c);
					transform: translateY(-1px);
				}
				.status-refresh-btn:disabled {
					opacity: 0.6;
					cursor: not-allowed;
					transform: none;
				}
				.status-refresh-btn__spinner {
					width: 14px;
					height: 14px;
					border: 2px solid rgba(255, 255, 255, 0.4);
					border-top-color: var(--vscode-button-foreground, #ffffff);
					border-radius: 50%;
					animation: status-refresh-spin 0.9s linear infinite;
					display: none;
				}
				.status-refresh-btn--loading .status-refresh-btn__spinner {
					display: inline-block;
				}
				.status-refresh-btn--loading .status-refresh-btn__label {
					opacity: 0.85;
				}
				@keyframes status-refresh-spin {
					from { transform: rotate(0deg); }
					to { transform: rotate(360deg); }
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
				.row-action-btn {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					width: 28px;
					height: 28px;
					background: rgba(33, 150, 243, 0.15);
					color: #2196f3;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					transition: background 0.2s ease;
				}
				.row-action-btn:hover {
					background: rgba(33, 150, 243, 0.25);
				}
				.row-action-btn svg {
					width: 14px;
					height: 14px;
					fill: currentColor;
				}
				.status-footer {
					font-size: 12px;
					color: var(--vscode-descriptionForeground);
				}
				.loading-overlay {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background: var(--vscode-sideBar-background);
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					gap: 16px;
					z-index: 1000;
					transition: opacity 0.3s ease;
				}
				.loading-overlay.hidden {
					opacity: 0;
					pointer-events: none;
				}
				.spinner {
					width: 48px;
					height: 48px;
					border: 4px solid var(--vscode-editorGroup-border);
					border-top-color: var(--vscode-button-background);
					border-radius: 50%;
					animation: spin 0.8s linear infinite;
				}
				@keyframes spin {
					to { transform: rotate(360deg); }
				}
				.loading-text {
					font-size: 14px;
					color: var(--vscode-descriptionForeground);
				}
				.settings-section {
					background: var(--vscode-editorWidget-background);
					border: 1px solid var(--vscode-editorGroup-border);
					border-radius: 12px;
					overflow: hidden;
				}
				.settings-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 12px 16px;
					cursor: pointer;
					user-select: none;
					background: rgba(255, 255, 255, 0.02);
				}
				.settings-header:hover {
					background: rgba(255, 255, 255, 0.05);
				}
				.settings-header-left {
					display: flex;
					align-items: center;
					gap: 8px;
				}
				.settings-header h3 {
					margin: 0;
					font-size: 14px;
					font-weight: 600;
				}
				.settings-toggle {
					font-size: 16px;
					transition: transform 0.2s ease;
				}
				.settings-toggle.expanded {
					transform: rotate(90deg);
				}
				.settings-content {
					max-height: 0;
					overflow: hidden;
					transition: max-height 0.3s ease;
				}
				.settings-content.expanded {
					max-height: 600px;
					overflow-y: auto;
				}
				.settings-body {
					padding: 16px;
					display: flex;
					flex-direction: column;
					gap: 16px;
				}
				.settings-field {
					display: flex;
					flex-direction: column;
					gap: 6px;
				}
				.settings-field-label {
					font-size: 12px;
					font-weight: 600;
					color: var(--vscode-foreground);
				}
				.settings-field-hint {
					font-size: 11px;
					color: var(--vscode-descriptionForeground);
					margin-top: 4px;
				}
				.settings-textarea {
					background: var(--vscode-input-background);
					color: var(--vscode-input-foreground);
					border: 1px solid var(--vscode-input-border);
					border-radius: 4px;
					padding: 8px;
					font-family: var(--vscode-editor-font-family);
					font-size: 13px;
					min-height: 120px;
					resize: vertical;
				}
				.settings-textarea:focus {
					outline: 1px solid var(--vscode-focusBorder);
					outline-offset: -1px;
				}
				.settings-actions {
					display: flex;
					gap: 8px;
					justify-content: flex-end;
				}
				.btn-secondary {
					background: var(--vscode-button-secondaryBackground);
					color: var(--vscode-button-secondaryForeground);
					border: none;
					border-radius: 4px;
					padding: 6px 12px;
					cursor: pointer;
					font-size: 13px;
					font-weight: 600;
				}
				.btn-secondary:hover {
					background: var(--vscode-button-secondaryHoverBackground);
				}
				@media (max-width: 768px) {
					.portal__header {
						flex-direction: column;
						align-items: stretch;
					}
					.portal__header-top {
						flex-direction: column;
						align-items: flex-start;
					}
					.portal__header-right {
						width: 100%;
						flex-direction: column;
					}
					.generate-btn {
						width: 100%;
						justify-content: center;
					}
					.model-selector {
						width: 100%;
					}
					.model-select {
						flex: 1;
					}
				}
			</style>
		`;

		const script = `
			<script nonce="${nonce}">
				(() => {
					const vscode = acquireVsCodeApi();
					const generateButton = document.getElementById('generateButton');
					const generateOutdatedButton = document.getElementById('generateOutdatedButton');
					const outdatedButtonBaseLabel = (generateOutdatedButton?.textContent ?? 'Generate Out-of-date Folders').trim();
					const refreshStatusButton = document.getElementById('refreshStatusButton');
					const modelSelect = document.getElementById('modelSelect');
					const loadingOverlay = document.getElementById('loadingOverlay');

					if (generateOutdatedButton) {
						generateOutdatedButton.disabled = true;
						generateOutdatedButton.title = 'Waiting for status data...';
					}
					
					// Ignore settings elements
					const settingsHeader = document.getElementById('settingsHeader');
					const settingsToggle = document.getElementById('settingsToggle');
					const settingsContent = document.getElementById('settingsContent');
					const ignoreNamesTextarea = document.getElementById('ignoreNamesTextarea');
					const ignorePatternsTextarea = document.getElementById('ignorePatternsTextarea');
					const saveSettingsButton = document.getElementById('saveSettings');
					const resetSettingsButton = document.getElementById('resetSettings');
					
					// Prompt settings elements
					const promptSettingsHeader = document.getElementById('promptSettingsHeader');
					const promptSettingsToggle = document.getElementById('promptSettingsToggle');
					const promptSettingsContent = document.getElementById('promptSettingsContent');
					const mainTemplateTextarea = document.getElementById('mainTemplateTextarea');
					const subfolderTemplateTextarea = document.getElementById('subfolderTemplateTextarea');
					const savePromptSettingsButton = document.getElementById('savePromptSettings');
					const resetPromptSettingsButton = document.getElementById('resetPromptSettings');
					
					// Status elements
					const totalCountEl = document.getElementById('totalCount');
					const completedCountEl = document.getElementById('completedCount');
					const inProgressCountEl = document.getElementById('inProgressCount');
					const failedCountEl = document.getElementById('failedCount');
					const tableBody = document.getElementById('folderTableBody');
					const lastUpdatedEl = document.getElementById('lastUpdated');

					let defaultIgnoreNames = [];
					let defaultIgnorePatterns = [];
					let defaultMainTemplate = '';
					let defaultSubfolderTemplate = '';
					let dataLoaded = false;

					// Notify extension that webview is ready
					setTimeout(() => {
						vscode.postMessage({ type: 'ready' });
					}, 0);

					generateButton.addEventListener('click', () => {
						vscode.postMessage({ type: 'generate' });
					});

					if (generateOutdatedButton) {
						generateOutdatedButton.addEventListener('click', () => {
							vscode.postMessage({ type: 'generateOutdated' });
						});
					}

					if (refreshStatusButton) {
						refreshStatusButton.addEventListener('click', () => {
							setRefreshButtonLoading(true);
							vscode.postMessage({ type: 'refreshStatus' });
						});
					}

					modelSelect.addEventListener('change', (event) => {
						const modelId = event.target.value;
						vscode.postMessage({ type: 'selectModel', modelId: modelId });
					});

					settingsHeader.addEventListener('click', () => {
						const isExpanded = settingsContent.classList.contains('expanded');
						if (isExpanded) {
							settingsContent.classList.remove('expanded');
							settingsToggle.classList.remove('expanded');
						} else {
							settingsContent.classList.add('expanded');
							settingsToggle.classList.add('expanded');
						}
					});

					promptSettingsHeader.addEventListener('click', () => {
						const isExpanded = promptSettingsContent.classList.contains('expanded');
						if (isExpanded) {
							promptSettingsContent.classList.remove('expanded');
							promptSettingsToggle.classList.remove('expanded');
						} else {
							promptSettingsContent.classList.add('expanded');
							promptSettingsToggle.classList.add('expanded');
						}
					});

					saveSettingsButton.addEventListener('click', () => {
						const namesText = ignoreNamesTextarea.value.trim();
						const patternsText = ignorePatternsTextarea.value.trim();
						
						const names = namesText ? namesText.split('\\n').map(n => n.trim()).filter(n => n) : [];
						const patterns = patternsText ? patternsText.split('\\n').map(p => p.trim()).filter(p => p) : [];
						
						vscode.postMessage({ 
							type: 'updateIgnoreConfig', 
							names: names,
							patterns: patterns
						});
					});

					resetSettingsButton.addEventListener('click', () => {
						ignoreNamesTextarea.value = defaultIgnoreNames.join('\\n');
						ignorePatternsTextarea.value = defaultIgnorePatterns.join('\\n');
					});

					savePromptSettingsButton.addEventListener('click', () => {
						const mainTemplate = mainTemplateTextarea.value.trim();
						const subfolderTemplate = subfolderTemplateTextarea.value.trim();
						
						if (!mainTemplate) {
							alert('Main prompt template cannot be empty');
							return;
						}
						
						vscode.postMessage({ 
							type: 'updatePromptConfig', 
							mainTemplate: mainTemplate,
							subfolderContextTemplate: subfolderTemplate
						});
					});

					resetPromptSettingsButton.addEventListener('click', () => {
						mainTemplateTextarea.value = defaultMainTemplate;
						subfolderTemplateTextarea.value = defaultSubfolderTemplate;
					});

					window.addEventListener('message', event => {
						const { type, data } = event.data ?? {};
						if (type === 'statusUpdate') {
							renderStatus(data);
							// Only hide loading when we have actual status data
							if (data && data.items && data.items.length > 0) {
								hideLoadingIfReady();
							}
						} else if (type === 'modelsUpdate') {
							renderModels(data);
						} else if (type === 'ignoreConfigUpdate') {
							renderIgnoreConfig(data);
						} else if (type === 'promptConfigUpdate') {
							renderPromptConfig(data);
						}
					});

					function hideLoadingIfReady() {
						if (!dataLoaded) {
							dataLoaded = true;
							setTimeout(() => {
								loadingOverlay.classList.add('hidden');
							}, 100);
						}
					}

					function setRefreshButtonLoading(isLoading) {
						if (!refreshStatusButton) {
							return;
						}
						if (isLoading) {
							refreshStatusButton.classList.add('status-refresh-btn--loading');
							refreshStatusButton.disabled = true;
						} else {
							refreshStatusButton.classList.remove('status-refresh-btn--loading');
							refreshStatusButton.disabled = false;
						}
					}

					function updateOutdatedButton(snapshot) {
						if (!generateOutdatedButton) {
							return;
						}
						const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
						const hasItems = items.length > 0;
						const outdatedCount = hasItems ? items.filter((item) => !item.isUpToDate).length : 0;
						generateOutdatedButton.disabled = !hasItems || outdatedCount === 0;
						generateOutdatedButton.textContent = outdatedButtonBaseLabel + ' (' + outdatedCount + ')';
						if (!hasItems) {
							generateOutdatedButton.title = 'Waiting for status data...';
						} else if (outdatedCount === 0) {
							generateOutdatedButton.title = 'All folders appear up to date.';
						} else {
							generateOutdatedButton.title = 'Generate AGENTS.md only for folders that are missing or outdated.';
						}
					}

					function renderStatus(snapshot) {
						totalCountEl.textContent = String(snapshot?.total ?? 0);
						completedCountEl.textContent = String(snapshot?.completed ?? 0);
						inProgressCountEl.textContent = String(snapshot?.inProgress ?? 0);
						failedCountEl.textContent = String(snapshot?.failed ?? 0);
						lastUpdatedEl.textContent = snapshot?.lastUpdated || '--';
						setRefreshButtonLoading(false);
						updateOutdatedButton(snapshot);

						tableBody.innerHTML = '';

						if (!snapshot?.items || snapshot.items.length === 0) {
							const emptyRow = document.createElement('tr');
							emptyRow.className = 'empty-row';
							const cell = document.createElement('td');
							cell.colSpan = 6;
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
							
							// Make folder name clickable if AGENTS.md exists
							if (item.hasAgentsFile) {
								folderName.style.cursor = 'pointer';
								folderName.style.color = 'var(--vscode-textLink-foreground)';
								folderName.style.textDecoration = 'none';
								folderName.addEventListener('mouseenter', () => {
									folderName.style.textDecoration = 'underline';
								});
								folderName.addEventListener('mouseleave', () => {
									folderName.style.textDecoration = 'none';
								});
								folderName.addEventListener('click', (e) => {
									e.stopPropagation();
									vscode.postMessage({ 
										type: 'openAgentsFile', 
										path: item.path 
									});
								});
							}
							
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

							const actionsCell = document.createElement('td');
							const generateBtn = document.createElement('button');
							generateBtn.className = 'row-action-btn';
							generateBtn.title = 'Generate AGENTS.md for this folder';
							generateBtn.innerHTML = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 3L13 8l-8.5 5V3z"/></svg>';
							generateBtn.addEventListener('click', (e) => {
								e.stopPropagation();
								vscode.postMessage({ 
									type: 'generateSingleFolder', 
									path: item.path 
								});
							});
							actionsCell.appendChild(generateBtn);
							row.appendChild(actionsCell);

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
					}

					function renderIgnoreConfig(data) {
						if (!data) {
							return;
						}
						
						defaultIgnoreNames = data.names || [];
						defaultIgnorePatterns = data.patterns || [];
						
						ignoreNamesTextarea.value = defaultIgnoreNames.join('\\n');
						ignorePatternsTextarea.value = defaultIgnorePatterns.join('\\n');
					}

					function renderPromptConfig(data) {
						if (!data) {
							return;
						}
						
						defaultMainTemplate = data.mainTemplate || '';
						defaultSubfolderTemplate = data.subfolderContextTemplate || '';
						
						mainTemplateTextarea.value = defaultMainTemplate;
						subfolderTemplateTextarea.value = defaultSubfolderTemplate;
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
		<div id="loadingOverlay" class="loading-overlay">
			<div class="spinner"></div>
			<div class="loading-text">Loading workspace data...</div>
		</div>
		<div class="portal">
			<div class="portal__header">
				<div class="portal__header-left">
					<div class="portal__header-top">
						<div class="portal__header-title">
							<h1>AGENTS.md Portal</h1>
							<p>AI-powered documentation overview</p>
						</div>
					</div>
				</div>
				<div class="portal__header-right">
					<div class="model-selector">
						<label class="model-selector-label" for="modelSelect">LLM Model:</label>
						<select id="modelSelect" class="model-select">
							<option value="">Loading models...</option>
						</select>
					</div>
					<button id="generateOutdatedButton" class="generate-btn generate-btn--secondary" title="Generate only folders that are missing or outdated">Generate Out-of-date Folders</button>
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

			<section class="settings-section">
				<div id="settingsHeader" class="settings-header">
					<div class="settings-header-left">
						<span id="settingsToggle" class="settings-toggle">▶</span>
						<h3>Ignore Configuration</h3>
					</div>
				</div>
				<div id="settingsContent" class="settings-content">
					<div class="settings-body">
						<div class="settings-field">
							<label class="settings-field-label" for="ignoreNamesTextarea">Ignored Folder Names</label>
							<textarea 
								id="ignoreNamesTextarea" 
								class="settings-textarea" 
								placeholder="Enter folder names (one per line)&#10;.git&#10;node_modules&#10;bin&#10;obj"
							></textarea>
							<span class="settings-field-hint">Exact folder names to ignore (one per line)</span>
						</div>
						
						<div class="settings-field">
							<label class="settings-field-label" for="ignorePatternsTextarea">Ignored Folder Patterns</label>
							<textarea 
								id="ignorePatternsTextarea" 
								class="settings-textarea" 
								placeholder="Enter patterns (one per line)&#10;*.log&#10;*-tmp&#10;.vs*"
							></textarea>
							<span class="settings-field-hint">Wildcard patterns (* for any characters, one per line)</span>
						</div>
						
						<div class="settings-actions">
							<button id="resetSettings" class="btn-secondary">Reset to Defaults</button>
							<button id="saveSettings" class="generate-btn">Save Changes</button>
						</div>
					</div>
				</div>
			</section>

			<section class="settings-section">
				<div id="promptSettingsHeader" class="settings-header">
					<div class="settings-header-left">
						<span id="promptSettingsToggle" class="settings-toggle">▶</span>
						<h3>Prompt Configuration</h3>
					</div>
				</div>
				<div id="promptSettingsContent" class="settings-content">
					<div class="settings-body">
						<div class="settings-field">
							<label class="settings-field-label" for="mainTemplateTextarea">Main Prompt Template</label>
							<textarea 
								id="mainTemplateTextarea" 
								class="settings-textarea" 
								placeholder="Enter the main prompt template"
								style="min-height: 200px;"
							></textarea>
							<span class="settings-field-hint">Use {{SUBFOLDER_CONTEXT}} and {{FOLDER_STRUCTURE}} as placeholders</span>
						</div>
						
						<div class="settings-field">
							<label class="settings-field-label" for="subfolderTemplateTextarea">Subfolder Context Template</label>
							<textarea 
								id="subfolderTemplateTextarea" 
								class="settings-textarea" 
								placeholder="Enter the subfolder context template"
								style="min-height: 150px;"
							></textarea>
							<span class="settings-field-hint">Use {{SUBFOLDER_DOCS}} as a placeholder for subfolder documentation</span>
						</div>
						
						<div class="settings-actions">
							<button id="resetPromptSettings" class="btn-secondary">Reset to Defaults</button>
							<button id="savePromptSettings" class="generate-btn">Save Changes</button>
						</div>
					</div>
				</div>
			</section>

			<section class="portal__status">
				<div class="status-header">
					<div class="status-header__text">
						<h2>Folder Status</h2>
						<span class="status-header__hint">Live view of documentation freshness</span>
					</div>
					<button id="refreshStatusButton" class="status-refresh-btn" title="Refresh folder status">
						<span class="status-refresh-btn__spinner" aria-hidden="true"></span>
						<span class="status-refresh-btn__label">Refresh</span>
					</button>
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
								<th style="width: 60px;">Actions</th>
							</tr>
						</thead>
						<tbody id="folderTableBody">
							<tr class="empty-row">
								<td colspan="6">Workspace has no folders to display.</td>
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
