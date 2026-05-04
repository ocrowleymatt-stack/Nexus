# Nexus Screenshot Ingestion Pipeline

## Purpose

Matt has thousands of screenshots that were captured because they mattered at the time, but their meaning may now be unclear. Nexus must treat screenshots as first-class source material, not as loose image clutter.

The goal is not merely OCR. The goal is to recover context, meaning, entities, chronology and evidential relevance.

## Core principle

A screenshot is a source record.

It may contain:

- visible text;
- app or platform context;
- timestamps;
- names, numbers, handles, locations and references;
- UI state;
- message ordering;
- emotional or threat context;
- evidence of deletion, blocking, read receipts, calls, profile changes or metadata;
- clues that only become meaningful when cross-linked with other sources.

## Pipeline

```text
screenshot file
→ source record
→ image metadata extraction
→ OCR / vision extraction
→ entity extraction
→ timestamp extraction
→ context classification
→ claim generation
→ graph linkage
→ human review queue
```

## Source record fields

```ts
type ScreenshotSource = {
  source_id: string
  source_type: 'screenshot'
  filename: string
  original_path?: string
  captured_at?: string
  file_created_at?: string
  file_modified_at?: string
  width?: number
  height?: number
  hash: string
  perceptual_hash?: string
  ocr_text?: string
  vision_summary?: string
  platform_guess?: string
  entities_extracted: string[]
  claims_extracted: string[]
  source_refs: string[]
  review_status: 'unchecked' | 'needs_human_context' | 'checked' | 'locked'
  why_it_might_matter?: string
}
```

## Screenshot-specific classifications

```text
message_thread
call_log
contact_card
profile_page
map_location
bank_or_payment
police_or_court_record
email
browser_page
social_media_post
file_metadata
unknown
```

## Important extraction targets

- names;
- aliases and handles;
- phone numbers;
- email addresses;
- dates and times;
- crime / CAD / court / complaint references;
- platform names;
- visible message content;
- status markers such as delivered, read, missed call, blocked, edited or deleted;
- profile URLs or usernames;
- visible location clues;
- filenames and folder paths.

## Human review prompt

Every screenshot that cannot be confidently explained should be placed into a review queue asking:

```text
What am I looking at?
Why did this matter?
Who is visible?
What date or event does it relate to?
Does it support, contradict or contextualise any known claim?
Should it be linked to an existing entity, event or source?
```

## Batch strategy

Do not try to understand thousands of screenshots in one pass.

Recommended flow:

1. Hash and deduplicate.
2. Extract metadata.
3. OCR / vision summary.
4. Cluster visually similar screenshots.
5. Group by likely app/platform.
6. Group by date where available.
7. Extract entities and references.
8. Link to existing Nexus graph.
9. Send uncertain or high-value items to human review.

## Priority scoring

Screenshots should be prioritised where they contain:

- threats;
- police/court/reference numbers;
- named people already in the graph;
- phone numbers already in the graph;
- dates matching key events;
- deleted/edited/blocked/read receipt indicators;
- apparent contradiction with an existing source;
- rare or high-risk keywords.

## Output

Each screenshot should become:

- a source node;
- extracted entity nodes;
- possible event nodes;
- claim nodes only where wording is source-safe;
- a human review card if meaning is uncertain.

## Rule

Never infer final meaning from a screenshot alone unless the visible content directly supports it. Screenshots are powerful context, but they need provenance and review.
