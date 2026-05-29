// @ts-check

/** @typedef {import("../../types.js").BookmarkCreate} BookmarkCreate */
/** @typedef {import("../../types.js").BookmarkPatch} BookmarkPatch */
/** @typedef {import("../../types.js").TreeNode} TreeNode */
/** @typedef {import("../../types.js").BookmarkIndexEntry} BookmarkIndexEntry */
/** @typedef {import("../../types.js").FolderMergeItem} FolderMergeItem */
/** @typedef {import("../../types.js").BookmarkMergeItem} BookmarkMergeItem */
/** @typedef {import("../../types.js").BookmarkConflictItem} BookmarkConflictItem */
/** @typedef {import("../../types.js").MergePreview} MergePreview */
/** @typedef {import("../../types.js").MergeApplyResult} MergeApplyResult */
/** @typedef {import("../../types.js").HistoryState} HistoryState */
/** @typedef {typeof import("../../../wailsjs/go/main/App")} WailsAppBindings */
/** @typedef {typeof import("../../../wailsjs/go/wailsapi/Handler")} WailsHandlerBindings */
/** @typedef {import("../../../wailsjs/go/models").wailsapi.NodeDTO} NodeDTO */

/**
 * @returns {WailsAppBindings | null}
 */
function getAppBindings() {
  return window.go?.main?.App ?? null;
}

/**
 * @returns {WailsHandlerBindings | null}
 */
function getHandlerBindings() {
  return window.go?.wailsapi?.Handler ?? window.go?.main?.Handler ?? null;
}

/**
 * @param {FolderMergeItem | null | undefined} item
 * @returns {FolderMergeItem}
 */
function normalizeFolderMergeItem(item) {
  return {
    path: item?.path ?? "",
    name: item?.name ?? "",
  };
}

/**
 * @param {BookmarkMergeItem | null | undefined} item
 * @returns {BookmarkMergeItem}
 */
function normalizeBookmarkMergeItem(item) {
  return {
    folderPath: item?.folderPath ?? "",
    title: item?.title ?? "",
    url: item?.url ?? "",
  };
}

/**
 * @param {BookmarkConflictItem | null | undefined} item
 * @returns {BookmarkConflictItem}
 */
function normalizeConflictItem(item) {
  return {
    folderPath: item?.folderPath ?? "",
    existingTitle: item?.existingTitle ?? "",
    incomingTitle: item?.incomingTitle ?? "",
    url: item?.url ?? "",
    existingMeta: item?.existingMeta ?? "",
    incomingMeta: item?.incomingMeta ?? "",
  };
}

/**
 * @param {HistoryState | null | undefined} state
 * @returns {HistoryState}
 */
function normalizeHistoryState(state) {
  return {
    canUndo: state?.canUndo ?? false,
    canRedo: state?.canRedo ?? false,
    undoLabel: state?.undoLabel ?? "",
    redoLabel: state?.redoLabel ?? "",
  };
}

/**
 * @param {NodeDTO | null | undefined} node
 * @returns {TreeNode}
 */
function normalizeTreeNode(node) {
  if (node?.type === 0 && node.folder) {
    return {
      id: node.id ?? "",
      type: 0,
      folder: {
        id: node.folder.id ?? "",
        name: node.folder.name ?? "",
        icon: node.folder.icon ?? "",
        addDate: node.folder.addDate ?? "",
        lastModified: node.folder.lastModified ?? "",
        meta: node.folder.meta ?? "",
        children: (node.folder.children ?? []).map(normalizeTreeNode),
      },
    };
  }

  return {
    id: node?.id ?? "",
    type: 1,
    bookmark: {
      id: node?.bookmark?.id ?? "",
      title: node?.bookmark?.title ?? "",
      url: node?.bookmark?.url ?? "",
      icon: node?.bookmark?.icon ?? "",
      iconURI: node?.bookmark?.iconURI ?? "",
      addDate: node?.bookmark?.addDate ?? "",
      lastModified: node?.bookmark?.lastModified ?? "",
      meta: node?.bookmark?.meta ?? "",
    },
  };
}

export async function GetFilePath() {
  const app = getAppBindings();
  return app ? app.GetFilePath() : "";
}

export async function CreateBookmarkFile() {
  const app = getAppBindings();
  if (!app) {
    throw new Error("Wails bridge not ready");
  }
  return app.CreateBookmarkFile();
}

export async function OpenFilePicker() {
  const app = getAppBindings();
  return app ? app.OpenFilePicker() : "";
}

export async function OpenImportFilePicker() {
  const app = getAppBindings();
  return app ? app.OpenImportFilePicker() : "";
}

/**
 * @param {string} path
 * @returns {Promise<void>}
 */
export async function LoadBookmarkFile(path) {
  const app = getAppBindings();
  if (!app) {
    return;
  }
  await app.LoadBookmarkFile(path);
}

/**
 * @param {string} path
 * @returns {Promise<void>}
 */
