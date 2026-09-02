# Quick Capture Inbox

## Purpose
Let the user record an idea or responsibility quickly before deciding how to organize it.

## Expected behavior
The user creates an inbox item with free-form content and classifies it as a task, note, or reminder during processing. The user can edit it, process it into the selected type, or explicitly dismiss it. Items may remain unprocessed until acted upon.

## Inputs / outputs
The user supplies captured text and optional classification/details. The app displays pending items and the resulting task, note, or reminder.

## User-visible behavior
Pending items are visibly distinct from processed or dismissed items, and processing provides confirmation.

## Constraints
Capture is local and single-user. Processing must not silently discard content.

## Basic acceptance expectations
The user can capture, edit, process, and dismiss items, and can tell which items still need attention.
