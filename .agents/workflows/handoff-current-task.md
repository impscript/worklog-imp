# Handoff current task

Create a durable local checkpoint before pausing or changing agents.

1. Load and follow `.agents/skills/worklog-handoff/SKILL.md`.
2. Capture the exact Git and verification state from direct commands.
3. Save a sanitized checkpoint under `.agents/worklog/`.
4. Return the checkpoint path and the next concrete action.
