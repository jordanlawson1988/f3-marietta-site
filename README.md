# F3 Marietta Website

This is the official marketing website for F3 Marietta, a region of F3 Nation.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (Recommended)

## Backblasts Feature Setup

The Backblasts feature automatically ingests workout recaps from Slack and displays them on the website.

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click **New Project**
3. Configure:
   - **Organization**: Create one (e.g., "F3 Marietta")
   - **Project name**: `f3-marietta`
   - **Database Password**: Generate and save securely
   - **Region**: East US
4. Click **Create new project** (takes ~2 minutes)

### 2. Run Database Migration

1. In Supabase, go to **SQL Editor**
2. Copy contents of `supabase/migrations/20260106_backblasts_schema.sql`
3. Paste and run in SQL Editor
4. Verify tables in **Table Editor**: `ao_channels`, `backblasts`

### 3. Configure AO Channels

In Supabase SQL Editor, update the `ao_channels` table with your actual Slack channel IDs:

```sql
UPDATE ao_channels SET slack_channel_id = 'C0123456789' WHERE ao_display_name = 'The Battlefield';
-- Repeat for each AO channel
```

To find Slack channel IDs: Right-click channel → View channel details → scroll to bottom.

### 4. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name: `F3 Marietta Backblasts`, Workspace: Your F3 workspace
4. Configure:

**OAuth & Permissions** → Add scopes:
- `channels:history` - Read messages
- `channels:read` - List channels

**Event Subscriptions**:
- Enable Events: ON
- Request URL: `https://your-domain.vercel.app/api/slack/events`
- Subscribe to bot events:
  - `message.channels`

5. **Install to Workspace** (OAuth & Permissions page)
6. Copy **Bot User OAuth Token** (starts with `xoxb-`)
7. Copy **Signing Secret** (Basic Information page)

### 5. Environment Variables

