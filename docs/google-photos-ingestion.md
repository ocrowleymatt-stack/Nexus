# Google Photos / Takeout Screenshot Metadata Ingestion

## Why this matters

Google Photos and Google Takeout may already hold the context needed to make thousands of screenshots meaningful again.

For screenshots, the useful intelligence is not just the image. It may include:

- creation timestamp;
- Google Photos `photoTakenTime`;
- upload time;
- device metadata;
- filename sequencing;
- album membership;
- location metadata where present;
- Google Photos description/title fields;
- Takeout JSON sidecar metadata;
- app/platform visible in the screenshot;
- clustering by date/time around known incidents.

## Best source

Use Google Takeout export of Google Photos where possible.

Each media file may have a JSON sidecar containing metadata similar to:

```json
{
  "title": "Screenshot_2025-05-12-14-22-01.png",
  "creationTime": { "timestamp": "1747056121" },
  "photoTakenTime": { "timestamp": "1747056121" },
  "geoData": {},
  "url": "..."
}
```

## Nexus import rule

For every screenshot:

```text
image file + sidecar JSON + OCR/vision output = one screenshot source record
```

Do not separate the image from its sidecar metadata.

## Pipeline

```text
Google Takeout ZIP
→ extract media files
→ match image to .json sidecar
→ read timestamps and metadata
→ hash image
→ OCR / vision summarise
→ entity extraction
→ classify screenshot type
→ create Nexus source node
→ link to entities, claims, events and dates
```

## Screenshot source schema

```ts
type GooglePhotosScreenshotSource = {
  source_id: string
  source_type: 'screenshot'
  filename: string
  google_title?: string
  takeout_json_path?: string
  image_path?: string
  creation_time?: string
  photo_taken_time?: string
  upload_time?: string
  device_hint?: string
  album_refs: string[]
  geo_present: boolean
  hash: string
  ocr_text?: string
  vision_summary?: string
  entities_extracted: string[]
  claims_extracted: string[]
  event_refs: string[]
  review_status: 'unchecked' | 'needs_human_context' | 'checked' | 'locked'
  why_it_might_matter?: string
}
```

## Metadata priority

Prefer timestamps in this order:

1. Google Photos `photoTakenTime` from sidecar JSON.
2. Google Photos `creationTime` from sidecar JSON.
3. EXIF / PNG metadata where available.
4. Filesystem created/modified time.
5. Timestamp parsed from filename.
6. Visible timestamp in OCR text.
7. Human review.

## Clustering rules

Screenshots should be clustered by:

- same day;
- same hour;
- same visible app/platform;
- same extracted person/entity;
- same phone number/email/reference;
- visual similarity;
- filename sequence;
- same album;
- proximity to known Nexus events.

## Relevance scoring

Raise priority if metadata or OCR contains:

- known entity already in graph;
- known phone number;
- known reference number;
- police/court/complaint terms;
- threat/risk terms;
- message status markers like read, delivered, missed call, blocked, deleted, edited;
- dates matching known events;
- screenshots captured in bursts around a key event.

## Google Photos API note

Google Photos API access is useful for library browsing where permitted, but Google Takeout is normally better for bulk forensic-style ingestion because it preserves sidecar JSON and avoids rate/permission friction.

## Implementation phases

### Phase 1

Support Google Takeout ZIP upload and sidecar JSON parsing.

### Phase 2

OCR / vision extraction per screenshot.

### Phase 3

Cluster screenshots by date, entity, app/platform and file sequence.

### Phase 4

Generate human review queue sorted by relevance score.

### Phase 5

Promote reviewed screenshots into claims, events, entities and graph links.

## Rule

Google Photos metadata can suggest context. It should not be treated as final meaning without source review where the screenshot content is ambiguous.
