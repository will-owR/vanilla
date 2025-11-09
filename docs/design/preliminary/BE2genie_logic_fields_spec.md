DRAFT

# BE2genie: response shape & expected fields (short spec)

Purpose: concise checklist of fields produced by `sampleService` / `aetherService` to simulate an A4 eBook (3 pages). Keep responses editable, deterministic, and easy to validate in tests.

Top-level envelope

- `ebook` (object)
  - `title` (string) — eBook title
  - `author` (string, optional)
  - `pageSize` (string) — e.g. "A4"
  - `orientation` (string, optional) — "portrait" or "landscape"
  - `manifest` (object) — metadata: `{ createdAt: ISO, version: string }
  - `pages` (array of page objects) — expected length: 3 for sample
  - `copies` (optional array) — alternate variants/layouts

Page object (per item in `pages[]`)

- `pageNumber` (integer) — 1-based
- `title` (string) — poem title
- `body` (string) — poem body; preserve line breaks
- `layoutHints` (object) — printable layout guidance:
  - `marginMm` (object) `{ top, bottom, left, right }`
  - `fontFamily` (string)
  - `fontSizePt` (number)
  - `alignment` (string) — "left", "center", "justified"
- `background` (object) — decorative background descriptor:
  - `type` (string) — "svg" | "image-placeholder" | "gradient" | "token"
  - `src` (string) — URL, data URL, or token id (e.g. "placeholder:flower-01")
  - `alt` (string) — accessible description
  - `seedPrompt` (string) — natural-language prompt for future image generation
- `assets` (optional array) — extra images/decorative elements
  - each asset: `{ id, type, src, alt, placementHint }`
- `editableFields` (array) — e.g. ["title","body"] to drive UI editing
- `versions` (optional array) — history records: `{ id, createdAt, author, note }`

Additional top-level hints

- `exportHints` (object) — guide for PDF pipeline
  - `{ includeBackground: boolean, dpi: 300, bleedMm: 3 }`
- `previewUrl` or `pdfDraftPath` (optional string) — path to a generated draft
- `language` (string) — RFC language tag
- `direction` (string) — "ltr" or "rtl"

Acceptance checklist (tests)

- Envelope contains `ebook.pages.length === 3`.
- Each page has non-empty `title` and `body` (body preserves line breaks).
- `pageSize === "A4"` and `layoutHints.marginMm` present.
- Each page has `background.seedPrompt` (non-empty) and `background.type` present.
- `editableFields` includes `title` and `body` for each page.
- If `background.src` references a placeholder token, the placeholder is resolvable by frontend or present under `public/`.

Notes / mapping to future implementation

- `background.seedPrompt` → feed to `aetherService` image generator.
- `assets[]` → generated image objects persisted by the persistence layer and referenced in final PDF export.
- `exportHints` → controls A4 PDF generation parameters (DPI, bleed, includeBackground)
- Keep shapes small and deterministic for unit tests (three short public-domain poems recommended).

End of spec (DRAFT)
