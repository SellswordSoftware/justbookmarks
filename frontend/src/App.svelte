<script lang="ts">
    import { onMount } from "svelte";
    import { treeStore } from "./lib/stores/treeStore.svelte.ts";
    import { CreateBookmarkFile, GetFilePath, OpenFilePicker } from "./lib/api";
    import { getErrorMessage } from "./lib/errors";
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
    import SearchBar from "./lib/components/SearchBar.svelte";
    import BookmarkTree from "./lib/components/BookmarkTree.svelte";
    import DetailPanel from "./lib/components/DetailPanel.svelte";
    import ToastContainer from "./lib/components/ToastContainer.svelte";
    import ConfirmModal from "./lib/components/ConfirmModal.svelte";
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
</script>

<svelte:window
    onbeforeunload={persistWindowSize}
    onfocus={syncWindowState}
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
        <SearchBar>
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
            {/snippet}
        </SearchBar>

        <div bind:this={mainContentRef} class="flex-1 flex overflow-hidden">
            <div
                class="min-w-0 overflow-y-auto bg-base-100"
                style={`width: ${leftPaneWidth}px;`}
            >
                <BookmarkTree />
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
</div>
