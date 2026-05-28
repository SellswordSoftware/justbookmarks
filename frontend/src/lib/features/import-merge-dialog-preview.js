// @ts-check

import { cleanupCollector, effect, list } from "../../shared/runtime/naf-html.js";

/**
 * @typedef {{ title: string, subtitle: string }} ImportMergePreviewRow
 * @typedef {{ title: string, count: number, rows: ImportMergePreviewRow[] }} ImportMergePreviewSection
 */

/**
 * @param {import("../../types.js").MergePreview} preview
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
 * @param {import("../../types.js").MergePreview | null} preview
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

  const sectionTemplate = document.createElement("template");
  sectionTemplate.innerHTML = `
    <section class="import-merge-dialog__section">
      <div class="import-merge-dialog__section-header">
        <h3 class="import-merge-dialog__section-title"></h3>
        <span class="badge"></span>
      </div>
      <p class="import-merge-dialog__empty" hidden>None</p>
      <div class="import-merge-dialog__rows"></div>
    </section>
  `;

  const rowTemplate = document.createElement("template");
  rowTemplate.innerHTML = `
    <div class="import-merge-dialog__row">
      <div class="import-merge-dialog__row-title"></div>
      <div class="import-merge-dialog__row-subtitle"></div>
    </div>
  `;

  return list(
    sectionList,
    sectionTemplate,
    () => buildImportMergePreviewSections(preview),
    (section) => section.title,
    (el, section) => {
      if (!(el instanceof HTMLElement)) {
        throw new Error("Import merge section template must render an element");
      }

      const titleEl = el.querySelector(".import-merge-dialog__section-title");
      const badgeEl = el.querySelector(".badge");
      const emptyEl = el.querySelector(".import-merge-dialog__empty");
      const rowsEl = el.querySelector(".import-merge-dialog__rows");
      if (!(rowsEl instanceof HTMLElement)) {
        throw new Error("Import merge section template must include a rows container");
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
          rowTemplate,
          () => section().rows,
          (row) => `${row.title}::${row.subtitle}`,
          (rowEl, row) => {
            if (!(rowEl instanceof HTMLElement)) {
              throw new Error("Import merge row template must render an element");
            }

            const rowTitle = rowEl.querySelector(".import-merge-dialog__row-title");
            const rowSubtitle = rowEl.querySelector(".import-merge-dialog__row-subtitle");
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
