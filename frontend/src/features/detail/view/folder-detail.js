// @ts-check

import { DeleteNode, UpdateFolderName } from "../../../shared/api/api.js";
import { createAddBookmarkForm } from "../../editing/add-bookmark-form.js";
import { createAddFolderForm } from "../../editing/add-folder-form.js";
import { getErrorMessage } from "../../../shared/infra/errors.js";
import {
  cleanupCollector,
  fx,
  model,
  signal,
  template,
} from "../../../shared/runtime/naf.js";
import { moveDialogState } from "../../move/move-dialog-state.js";
import { treeState } from "../../tree/state/tree-state.js";
import { uiState } from "../../../shared/state/ui-state.js";

/**
 * @param {string} value
 * @returns {boolean}
 */
function hasRealDate(value) {
  return Boolean(value) && !String(value).startsWith("0001-01-01");
}

/**
 * @param {FolderNode} folder
 * @returns {Component<HTMLElement>}
 */
export function createFolderDetail(folder) {
  const editing = signal(false);
  const busy = signal(false);
  const currentName = signal(folder.folder.name);
  const nameErrorMessage = signal("");
  const addBookmark = createAddBookmarkForm({
    triggerLabel: "Add Bookmark",
    triggerClassName: "btn btn-ghost btn-sm btn-square detail-action-btn",
    formTitle: "Create bookmark inside selection",
    triggerKeyboardAction: "folder-add-bookmark",
    triggerAriaLabel: "Add bookmark",
    triggerTitle: "Add bookmark",
    triggerIconClassName: "icon-mask detail-action-icon--bookmark detail-action-icon--with-plus",
    getParentFolderId: () => folder.id,
  });
  const addFolder = createAddFolderForm({
    triggerLabel: "Add Folder",
    triggerClassName: "btn btn-ghost btn-sm btn-square detail-action-btn",
    formTitle: "Create folder inside selection",
    triggerKeyboardAction: "folder-add-folder",
    triggerAriaLabel: "Add folder",
    triggerTitle: "Add folder",
    triggerIconClassName: "icon-mask detail-action-icon--folder detail-action-icon--with-plus",
    getParentFolderId: () => folder.id,
  });
  const cleanup = cleanupCollector();

  const renderFolderDetail = /** @type {TemplateTag} */ (
    template({
      root: ".folder-detail",
      onMount(_el, _parent, ctx) {
        const title = ctx.refs.title;
        const count = ctx.refs.count;
        const created = ctx.refs.created;
        const header = ctx.refs.header;
        const editButton = ctx.refs.editButton;
        const moveButton = ctx.refs.moveButton;
        const deleteButton = ctx.refs.deleteButton;
        const editPanel = ctx.refs.editPanel;
        const nameInput = ctx.refs.nameInput;
        const nameError = ctx.refs.nameError;
        const saveButton = ctx.refs.saveButton;
        const cancelButton = ctx.refs.cancelButton;

        if (!(title instanceof HTMLElement)) {
          throw new Error("Expected folder detail title");
        }
        if (!(count instanceof HTMLElement)) {
          throw new Error("Expected folder detail count");
        }
        if (!(created instanceof HTMLElement)) {
          throw new Error("Expected folder detail created label");
        }
        if (!(header instanceof HTMLElement)) {
          throw new Error("Expected folder detail header");
        }
        if (!(editButton instanceof HTMLButtonElement)) {
          throw new Error("Expected folder detail edit button");
        }
        if (!(moveButton instanceof HTMLButtonElement)) {
          throw new Error("Expected folder detail move button");
        }
        if (!(deleteButton instanceof HTMLButtonElement)) {
          throw new Error("Expected folder detail delete button");
        }
        if (!(editPanel instanceof HTMLElement)) {
          throw new Error("Expected folder detail edit panel");
        }
        if (!(nameInput instanceof HTMLInputElement)) {
          throw new Error("Expected folder detail name input");
        }
        if (!(nameError instanceof HTMLElement)) {
          throw new Error("Expected folder detail name error");
        }
        if (!(saveButton instanceof HTMLButtonElement)) {
          throw new Error("Expected folder detail save button");
        }
        if (!(cancelButton instanceof HTMLButtonElement)) {
          throw new Error("Expected folder detail cancel button");
        }

        const nameInputEl = nameInput;
        const nameBinding = model(nameInputEl, currentName, { reactive: true });

        /**
         * @param {boolean} nextEditing
         * @returns {void}
         */
        function setEditing(nextEditing) {
          editing(nextEditing);
          nameErrorMessage("");
          if (nextEditing) {
            queueMicrotask(() => {
              nameInputEl.focus();
              nameInputEl.select();
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
            nameInputEl.focus();
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

          if (
            event.key === "Enter" ||
            ((event.ctrlKey || event.metaKey) && event.key === "Enter")
          ) {
            event.preventDefault();
            void saveName();
          }
        }

        editButton.addEventListener("click", handleEditClick);
        moveButton.addEventListener("click", showMoveDialog);
        deleteButton.addEventListener("click", showDeleteConfirm);
        saveButton.addEventListener("click", handleSaveClick);
        cancelButton.addEventListener("click", handleCancelClick);
        nameInputEl.addEventListener("keydown", handleNameKeydown);

        cleanup.add(
          nameBinding.cleanup,
          fx(title, (currentTitleEl) => {
            currentTitleEl.textContent = currentName() || "Untitled folder";
          }),
          fx(count, (currentCountEl) => {
            currentCountEl.textContent =
              `${folder.folder.children.length} item${folder.folder.children.length === 1 ? "" : "s"}`;
          }),
          fx(created, (currentCreatedEl) => {
            const hasDate = hasRealDate(folder.folder.addDate);
            currentCreatedEl.hidden = !hasDate;
            currentCreatedEl.textContent = hasDate
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
          () => editButton.removeEventListener("click", handleEditClick),
          () => moveButton.removeEventListener("click", showMoveDialog),
          () => deleteButton.removeEventListener("click", showDeleteConfirm),
          () => saveButton.removeEventListener("click", handleSaveClick),
          () => cancelButton.removeEventListener("click", handleCancelClick),
          () => nameInputEl.removeEventListener("keydown", handleNameKeydown),
        );
      },
      onUnmount() {
        cleanup.run();
      },
    })
  );

  return renderFolderDetail/*html*/`
    <div class="folder-detail">
      <div class="folder-detail__header" data-ref="header">
        <div class="folder-detail__top-row">
          <div class="folder-detail__title-block">
            <h3 class="folder-detail__title" data-ref="title"></h3>
            <p class="folder-detail__meta" data-ref="count"></p>
            <p class="folder-detail__meta" data-ref="created"></p>
          </div>
          <div class="detail-inline-actions">
            ${addBookmark}
            ${addFolder}
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square detail-action-btn detail-action-btn--main"
              data-keyboard-action="folder-edit"
              data-ref="editButton"
              aria-label="Edit folder"
              title="Edit folder"
            >
              <span class="icon-mask detail-action-icon--edit" aria-hidden="true"></span>
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square detail-action-btn detail-action-btn--main"
              data-keyboard-action="folder-move"
              data-ref="moveButton"
              aria-label="Move folder"
              title="Move folder"
            >
              <span class="icon-mask detail-action-icon--move" aria-hidden="true"></span>
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square detail-action-btn detail-action-btn--main detail-action-btn--danger"
              data-keyboard-action="folder-delete"
              data-ref="deleteButton"
              aria-label="Delete folder"
              title="Delete folder"
            >
              <span class="icon-mask detail-action-icon--delete" aria-hidden="true"></span>
            </button>
          </div>
        </div>
      </div>

      <div class="folder-detail__edit" hidden data-ref="editPanel">
        <div class="field">
          <label class="label" for="folder-detail-name-${folder.id}">Folder name</label>
          <input
            id="folder-detail-name-${folder.id}"
            type="text"
            class="input"
            data-keyboard-action="folder-name"
            data-ref="nameInput"
          />
          <p class="error-text" hidden data-ref="nameError"></p>
        </div>
        <div class="detail-inline-actions">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            data-keyboard-action="folder-save"
            data-ref="saveButton"
          >
            Save
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            data-keyboard-action="folder-cancel"
            data-ref="cancelButton"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;
}
