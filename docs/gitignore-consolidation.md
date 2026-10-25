# Git Ignore Consolidation

## Overview

This change consolidates Git ignore rules into the repository root `.gitignore` file.

## Changes Made

- Moved the ignore rules from `frontend/.gitignore` into the root `.gitignore`.
- Removed the redundant `frontend/.gitignore` file.
- Centralized Git ignore configuration at the repository root.

## Validation

- Checked the expected ignored files and directories using `git check-ignore`.
- Ran `git diff --cached --check` before committing; no whitespace errors were reported.

## Git History

- **Commit:** `b641ba5`
- **Commit message:** `chore: consolidate gitignore rules`
- **Branch:** `feat/T1-06-frontend-project-setup`

## Pull Request

[Pull Request #8](https://github.com/MaryamM84/VAKA-platform/pull/8)

Refer to GitHub for the current review and merge status.

## Result

The repository uses a centralized `.gitignore` configuration instead of maintaining a separate ignore file for the frontend.