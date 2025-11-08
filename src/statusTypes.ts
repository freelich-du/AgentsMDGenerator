export enum GenerationStatus {
	NotStarted = 'not-started',
	InProgress = 'in-progress',
	Completed = 'completed',
	Failed = 'failed'
}

export interface StatusItem {
	path: string;
	name: string;
	status: GenerationStatus;
}

export interface StatusSnapshot {
	total: number;
	completed: number;
	inProgress: number;
	failed: number;
	items: StatusItem[];
	lastUpdated: string;
}
