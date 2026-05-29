// @ts-check

import { DeleteNode, UpdateFolderName } from "../../../shared/api/api.js";
import { createAddBookmarkForm } from "../../editing/add-bookmark-form.js";
import { createAddFolderForm } from "../../editing/add-folder-form.js";
import { getErrorMessage } from "../../../shared/infra/errors.js";
import { cleanupCollector, fx, model, signal } from "../../../shared/runtime/naf.js";
import { moveDialogState } from "../../move/move-dialog-state.js";
import { treeState } from "../../tree/state/tree-state.js";
import { uiState } from "../../../shared/state/ui-state.js";

/**
 * @typedef {import("../../../types.js").FolderNode} FolderNode
 */

/**
 * @param {string} value
 * @returns {boolean}
 */
function hasRealDate(value) {
  return Boolean(value) && !String(value).startsWith("0001-01-01");
}

/**
 * @param {FolderNode} folder
 * @returns {{ element: HTMLElement, cleanup: () => void }}
 */
export function createFolderDetail(folder) {
  const wrapper = document.createElement("div");
  wrapper.className = "folder-detail";

  const header = document.createElement("div");
  header.className = "folder-detail__header";

  const titleBlock = document.createElement("div");
  titleBlock.className = "folder-detail__title-block";

  const title = document.createElement("h3");
  title.className = "folder-detail__title";

  const count = document.createElement("p");
  count.className = "folder-detail__meta";

  const created = document.createElement("p");
  created.className = "folder-detail__meta";

  const actions = document.createElement("div");
  actions.className = "detail-inline-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "btn btn-ghost btn-sm";
  editButton.textContent = "Edit";
  editButton.setAttribute("data-keyboard-action", "folder-edit");

  const addBookmark = createAddBookmarkForm({
    triggerLabel: "Add Bookmark",
    triggerClassName: "btn btn-ghost btn-sm",
    formTitle: "Create bookmark inside selection",
    triggerKeyboardAction: "folder-add-bookmark",
    getParentFolderId: () => folder.id,
  });

  const moveButton = document.createElement("button");
  moveButton.type = "button";
  moveButton.className = "btn btn-ghost btn-sm";
  moveButton.textContent = "Move...";
  moveButton.setAttribute("data-keyboard-action", "folder-move");

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "btn btn-danger btn-sm";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("data-keyboard-action", "folder-delete");

  const editPanel = document.createElement("div");
  editPanel.className = "folder-detail__edit";
  editPanel.hidden = true;

  const nameField = document.createElement("div");
  nameField.className = "field";

  const nameLabel = document.createElement("label");
  nameLabel.className = "label";
  nameLabel.textContent = "Folder name";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "input";
  nameInput.setAttribute("data-keyboard-action", "folder-name");

  const nameError = document.createElement("p");
  nameError.className = "error-text";
  nameError.hidden = true;

  const editActions = document.createElement("div");
  editActions.className = "detail-inline-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "btn btn-primary btn-sm";
  saveButton.textContent = "Save";
  saveButton.setAttribute("data-keyboard-action", "folder-save");

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "btn btn-ghost btn-sm";
  cancelButton.textContent = "Cancel";
  cancelButton.setAttribute("data-keyboard-action", "folder-cancel");

  const addFolder = createAddFolderForm({
    triggerLabel: "Add Folder",
    triggerClassName: "btn btn-secondary btn-sm",
    formTitle: "Create folder inside selection",
    triggerKeyboardAction: "folder-add-folder",
    getParentFolderId: () => folder.id,
  });

  titleBlock.append(title, count, created);
  actions.append(editButton, moveButton, addBookmark.element, addFolder.element, deleteButton);
  header.append(titleBlock, actions);

  nameField.append(nameLabel, nameInput, nameError);
  editActions.append(saveButton, cancelButton);
  editPanel.append(nameField, editActions);

  wrapper.append(header, editPanel);

  const editing = signal(false);
  const busy = signal(false);
  const currentName = signal(folder.folder.name);
  const nameErrorMessage = signal("");
  const nameBinding = model(nameInput, currentName, { reactive: true });
  const cleanup = cleanupCollector(
    addBookmark.cleanup,
    addFolder.cleanup,
    nameBinding.cleanup,
  );

  /**
   * @param {boolean} nextEditing
   * @returns {void}
   */
  function setEditing(nextEditing) {
    editing(nextEditing);
    nameErrorMessage("");
    if (nextEditing) {
      queueMicrotask(() => {
        nameInput.focus();
        nameInput.select();
      });
    }
  }

  async function saveName() {
    if (busy()) {
      return;
    }

    const nextName = currentName().trim();
    if (!nextName) {
      nameErrorMessage("Folder name is required");
      nameInput.focus();
      return;
    }

    if (nextName === folder.folder.name) {
      setEditing(false);
      return;
    }

    nameErrorMessage("");
    busy(true);

    try {
      await UpdateFolderName(folder.id, nextName);
      currentName(nextName);
      await treeState.actions.refresh();
      treeState.actions.selectSingle(folder.id);
      uiState.actions.showToast("Folder renamed", "success");
      setEditing(false);
    } catch (caughtError) {
      nameErrorMessage(getErrorMessage(caughtError, "Failed to rename folder"));
    } finally {
      busy(false);
    }
  }

  function showDeleteConfirm() {
    uiState.actions.showConfirm(
      "Delete Folder",
      `Delete "${currentName()}" and all of its contents?`,
      "Delete",
      async () => {
        try {
          await DeleteNode(folder.id);
          treeState.actions.clearSelection();
          await treeState.actions.refresh();
          uiState.actions.showToast("Folder deleted", "success");
        } catch (caughtError) {
          uiState.actions.showToast(
            getErrorMessage(caughtError, "Failed to delete folder"),
            "error",
          );
        }
      },
    );
  }

  function showMoveDialog() {
    moveDialogState.actions.showMoveDialog(
      folder.id,
      currentName() || "Untitled folder",
      "folder",
      treeState.selectors.getTree(),
    );
  }

  function handleEditClick() {
    setEditing(true);
  }

  function handleSaveClick() {
    void saveName();
  }

  function handleCancelClick() {
    currentName(folder.folder.name);
    setEditing(false);
  }

  /** @param {KeyboardEvent} event */
  function handleNameKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
      return;
    }

    if (event.key === "Enter" || ((event.ctrlKey || event.metaKey) && event.key === "Enter")) {
      event.preventDefault();
      void saveName();
    }
  }

  editButton.addEventListener("click", handleEditClick);
  moveButton.addEventListener("click", showMoveDialog);
  deleteButton.addEventListener("click", showDeleteConfirm);
  saveButton.addEventListener("click", handleSaveClick);
  cancelButton.addEventListener("click", handleCancelClick);
  nameInput.addEventListener("keydown", handleNameKeydown);
  cleanup.add(
    fx(title, (currentTitle) => {
      currentTitle.textContent = currentName() || "Untitled folder";
    }),
    fx(count, (currentCount) => {
      currentCount.textContent =
        `${folder.folder.children.length} item${folder.folder.children.length === 1 ? "" : "s"}`;
    }),
    fx(created, (currentCreated) => {
      const hasDate = hasRealDate(folder.folder.addDate);
      currentCreated.hidden = !hasDate;
      currentCreated.textContent = hasDate
        ? `Created: ${new Date(folder.folder.addDate).toLocaleDateString()}`
        : "";
    }),
    fx(header, (currentHeader) => {
      currentHeader.hidden = editing();
    }),
    fx(editPanel, (currentEditPanel) => {
      currentEditPanel.hidden = !editing();
    }),
    fx(saveButton, (currentSaveButton) => {
      currentSaveButton.disabled = busy();
    }),
    fx(nameError, (currentNameError) => {
      const message = nameErrorMessage();
      currentNameError.hidden = message.length === 0;
      currentNameError.textContent = message;
    }),
  );

  return {
    element: wrapper,
    cleanup() {
      cleanup.run();
      editButton.removeEventListener("click", handleEditClick);
      moveButton.removeEventListener("click", showMoveDialog);
      nameInput.removeEventListener("keydown", handleNameKeydown);
      deleteButton.removeEventListener("click", showDeleteConfirm);
      saveButton.removeEventListener("click", handleSaveClick);
      cancelButton.removeEventListener("click", handleCancelClick);
    },
  };
}
