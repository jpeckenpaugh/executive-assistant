# Schedule and Commitment Tracking

## Purpose
Keep meetings and other important commitments visible and actionable.

## Expected behavior
The user can create, view, edit, cancel, and complete commitments. A commitment includes a title, local date/time, and optional duration, location, attendees, notes, and links to other records. The app warns about overlapping commitments without preventing the user from saving.

## Inputs / outputs
The user supplies commitment details and optional links. The app returns an ordered schedule and commitment status/details.

## User-visible behavior
The user sees upcoming commitments, their details, and a clear overlap warning when times intersect.

## Constraints
Scheduling is local and single-user; there is no external calendar synchronization. Overlap warnings are advisory.

## Basic acceptance expectations
CRUD actions work, commitments sort by local date/time, status changes are visible, and overlapping times produce a warning.
