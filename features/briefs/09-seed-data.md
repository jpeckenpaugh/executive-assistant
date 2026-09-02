# Seed Data

## Purpose
Make the first-run app immediately understandable and testable.

## Expected behavior
On first setup, the app provides a small representative set of tasks, commitments, contacts, notes, and reminders. Dates are relative to the setup date so records remain useful. The data is clearly marked as sample data, and the user can reset the sample dataset.

## Inputs / outputs
First-run setup creates sample records. The reset action removes or restores the sample records in a predictable way and reports completion.

## User-visible behavior
The dashboard and each major feature contain clearly labeled sample content without confusing it with user-created content.

## Constraints
Seed data is local, representative, and intended for an individual professional. Reset must not silently erase user-created records.

## Basic acceptance expectations
Fresh setup contains all required sample categories, dates are relative, sample labeling is clear, and reset behavior is available and safe.
