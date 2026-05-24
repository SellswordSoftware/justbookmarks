<script lang="ts">
    import { onMount, tick } from "svelte";
    import { treeStore } from "./lib/stores/treeStore.svelte.ts";
    import {
        ApplyImportMerge,
        CreateBookmarkFile,
        DeleteNode,
        DeleteNodes,
        FetchFaviconsForNodes,
        RefreshTitlesForNodes,
        GetHistoryState,
        GetFilePath,
        OpenFilePicker,
        OpenImportFilePicker,
        PreviewImportMerge,
        Redo,
        Undo,
    } from "./lib/api";
    import { getErrorMessage } from "./lib/errors";
    import type { MergePreview } from "./lib/types";
    import {
        loadPersistedUIState,
        savePersistedUIState,
        setLastOpenedFile,
        setLeftPaneWidth,
        setPerFileTreeState,
        setWindowState,
        type PersistedUIState,
    } from "./lib/persistence";
    import { uiStore } from "./lib/stores/uiStore.svelte.ts";
    import { searchStore } from "./lib/stores/searchStore.svelte.ts";
    import { isFolderNode } from "./lib/types";
    import { moveDialogStore } from "./lib/stores/moveDialogStore.svelte.ts";
    import SearchBar from "./lib/components/SearchBar.svelte";
    import BookmarkTree from "./lib/components/BookmarkTree.svelte";
    import DetailPanel from "./lib/components/DetailPanel.svelte";
    import ToastContainer from "./lib/components/ToastContainer.svelte";
    import ConfirmModal from "./lib/components/ConfirmModal.svelte";
    import ImportMergeDialog from "./lib/components/ImportMergeDialog.svelte";
    import KeyboardShortcutsDialog from "./lib/components/KeyboardShortcutsDialog.svelte";
    import {
        Quit,
        WindowGetSize,
        WindowIsMaximised,
        WindowIsNormal,
        WindowMinimise,
        WindowSetSize,
        WindowToggleMaximise,
    } from "../wailsjs/runtime/runtime.js";

    let hasTriedLoad = $state(false);
    let currentFilePath = $state("");
    let isMaximised = $state(false);
    let titlebarRef = $state<HTMLDivElement | undefined>(undefined);
    let mainContentRef = $state<HTMLDivElement | undefined>(undefined);
    let leftPaneWidth = $state(360);
    let isResizingPane = $state(false);
    let persistedState = $state<PersistedUIState>(loadPersistedUIState());
    let persistenceReady = $state(false);
    let saveWindowSizeTimer: ReturnType<typeof setTimeout> | null = null;
    let importMergeOpen = $state(false);
    let importMergePath = $state("");
    let importMergePreview = $state<MergePreview | null>(null);
    let importMergePreviewLoading = $state(false);
    let importMergeApplyLoading = $state(false);
    let importMergeError = $state("");
    let shortcutsDialogOpen = $state(false);
    let searchInputRef = $state<HTMLInputElement | undefined>(undefined);
    let bookmarkTreeRef = $state<
        | {
              focusTree?: () => void;
              openRootBookmarkForm?: () => void;
              openRootFolderForm?: () => void;
          }
        | undefined
    >(undefined);

    async function initApp() {
        leftPaneWidth = persistedState.leftPaneWidth;

        if (hasWailsRuntime() && persistedState.window) {
            WindowSetSize(persistedState.window.width, persistedState.window.height);
        }

        if (!window.go) {
            persistenceReady = true;
            return;
        }

        const filePath = await GetFilePath();

        if (typeof filePath === "string" && filePath.length > 0) {
            await loadFileIntoSession(filePath);
        } else if (persistedState.lastOpenedFile) {
            await loadFileIntoSession(persistedState.lastOpenedFile, true);
        }

        hasTriedLoad = true;
        await syncWindowState();
        persistenceReady = true;
    }

    onMount(() => {
        initApp();

        return () => {
            if (saveWindowSizeTimer) {
                clearTimeout(saveWindowSizeTimer);
            }
            void persistWindowSize();
        };
    });

    $effect(() => {
        if (!titlebarRef) return;
        const titlebar = titlebarRef;

        const handleDoubleClick = () => {
            toggleMaximiseWindow();
        };

        titlebar.addEventListener("dblclick", handleDoubleClick);

        return () => {
            titlebar.removeEventListener("dblclick", handleDoubleClick);
        };
    });

    $effect(() => {
        if (!mainContentRef) return;
        leftPaneWidth = clampLeftPaneWidth(leftPaneWidth);
    });

    $effect(() => {
        if (!persistenceReady || !currentFilePath || treeStore.loading) return;
        persistedState = setPerFileTreeState(
            currentFilePath,
            treeStore.getPersistentState(),
        );
    });

    $effect(() => {
        if (!persistenceReady) return;
        persistedState = setLeftPaneWidth(leftPaneWidth);
    });

    async function loadFileIntoSession(
        path: string,
        silentFailure = false,
    ): Promise<boolean> {
        const loaded = await treeStore.loadFile(path);
        if (loaded) {
            const nextState = loadPersistedUIState();
            treeStore.restoreUIState(nextState.files[path]);
            persistedState = setLastOpenedFile(path);
            currentFilePath = path;
            return true;
        }

        if (loadPersistedUIState().lastOpenedFile === path) {
            persistedState = {
                ...loadPersistedUIState(),
                lastOpenedFile: "",
            };
            savePersistedUIState(persistedState);
        }
        currentFilePath = "";
        if (!silentFailure && treeStore.error) {
            uiStore.showToast(treeStore.error, "error");
        }
        return false;
    }

    async function openFile() {
        const path = await OpenFilePicker();
        if (path) {
            const loaded = await loadFileIntoSession(path);
            hasTriedLoad = true;
            if (!loaded) return;
        }
    }

    async function createFile() {
        try {
            const path = await CreateBookmarkFile();
            if (!path) {
                return;
            }

            const loaded = await loadFileIntoSession(path);
            hasTriedLoad = true;
            if (!loaded) {
                return;
            }
            uiStore.showToast("Bookmark file created", "success");
        } catch (caughtError: unknown) {
            uiStore.showToast(
                getErrorMessage(caughtError, "Failed to create bookmark file"),
                "error",
            );
        }
    }

    function closeImportMergeDialog(force = false): void {
        if (importMergeApplyLoading && !force) return;
        importMergeOpen = false;
        importMergePath = "";
        importMergePreview = null;
        importMergePreviewLoading = false;
        importMergeError = "";
    }

    async function previewImportMergeFromPath(path: string): Promise<void> {
        importMergeOpen = true;
        importMergePath = path;
        importMergePreview = null;
        importMergeError = "";
        importMergePreviewLoading = true;

        try {
            const preview = await PreviewImportMerge(path);
            const hasAdditions =
                preview.foldersToAdd.length > 0 ||
                preview.bookmarksToAdd.length > 0;

            if (!hasAdditions) {
                importMergeOpen = false;
                uiStore.showToast("No new changes found", "info");
                return;
            }

            importMergePreview = preview;
        } catch (caughtError: unknown) {
            importMergeError = getErrorMessage(
                caughtError,
                "Failed to preview import merge",
            );
        } finally {
            importMergePreviewLoading = false;
        }
    }

    async function openImportMerge(): Promise<void> {
        const path = await OpenImportFilePicker();
        if (!path) {
            return;
        }

        await previewImportMergeFromPath(path);
    }

    async function pickAnotherImportFile(): Promise<void> {
        const path = await OpenImportFilePicker();
        if (!path) {
            return;
        }

        await previewImportMergeFromPath(path);
    }

    async function applyImportMerge(): Promise<void> {
        if (!importMergePath) {
            return;
        }

        importMergeApplyLoading = true;
        importMergeError = "";

        try {
            const result = await ApplyImportMerge(importMergePath);
            await treeStore.refresh();
            importMergeApplyLoading = false;
            closeImportMergeDialog(true);
            uiStore.showToast(
                `Merge applied: ${result.foldersAdded} folders, ${result.bookmarksAdded} bookmarks`,
                "success",
            );
        } catch (caughtError: unknown) {
            importMergeError = getErrorMessage(
                caughtError,
                "Failed to apply import merge",
            );
        } finally {
            importMergeApplyLoading = false;
        }
    }

    function registerSearchInput(
        input: HTMLInputElement | undefined,
    ): void {
        searchInputRef = input;
    }

    function openShortcutsDialog(): void {
        shortcutsDialogOpen = true;
    }

    function closeShortcutsDialog(): void {
        shortcutsDialogOpen = false;
    }

    function hasWailsRuntime(): boolean {
        return (
            typeof window !== "undefined" &&
            typeof window.runtime !== "undefined"
        );
    }

    async function syncWindowState() {
        if (!hasWailsRuntime()) {
            isMaximised = false;
            return;
        }
        try {
            isMaximised = await WindowIsMaximised();
        } catch {
            isMaximised = false;
        }
    }

    function minimiseWindow() {
        if (!hasWailsRuntime()) return;
        WindowMinimise();
    }

    async function toggleMaximiseWindow() {
        if (!hasWailsRuntime()) return;
        WindowToggleMaximise();
        await syncWindowState();
    }

    function closeWindow() {
        if (!hasWailsRuntime()) return;
        Quit();
    }

    function clampLeftPaneWidth(nextWidth: number): number {
        const containerWidth = mainContentRef?.clientWidth ?? 0;
        const minWidth = 260;
        const maxWidth = Math.max(minWidth, containerWidth - 320);
        return Math.min(Math.max(nextWidth, minWidth), maxWidth);
    }

    function startPaneResize(event: MouseEvent): void {
        event.preventDefault();
        isResizingPane = true;
    }

    function handlePaneResize(event: MouseEvent): void {
        if (!isResizingPane || !mainContentRef) return;

        const bounds = mainContentRef.getBoundingClientRect();
        leftPaneWidth = clampLeftPaneWidth(event.clientX - bounds.left);
    }

    function stopPaneResize(): void {
        isResizingPane = false;
    }

    async function persistWindowSize(): Promise<void> {
        if (!persistenceReady || !hasWailsRuntime()) return;

        try {
            const isNormal = await WindowIsNormal();
            if (!isNormal) return;

            const size = await WindowGetSize();
            persistedState = setWindowState({
                width: size.w,
                height: size.h,
            });
        } catch {
            // Best-effort persistence only.
        }
    }

    function schedulePersistWindowSize(): void {
        if (saveWindowSizeTimer) {
            clearTimeout(saveWindowSizeTimer);
        }

        saveWindowSizeTimer = setTimeout(() => {
            void persistWindowSize();
        }, 150);
    }

    function isEditableTarget(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) {
            return false;
        }

        const tagName = target.tagName.toLowerCase();
        return (
            target.isContentEditable ||
            tagName === "input" ||
            tagName === "textarea" ||
            tagName === "select"
        );
    }

    function getCurrentFocusZone(): "search" | "tree" | "detail" | "dialog" {
        const activeElement = document.activeElement;
        const zoneElement = activeElement instanceof HTMLElement
            ? activeElement.closest<HTMLElement>("[data-focus-zone]")
            : null;
        const zone = zoneElement?.dataset.focusZone;
        if (zone === "search" || zone === "tree" || zone === "detail" || zone === "dialog") {
            return zone;
        }
        return "tree";
    }

    function focusSearch(): void {
        searchInputRef?.focus();
        searchInputRef?.select();
    }

    function focusTree(): void {
        bookmarkTreeRef?.focusTree?.();
    }

    function focusDetail(): void {
        const detail = document.querySelector<HTMLElement>('[data-focus-zone="detail"]');
        detail?.focus();
    }

    function cycleFocusZone(): void {
        const zoneOrder: Array<"search" | "tree" | "detail"> = ["search", "tree", "detail"];
        const currentZone = getCurrentFocusZone();
        const currentIndex = zoneOrder.indexOf(currentZone === "dialog" ? "detail" : currentZone);
        const nextZone = zoneOrder[(currentIndex + 1 + zoneOrder.length) % zoneOrder.length];
        if (nextZone === "search") focusSearch();
        if (nextZone === "tree") focusTree();
        if (nextZone === "detail") focusDetail();
    }

    async function focusDetailForSelection(): Promise<void> {
        await tick();
        focusDetail();
    }

    function clickKeyboardAction(action: string): boolean {
        const target = document.querySelector<HTMLElement>(`[data-keyboard-action="${action}"]`);
        if (!target || target.hasAttribute("disabled")) {
            return false;
        }
        target.click();
        return true;
    }

    function getPrimarySelectionParentFolderId(): string {
        const primaryId = treeStore.primarySelectedNodeId;
        if (!primaryId) return "";
        return treeStore.getParentId(primaryId);
    }

    async function openAddBookmarkShortcut(): Promise<void> {
        const selectedNode = treeStore.getPrimarySelectedNode();
        if (selectedNode && isFolderNode(selectedNode)) {
            if (!clickKeyboardAction("folder-add-bookmark")) {
                return;
            }
            await tick();
            document.querySelector<HTMLElement>('[data-keyboard-action="add-bookmark-url"]')?.focus();
            return;
        }

        const parentId = getPrimarySelectionParentFolderId();
        if (parentId) {
            treeStore.selectSingle(parentId);
            await focusDetailForSelection();
            if (clickKeyboardAction("folder-add-bookmark")) {
                await tick();
                document.querySelector<HTMLElement>('[data-keyboard-action="add-bookmark-url"]')?.focus();
            }
            return;
        }

        bookmarkTreeRef?.openRootBookmarkForm?.();
        await tick();
        document.querySelector<HTMLElement>('[data-keyboard-action="add-bookmark-url"]')?.focus();
    }

    async function openAddFolderShortcut(): Promise<void> {
        const selectedNode = treeStore.getPrimarySelectedNode();
        if (selectedNode && isFolderNode(selectedNode)) {
            if (!clickKeyboardAction("folder-add-folder")) {
                return;
            }
            await tick();
            document.querySelector<HTMLElement>('[data-keyboard-action="add-folder-name"]')?.focus();
            return;
        }

        const parentId = getPrimarySelectionParentFolderId();
        if (parentId) {
            treeStore.selectSingle(parentId);
            await focusDetailForSelection();
            if (clickKeyboardAction("folder-add-folder")) {
                await tick();
                document.querySelector<HTMLElement>('[data-keyboard-action="add-folder-name"]')?.focus();
            }
            return;
        }

        bookmarkTreeRef?.openRootFolderForm?.();
        await tick();
        document.querySelector<HTMLElement>('[data-keyboard-action="add-folder-name"]')?.focus();
    }

    async function triggerEditShortcut(renameOnly = false): Promise<void> {
        const selectedNode = treeStore.getPrimarySelectedNode();
        if (!selectedNode) return;

        if (isFolderNode(selectedNode)) {
            if (clickKeyboardAction("folder-edit")) {
                await tick();
                document.querySelector<HTMLElement>('[data-keyboard-action="folder-name"]')?.focus();
            }
            return;
        }

        if (renameOnly) {
            if (clickKeyboardAction("bookmark-edit")) {
                await tick();
                document.querySelector<HTMLElement>('[data-keyboard-action="bookmark-title"]')?.focus();
            }
            return;
        }

        if (clickKeyboardAction("bookmark-edit")) {
            await tick();
            document.querySelector<HTMLElement>('[data-keyboard-action="bookmark-title"]')?.focus();
        }
    }

    function triggerOpenShortcut(): void {
        clickKeyboardAction("bookmark-open");
    }

    function triggerMoveShortcut(): void {
        if (treeStore.selectionCount > 1) {
            const selectedNodes = treeStore.getSelectedNodes();
            if (selectedNodes.length === 0) return;
            moveDialogStore.showBulkMoveDialog(
                treeStore.selectedNodeIds,
                isFolderNode(selectedNodes[0]) ? "folder" : "bookmark",
            );
            return;
        }

        const selectedNode = treeStore.getPrimarySelectedNode();
        if (!selectedNode) return;
        moveDialogStore.showMoveDialog(
            selectedNode.id,
            isFolderNode(selectedNode)
                ? selectedNode.folder.name
                : selectedNode.bookmark.title || selectedNode.bookmark.url,
            isFolderNode(selectedNode) ? "folder" : "bookmark",
        );
    }

    function triggerDeleteShortcut(): void {
        const selectedNodes = treeStore.getSelectedNodes();
        if (selectedNodes.length === 0) return;

        if (selectedNodes.length > 1) {
            const label = isFolderNode(selectedNodes[0]) ? "Folders" : "Bookmarks";
            uiStore.showConfirm(
                `Delete ${label}`,
                `Delete ${selectedNodes.length} selected ${label.toLowerCase()}?`,
                "Delete",
                async () => {
                    try {
                        await DeleteNodes(treeStore.selectedNodeIds);
                        treeStore.clearSelection();
                        await treeStore.refresh();
                        uiStore.showToast(`${selectedNodes.length} ${label.toLowerCase()} deleted`, "success");
                    } catch (caughtError: unknown) {
                        uiStore.showToast(getErrorMessage(caughtError, "Bulk delete failed"), "error");
                    }
                },
            );
            return;
        }

        const selectedNode = selectedNodes[0];
        const title = isFolderNode(selectedNode)
            ? selectedNode.folder.name
            : selectedNode.bookmark.title || selectedNode.bookmark.url;
        const noun = isFolderNode(selectedNode) ? "Folder" : "Bookmark";
        const message = isFolderNode(selectedNode)
            ? `Delete "${title}" and all of its contents?`
            : `Delete "${title}"?`;
        uiStore.showConfirm(
            `Delete ${noun}`,
            message,
            "Delete",
            async () => {
                try {
                    await DeleteNode(selectedNode.id);
                    treeStore.clearSelection();
                    await treeStore.refresh();
                    uiStore.showToast(`${noun} deleted`, "success");
                } catch (caughtError: unknown) {
                    uiStore.showToast(getErrorMessage(caughtError, `Failed to delete ${noun.toLowerCase()}`), "error");
                }
            },
        );
    }

    async function triggerBulkRefreshShortcut(
        kind: "favicons" | "titles",
    ): Promise<void> {
        const selectedNodes = treeStore.getSelectedNodes();
        if (selectedNodes.length === 0 || isFolderNode(selectedNodes[0])) {
            return;
        }

        try {
            if (kind === "favicons") {
                await FetchFaviconsForNodes(treeStore.selectedNodeIds);
                uiStore.showToast("Favicons refreshed", "success");
            } else {
                await RefreshTitlesForNodes(treeStore.selectedNodeIds);
                uiStore.showToast("Titles refreshed", "success");
            }
            await treeStore.refresh();
        } catch (caughtError: unknown) {
            uiStore.showToast(
                getErrorMessage(
                    caughtError,
                    kind === "favicons"
                        ? "Bulk favicon refresh failed"
                        : "Bulk title refresh failed",
                ),
                "error",
            );
        }
    }

    function getSelectedSearchResultId(): string {
        if (!searchStore.query) {
            return "";
        }

        const selectedId = treeStore.selectedNodeId;
        if (selectedId && searchStore.getResults().some((result) => result.nodeId === selectedId)) {
            return selectedId;
        }

        return searchStore.getResults()[0]?.nodeId ?? "";
    }

    async function activateSearchResult(
        mode: "detail" | "open",
    ): Promise<void> {
        const nodeId = getSelectedSearchResultId();
        if (!nodeId) return;

        treeStore.expandAncestors(nodeId);
        treeStore.selectSingle(nodeId);

        if (mode === "open") {
            const node = treeStore.getNode(nodeId);
            if (node && !isFolderNode(node)) {
                await tick();
                triggerOpenShortcut();
            }
            return;
        }

        await focusDetailForSelection();
    }

    function handleSearchInputKeydown(event: KeyboardEvent): void {
        if (event.key === "Escape") {
            event.preventDefault();
            if (searchStore.query) {
                searchStore.setQuery("");
            } else {
                focusTree();
            }
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            if (searchStore.query) {
                const results = searchStore.getResults();
                if (results[0]) {
                    treeStore.expandAncestors(results[0].nodeId);
                    treeStore.selectSingle(results[0].nodeId);
                }
            }
            focusTree();
            return;
        }

        if (event.key === "Enter" && searchStore.query) {
            event.preventDefault();
            void activateSearchResult(
                event.ctrlKey || event.metaKey ? "open" : "detail",
            );
        }
    }

    async function runHistoryAction(direction: "undo" | "redo"): Promise<void> {
        if (!currentFilePath) {
            return;
        }

        const historyState = await GetHistoryState();
        const canRun = direction === "undo" ? historyState.canUndo : historyState.canRedo;
        const actionLabel = direction === "undo" ? historyState.undoLabel : historyState.redoLabel;
        if (!canRun) {
            return;
        }

        const selectionSnapshot = treeStore.captureSelectionSnapshot();

        try {
            if (direction === "undo") {
                await Undo();
            } else {
                await Redo();
            }
            await treeStore.refresh();
            treeStore.restoreSelectionSnapshot(selectionSnapshot);
            uiStore.showToast(
                `${direction === "undo" ? "Undid" : "Redid"} ${actionLabel || "action"}`,
                "success",
            );
        } catch (caughtError: unknown) {
            uiStore.showToast(
                getErrorMessage(
                    caughtError,
                    `Failed to ${direction}`,
                ),
                "error",
            );
        }
    }

    function handleGlobalKeydown(event: KeyboardEvent): void {
        const modifierPressed = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        const editableTarget = isEditableTarget(event.target);

        if (!editableTarget && !modifierPressed && !event.altKey) {
            if (key === "f1" || (key === "?" && event.shiftKey)) {
                event.preventDefault();
                openShortcutsDialog();
                return;
            }

            if (key === "/") {
                event.preventDefault();
                focusSearch();
                return;
            }

            if (key === "f6") {
                event.preventDefault();
                cycleFocusZone();
                return;
            }

            if (key === "escape") {
                if (shortcutsDialogOpen) {
                    event.preventDefault();
                    closeShortcutsDialog();
                    return;
                }
                if (uiStore.modal.open) return;
                if (moveDialogStore.open) {
                    event.preventDefault();
                    moveDialogStore.closeMoveDialog();
                    return;
                }
                if (treeStore.selectionCount > 1) {
                    event.preventDefault();
                    treeStore.collapseSelectionToPrimary();
                    return;
                }
            }
        }

        if (editableTarget) {
            return;
        }

        if (!modifierPressed && !event.altKey && currentFilePath) {
            if (key === "a" && !event.shiftKey) {
                event.preventDefault();
                void openAddBookmarkShortcut();
                return;
            }
            if (key === "a" && event.shiftKey) {
                event.preventDefault();
                void openAddFolderShortcut();
                return;
            }
            if (key === "e") {
                event.preventDefault();
                void triggerEditShortcut(false);
                return;
            }
            if (key === "f2") {
                event.preventDefault();
                void triggerEditShortcut(true);
                return;
            }
            if (key === "o") {
                event.preventDefault();
                triggerOpenShortcut();
                return;
            }
            if (key === "m") {
                event.preventDefault();
                triggerMoveShortcut();
                return;
            }
            if (key === "delete" || key === "backspace") {
                event.preventDefault();
                triggerDeleteShortcut();
                return;
            }
            if (key === "enter" && getCurrentFocusZone() === "tree") {
                event.preventDefault();
                if (searchStore.query) {
                    void activateSearchResult(
                        modifierPressed ? "open" : "detail",
                    );
                } else {
                    void focusDetailForSelection();
                }
                return;
            }
        }

        if (!modifierPressed || event.altKey) {
            return;
        }

        const isUndo = key === "z" && !event.shiftKey;
        const isRedo = key === "y" || (key === "z" && event.shiftKey);

        if (isUndo || isRedo) {
            event.preventDefault();
            void runHistoryAction(isUndo ? "undo" : "redo");
            return;
        }

        if (key === "enter" && getCurrentFocusZone() === "tree" && searchStore.query) {
            event.preventDefault();
            void activateSearchResult("open");
            return;
        }

        if (key === "i" && event.shiftKey) {
            event.preventDefault();
            void openImportMerge();
            return;
        }

        if (key === "a" && event.shiftKey) {
            event.preventDefault();
            treeStore.collapseSelectionToPrimary();
            return;
        }

        if (key === "f" && event.shiftKey && currentFilePath) {
            event.preventDefault();
            void triggerBulkRefreshShortcut("favicons");
            return;
        }

        if (key === "t" && event.shiftKey && currentFilePath) {
            event.preventDefault();
            void triggerBulkRefreshShortcut("titles");
            return;
        }

        if (key === "f") {
            event.preventDefault();
            focusSearch();
            return;
        }

        if (key === "o") {
            event.preventDefault();
            void openFile();
            return;
        }

        if (key === "n") {
            event.preventDefault();
            void createFile();
            return;
        }

        if (key === "a" && currentFilePath) {
            event.preventDefault();
            treeStore.selectAllSiblings();
            return;
        }

        if (key === " " && getCurrentFocusZone() === "tree" && currentFilePath) {
            event.preventDefault();
            const changed = treeStore.toggleSelected(treeStore.selectedNodeId);
            if (!changed) {
                uiStore.showToast("Multi-select only supports matching sibling bookmarks or folders", "warning");
            }
            return;
        }

    }
