<script lang="ts">
    import { MoveNode } from "../api";
    import { getErrorMessage } from "../errors";
    import { treeStore } from "../stores/treeStore.svelte.ts";
    import { uiStore } from "../stores/uiStore.svelte.ts";
    import TreeNode from "./TreeNode.svelte";
    import type { TreeNode as BookmarkTreeNode } from "../types";
    import { isFolderNode } from "../types";

    interface Props {
        node: BookmarkTreeNode;
        depth?: number;
    }

    let { node, depth = 0 }: Props = $props();
    const nodeId = $derived(node.id);
    const childNodes = $derived(isFolderNode(node) ? node.folder.children : []);
    const folderPaddingLeft = $derived(`${depth * 16 + 8}px`);
    const bookmarkPaddingLeft = $derived(`${depth * 16 + 24}px`);

    // Drag state
    let isDragOver = $state(false);
    let isDragging = $state(false);
    let dropPosition = $state<"before" | "after" | "inside" | "">(""); // 'before', 'after', 'inside'

    function handleDragStart(event: DragEvent): void {
        isDragging = true;
        event.dataTransfer?.setData("text/plain", nodeId);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
        }
    }

    function handleDragEnd() {
        isDragging = false;
    }

    function handleDragOver(event: DragEvent): void {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }
        isDragOver = true;
        const currentTarget = event.currentTarget;
        if (!(currentTarget instanceof HTMLElement)) return;
        const rect = currentTarget.getBoundingClientRect();
        const relY = (event.clientY - rect.top) / rect.height;
        if (isFolderNode(node)) {
            if (relY < 0.25) {
                dropPosition = "before";
            } else if (relY > 0.75) {
                dropPosition = "after";
            } else {
                dropPosition = "inside";
            }
        } else {
            dropPosition = relY < 0.5 ? "before" : "after";
        }
    }

    function handleDragLeave() {
        isDragOver = false;
        dropPosition = "";
    }

    async function handleDrop(event: DragEvent): Promise<void> {
        event.preventDefault();
        isDragOver = false;
        const targetPosition = dropPosition;
        dropPosition = "";
        const draggedId = event.dataTransfer?.getData("text/plain") ?? "";
        if (!draggedId || draggedId === nodeId) return;

        let newParentId = "";
        let newIndex = -1;

        if (isFolderNode(node) && targetPosition === "inside") {
            newParentId = nodeId;
            newIndex = -1;
        } else {
            const parent = treeStore.getParentNode(nodeId);
            if (!parent) {
                uiStore.showToast(
                    "Reordering at the root level is not supported yet",
                    "error",
                );
                return;
            }

            const siblingIndex = treeStore.getChildIndex(parent.id, nodeId);
            if (siblingIndex < 0) {
                uiStore.showToast(
                    "Move failed: could not resolve target position",
                    "error",
                );
                return;
            }

            newParentId = parent.id;
            newIndex =
                targetPosition === "before" ? siblingIndex : siblingIndex + 1;
        }

        try {
            await MoveNode(draggedId, newParentId, newIndex);
            await treeStore.refresh();
        } catch (caughtError: unknown) {
            uiStore.showToast(
                getErrorMessage(caughtError, "Move failed"),
                "error",
            );
        }
    }

    function handleRowKeydown(event: KeyboardEvent): void {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            treeStore.selectNode(nodeId);
            if (isFolderNode(node) && event.key === " ") {
                treeStore.toggleExpand(nodeId);
            }
        }
    }
</script>

