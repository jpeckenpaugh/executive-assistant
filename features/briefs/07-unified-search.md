# Unified Search

## Purpose
Help the user locate information without knowing which record type contains it.

## Expected behavior
The user enters free text and searches across tasks, commitments, contacts, notes, reminders, and inbox items. The user can filter results by record type.

## Inputs / outputs
The input is a query and optional type filter. The output is a grouped or labeled result list with enough context to open each record.

## User-visible behavior
Results identify their type and relevant matching text; an empty state explains when nothing matches.

## Constraints
Search is local and free-text based. It need not provide ranking, semantic interpretation, or external search.

## Basic acceptance expectations
Known text is found in each supported record type, type filters narrow results correctly, and no-result searches are handled clearly.
