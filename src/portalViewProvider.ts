import * as vscode from 'vscode';
import { StatusSnapshot } from './statusTypes';

export class PortalViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'agentsPortalView';
	private view?: vscode.WebviewView;
	private latestSnapshot: StatusSnapshot = {
		total: 0,
		completed: 0,
		inProgress: 0,
		failed: 0,
		items: [],
		lastUpdated: ''
	};

	constructor(private readonly extensionUri: vscode.Uri) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void | Thenable<void> {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true
		};

		webviewView.webview.html = this.getHtml(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async (message) => {
			switch (message?.type) {
				case 'generate':
					await vscode.commands.executeCommand('AgentsMDGenerator.generateAgentsMd');
					break;
			}
		});

		// Send initial snapshot
		this.postSnapshot();
	}

	update(snapshot: StatusSnapshot) {
		this.latestSnapshot = snapshot;
		this.postSnapshot();
	}

	private postSnapshot() {
		if (this.view) {
			this.view.webview.postMessage({
				type: 'statusUpdate',
				data: this.latestSnapshot
			});
		}
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = getNonce();
		const styles = `
			<style>
				body {
					font-family: var(--vscode-font-family);
					color: var(--vscode-foreground);
					background-color: var(--vscode-sideBar-background);
					margin: 0;
					padding: 16px;
				}
				h1 {
					font-size: 18px;
					margin-bottom: 12px;
				}
				button {
					background-color: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					border: none;
					padding: 8px 12px;
					border-radius: 4px;
					cursor: pointer;
				}
				button:hover {
					background-color: var(--vscode-button-hoverBackground);
				}
				.status-grid {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
					gap: 8px;
					margin: 16px 0;
				}
				.status-card {
					padding: 12px;
					border-radius: 4px;
					background-color: var(--vscode-editorWidget-background);
					box-shadow: 0 1px 3px rgba(0,0,0,0.1);
				}
				.status-card h2 {
					margin: 0 0 4px;
					font-size: 14px;
					font-weight: 600;
				}
				.status-card span {
					font-size: 20px;
					font-weight: bold;
				}
				.status-list {
					margin-top: 16px;
					max-height: 320px;
					overflow-y: auto;
				}
				.status-item {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 8px 10px;
					border-bottom: 1px solid var(--vscode-editorGroup-border);
					font-size: 13px;
				}
				.status-item:last-child {
					border-bottom: none;
				}
				.status-pill {
					padding: 2px 8px;
					border-radius: 999px;
					font-size: 12px;
					font-weight: 600;
					text-transform: capitalize;
				}
				.status-pill.in-progress {
					background-color: rgba(255, 215, 0, 0.15);
					color: #ffd700;
				}
				.status-pill.completed {
					background-color: rgba(50, 205, 50, 0.15);
					color: #32cd32;
				}
				.status-pill.failed {
					background-color: rgba(220, 20, 60, 0.15);
					color: #dc143c;
				}
				.status-pill.not-started {
					background-color: rgba(211, 211, 211, 0.1);
					color: var(--vscode-descriptionForeground);
				}
				.status-list .empty {
					text-align: center;
					padding: 24px 0;
					color: var(--vscode-descriptionForeground);
				}
				.footer {
					margin-top: 16px;
					font-size: 11px;
					color: var(--vscode-descriptionForeground);
				}
			</style>
		`;

		const script = `
			<script nonce="${nonce}">
				const vscode = acquireVsCodeApi();
				document.getElementById('generateButton').addEventListener('click', () => {
					vscode.postMessage({ type: 'generate' });
				});

				window.addEventListener('message', event => {
					const { type, data } = event.data;
					if (type === 'statusUpdate') {
						renderStatus(data);
					}
				});

				function renderStatus(snapshot) {
					document.getElementById('totalCount').innerText = String(snapshot.total);
					document.getElementById('completedCount').innerText = String(snapshot.completed);
					document.getElementById('inProgressCount').innerText = String(snapshot.inProgress);
					document.getElementById('failedCount').innerText = String(snapshot.failed);
					document.getElementById('lastUpdated').innerText = snapshot.lastUpdated || '--';

					const list = document.getElementById('statusList');
					list.innerHTML = '';

					if (snapshot.items.length === 0) {
						const empty = document.createElement('div');
						empty.className = 'empty';
						empty.innerText = 'No folders discovered yet. Click Generate to begin.';
						list.appendChild(empty);
						return;
					}

					snapshot.items.forEach(item => {
						const row = document.createElement('div');
						row.className = 'status-item';

						const name = document.createElement('span');
						name.textContent = item.name;

						const pill = document.createElement('span');
						pill.className = 'status-pill ' + item.status;
						pill.textContent = titleCase(item.status.replace(/-/g, ' '));

						row.appendChild(name);
						row.appendChild(pill);
						list.appendChild(row);
					});
				}

				function titleCase(value) {
					return value.replace(/\b\w/g, char => char.toUpperCase());
				}
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
	<h1>AGENTS.md Portal</h1>
	<button id="generateButton">Generate AGENTS.md Files</button>
	<div class="status-grid">
		<div class="status-card">
			<h2>Total Folders</h2>
			<span id="totalCount">0</span>
		</div>
		<div class="status-card">
			<h2>Completed</h2>
			<span id="completedCount">0</span>
		</div>
		<div class="status-card">
			<h2>In Progress</h2>
			<span id="inProgressCount">0</span>
		</div>
		<div class="status-card">
			<h2>Failed</h2>
			<span id="failedCount">0</span>
		</div>
	</div>
	<div class="status-list" id="statusList"></div>
	<div class="footer">Last updated: <span id="lastUpdated">--</span></div>
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
