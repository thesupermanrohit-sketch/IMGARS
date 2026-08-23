# IMGARS Codebase Recommendations

Review date: 2026-08-23

Verification run:

- `npm.cmd run build` passes.
- `npm.cmd test` passes: 3 test files, 12 tests.
- `npm.cmd run lint` passes.

Note: `src/features/convert/formatSupport.ts` had pre-existing uncommitted changes during this review and was not edited.

## Ranked Recommendations

| Rank | Priority | Recommendation | Why it is needed | How it helps |
| --- | --- | --- | --- | --- |
| 1 | High | Fix visible text encoding regressions in the UI. | `src/components/QueueList.tsx` contains mojibake where bullets, dashes, arrows, and minus signs were intended. Users will see broken text in tooltips and result summaries. | Restores a polished interface, avoids confusion in compression/convert size summaries, and makes the app look production-ready. |
| 2 | High | Add lifecycle cleanup for object URLs and stored blobs. | Preview URLs are revoked when items are removed or cleared, but there is no app-level cleanup on unmount/navigation/session end. IndexedDB blobs can also remain if the tab is closed or the app reloads before `clearQueue` runs. Relevant files: `src/store/slices/createQueueSlice.ts`, `src/store/slices/createImagePdfSlice.ts`, `src/db/db.ts`. | Reduces memory leaks, prevents stale browser storage growth, and makes large-batch image work safer for users. |
| 3 | High | Add integration tests for upload, process, download, and PDF flows. | Current tests focus on store defaults and format support, but do not cover the core browser workflows: drag/drop, IndexedDB persistence, worker fallback, compression, conversion, PDF generation, and download naming. Relevant files: `src/store/useForgeStore.test.ts`, `src/components/DropZone.tsx`, `src/components/QueueList.tsx`, `src/features/imagePdf/ImagePdfPanel.tsx`. | Catches regressions in the highest-value user paths before release and gives confidence when changing workers or store behavior. |
| 4 | High | Improve worker lifecycle management and cancellation. | `convertWorkerClient.ts` caches a worker without an exposed shutdown path, and `ImagePdfPanel.tsx` terminates the PDF worker only after generation finishes. There is no user-facing cancel action for long PDF/compression/conversion jobs. | Prevents long-running work from feeling stuck, frees browser resources more predictably, and improves reliability on large images or weaker devices. |
| 5 | Medium | Make tab changes reconcile queue state deliberately. | `processFile` branches based on the current global `activeTab`, not the mode the file was originally added under. If a user adds files in one tab, switches tabs, then processes, queued files may be processed by the new mode. Relevant file: `src/store/slices/createQueueSlice.ts`. | Avoids surprising results and makes queue behavior easier to reason about. Options include clearing on tab switch, storing mode per queue item, or maintaining separate queues per tool. |
| 6 | Medium | Replace duplicated queue rendering logic with shared helpers/components. | `QueueList.tsx` repeats similar compress and convert layouts, including queue header, drag list, download card rendering, and size-delta formatting. | Lowers maintenance cost, reduces bug duplication, and makes future tool additions simpler. |
| 7 | Medium | Harden image format support detection and conversion fallback. | Format support is browser-dependent and partly asynchronous. The app should cache support results, expose clear unsupported states, and test fallback behavior for `OffscreenCanvas`, `HTMLCanvasElement`, AVIF, and worker failures. Relevant files: `src/features/convert/formatSupport.ts`, `src/features/convert/convertUtil.ts`, `src/features/convert/convert.worker.ts`. | Reduces "works in one browser, fails in another" risk and makes conversion behavior more predictable. |
| 8 | Medium | Add file size/count guardrails and clearer failure messages. | The app accepts arbitrary image batches and then processes several files concurrently. `BATCH_CONCURRENCY` helps, but there are no visible limits, warnings, or per-browser storage/quota handling. Relevant files: `src/store/slices/createQueueSlice.ts`, `src/components/DropZone.tsx`, `src/features/imagePdf/imagePdf.worker.ts`. | Prevents out-of-memory crashes, improves user trust, and gives users actionable feedback when files are too large or unsupported. |
| 9 | Medium | Improve accessibility semantics for interactive controls. | Several controls are custom buttons/radio groups/dropdowns. The foundation is decent, but menu keyboard navigation, radio roving focus, drag handle alternatives, and file input labeling could be stronger. Relevant files: `src/components/NavBar.tsx`, `src/components/SegmentedControl.tsx`, `src/components/SortableImageCard.tsx`, `src/components/DropZone.tsx`. | Makes the app easier to use with keyboard and assistive technology and reduces accessibility regressions. |
| 10 | Medium | Update project identity, README, and release metadata. | `README.md` is still the default Vite template and `package.json` names the package `anti` while the UI presents `IMGARS`. | Helps contributors and future maintainers understand what the app does, how to run it, what browsers are supported, and how releases are deployed. |
| 11 | Low | Remove stale or unused styling hooks and generated assets. | `src/index.css` references `#max-dimension-custom-input`, but no current component uses that id. Default Vite assets remain in `src/assets`. | Keeps the codebase tidy and reduces confusion while scanning styles/assets. |
| 12 | Low | Add CI for build, lint, and tests. | The local checks pass, but there is no visible CI configuration in the repository. | Prevents broken builds from being merged and gives a simple quality gate for future changes. |

## Suggested Order of Work

1. Fix text encoding and documentation/metadata first because they are quick, visible improvements.
2. Add app-level cleanup and queue-mode safeguards before expanding features.
3. Add integration coverage around the upload/process/download flows.
4. Refactor duplicated queue UI after the behavior is protected by tests.
5. Add cancellation, quota handling, and CI as the reliability layer.

## Quick Wins

- Replace mojibake strings in `QueueList.tsx`.
- Rename the package from `anti` to an IMGARS-related name if this is the intended product name.
- Replace the Vite template README with real setup, feature, browser support, and troubleshooting notes.
- Remove unused default Vite assets if they are not referenced.

## Larger Investments

- Introduce browser integration tests with mocked workers/IndexedDB or a real browser runner.
- Split queues by tool mode or store a `mode` on each queue item.
- Add explicit worker disposal and optional cancellation for long-running jobs.
- Add file limits, quota handling, and clearer errors for very large image batches.
