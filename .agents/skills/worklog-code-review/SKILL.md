---
name: worklog-code-review
description: Review Worklog Newgen changes for correctness, regressions, data safety, RLS, and project conventions. Use for a PR, branch, commit, staged changes, current diff, or when asked to review code without editing it.
---

# Worklog Newgen code review

Review only. Do not edit files, stage changes, commit, push, deploy, or mutate local or remote data.

## Inputs

- Use the scope named by the user.
- If no scope is named, review staged and unstaged changes relative to `HEAD`.
- Read the root `AGENTS.md` before reviewing.

## Procedure

1. Run `git status --short --branch`, `git diff --stat`, `git diff`, and `git diff --cached`.
2. Open every changed file and the nearest relevant callers, types, queries, and tests or verification scripts.
3. Check behavior, error paths, null/empty/loading states, authorization, tenant/workspace boundaries, and backward compatibility.
4. For React changes, check hook dependencies, stale state, request races, rendering behavior, accessibility, and existing modal/i18n patterns.
5. For Supabase or SQL changes, check migration ordering, RLS impact, constraints, trigger interactions, idempotency assumptions, and rollback risk. Never use `.env` or a remote database to complete a review.
6. Run safe checks only when they materially validate a finding. Do not fix failures during the review.

## Output

List actionable findings first, highest severity first:

`[P0-P3] short title — path:line`

For each finding, explain the concrete failure scenario and the smallest safe correction. Do not report preferences as bugs. If there are no findings, say so and state what was inspected and which checks ran.

Finish with residual risks or unverified areas. Never say tests passed unless a test command actually ran; build and lint are separate checks.
