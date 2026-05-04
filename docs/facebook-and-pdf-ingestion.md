# Facebook, Messenger and PDF-mounted Evidence Ingestion

## Purpose

A large amount of relevant material may exist across Facebook, Messenger, screenshots, exported archives, downloaded HTML/JSON files and PDFs containing embedded screenshots. Nexus must treat all of these as source containers that can be decomposed into structured evidence.

The aim is to recover chronology, context, entities, relationships, message content, reactions, attachments, profile/page references and why a screenshot or PDF mattered at the time.

## Core rule

Do not treat Facebook material, screenshots and PDFs as separate evidence worlds.

```text
Facebook export / screenshot / PDF / image / message thread
→ normalised source record
→ extracted text + metadata
→ entities + events + claims + relationships
→ graph + review queue
```

## Facebook source types

```text
facebook_archive_json
facebook_archive_html
messenger_thread
facebook_post
facebook_comment_thread
facebook_profile_or_page
facebook_group_item
facebook_marketplace_item
facebook_screenshot
pdf_mounted_screenshot_bundle
pdf_conversation_export
unknown_social_media_source
```

## Best source order

1. Meta / Facebook download-your-information archive where available.
2. Original screenshots with metadata preserved.
3. PDFs containing screenshots or exported conversations.
4. Manually saved HTML pages.
5. Copy-pasted text or reconstructed notes.

## Facebook / Messenger export targets

Extract:

- sender and recipient names;
- participant IDs where present;
- timestamps;
- message text;
- reactions;
- attachments;
- photos, videos, audio and files;
- deleted or unavailable messages where recorded;
- thread names;
- group names;
- profile URLs or handles;
- post URLs;
- comment chains;
- visible edit/delete/status markers;
- location or check-in metadata where present.

## PDF-mounted evidence problem

Many screenshots may be mounted inside PDFs. Nexus must treat PDFs as containers, not just flat documents.

A PDF may contain:

- selectable text;
- embedded images;
- scanned pages;
- screenshots mounted on pages;
- captions or annotations added later;
- page order that may or may not match event order;
- exported conversation views;
- mixed evidence from different dates.

## PDF decomposition pipeline

```text
PDF
→ source record for whole PDF
→ page records
→ extract selectable text
→ render page images
→ detect embedded screenshots/images
→ OCR page/image text
→ extract visible timestamps/entities
→ link page-level findings back to parent PDF
→ create review cards for ambiguous pages
```

## Source hierarchy

```text
SRC-PDF-0001 = parent PDF
SRC-PDF-0001-P001 = page 1
SRC-PDF-0001-P001-IMG01 = embedded screenshot/image on page 1
```

This prevents losing where a screenshot came from.

## Suggested Facebook source schema

```ts
type FacebookSource = {
  source_id: string
  source_type:
    | 'facebook_archive_json'
    | 'facebook_archive_html'
    | 'messenger_thread'
    | 'facebook_post'
    | 'facebook_comment_thread'
    | 'facebook_screenshot'
    | 'pdf_mounted_screenshot_bundle'
  title: string
  parent_source_id?: string
  thread_id?: string
  participants: string[]
  timestamp?: string
  platform: 'facebook' | 'messenger' | 'meta' | 'unknown'
  raw_path?: string
  extracted_text?: string
  attachment_refs: string[]
  image_refs: string[]
  entities_extracted: string[]
  events_extracted: string[]
  claims_extracted: string[]
  relationship_edges: string[]
  review_status: 'unchecked' | 'needs_human_context' | 'checked' | 'locked'
  why_it_might_matter?: string
}
```

## Suggested PDF page schema

```ts
type PdfPageSource = {
  source_id: string
  parent_pdf_source_id: string
  page_number: number
  selectable_text?: string
  ocr_text?: string
  embedded_image_refs: string[]
  visible_dates: string[]
  visible_entities: string[]
  likely_platform?: 'facebook' | 'messenger' | 'whatsapp' | 'sms' | 'email' | 'unknown'
  review_status: 'unchecked' | 'needs_human_context' | 'checked' | 'locked'
}
```

## Extraction targets

For Facebook, Messenger and PDF-mounted evidence, extract:

- people;
- aliases and handles;
- organisations;
- phone numbers;
- email addresses;
- URLs;
- dates and times;
- message content;
- references and identifiers;
- threats, admissions, denials, contradictions and risk terms;
- reactions and read/status indicators;
- attachments and media references;
- group/thread context.

## Chronology reconstruction

Use timestamps in this order:

1. Platform export timestamp.
2. Visible timestamp in message/post/screenshot.
3. Screenshot metadata.
4. PDF metadata only as weak context.
5. Filename timestamp.
6. Human review.

PDF creation date is not usually the event date. Treat it carefully.

## Deduplication

Deduplicate by:

- exact file hash;
- perceptual image hash;
- same message text + same timestamp + same sender;
- same screenshot embedded in multiple PDFs;
- same Facebook export item appearing in screenshot and archive.

When duplicate material appears in multiple forms, preserve all source paths but identify a canonical evidence item.

## Review queue prompts

For ambiguous Facebook/PDF items ask:

```text
What platform is visible?
Who are the participants?
What event does this relate to?
Is the PDF page order chronological or assembled later?
Is this a screenshot of a message, a post, a profile, a comment thread or something else?
Does it support, contradict or contextualise any existing claim?
Should it link to an existing person, phone, date, reference or event?
```

## Priority scoring

Raise priority where an item contains:

- known entities already in the Nexus graph;
- police/court/complaint/reference terms;
- threats or safeguarding/risk terms;
- admissions or denials;
- date overlap with known events;
- repeated appearance across screenshots and PDFs;
- contradiction with another source;
- deleted/unavailable/blocked/read/edited indicators;
- media attachments likely to be primary evidence.

## Handling mounted screenshots inside PDFs

If a PDF contains screenshots, do not only store the OCR text. Store:

- parent PDF source ID;
- page number;
- extracted screenshot/image hash;
- OCR text;
- visual summary;
- visible timestamp;
- visible platform;
- linked entities;
- confidence;
- review status.

## Court-safe rule

A PDF containing a screenshot is not automatically proof of the original platform record. It is evidence that a PDF contains an image that appears to show a platform record. Where possible, link it to the original screenshot, export archive or metadata-backed source.

## Implementation phases

### Phase 1

Support PDF upload and page-level source creation.

### Phase 2

Support Facebook/Meta archive ZIP upload.

### Phase 3

Support embedded image extraction and OCR.

### Phase 4

Link duplicate screenshots across PDFs, image folders, Google Photos and iCloud exports.

### Phase 5

Generate review queue sorted by entity overlap, timestamp relevance and contradiction risk.

### Phase 6

Promote reviewed records into events, claims and relationships.
