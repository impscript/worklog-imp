---
name: worklog-verify-change
description: Verify a Worklog Newgen implementation using the current Git diff, frontend build and focused lint, plus safe local checks. Use after edits, before handoff, commit, push, or when asked whether a change is ready.
---

# Verify a Worklog Newgen change

Verification is read-only with respect to application and remote data. Do not repair failures unless the user also asks for a fix.

## Procedure

1. Read root `AGENTS.md` and run `git status --short --branch`.
2. Determine scope from `git diff --name-only` and `git diff --cached --name-only`. Include user-named files even when untracked.
3. Re-read every changed file and confirm the diff matches the requested behavior.
4. When frontend source or configuration changed, run from `frontend/`:
   - `npm run build`
   - `npx eslint <changed .js/.jsx/.ts/.tsx files>` when at least one such file changed
5. When migrations changed:
   - inspect filename ordering and the SQL diff;
   - verify affected tables, constraints, functions, triggers, and policies are consistently referenced;
   - run local Supabase lint only if an already configured local environment is available.
6. Do not run files under `scratch/`, link a Supabase project, apply migrations, call production APIs, or use credentials as verification.
7. Re-run `git status --short` and confirm verification did not introduce unexpected tracked files.

## Output

Report a compact matrix:

- `PASS`: command and decisive result.
- `FAIL`: command and first actionable error.
- `NOT RUN`: check and concrete reason.

Distinguish changed-file lint from full-project lint. The repository has no standard automated `test` script, so never label build or lint as tests. End with `ready`, `not ready`, or `conditionally ready`, and state the condition.
