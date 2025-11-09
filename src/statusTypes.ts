export enum GenerationStatus {
	NotStarted = 'not-started',
	InProgress = 'in-progress',
	Completed = 'completed',
	Failed = 'failed'
}

export interface StatusItem {
	path: string;
	name: string;
	relativePath: string;
	depth: number;
	status: GenerationStatus;
	hasAgentsFile: boolean;
	agentsUpdatedAt?: string;
	contentUpdatedAt?: string;
	isUpToDate: boolean;
}

export interface StatusSnapshot {
	total: number;
	completed: number;
	inProgress: number;
	failed: number;
	items: StatusItem[];
	lastUpdated: string;
}