Add to `.env.local` (local) and Vercel dashboard (production):

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
SLACK_SIGNING_SECRET=xxxxx
SLACK_BOT_TOKEN=xoxb-xxxxx
```

Get Supabase values from: **Settings** → **API**

### 6. Invite Bot to Channels

In Slack, invite your bot to each AO channel:
```
/invite @F3 Marietta Backblasts
```

### Local Testing with ngrok

1. Install ngrok: `brew install ngrok`
2. Start dev server: `npm run dev`
3. Start tunnel: `ngrok http 3000`
4. Update Slack Event Subscriptions URL to ngrok URL + `/api/slack/events`
5. Post a test backblast in a configured channel
6. Check `/backblasts` page

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

3.  **Build for Production**:
    ```bash
    npm run build
    npm start
    ```

## Project Structure

- `src/app`: Application routes (Home, About, Workouts, etc.).
- `src/components/layout`: Global layout components (Navbar, Footer).
- `src/components/ui`: Reusable UI components (Button, Card, Hero, etc.).
- `src/lib`: Utility functions.

## Customization

### Adding New AOs
To add a new workout location, edit `src/app/workouts/page.tsx`. Add a new object to the `aos` array with the name, time, location, map link, and description.

### Updating Schedule
Edit the `time` field in the `aos` array in `src/app/workouts/page.tsx`.

### Changing Images
Place new images in the `public/images` folder and update the `backgroundImage` props in the page files (e.g., `src/app/page.tsx`, `src/app/about/page.tsx`).

## Note on Icons
Due to compatibility issues with the latest Next.js/React versions, icons (Lucide React) have been temporarily disabled and replaced with emoji placeholders. To restore them, ensure `lucide-react` is compatible with React 19 and uncomment the imports and usages in the components.

## Contributing & Deployment

This repo powers the **F3 Marietta** website and AI assistant.

The site is built with:

- Next.js (React, TypeScript)
- Tailwind CSS
- Markdown-based content in `data/content/`
- Lexicon/Exicon data in `data/` (TS/CSV)
- OpenAI embeddings + a vector index in `data/f3VectorIndex.json`
- Deployed via Vercel

### Branching & Workflow

We use a simple Git branching model:

- `main` – always deployable, production branch
- `feature/*` – new features or larger changes
- `fix/*` – bug fixes
- `hotfix/*` – urgent fixes to production behavior

Basic workflow:

1. Branch off `main`:
   ```bash
   git checkout main
   git pull
   git checkout -b feature/short-description
2. Make changes (code, markdown, glossary, etc.).

3. Run the app locally and ensure everything works.

4. Commit with a clear, conventional message (see Commit Messages below).

5. Push your branch: 
    ## git push -u origin feature/short-description
6. Open a Pull Request into main.
7. CI must pass (GitHub Actions).
8. Once approved, merge to main → Vercel deploys automatically.

## Deploy Checklist

Use this checklist when making changes to the F3 Marietta site or knowledgebase.

### Before You Commit

- [ ] **Code / content updated**
  - [ ] Updated markdown in `data/content/` (About, Mission, First Workout, Region, etc.) as needed.
  - [ ] Updated Lexicon/Exicon entries if new F3 terms or exercises were added.
  - [ ] Verified relevant React components render the new content correctly.

- [ ] **Local testing**
  - [ ] `npm run dev` – manually verified key pages:
    - [ ] Home page & hero
    - [ ] About / Mission section
    - [ ] Lexicon / Exicon pages
    - [ ] “What would you like to know?” assistant box
  - [ ] Asked the assistant a few questions:
    - [ ] Direct term lookup (e.g. “What is a Merkin?”)
    - [ ] General F3 question (e.g. “What is F3?”)
    - [ ] New or updated content (e.g. new AO, new region details)

### Commit & Push

- [ ] On a feature or fix branch:
  - [ ] `git status` is clean except for intended changes.
  - [ ] Commit message uses conventional format (e.g. `feat(content): update mission statement`).
- [ ] Pushed to GitHub.
- [ ] Opened a Pull Request into `main`.

### CI & Review

- [ ] GitHub Actions CI is **green**:
  - [ ] Vector index builds successfully (`npm run build:index`).
  - [ ] Project builds (`npm run build`).
- [ ] PR reviewed and approved by at least one other F3 leader (if possible).

### After Merge (Production Deploy)

- [ ] Vercel deployment for `main` is successful.
- [ ] Visit production site (`https://f3marietta.com`) and verify:
  - [ ] Updated content appears as expected.
  - [ ] Lexicon/Exicon pages reflect any new or changed terms.
  - [ ] AI assistant answers reflect latest content (ask about recently changed sections).

### Optional Communication

- [ ] Share key updates in F3 Marietta comms (Slack/GroupMe/etc.):
  - [ ] New content (AOs, events, FAQs).
  - [ ] New or improved AI assistant capabilities.

---

## Release Notes

### January 12, 2026 - Backblasts Page Launch

**New Features:**
- **Backblasts Page** (`/backblasts`) - View all workout recaps from F3 Marietta AOs
  - Table layout with date, AO, Q (workout leader), and PAX count
  - Server-side pagination for fast loading
  - Click any row to view the full backblast details

- **Backblast Detail View** (`/backblasts/[id]`) - Individual backblast pages
  - Full workout recap content with rich formatting
  - Displays Q name, PAX count, and workout date
  - Slack user mentions resolved to display names

- **Canonical F3 Events Data Model** - New normalized database schema
  - Supports both backblasts (workout recaps) and preblasts (workout announcements)
  - Stores attendee lists, Q information, and full message content
  - Automatic ingestion from Slack via F3 Nation bot integration

**Bug Fixes:**
- Fixed PAX count display (was incorrectly parsing F3 names as numbers)
- Filtered out thread replies that were appearing as separate backblast entries
- Resolved Slack user IDs to display names in backblast content

**Technical Notes:**
- New `f3_events` table replaces legacy `backblasts` table
- Data fix script available: `npx tsx scripts/fix-f3-events-data.ts`
- Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables in production
