// Tree store — singleton managing the bookmark tree, selection, expand/collapse.
// Uses Svelte 5 runes ($state) — must be processed by the Svelte compiler.

import { LoadFile, GetTree } from '../api.js';

function getNodeId(node) {
	if (!node || typeof node !== 'object') return '';
	return node.id || node.folder?.id || node.bookmark?.id || '';
}

function normalizeNode(node) {
	if (!node || typeof node !== 'object') return null;

	const id = getNodeId(node);
	if (!id) return null;

	if (node.type === 0 && node.folder) {
		return {
			...node,
			id,
			folder: {
				...node.folder,
				children: normalizeTree(node.folder.children),
			},
		};
	}

	if (node.type === 1 && node.bookmark) {
		return {
			...node,
			id,
		};
	}

	return null;
}

// Normalize tree data into the frontend shape the components expect.
function normalizeTree(nodes) {
	if (Array.isArray(nodes)) {
		return nodes.map(normalizeNode).filter(Boolean);
	}

	const singleNode = normalizeNode(nodes);
	return singleNode ? [singleNode] : [];
}

let tree = $state([]);
let selectedNodeId = $state('');
let expandedNodeIds = $state([]);
let loading = $state(false);
let error = $state('');

async function loadFile(path) {
	loading = true;
	error = '';
	try {
		await LoadFile(path);
		const treeData = await GetTree();
		const normalized = normalizeTree(treeData);
		// Clear expanded IDs before reloading
		expandedNodeIds = [];
		tree = normalized;
		// Expand root folders by default
		tree.forEach((node) => {
			if (node.type === 0) {
				expandedNodeIds.push(node.id);
			}
		});
	} catch (e) {
		error = e.message || String(e);
	} finally {
		loading = false;
	}
}

function selectNode(id) {
	selectedNodeId = id;
}

function toggleExpand(id) {
	const idx = expandedNodeIds.indexOf(id);
	if (idx >= 0) {
		expandedNodeIds.splice(idx, 1);
	} else {
		expandedNodeIds.push(id);
	}
}

function isExpanded(id) {
	return expandedNodeIds.includes(id);
}

function getNode(id) {
	return findNode(tree, id);
}

function findNode(nodes, id) {
	for (const node of nodes) {
		if (!node) continue;
		if (node.id === id) return node;
		if (node.type === 0 && node.folder && node.folder.children) {
			const found = findNode(node.folder.children, id);
			if (found) return found;
		}
	}
	return null;
}

async function refresh() {
	tree = normalizeTree(await GetTree());
}

export const treeStore = {
	get tree() { return tree; },
	get selectedNodeId() { return selectedNodeId; },
	get expandedNodeIds() { return expandedNodeIds; },
	get loading() { return loading; },
	get error() { return error; },
	loadFile,
	refresh,
	selectNode,
	toggleExpand,
	isExpanded,
	getNode,
};
