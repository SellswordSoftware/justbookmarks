// @ts-check

import { saving } from "../state/save-state.js";
import {
  CreateBookmarkFile as WailsCreateBookmarkFile,
  GetFilePath as WailsGetFilePath,
  LoadBookmarkFile as WailsLoadBookmarkFile,
  OpenFilePicker as WailsOpenFilePicker,
  OpenImportFilePicker as WailsOpenImportFilePicker,
} from "../../../bindings/github.com/SellswordSoftware/justbookmarks/app.js";
import {
  AddBookmark as WailsAddBookmark,
  AddFolder as WailsAddFolder,
  ApplyImportMerge as WailsApplyImportMerge,
  DeleteNode as WailsDeleteNode,
  DeleteNodes as WailsDeleteNodes,
  FetchFavicon as WailsFetchFavicon,
  FetchFaviconsForNodes as WailsFetchFaviconsForNodes,
  FetchPageTitle as WailsFetchPageTitle,
  FilePath as WailsFilePath,
  GetAllFolders as WailsGetAllFolders,
  GetFlatIndex as WailsGetFlatIndex,
  GetFlatTree as WailsGetFlatTree,
  GetFolderChildren as WailsGetFolderChildren,
  GetHistoryState as WailsGetHistoryState,
  GetRootNodes as WailsGetRootNodes,
  GetTreeStats as WailsGetTreeStats,
  LoadFile as WailsLoadFile,
  MoveNode as WailsMoveNode,
  MoveNodes as WailsMoveNodes,
  OpenURL as WailsOpenURL,
  PreviewImportMerge as WailsPreviewImportMerge,
  Redo as WailsRedo,
  Undo as WailsUndo,
  UpdateBookmark as WailsUpdateBookmark,
  UpdateFolderName as WailsUpdateFolderName,
} from "../../../bindings/github.com/SellswordSoftware/justbookmarks/internal/wailsapi/handler.js";

/** @typedef {import("../../../bindings/github.com/SellswordSoftware/justbookmarks/internal/wailsapi/models.js").NodeDTO} NodeDTO */

/**
 * Wrap a mutation promise with save state tracking.
 * Sets saving=true before the call and saving=false when it settles.
 *
 * @template T
 * @param {Promise<T>} promise
 * @returns {Promise<T>}
 */
function wrapMutation(promise) {
  saving(true);
  return promise.finally(() => {
    saving(false);
  });
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
        childCount: Array.isArray(node.folder.children) ? node.folder.children.length : 0,
        childrenLoaded: true,
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
  return WailsGetFilePath();
}

export async function CreateBookmarkFile() {
  return wrapMutation(WailsCreateBookmarkFile());
}

export async function OpenFilePicker() {
  return WailsOpenFilePicker();
}

export async function OpenImportFilePicker() {
  return WailsOpenImportFilePicker();
}

/**
 * @param {string} path
 * @returns {Promise<void>}
 */
export async function LoadBookmarkFile(path) {
  await WailsLoadBookmarkFile(path);
}

/**
 * @param {string} path
 * @returns {Promise<void>}
 */
export async function LoadFile(path) {
  await WailsLoadFile(path);
}

/** @returns {Promise<FlatNode[]>} */
export async function GetFlatTree() {
  return /** @type {FlatNode[]} */ (/** @type {unknown} */ (await WailsGetFlatTree()));
}

/** @returns {Promise<FlatNode[]>} */
export async function GetRootNodes() {
  return /** @type {FlatNode[]} */ (/** @type {unknown} */ (await WailsGetRootNodes()));
}

/**
 * @param {string} folderId
 * @returns {Promise<FlatNode[]>}
 */
export async function GetFolderChildren(folderId) {
  return /** @type {FlatNode[]} */ (/** @type {unknown} */ (await WailsGetFolderChildren(folderId)));
}

/** @returns {Promise<BookmarkIndexEntry[]>} */
export async function GetFlatIndex() {
  return WailsGetFlatIndex();
}

/** @returns {Promise<TreeNode[]>} */
export async function GetAllFolders() {
  return (await WailsGetAllFolders()).map(normalizeTreeNode);
}

