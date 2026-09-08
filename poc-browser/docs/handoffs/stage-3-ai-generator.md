# Stage 3 Handoff Audit: Cloud AI Agent Integration (Bulk Data & Test Seed Generator)

## Overview
Stage 3 implements Option 1: Bulk Data & Test Seed Generator (`js/ai/generator.js`) for generating structured candidate entity records using Cloud AI and seeding them directly into the local workspace.

## Changes Made
1. **Bulk Data Generator Module (`js/ai/generator.js`)**:
   - Imported `completeJson` from `./cloud-client.js`.
   - Defined strict entity schemas for:
     - `tasks`: `{ title (required string), description (string), priority ('low'|'medium'|'high'), due_at (ISO datetime string e.g. YYYY-MM-DDTHH:mm), recurrence ('none'|'daily'|'weekly'|'monthly') }`
     - `commitments`: `{ title (required string), kind ('meeting'|'other'), starts_at (ISO datetime string), duration_minutes (number), location (string), attendees (string), notes (string) }`
     - `contacts`: `{ name (required string), email (string), phone (string), organization (string), role (string), relationship_context (string) }`
     - `notes`: `{ title (string), content (required string), kind ('general'|'preparation'|'follow_up') }`
     - `reminders`: `{ title (required string), remind_at (ISO datetime string) }`
     - `inbox_items`: `{ content (required string) }`
   - Implemented `generateBulkItems(type, prompt, count)`:
     - Formats prompt with system instruction requiring a JSON object containing key `"items"` with `count` array elements matching the target entity schema.
     - Calls `completeJson` and validates the returned array structure.
   - Implemented `showGeneratorModal(type, onComplete)`:
     - Creates and renders a dynamic Bootstrap modal with user prompt input (prefilled default: `"Generate 10 realistic sample ${type}"`), number input (count 1-20, default 10), and "Generate" submit button.
     - Displays candidate records in a scrollable preview list with checkboxes pre-selected.
     - Includes a "Save to Workspace" button that sequentially saves checked candidate records via `api.save(type, null, item)` and triggers `onComplete(count)`.

2. **Application UI Integration (`js/app.js`)**:
   - Imported `showGeneratorModal` from `./ai/generator.js`.
   - Updated `listing(type)` to insert a `✨ AI Generate` button (`<button class="btn btn-outline-primary me-2" data-ai-generate="${type}">✨ AI Generate</button>`) alongside the "New" record button.
   - Added click listener for `data-ai-generate` in event delegation logic to launch `showGeneratorModal(type, () => render())`.

## Files Created / Modified
- `js/ai/generator.js` (Created)
- `js/app.js` (Modified)
- `docs/handoffs/stage-3-ai-generator.md` (Created)

## Verification Performed
- Executed unit test suite (`scratch/test-generator.js`) validating `generateBulkItems` against entity schemas and mock `completeJson` responses.
- Verified syntax, imports, modal DOM creation, checkbox selection state, and batch save flow.
