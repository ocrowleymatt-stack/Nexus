# iCloud / Apple Photos Screenshot Ingestion

## Purpose

iCloud Photos and Apple Photos can hold crucial metadata for screenshots and images: capture time, device context, location where present, album grouping, favourites, edits and sequence. For Nexus, Apple Photos should be treated as another source archive capable of reconstructing chronology and context.

## Best practical sources

### 1. Apple Photos export from macOS

Best for preserving original files and metadata.

Recommended export modes:

- Export Unmodified Original for source preservation.
- Export IPTC as XMP where available.
- Preserve filenames where possible.

### 2. iCloud.com download

Useful, but may not preserve all local library context. Good for quick collection, weaker for forensic-style structure.

### 3. Local Photos Library package on macOS

High-value but delicate. It may contain database records and asset metadata, but should be copied before analysis. Do not work directly on the live library.

### 4. iPhone backup / device export

Useful where screenshots are not fully represented in cloud exports or where local metadata matters.

## Important metadata

Nexus should attempt to capture:

- original filename;
- capture timestamp;
- file created/modified timestamps;
- EXIF metadata;
- PNG metadata where present;
- asset UUID where available;
- album membership;
- favourites/hidden/deleted status where available;
- location metadata where present;
- device model where available;
- screenshot dimensions;
- image hash and perceptual hash;
- visual similarity clusters.

## Apple Photos source rule

```text
image file + exported metadata/XMP/EXIF + library context = one screenshot source record
```

Do not treat the exported image alone as the full source if metadata files are present.

## Suggested schema

```ts
type ApplePhotosScreenshotSource = {
  source_id: string
  source_type: 'screenshot'
  filename: string
  apple_asset_id?: string
  original_filename?: string
  image_path?: string
  xmp_path?: string
  captured_at?: string
  file_created_at?: string
  file_modified_at?: string
  exif_datetime_original?: string
  device_model?: string
  album_refs: string[]
  favourite?: boolean
  hidden?: boolean
  recently_deleted?: boolean
  geo_present: boolean
  width?: number
  height?: number
  hash: string
  perceptual_hash?: string
  ocr_text?: string
  vision_summary?: string
  platform_guess?: string
  entities_extracted: string[]
  claims_extracted: string[]
  event_refs: string[]
  review_status: 'unchecked' | 'needs_human_context' | 'checked' | 'locked'
  why_it_might_matter?: string
}
```

## Timestamp priority

Prefer timestamps in this order:

1. EXIF DateTimeOriginal or screenshot capture timestamp.
2. Apple Photos exported metadata / XMP.
3. Apple Photos library database timestamp where available.
4. File creation time.
5. File modified time.
6. Timestamp parsed from filename.
7. Visible timestamp in OCR text.
8. Human review.

## Screenshot filename signals

Apple screenshots may follow patterns like:

```text
IMG_1234.PNG
Screenshot 2025-05-12 at 14.22.01.png
Screenshot_2025-05-12-14-22-01.png
```

Filename sequence can matter. IMG_1234 followed by IMG_1235 in a tight window may indicate a live event capture burst.

## Pipeline

```text
Apple Photos export / iCloud download / copied Photos library
→ preserve originals
→ extract metadata
→ hash and deduplicate
→ OCR / vision summary
→ classify screenshot type
→ extract entities and references
→ cluster by time, album, device, app/platform and visual similarity
→ link to Nexus entities, events, claims and sources
→ send uncertain screenshots to human review
```

## Useful clusters

- same minute / same hour;
- same date as known Nexus event;
- same visible app;
- same named person;
- same phone number;
- same reference number;
- same album;
- same device;
- screenshot burst sequence;
- visual similarity.

## Review prompts

For screenshots whose meaning is not obvious:

```text
What is visible?
Which app/platform is this?
Who is shown?
What date/event might this relate to?
Why might this have been captured?
Does it support, contradict or contextualise an existing claim?
Should it be linked to an existing entity or event?
```

## Legal/evidential caution

Apple/iCloud metadata can strongly support chronology, but it should be preserved with the exported original file and not loosely rewritten. If using screenshots evidentially, preserve the original export, metadata sidecar if any, hash, and chain of handling.

## Implementation phases

### Phase 1

Support bulk upload of Apple Photos exports and ordinary image folders.

### Phase 2

Extract file/EXIF/PNG metadata and compute hashes.

### Phase 3

OCR / vision extraction.

### Phase 4

Cluster by date, filename sequence, app/platform, known entities and visual similarity.

### Phase 5

Generate high-priority human review queue.

### Phase 6

Promote reviewed items into events, claims and graph relationships.
