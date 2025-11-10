/**
 * Configuration for folders to ignore during AGENTS.md generation.
 * 
 * Add new patterns here to exclude additional folders from documentation generation.
 * Patterns are matched against folder names (case-sensitive by default on Linux/Mac,
 * case-insensitive on Windows).
 */

/**
 * Default list of folder names to ignore.
 * These are exact matches against folder names.
 */
export const DEFAULT_IGNORED_FOLDER_NAMES = [
	// Version Control
	'.git',
	'.svn',
	'.hg',
	
	// IDEs and Editors
	'.vs',
	'.vscode',
	'.idea',
	'.fleet',
	
	// Build Outputs
	'bin',
	'obj',
	'dist',
	'out',
	'build',
	'target',
	'release',
	'debug',
	
	// Dependencies
	'node_modules',
	'vendor',
	'packages',
	'bower_components',
	
	// Test Coverage and Reports
	'coverage',
	'.nyc_output',
	'test-results',
	'TestResults',
	
	// Temporary and Cache
	'.cache',
	'.temp',
	'.tmp',
	'tmp',
	'temp',
	
	// Python
	'__pycache__',
	'.pytest_cache',
	'.mypy_cache',
	'.tox',
	'venv',
	'.venv',
	'env',
	'.env',
	'virtualenv',
	
	// .NET
	'.nuget',
	'.dotnet',
	
	// Java
	'.gradle',
	'.m2',
	
	// macOS
	'.DS_Store',
	
	// Other
	'.next',
	'.nuxt',
	'.output',
	'.vercel',
	'.netlify',
	'__snapshots__',
];

/**
 * Default list of folder name patterns to ignore (using simple wildcard matching).
 * Supports * wildcard for matching multiple characters.
 * 
 * Examples:
 * - "test-*" matches "test-output", "test-reports", etc.
 * - "*-tmp" matches "build-tmp", "cache-tmp", etc.
 * - "*.bak" matches "config.bak", "data.bak", etc.
 */
export const DEFAULT_IGNORED_FOLDER_PATTERNS = [
	'*.log',
	'*.tmp',
	'*-tmp',
	'*-cache',
	'.vs*', // Matches .vs, .vscode-server, etc.
];

// Runtime configuration - these will be updated from user settings
let runtimeIgnoredFolderNames: string[] = [...DEFAULT_IGNORED_FOLDER_NAMES];
let runtimeIgnoredFolderPatterns: string[] = [...DEFAULT_IGNORED_FOLDER_PATTERNS];

/**
 * Update the runtime ignore configuration
 */
export function updateIgnoreConfig(names: string[], patterns: string[]): void {
	runtimeIgnoredFolderNames = names;
	runtimeIgnoredFolderPatterns = patterns;
}

/**
 * Get current ignore configuration
 */
export function getIgnoreConfig(): { names: string[]; patterns: string[] } {
	return {
		names: [...runtimeIgnoredFolderNames],
		patterns: [...runtimeIgnoredFolderPatterns]
	};
}

/**
 * Checks if a folder name should be ignored based on the configured patterns.
 * @param folderName The name of the folder to check
 * @returns true if the folder should be ignored, false otherwise
 */
export function shouldIgnoreFolder(folderName: string): boolean {
	// Check exact matches
	if (runtimeIgnoredFolderNames.includes(folderName)) {
		return true;
	}
	
	// Check pattern matches
	for (const pattern of runtimeIgnoredFolderPatterns) {
		if (matchesPattern(folderName, pattern)) {
			return true;
		}
	}
	
	return false;
}

/**
 * Simple wildcard pattern matcher.
 * Supports * for matching any sequence of characters.
 * @param text The text to match against
 * @param pattern The pattern with wildcards
 * @returns true if the text matches the pattern
 */
function matchesPattern(text: string, pattern: string): boolean {
	// Escape special regex characters except *
	const regexPattern = pattern
		.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
		.replace(/\*/g, '.*');
	
	const regex = new RegExp(`^${regexPattern}$`);
	return regex.test(text);
}