/** @returns {Promise<TreeStats>} */
export async function GetTreeStats() {
  return /** @type {TreeStats} */ (/** @type {unknown} */ (await WailsGetTreeStats()));
}

/**
 * @param {string} parentFolderId
 * @param {BookmarkCreate} bookmark
 * @returns {Promise<FlatNode>}
 */
export async function AddBookmark(parentFolderId, bookmark) {
  return /** @type {FlatNode} */ (/** @type {unknown} */ (
    await wrapMutation(WailsAddBookmark(parentFolderId, {
      title: bookmark.title,
      url: bookmark.url,
      icon: bookmark.icon ?? "",
      iconURI: bookmark.iconURI ?? "",
      meta: bookmark.meta ?? "",
    }))
  ));
}

/**
 * @param {string} parentFolderId
 * @param {string} name
 * @returns {Promise<FlatNode>}
 */
export async function AddFolder(parentFolderId, name) {
  return /** @type {FlatNode} */ (/** @type {unknown} */ (
    await wrapMutation(WailsAddFolder(parentFolderId, name))
  ));
}

/**
 * @param {string} id
 * @param {BookmarkPatch} patch
 * @returns {Promise<void>}
 */
export async function UpdateBookmark(id, patch) {
  await wrapMutation(WailsUpdateBookmark(id, /** @type {any} */ (patch)));
}

/**
 * @param {string} id
 * @param {string} name
 * @returns {Promise<void>}
 */
export async function UpdateFolderName(id, name) {
  await wrapMutation(WailsUpdateFolderName(id, name));
}

/** @param {string} id */
export async function DeleteNode(id) {
  await wrapMutation(WailsDeleteNode(id));
}

/** @param {string[]} ids */
export async function DeleteNodes(ids) {
  await wrapMutation(WailsDeleteNodes(ids));
}

/**
 * @param {string} draggedId
 * @param {string} targetFolderId
 * @param {number} index
 * @returns {Promise<MoveResult>}
 */
export async function MoveNode(draggedId, targetFolderId, index) {
  return /** @type {MoveResult} */ (/** @type {unknown} */ (
    await wrapMutation(WailsMoveNode(draggedId, targetFolderId, index))
  ));
}

/**
 * @param {string[]} nodeIds
 * @param {string} targetFolderId
 * @returns {Promise<MoveResult>}
 */
export async function MoveNodes(nodeIds, targetFolderId) {
  return /** @type {MoveResult} */ (/** @type {unknown} */ (
    await wrapMutation(WailsMoveNodes(nodeIds, targetFolderId))
  ));
}

/** @param {string} url */
export async function FetchPageTitle(url) {
  return wrapMutation(WailsFetchPageTitle(url));
}

/** @param {string} url */
export async function FetchFavicon(url) {
  return wrapMutation(WailsFetchFavicon(url));
}

/**
 * @param {string[]} ids
 * @returns {Promise<FlatNode[]>}
 */
export async function FetchFaviconsForNodes(ids) {
  return /** @type {FlatNode[]} */ (/** @type {unknown} */ (await wrapMutation(WailsFetchFaviconsForNodes(ids))));
}

/** @param {string} url */
export async function OpenURL(url) {
  await WailsOpenURL(url);
}

/** @returns {Promise<string>} */
export async function FilePath() {
  return WailsFilePath();
}

/**
 * @param {string} path
 * @returns {Promise<MergePreview>}
 */
export async function PreviewImportMerge(path) {
  const preview = await WailsPreviewImportMerge(path);
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
  const result = await wrapMutation(WailsApplyImportMerge(path));
  return {
    foldersAdded: result?.foldersAdded ?? 0,
    bookmarksAdded: result?.bookmarksAdded ?? 0,
    duplicatesSkipped: result?.duplicatesSkipped ?? 0,
    potentialUpdates: result?.potentialUpdates ?? 0,
  };
}

/** @returns {Promise<HistoryState>} */
export async function GetHistoryState() {
  return normalizeHistoryState(await WailsGetHistoryState());
}

/** @returns {Promise<HistoryState>} */
export async function Undo() {
  return normalizeHistoryState(await wrapMutation(WailsUndo()));
}

/** @returns {Promise<HistoryState>} */
export async function Redo() {
  return normalizeHistoryState(await wrapMutation(WailsRedo()));
}
