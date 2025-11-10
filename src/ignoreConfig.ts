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
 * Checks if a folder should be ignored based on the configured patterns.
 * @param folderName The name of the folder to check
 * @param relativePath The relative path from workspace root (for path-based patterns like "ResourceAnalyzers/*")
 * @returns true if the folder should be ignored, false otherwise
 */
export function shouldIgnoreFolder(folderName: string, relativePath?: string): boolean {
	// Check exact matches against folder name
	if (runtimeIgnoredFolderNames.includes(folderName)) {
		return true;
	}
	
	// Check pattern matches against both folder name and relative path
	for (const pattern of runtimeIgnoredFolderPatterns) {
		// Try matching against folder name
		if (matchesPattern(folderName, pattern)) {
			return true;
		}
		
		// If relativePath is provided and pattern contains / or \, match against path
		if (relativePath && (pattern.includes('/') || pattern.includes('\\'))) {
			// Normalize path separators to forward slash for consistent matching
			const normalizedPath = relativePath.replace(/\\/g, '/');
			const normalizedPattern = pattern.replace(/\\/g, '/');
			
			if (matchesPattern(normalizedPath, normalizedPattern)) {
				return true;
			}
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
