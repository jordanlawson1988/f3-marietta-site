# Business Context — F3 Marietta

> Domain knowledge, stakeholder context, and business goals. Last updated: 2026-03-22

## The Organization

**F3** (Fitness, Fellowship, Faith) is a national network of free, peer-led outdoor workouts for men. F3's mission is to plant, grow, and serve small workout groups for men for the invigoration of male community leadership.

**F3 Marietta** is a regional group within F3 Nation, based in Marietta, Georgia. The region launched with The Battlefield AO at Marietta High School in June 2024 and officially became a region in December 2025.

## Core Principles (Non-Negotiable)

All F3 workouts adhere to 5 core principles:
1. **Free of charge** — no fees, ever
2. **Open to all men** — any fitness level
3. **Held outdoors** — rain or shine, heat or cold
4. **Peer-led in a rotating fashion** — no permanent instructor
5. **Ends with a Circle of Trust (COT)** — brief moment of reflection/prayer

## F3 Vocabulary (Key Terms)

Understanding F3 terminology is essential for working on this project:

| Term | Meaning |
|------|---------|
| **PAX** | Participants in a workout (plural or singular) |
| **Q** | The leader/instructor for a workout |
| **AO** | Area of Operations — a specific workout location |
| **FNG** | Friendly New Guy — someone attending their first workout |
| **Backblast** | Post-workout recap shared in Slack (who was there, what was done) |
| **Preblast** | Pre-workout announcement (when, where, what to expect) |
| **COT** | Circle of Trust — closing moment at every workout |
| **The Gloom** | Early morning darkness when most workouts begin (typically 5:00-5:30 AM) |
| **HC** | Hard Commit — confirming attendance to a workout |
| **Lexicon** | F3-specific vocabulary and terminology |
| **Exicon** | F3 exercise dictionary (specific exercises with F3 names) |
| **Region** | A geographic grouping of AOs under shared leadership |
| **Site Q** | The PAX responsible for a specific AO |
| **Nantan** | Regional leader |

## Stakeholders

| Person | Role | Authority |
|--------|------|-----------|
| **Jordan Lawson** | Developer, F3 Marietta leader | Sole developer, architecture decisions, content curation |

Jordan is an active participant and leader in F3 Marietta. He built this site to serve the community — it is not a client project. There is no external stakeholder or business owner.

## What the Website Does

1. **Attracts new PAX** — Public-facing pages explain F3, show workout schedules, and make it easy for newcomers to find and join a workout
2. **Displays workout recaps** — Backblasts are automatically ingested from Slack and displayed on the site, creating a public record of F3 Marietta's activity
3. **Answers questions** — AI assistant (AMA widget) answers F3-related questions using the glossary and knowledge base
4. **Automates social media** — Instagram captions and newsletters are AI-generated from backblast data, reviewed by admin, then posted
5. **Manages operations** — Admin dashboard for workout schedules, regions, knowledge base, and content automation

## Target Audience

### Primary: Potential New PAX
- Men in the Marietta, GA area curious about F3
- Discovered via word of mouth, Instagram, or Google search
- Need to quickly understand: What is this? Where do I go? When? Do I need to sign up?
- **Key requirement:** Zero friction to first workout — no signup, no account, just show up

### Secondary: Existing PAX
- Check workout schedules and locations
- Read backblasts from workouts they missed
- Share the site with potential new PAX (EH — Emotional Headlock, F3 term for recruiting)

### Tertiary: F3 Leadership
- Jordan (admin) manages content, monitors automation, curates knowledge base
- Future: other F3 Marietta leaders may need admin access

## Business Model

**There is no business model.** F3 is free. The website is a community tool, not a revenue generator. The site runs on free tiers:
- Vercel Hobby (free hosting)
- Neon free tier (free Postgres)
- OpenAI API (minimal cost for AI assistant queries)
- Anthropic API (minimal cost for automation)
- Slack (free workspace)

## What the Website Must NOT Do

- Charge money or process payments
- Require user registration for public content
- Replace Slack as the primary communication tool
- Become a social network — F3 community lives in Slack, not on the website
- Support multiple F3 regions (each region manages their own web presence)

## Key Metrics

- **Workout schedule accuracy** — PAX rely on the website for correct locations and times
- **Backblast completeness** — All Slack backblasts should appear on the site
- **Assistant helpfulness** — New PAX should get useful answers about F3
- **Site uptime** — The site should always be available (Vercel handles this)

## Content Sources

- **Workout schedules:** Managed via admin dashboard, stored in Neon
- **Backblasts:** Automatically ingested from Slack via Events API
- **Glossary:** F3 Nation's Lexicon/Exicon (353KB CSV, 2000+ terms)
- **Knowledge base:** Curated markdown files in `data/content/` covering about, mission, FAQ, leadership, regions, workouts, culture, events, gear, and more (12 content directories)
- **Images:** Static in `public/images/` and `public/icons/`
