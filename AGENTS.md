# Worklog Newgen engineering guide

This file is the shared source of truth for coding agents working in this repository. Apply it before making changes, regardless of whether the work starts in Antigravity, Codex, or another editor agent.

## Repository map

- `frontend/`: React 19, TypeScript, Vite, Tailwind CSS, and Supabase client application.
- `frontend/src/components/`: reusable UI and feature components.
- `frontend/src/pages/`: route-level screens.
- `frontend/src/hooks/` and `frontend/src/lib/`: shared client logic and integrations.
- `supabase/migrations/`: canonical, ordered database migrations.
- `db/`: SQL diagnostics and maintenance scripts; treat these as operational tooling, not application migrations.
- `scratch/` and `frontend/scratch/`: one-off diagnostics. Do not run them unless the user explicitly requests it and their data access is understood.

## Working agreement

1. Read this file and inspect `git status` before editing.
2. Explore the relevant code path and state a focused plan before a cross-cutting change.
3. Keep edits scoped to the request. Do not clean up unrelated lint or legacy issues.
4. Re-read the diff and run the applicable verification commands before reporting completion.
5. Report changed files, checks run, failures or skipped checks, and any operational follow-up.

## Frontend rules

- Follow the existing React component, hook, query, and styling patterns near the changed code.
- Do not add or upgrade production dependencies without explicit approval.
- Preserve strict TypeScript behavior. Do not hide errors with `any`, `@ts-ignore`, or disabled lint rules unless the user approves the tradeoff.
- Do not use `window.confirm()`, `confirm()`, `window.alert()`, or `alert()`. Use the project's custom modal components for confirmations and alerts.
- Keep user-visible copy consistent with the existing i18next structure when the surrounding feature is localized.
- Do not commit generated `dist/`, local uploads, logs, or environment files.

## Supabase and data safety

- Represent schema changes as a new timestamped file in `supabase/migrations/`; do not rewrite an applied migration unless explicitly requested.
- Preserve RLS and tenant/workspace boundaries. Treat broader access as a security change requiring explanation and approval.
- Do not execute migrations, SQL mutations, or scratch scripts against a linked or remote database unless the user explicitly requests that action.
- Never read, print, commit, or copy secrets from `.env`, Supabase service-role keys, tokens, or credential stores.
- Prefer read-only inspection before proposing a data repair. Include rollback or recovery notes for destructive or irreversible operations.

## Verification

Run commands from `frontend/` unless noted otherwise.

- Frontend build and type check: `npm run build`
- Full lint: `npm run lint`
- Focused lint for changed source files: `npx eslint <changed-file...>`

The repository currently has no standard automated `test` script. Do not claim tests passed when only build or lint ran. The full lint baseline may contain unrelated legacy findings; run focused lint on changed source files and clearly distinguish new failures from pre-existing debt.

For SQL changes, inspect the migration diff and use local Supabase validation only when a local environment is already available. Do not connect, link, push, or mutate a remote project as part of verification.

## Git and multi-agent safety

- Do not commit, push, merge, deploy, or switch branches unless the user requests it.
- Keep unrelated user changes intact; never reset or discard them.
- Allow only one writing agent per working tree. Use a separate branch or Git worktree for parallel implementation; read-only reviewers may share the same tree.
- Before handoff, record the branch, HEAD, working-tree state, changed files, verification results, blockers, and the next concrete action.

## Reusable workflows

- Use `$worklog-code-review` for a read-only review of the current diff.
- Use `$worklog-verify-change` to run and report the checks appropriate to the current change.
- Use `$worklog-handoff` before changing agents or pausing unfinished work.
