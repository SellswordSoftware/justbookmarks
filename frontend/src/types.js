// @ts-check

/**
 * Shared JSDoc typedef entrypoint for the vanilla JS migration.
 *
 * Conventions:
 * - Put `// @ts-check` at the top of non-trivial JS modules.
 * - Import shared typedefs with `@typedef {import("../types.js").TypeName} TypeName`.
 * - Prefer explicit `@param` and `@returns` annotations on exported functions.
 * - Keep runtime code out of this file; this is an IDE typing surface only.
 */

/**
 * @typedef {0 | 1} NodeType
 */

/**
 * @typedef {string} TimestampValue
 */

/**
 * @typedef {object} BookmarkData
 * @property {string} id
 * @property {string} title
 * @property {string} url
 * @property {string} icon
 * @property {string} iconURI
 * @property {TimestampValue} addDate
 * @property {TimestampValue} lastModified
 * @property {string} meta
 */

/**
 * @typedef {object} BookmarkCreate
 * @property {string} title
 * @property {string} url
 * @property {string=} icon
 * @property {string=} iconURI
 * @property {string=} meta
 */

/**
 * @typedef {object} BookmarkPatch
 * @property {string=} title
 * @property {string=} url
 * @property {string=} icon
 * @property {string=} iconURI
 * @property {string=} meta
 */

/**
 * @typedef {object} BookmarkNode
 * @property {1} type
 * @property {string} id
 * @property {BookmarkData} bookmark
 */

/**
 * @typedef {object} FolderData
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {TimestampValue} addDate
 * @property {TimestampValue} lastModified
 * @property {string} meta
 * @property {TreeNode[]} children
 */

/**
 * @typedef {object} FolderNode
 * @property {0} type
 * @property {string} id
 * @property {FolderData} folder
 */

/**
 * @typedef {FolderNode | BookmarkNode} TreeNode
 */

/**
 * @typedef {object} BookmarkIndexEntry
 * @property {string} nodeId
 * @property {string} title
 * @property {string} url
 * @property {string} folderPath
 */

/**
 * @typedef {object} FolderMergeItem
 * @property {string} path
 * @property {string} name
 */

/**
 * @typedef {object} BookmarkMergeItem
 * @property {string} folderPath
 * @property {string} title
 * @property {string} url
 */

/**
 * @typedef {object} BookmarkConflictItem
 * @property {string} folderPath
 * @property {string} existingTitle
 * @property {string} incomingTitle
 * @property {string} url
 * @property {string} existingMeta
 * @property {string} incomingMeta
 */

/**
 * @typedef {object} MergePreview
 * @property {FolderMergeItem[]} foldersToAdd
 * @property {BookmarkMergeItem[]} bookmarksToAdd
 * @property {BookmarkMergeItem[]} duplicateBookmarks
 * @property {BookmarkConflictItem[]} potentialUpdates
 */

/**
 * @typedef {object} MergeApplyResult
 * @property {number} foldersAdded
 * @property {number} bookmarksAdded
 * @property {number} duplicatesSkipped
 * @property {number} potentialUpdates
 */

/**
 * @typedef {object} HistoryState
 * @property {boolean} canUndo
 * @property {boolean} canRedo
 * @property {string} undoLabel
 * @property {string} redoLabel
 */

/**
 * @typedef {"info" | "success" | "error" | "warning"} ToastType
 */

/**
 * @typedef {object} Toast
 * @property {number} id
 * @property {string} message
 * @property {ToastType} type
 */

/**
 * @typedef {(() => void | Promise<void>) | null} ConfirmCallback
 */

/**
 * @typedef {object} ConfirmModalState
 * @property {boolean} open
 * @property {string} title
 * @property {string} message
 * @property {string} confirmLabel
 * @property {ConfirmCallback} onConfirm
 */

/**
 * @typedef {object} MoveTarget
 * @property {string} id
 * @property {string} name
 * @property {number} depth
 * @property {string} pathLabel
 */

/**
 * @typedef {object} MoveDialogRequest
 * @property {string[]} nodeIds
 * @property {string} label
 * @property {"bookmark" | "folder"} type
 */

/**
 * @typedef {object} VisibleTreeNodeEntry
 * @property {string} id
 * @property {TreeNode} node
 * @property {number} depth
 * @property {string} parentId
 */

/**
 * @typedef {object} PerFileTreeState
 * @property {string[]} expandedNodeIds
 * @property {string} selectedNodeId
 */

/**
 * @typedef {object} WindowState
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {object} PersistedUIState
 * @property {string} lastOpenedFile
 * @property {number} leftPaneWidth
 * @property {WindowState | null} window
 * @property {Record<string, PerFileTreeState>} files
 * @property {"light" | "dark"} theme
 */

export {};
