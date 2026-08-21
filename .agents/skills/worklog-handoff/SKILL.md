---
name: worklog-handoff
description: Save a sanitized Worklog Newgen task checkpoint so Antigravity, Codex, Grok, or another agent can resume safely. Use before switching agents, pausing unfinished work, context reset, or handing a task to review.
---

# Handoff a Worklog Newgen task

Create a factual checkpoint from the current repository state. Do not infer successful verification and do not include secrets, environment values, tokens, credentials, private row data, or copied production payloads.

## Procedure

1. Read root `AGENTS.md`.
2. Capture direct outputs from:
   - `git branch --show-current`
   - `git rev-parse --short HEAD`
   - `git status --short`
   - `git diff --stat`
   - `git diff --name-only`
   - `git diff --cached --name-only`
3. Summarize the task goal, decisions made, completed work, remaining work, verification commands and results, blockers, and the next concrete action.
4. Create `.agents/worklog/` if needed and save the checkpoint as `.agents/worklog/YYYYMMDD-HHMM-<short-task-slug>.md` using local macOS time.
5. Do not stage or commit the checkpoint. `.agents/worklog/` is intentionally local-only.
6. Re-open the saved checkpoint and verify every required section is present.

## Checkpoint format

```markdown
# Task handoff: <title>

- Updated: <ISO local timestamp>
- Branch: <branch>
- HEAD: <short SHA>
- Working tree: <clean or concise status>

## Goal
## Decisions
## Completed
## Changed files
## Verification
## Remaining work
## Blockers and risks
## Next action
```

Return the saved path and a one-sentence resume instruction for the next agent.
