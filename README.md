# IMGARS — Private Client-Side Image Processor

**IMGARS** is a high-performance, 100% client-side web application for image compression, conversion, size padding, and PDF compilation. Your files never leave your browser.

---

## ⚡ Features

1. **Compress**:
   - Target maximum file size in KB (e.g. 50 KB, 100 KB, or custom).
   - Preset dimension constraints (Web 1024px, Full HD 1920px).
   - Web Worker powered canvas compression.

2. **Increase Size**:
   - Increases image file size to meet strict platform upload minimums without modifying pixel data.
   - Uses native `ArrayBuffer` & `DataView` padding (JPEG COM chunks, PNG tEXt chunks with CRC-32, WebP VP8X/EXIF RIFF chunks).
   - Repeated WebP enlargement preserves existing EXIF data and consolidates duplicate EXIF chunks from older outputs.

3. **Convert**:
   - Convert seamlessly between JPEG, PNG, WebP, and AVIF.
   - Automatic browser support detection with graceful OffscreenCanvas fallback.
   - Changing the output format invalidates old results; click Convert again to generate the new format.
   - Each conversion runs in its own worker, with main-thread fallback on errors or timeout.

4. **Image to PDF**:
   - Drag-and-drop reordering for multi-image PDF generation.
   - Page size selection (A4 or Match Image) and orientation (Portrait or Landscape).
   - Worker-based PDF generation via `pdf-lib` and `comlink`.
   - JPEG EXIF rotation and mirroring are applied before PDF embedding. Upright JPEGs retain their original encoded data.

Compress, Increase Size, and Convert each display and process their own queue. Clearing a queue affects only the current tool.

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript + Vite 8
- **State Management**: Zustand 5 (modular feature slices)
- **Local Storage**: Dexie (IndexedDB) for binary blob persistence
- **Styling**: Tailwind CSS v4 (minimalist brutalist aesthetic)
- **Drag & Drop**: `@dnd-kit/core` & `@dnd-kit/sortable`
- **Linting & Testing**: Oxlint & Vitest

---

## 🚀 Getting Started

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Run Linter
```bash
npm run lint
```

### Production Build
```bash
npm run build
```

---

## 🔒 Privacy & Security

All image processing operations (decoding, resizing, chunk insertion, PDF embedding) are performed purely in the user's browser using HTML5 Canvas, Web Workers, and WebAssembly/JavaScript. No image data is sent to external servers.

Image blobs are stored temporarily in IndexedDB. Cleanup runs at startup and every five minutes. Web Locks protect live tabs, including suspended tabs, while allowing records from closed or crashed sessions to be removed. Older records and browsers without Web Locks use the existing 30-minute session-heartbeat fallback.
