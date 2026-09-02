# Daily Dashboard

## Purpose
Give the user one local, at-a-glance view of the day and the next seven days.

## Expected behavior
The dashboard uses the user's local date and time. It groups high-priority and due-today tasks, overdue responsibilities, and commitments in the next seven days. It also exposes quick actions to create a task, commitment, or inbox item.

## Inputs / outputs
It reads stored tasks, commitments, reminders, and inbox items. It produces grouped lists and links to their details or actions.

## User-visible behavior
The user sees an actionable daily summary, clear overdue indicators, the seven-day commitment horizon, and accessible create actions.

## Constraints
The app is single-user and local. The dashboard must not imply that external calendars or notifications are synchronized.

## Basic acceptance expectations
With representative records present, the dashboard shows the correct local day, overdue items, seven-day commitments, and working quick actions.
