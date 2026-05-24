import type { BookmarkIndexEntry } from '../types';

let query = $state('');
let flatIndex = $state<BookmarkIndexEntry[]>([]);

function setQuery(nextQuery: string): void {
	query = nextQuery;
}

function setIndex(index: BookmarkIndexEntry[]): void {
	flatIndex = index;
}

function getResults(): BookmarkIndexEntry[] {
	if (!query.trim()) return [];

	const normalizedQuery = query.toLowerCase();
	return flatIndex.filter((entry) =>
		entry.title.toLowerCase().includes(normalizedQuery) ||
		entry.url.toLowerCase().includes(normalizedQuery)
	);
}

export const searchStore = {
	get query(): string {
		return query;
	},
	setQuery,
	setIndex,
	getResults,
};