</script>

<svelte:window
    onbeforeunload={persistWindowSize}
    onfocus={syncWindowState}
    onkeydown={handleGlobalKeydown}
    onmousemove={handlePaneResize}
    onmouseup={stopPaneResize}
    onresize={schedulePersistWindowSize}
/>

<div
    class="h-screen flex flex-col overflow-hidden bg-base-100 border border-base-300"
>
    <div
        bind:this={titlebarRef}
        class="navbar min-h-10 bg-base-200 border-b border-base-300 gap-2 select-none"
        style="--wails-draggable:drag"
        data-wails-drag
    >
        <div class="flex-1 min-w-0 px-3">
            <div class="flex items-center gap-3">
                <h1 class="text-sm font-semibold truncate">JustBookmarks</h1>
                {#if currentFilePath}
                    {#if treeStore.loading}
                        <span class="loading loading-spinner loading-xs"></span>
                    {:else if treeStore.error}
                        <span class="text-error text-xs truncate"
                            >{treeStore.error}</span
                        >
                    {:else}
                        <span class="text-xs opacity-60"
                            >{treeStore.tree.length} root folder{treeStore.tree
                                .length !== 1
                                ? "s"
                                : ""}</span
                        >
                    {/if}
                {/if}
            </div>
        </div>
        <div class="flex items-center gap-1 px-2" data-wails-no-drag>
            <button
                class="btn btn-ghost btn-sm btn-square"
                type="button"
                aria-label="Minimize window"
                title="Minimize"
                onclick={minimiseWindow}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 12h14"
                    />
                </svg>
            </button>
            <button
                class="btn btn-ghost btn-sm btn-square"
                type="button"
                aria-label={isMaximised ? "Restore window" : "Maximize window"}
                title={isMaximised ? "Restore" : "Maximize"}
                onclick={toggleMaximiseWindow}
            >
                {#if isMaximised}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 9h11v11H9z"
                        />
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 4h11v11"
                        />
                    </svg>
                {:else}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 4h16v16H4z"
                        />
                    </svg>
                {/if}
            </button>
            <button
                class="btn btn-ghost btn-sm btn-square hover:btn-error"
                type="button"
                aria-label="Close window"
                title="Close"
                onclick={closeWindow}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
            </button>
        </div>
    </div>

    <!-- Welcome screen (no file loaded) -->
    {#if !currentFilePath}
        <div class="flex-1 flex items-center justify-center">
            <div class="text-center max-w-sm">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-24 w-24 mx-auto mb-6 text-primary/30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1"
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                </svg>
                <h2 class="text-2xl font-bold mb-2">JustBookmarks</h2>
                <p class="text-base-content/60 mb-6">
                    Manage your bookmarks outside the browser. Open a Netscape
                    Bookmarks HTML file to get started.
                </p>
                <button class="btn btn-primary" onclick={openFile}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                    </svg>
                    Open Bookmark File
                </button>
                <button class="btn btn-outline btn-secondary mt-3" onclick={createFile}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    Create Bookmark File
                </button>
                {#if treeStore.loading}
                    <div class="mt-4">
                        <span
                            class="loading loading-spinner loading-sm text-primary"
                        ></span>
                        <p class="text-xs text-base-content/50 mt-1">
                            Loading...
                        </p>
                    </div>
                {/if}
                {#if treeStore.error}
                    <p class="text-error text-xs mt-2">{treeStore.error}</p>
                {/if}
            </div>
        </div>
    {:else}
        <!-- Main app layout -->
        <SearchBar
            onInputReady={registerSearchInput}
            onInputKeydown={handleSearchInputKeydown}
        >
            {#snippet actions()}
                <button
                    class="btn btn-sm btn-outline btn-secondary"
                    onclick={createFile}
                    title="Create a new bookmark file"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    New File
                </button>
                <button
                    class="btn btn-sm btn-ghost"
                    onclick={openFile}
                    title="Open another file"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                    </svg>
                    Open File
                </button>
                <button
                    class="btn btn-sm btn-ghost"
                    onclick={openImportMerge}
                    title="Import another bookmark file into the current one"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 4v10m0 0l-4-4m4 4l4-4M4 18h16"
                        />
                    </svg>
                    Import
                </button>
            {/snippet}
        </SearchBar>

        <div bind:this={mainContentRef} class="flex-1 flex overflow-hidden">
            <div
                class="min-w-0 overflow-y-auto bg-base-100"
                style={`width: ${leftPaneWidth}px;`}
            >
                <BookmarkTree bind:this={bookmarkTreeRef} />
            </div>

            <button
                class={`w-2 border-x border-base-300 bg-base-200 hover:bg-base-300 cursor-col-resize ${isResizingPane ? "bg-base-300" : ""}`}
                type="button"
                aria-label="Resize panes"
                title="Resize panes"
                onmousedown={startPaneResize}
            ></button>

            <div class="flex-1 overflow-y-auto bg-base-100 p-4">
                <DetailPanel />
            </div>
        </div>
    {/if}

    <!-- Global UI overlays -->
    <ToastContainer />
    <ConfirmModal />
    <KeyboardShortcutsDialog
        open={shortcutsDialogOpen}
        onClose={closeShortcutsDialog}
    />
    <ImportMergeDialog
        open={importMergeOpen}
        importPath={importMergePath}
        preview={importMergePreview}
        previewLoading={importMergePreviewLoading}
        applyLoading={importMergeApplyLoading}
        error={importMergeError}
        onCancel={closeImportMergeDialog}
        onApply={applyImportMerge}
        onPickAnother={pickAnotherImportFile}
    />
</div>
