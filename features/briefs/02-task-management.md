# Task Management

## Purpose
Help the user manage responsibilities from creation through completion.

## Expected behavior
The user can create, view, edit, complete, and postpone tasks. Each task has a low, medium, or high priority and may have a due date. Postponement requires selecting a new date. A recurring task creates its next occurrence when completed. Tasks may link simply to relevant commitments, contacts, notes, or reminders.

## Inputs / outputs
The user supplies task text, priority, dates, recurrence, and optional links. The app stores the task and displays its status, dates, recurrence, and linked records.

## User-visible behavior
Lists and detail views show priority, due status, completion state, and recurrence. Completing or postponing a task immediately updates its display.

## Constraints
Only low, medium, and high priorities are supported. Postponement cannot leave the task without a new date. Recurrence remains simple and local.

## Basic acceptance expectations
The user can perform each listed task action, see validation for required postponement dates, and observe the next occurrence after completing a recurring task.