export async function LoadFile(path) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  await handler.LoadFile(path);
}

/** @returns {Promise<TreeNode[]>} */
export async function GetTree() {
  const handler = getHandlerBindings();
  return handler ? (await handler.GetTree()).map(normalizeTreeNode) : [];
}

/** @returns {Promise<BookmarkIndexEntry[]>} */
export async function GetFlatIndex() {
  const handler = getHandlerBindings();
  return handler ? handler.GetFlatIndex() : [];
}

/** @returns {Promise<TreeNode[]>} */
export async function GetAllFolders() {
  const handler = getHandlerBindings();
  return handler ? (await handler.GetAllFolders()).map(normalizeTreeNode) : [];
}

/**
 * @param {string} parentFolderId
 * @param {BookmarkCreate} bookmark
 * @returns {Promise<string>}
 */
export async function AddBookmark(parentFolderId, bookmark) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  return handler.AddBookmark(parentFolderId, {
    title: bookmark.title,
    url: bookmark.url,
    icon: bookmark.icon ?? "",
    iconURI: bookmark.iconURI ?? "",
    meta: bookmark.meta ?? "",
  });
}

/**
 * @param {string} parentFolderId
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function AddFolder(parentFolderId, name) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  return handler.AddFolder(parentFolderId, name);
}

/**
 * @param {string} id
 * @param {BookmarkPatch} patch
 * @returns {Promise<void>}
 */
export async function UpdateBookmark(id, patch) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  await handler.UpdateBookmark(id, patch);
}

/**
 * @param {string} id
 * @param {string} name
 * @returns {Promise<void>}
 */
export async function UpdateFolderName(id, name) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  await handler.UpdateFolderName(id, name);
}

/** @param {string} id */
export async function DeleteNode(id) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  await handler.DeleteNode(id);
}

/** @param {string[]} ids */
export async function DeleteNodes(ids) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  await handler.DeleteNodes(ids);
}

/**
 * @param {string} draggedId
 * @param {string} targetFolderId
 * @param {number} index
 */
export async function MoveNode(draggedId, targetFolderId, index) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  await handler.MoveNode(draggedId, targetFolderId, index);
}

/**
 * @param {string[]} nodeIds
 * @param {string} targetFolderId
 */
export async function MoveNodes(nodeIds, targetFolderId) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  await handler.MoveNodes(nodeIds, targetFolderId);
}

/** @param {string} url */
export async function FetchPageTitle(url) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  return handler.FetchPageTitle(url);
}

/** @param {string} url */
export async function FetchFavicon(url) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  return handler.FetchFavicon(url);
}

/** @param {string[]} ids */
export async function FetchFaviconsForNodes(ids) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  await handler.FetchFaviconsForNodes(ids);
}

/** @param {string[]} ids */
export async function RefreshTitlesForNodes(ids) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  await handler.RefreshTitlesForNodes(ids);
}

/** @param {string} url */
export async function OpenURL(url) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  await handler.OpenURL(url);
}

/** @returns {Promise<string>} */
export async function FilePath() {
  const handler = getHandlerBindings();
  return handler ? handler.FilePath() : "";
}

/**
 * @param {string} path
 * @returns {Promise<MergePreview>}
 */
export async function PreviewImportMerge(path) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }

  const preview = await handler.PreviewImportMerge(path);
  return {
    foldersToAdd: (preview?.foldersToAdd ?? []).map(normalizeFolderMergeItem),
    bookmarksToAdd: (preview?.bookmarksToAdd ?? []).map(normalizeBookmarkMergeItem),
    duplicateBookmarks: (preview?.duplicateBookmarks ?? []).map(normalizeBookmarkMergeItem),
    potentialUpdates: (preview?.potentialUpdates ?? []).map(normalizeConflictItem),
  };
}

/**
 * @param {string} path
 * @returns {Promise<MergeApplyResult>}
 */
export async function ApplyImportMerge(path) {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }

  const result = await handler.ApplyImportMerge(path);
  return {
    foldersAdded: result?.foldersAdded ?? 0,
    bookmarksAdded: result?.bookmarksAdded ?? 0,
    duplicatesSkipped: result?.duplicatesSkipped ?? 0,
    potentialUpdates: result?.potentialUpdates ?? 0,
  };
}

/** @returns {Promise<HistoryState>} */
export async function GetHistoryState() {
  const handler = getHandlerBindings();
  if (!handler) {
    return normalizeHistoryState(null);
  }
  return normalizeHistoryState(await handler.GetHistoryState());
}

/** @returns {Promise<HistoryState>} */
export async function Undo() {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  return normalizeHistoryState(await handler.Undo());
}

/** @returns {Promise<HistoryState>} */
export async function Redo() {
  const handler = getHandlerBindings();
  if (!handler) {
    throw new Error("Wails bridge not ready");
  }
  return normalizeHistoryState(await handler.Redo());
}
