# F3 Marietta

Next.js 16, Neon (shared DB with f3-automation), Better Auth, OpenAI `gpt-4o-mini` (public assistant), Anthropic Sonnet 4.6 (automation), Vercel Blob, Buffer, Slack Web API.

## Key Decisions

- Human-in-the-loop: all AI-generated content (captions, newsletters) requires approval before publishing
- Shared Neon DB with f3-automation — automation tables are additive only, never destructive
- Admin auth: HMAC token via `validateAdminToken(request)` — no user accounts for PAX
- Slack event handler must return 200 within 3 seconds (Vercel serverless, no background jobs)

## F3 Terminology (non-obvious domain language)

PAX = participants, Q = workout leader, AO = workout location (Area of Operations), FNG = first-timer, Backblast = post-workout recap, COT = Circle of Trust (closing), EH = recruiting, HC = hard commit, Gloom = early morning darkness.

## Agent Discipline

**Before spawning any subagent, summarize to Jordan what each agent will do and wait for approval.**

## Context (read on demand — do NOT auto-load)

- `AGENTS.md` — subagent-specific guidelines
- `.claude/context/feature-status.md` — feature tracker and route inventory
- `.claude/context/architecture-notes.md` — tech debt and footguns
- `.claude/context/business-context.md` — domain knowledge and stakeholders
- `.claude/context/test-health.md` — test suite status
