// Search store — singleton managing search query and flat index filtering.
// Uses Svelte 5 runes ($state) — must be processed by the Svelte compiler.

let query = $state('');
let flatIndex = $state([]);

function setQuery(q) {
	query = q;
}

function setIndex(index) {
	flatIndex = index;
}

function getResults() {
	if (!query.trim()) return [];
	const q = query.toLowerCase();
	return flatIndex.filter((entry) =>
		entry.title.toLowerCase().includes(q) ||
		entry.url.toLowerCase().includes(q)
	);
}

export const searchStore = {
	get query() { return query; },
	setQuery,
	setIndex,
	getResults,
};
