// @ts-check

import { cleanupCollector, effect, list } from "../../shared/runtime/naf.js";

/**
 * @typedef {{ title: string, subtitle: string }} ImportMergePreviewRow
 * @typedef {{ title: string, count: number, rows: ImportMergePreviewRow[] }} ImportMergePreviewSection
 */

/** @type {string} */
const SECTION_ROW_HTML = /*html*/ `
  <section class="import-merge-dialog__section">
    <div class="import-merge-dialog__section-header">
      <h3 class="import-merge-dialog__section-title" data-ref="title"></h3>
      <span class="badge" data-ref="badge"></span>
    </div>
    <p class="import-merge-dialog__empty" hidden data-ref="empty">None</p>
    <div class="import-merge-dialog__rows" data-ref="rows"></div>
  </section>
`;

/** @type {string} */
const PREVIEW_ROW_HTML = /*html*/ `
  <div class="import-merge-dialog__row">
    <div class="import-merge-dialog__row-title" data-ref="title"></div>
    <div class="import-merge-dialog__row-subtitle" data-ref="subtitle"></div>
  </div>
`;

/**
 * @param {MergePreview} preview
 * @returns {ImportMergePreviewSection[]}
 */
export function buildImportMergePreviewSections(preview) {
  return [
    {
      title: "Folders to add",
      count: preview.foldersToAdd.length,
      rows: preview.foldersToAdd.map((item) => ({
        title: item.path,
        subtitle: item.name,
      })),
    },
    {
      title: "Bookmarks to add",
      count: preview.bookmarksToAdd.length,
      rows: preview.bookmarksToAdd.map((item) => ({
        title: item.title || item.url,
        subtitle: [item.folderPath || "Root", item.url].join("  •  "),
      })),
    },
    {
      title: "Duplicates ignored",
      count: preview.duplicateBookmarks.length,
      rows: preview.duplicateBookmarks.map((item) => ({
        title: item.title || item.url,
        subtitle: [item.folderPath || "Root", item.url].join("  •  "),
      })),
    },
    {
      title: "Potential updates",
      count: preview.potentialUpdates.length,
      rows: preview.potentialUpdates.map((item) => ({
        title: `${item.existingTitle || item.url} -> ${item.incomingTitle || item.url}`,
        subtitle: [item.folderPath || "Root", item.url].join("  •  "),
      })),
    },
  ];
}

/**
 * @param {HTMLElement} body
 * @param {MergePreview | null} preview
 * @param {boolean} previewLoading
 * @returns {() => void}
 */
export function mountImportMergePreview(body, preview, previewLoading) {
  if (previewLoading) {
    const loadingCard = document.createElement("div");
    loadingCard.className = "import-merge-dialog__loading";

    const spinner = document.createElement("span");
    spinner.className = "spinner";

    const loadingText = document.createElement("span");
    loadingText.className = "import-merge-dialog__loading-text";
    loadingText.textContent = "Computing merge preview...";

    loadingCard.append(spinner, loadingText);
    body.append(loadingCard);
    return () => {};
  }

  if (!preview) {
    return () => {};
  }

  const stats = document.createElement("div");
  stats.className = "import-merge-dialog__stats";

  for (const [label, value, desc] of [
    ["Folders", preview.foldersToAdd.length, "to add"],
    ["Bookmarks", preview.bookmarksToAdd.length, "to add"],
    ["Duplicates", preview.duplicateBookmarks.length, "ignored"],
    ["Potential updates", preview.potentialUpdates.length, "not applied"],
  ]) {
    const stat = document.createElement("div");
    stat.className = "import-merge-dialog__stat";

    const statLabel = document.createElement("div");
    statLabel.className = "import-merge-dialog__stat-label";
    statLabel.textContent = String(label);

    const statValue = document.createElement("div");
    statValue.className = "import-merge-dialog__stat-value";
    statValue.textContent = String(value);

    const statDesc = document.createElement("div");
    statDesc.className = "import-merge-dialog__stat-desc";
    statDesc.textContent = String(desc);

    stat.append(statLabel, statValue, statDesc);
    stats.append(stat);
  }

  const sectionList = document.createElement("div");
  sectionList.className = "import-merge-dialog__sections";

  body.append(stats, sectionList);

  return list(
    sectionList,
    SECTION_ROW_HTML,
    () => buildImportMergePreviewSections(preview),
    (section) => section.title,
    (el, section) => {
      if (!(el instanceof HTMLElement)) {
        throw new Error("Import merge section template must render an element");
      }

      const titleEl = el.querySelector('[data-ref="title"]');
      const badgeEl = el.querySelector('[data-ref="badge"]');
      const emptyEl = el.querySelector('[data-ref="empty"]');
      const rowsEl = el.querySelector('[data-ref="rows"]');
      if (!(rowsEl instanceof HTMLElement)) {
        throw new Error(
          "Import merge section template must include a rows container",
        );
      }

      const cleanup = cleanupCollector(
        effect(() => {
          const currentSection = section();
          if (titleEl instanceof HTMLElement) {
            titleEl.textContent = currentSection.title;
          }
          if (badgeEl instanceof HTMLElement) {
            badgeEl.textContent = String(currentSection.count);
          }
          if (emptyEl instanceof HTMLElement) {
            emptyEl.hidden = currentSection.rows.length > 0;
          }
          rowsEl.hidden = currentSection.rows.length === 0;
        }),
        list(
          rowsEl,
          PREVIEW_ROW_HTML,
          () => section().rows,
          (row) => `${row.title}::${row.subtitle}`,
          (rowEl, row) => {
            if (!(rowEl instanceof HTMLElement)) {
              throw new Error(
                "Import merge row template must render an element",
              );
            }

            const rowTitle = rowEl.querySelector('[data-ref="title"]');
            const rowSubtitle = rowEl.querySelector('[data-ref="subtitle"]');
            return effect(() => {
              const currentRow = row();
              if (rowTitle instanceof HTMLElement) {
                rowTitle.textContent = currentRow.title;
              }
              if (rowSubtitle instanceof HTMLElement) {
                rowSubtitle.textContent = currentRow.subtitle;
              }
            });
          },
        ),
      );

      return () => {
        cleanup.run();
      };
    },
  );
}
