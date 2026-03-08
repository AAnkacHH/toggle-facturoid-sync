---
description: Initialize a new project — ask questions, generate .context/PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, AGENTS.md
---

# /init-project

You initialize a new project. Your goal is to understand what is being built and generate structured documentation for agents.

**Arguments (optional):** $ARGUMENTS — project name or short description. If empty — start with questions.

---

## Step 1: Check if Project Already Exists

Check if `.context/PROJECT.md` or `AGENTS.md` exists. If so — ask the user:
> Existing project context found. Do you want to **update** the existing one or **start fresh**?

---

## Step 2: Requirements Gathering (Q&A)

Ask questions in **blocks**, not all at once. Wait for a response before moving to the next block.

### Block 1 — Project Essence
- What are we building? (web app, API, CLI, mobile app, library?)
- Who is it for? (personal use, B2B, B2C, internal tool?)
- What main problem does it solve?

### Block 2 — Technical Preferences
- Is there an already chosen tech stack or leave it to the agent?
- Programming language? (TypeScript, Python, Go, other)
- Database? (PostgreSQL, MySQL, MongoDB, SQLite, no DB)
- Auth needed? (JWT, OAuth Google/GitHub, magic links, no auth)

### Block 3 — Scope and Priorities
- What **must** be in the first version (v1)?
- What can be deferred to later (v2+)?
- What is definitely **out of scope**?

### Block 4 — Additional (if relevant)
- Is there a deadline or constraints?
- Is there existing code to integrate with?

---

## Step 3: Draft Summary

Show a concise summary before generating files:

```
📋 Here is what I understood:

**Project:** [name]
**Type:** [web app / API / CLI / ...]
**Audience:** [for whom]
**Stack:** [language, framework, DB]
**Auth:** [yes/no, type]

**v1 Must-have:**
- [list]

**v2 Nice-to-have:**
- [list]

**Out of scope:**
- [list]

Is everything correct? Or is there anything to clarify?
```

Wait for confirmation before generating.

---

## Step 4: Generate `.context/` Files

### `.context/PROJECT.md`
```markdown
# [Project Name]

## Overview
[2-3 sentences: what it is, for whom, what value it provides]

## Goals
- [Goal 1]
- [Goal 2]

## Target Audience
[audience description]

## Tech Stack (Planned)
- Language: [...]
- Backend: [...]
- Frontend: [...]
- Database: [...]
- Auth: [...]

## Non-Goals
- [What we are NOT building]
```

### `.context/REQUIREMENTS.md`
```markdown
# Requirements

## v1 — Must Have (MVP)
- [ ] [Requirement 1]
- [ ] [Requirement 2]

## v2 — Nice to Have
- [ ] [Requirement 1]

## Out of Scope
- [What is excluded and why]

## Open Questions
- [Questions that need a decision]
```

### `.context/ROADMAP.md`
```markdown
# Roadmap

## Phase 1 — Foundation
**Goal:** [What should work after this phase]
**Deliverables:**
- [concrete result]

## Phase 2 — Core Features
**Goal:** [...]
**Deliverables:**
- [...]

## Phase 3 — Polish & Launch
**Goal:** [...]
**Deliverables:**
- [...]
```

### `.context/STATE.md`
```markdown
# Project State

**Current Phase:** Phase 1
**Status:** 🟡 In Progress
**Last Updated:** [date]

## Completed
- [x] Project initialized

## In Progress
- [ ] [Current task]

## Blocked
- [description of blockers if any]

## Next Up
- [ ] [Next step]
```

---

## Step 5: Generate `AGENTS.md` and Platform Wrappers

### `AGENTS.md`
```markdown
# AGENTS.md — [Project Name]

## Project Overview
[1-3 sentences]

## Tech Stack
[concise list]

## Current Phase
Phase 1 — Foundation (see `.context/STATE.md` for progress)

## Architecture Rules
[3-5 rules, if stack is chosen]

## Development Commands
```bash
[commands if known, otherwise — TBD]
```

## Detailed Context
- `.context/PROJECT.md` — project overview & goals
- `.context/REQUIREMENTS.md` — v1/v2/out-of-scope
- `.context/ROADMAP.md` — phases & deliverables
- `.context/STATE.md` — current progress
```

### `CLAUDE.md`
```markdown
# Claude Code — [Project Name]

See @AGENTS.md for project rules and context.

## Claude-Specific
- Sub-agents: `.claude/agents/`
- Commands: `.claude/commands/`
- Planning: `.planning/`
```

### `GEMINI.md`
```markdown
# Gemini — [Project Name]

See AGENTS.md for project rules and context.

## Gemini-Specific Rules
- Do NOT expand scope without explicit user approval
- Agents: `.agents/`
- Workflows: `.agents/workflows/`
- Planning: `.planning/`
```

---

## Step 6: Report

```
✅ Project initialized: [Project Name]

Files created:
  AGENTS.md                    — universal context
  CLAUDE.md                    — Claude Code wrapper
  GEMINI.md                    — Gemini wrapper
  .context/PROJECT.md          — project overview
  .context/REQUIREMENTS.md     — v1/v2/out-of-scope
  .context/ROADMAP.md          — phases
  .context/STATE.md            — current state

🚀 Next steps:
  1. Run /map-codebase if there is existing code to analyze
  2. Or start with the Planner agent for the first feature:
     > You are a planner sub-agent. Read .context/REQUIREMENTS.md and .context/ROADMAP.md and create a plan for Phase 1.
```

---

## Rules

- **Do not generate** files until the Draft Summary in Step 3 is confirmed
- **Do not invent** a tech stack if the user said "agent's choice" — write `[TBD — determine at development start]`
- **CLAUDE.md and GEMINI.md** — maximum 10 lines
- **STATE.md** is updated at every significant milestone, not only at initialization