{#if isFolderNode(node)}
    <!-- Folder node -->
    <div>
        <!-- Insertion indicator above -->
        {#if isDragOver && dropPosition === "before"}
            <div class="h-0.5 bg-secondary rounded-full mx-2"></div>
        {/if}
        <div
            class={`tree-row flex items-center gap-1 py-1 px-2 cursor-pointer select-none
				${treeStore.selectedNodeId === nodeId ? "bg-primary/20 text-primary" : "hover:bg-base-200"}
				${isDragOver && dropPosition === "inside" ? "bg-secondary/20 border-2 border-dashed border-secondary" : ""}
				${isDragging ? "opacity-40" : ""}
			`}
            role="treeitem"
            aria-expanded={treeStore.isExpanded(nodeId)}
            aria-selected={treeStore.selectedNodeId === nodeId}
            tabindex="-1"
            style:padding-left={folderPaddingLeft}
            onclick={() => treeStore.selectNode(nodeId)}
            onkeydown={handleRowKeydown}
            draggable="true"
            ondragstart={handleDragStart}
            ondragend={handleDragEnd}
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
        >
            <!-- Expand/collapse chevron -->
            <button
                class="btn btn-ghost btn-xs p-0 h-4 min-h-0 inline-flex items-center justify-center"
                onclick={(event: MouseEvent) => {
                    event.stopPropagation();
                    treeStore.toggleExpand(nodeId);
                }}
            >
                {#if treeStore.isExpanded(nodeId)}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fill-rule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clip-rule="evenodd"
                        />
                    </svg>
                {:else}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fill-rule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clip-rule="evenodd"
                        />
                    </svg>
                {/if}
            </button>
            <!-- Folder icon -->
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 shrink-0"
                viewBox="0 0 640 640"
                fill="currentColor"
                aria-hidden="true"
            >
                {#if treeStore.isExpanded(nodeId)}
                    <path
                        d="M88 289.6L64.4 360.2L64.4 160C64.4 124.7 93.1 96 128.4 96L267.1 96C280.9 96 294.4 100.5 305.5 108.8L343.9 137.6C349.4 141.8 356.2 144 363.1 144L480.4 144C515.7 144 544.4 172.7 544.4 208L544.4 224L179 224C137.7 224 101 250.4 87.9 289.6zM509.8 512L131 512C98.2 512 75.1 479.9 85.5 448.8L133.5 304.8C140 285.2 158.4 272 179 272L557.8 272C590.6 272 613.7 304.1 603.3 335.2L555.3 479.2C548.8 498.8 530.4 512 509.8 512z"
                    />
                {:else}
                    <path
                        d="M128 512L512 512C547.3 512 576 483.3 576 448L576 208C576 172.7 547.3 144 512 144L362.7 144C355.8 144 349 141.8 343.5 137.6L305.1 108.8C294 100.5 280.5 96 266.7 96L128 96C92.7 96 64 124.7 64 160L64 448C64 483.3 92.7 512 128 512z"
                    />
                {/if}
            </svg>
            <span class="truncate text-sm">{node.folder.name}</span>
            <span class="text-xs opacity-40 ml-1">({childNodes.length})</span>
        </div>
        <!-- Insertion indicator below -->
        {#if isDragOver && dropPosition === "after"}
            <div class="h-0.5 bg-secondary rounded-full mx-2"></div>
        {/if}
        <!-- Children -->
        {#if treeStore.isExpanded(nodeId)}
            {#each childNodes as child (child.id)}
                <TreeNode node={child} depth={depth + 1} />
            {/each}
        {/if}
    </div>
{:else}
    <!-- Bookmark node -->
    <div
        class={`tree-row relative flex items-center gap-2 py-1 px-2 cursor-pointer select-none
			${treeStore.selectedNodeId === nodeId ? "bg-primary/20 text-primary" : "hover:bg-base-200"}
			${isDragOver ? "bg-secondary/10" : ""}
			${isDragging ? "opacity-40" : ""}
		`}
        role="treeitem"
        aria-selected={treeStore.selectedNodeId === nodeId}
        tabindex="-1"
        style:padding-left={bookmarkPaddingLeft}
        onclick={() => treeStore.selectNode(nodeId)}
        onkeydown={handleRowKeydown}
        draggable="true"
        ondragstart={handleDragStart}
        ondragend={handleDragEnd}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
    >
        {#if isDragOver && dropPosition === "before"}
            <div
                class="absolute inset-x-0 top-0 h-0.5 bg-secondary rounded-full"
            ></div>
        {/if}
        <!-- Bookmark icon -->
        {#if node.bookmark.icon}
            <img src={node.bookmark.icon} alt="" class="h-4 w-4 shrink-0" />
        {:else}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
            >
                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
            </svg>
        {/if}
        <span class="truncate text-sm"
            >{node.bookmark.title || node.bookmark.url}</span
        >
        {#if isDragOver && dropPosition === "after"}
            <div
                class="absolute inset-x-0 bottom-0 h-0.5 bg-secondary rounded-full"
            ></div>
        {/if}
    </div>
{/if}
