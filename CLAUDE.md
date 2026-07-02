# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PlanEatRepeat is a dinner planning app that helps users track what dinners they can make and plan meals for specific days. It's a multi-tenant app where users belong to households that share dinners and meal plans.

## Tech Stack

- **Framework**: Next.js 15 (Pages Router)
- **Database**: PostgreSQL with Prisma ORM
- **API**: tRPC for type-safe API routes
- **Auth**: Clerk for authentication
- **UI**: shadcn/ui components with Tailwind CSS
- **State**: React Query (via tRPC integration)
- **Hosting**: Vercel with Supabase for production database

## Common Commands

```bash
pnpm dev              # Start development server
pnpm lint             # Run ESLint
pnpm build            # Production build
pnpm db:migrate       # Create new Prisma migration
pnpm db:studio        # Open Prisma Studio
pnpm db:fix           # Wipe and rebuild local database with seed data
```

## Architecture

### Path Alias

Use `~/` to import from `src/` (e.g., `import { api } from "~/utils/api"`)

### tRPC Procedures

Three procedure types in `src/server/api/trpc.ts`:

- `publicProcedure` - Unauthenticated, adds optional householdId to context
- `protectedProcedure` - Requires authentication
- `protectedProcedureWithHousehold` - Requires auth AND household membership

### API Routers

Located in `src/server/api/routers/`:

- `dinner` - CRUD for dinner recipes
- `plan` - Schedule dinners to dates
- `household` - Manage households, memberships, and invites

### Data Model

- **Household** - Multi-tenant container; users join via invites
- **Dinner** - A meal that belongs to a household, has optional tags/link/notes
- **Plan** - Links a dinner to a specific date
- **Membership** - Links users to households with ADMIN or MEMBER role
- **Invite** - Time-limited household invitation links

### Frontend Structure

- `src/pages/` - Next.js pages (index, dinners, settings, invites)
- `src/views/` - Feature-specific view components
- `src/components/ui/` - shadcn/ui base components
- `src/hooks/` - Custom React hooks

### Clerk Integration

User data synced via webhook (`src/server/webhooks/user.ts`). HouseholdId stored in Clerk session claims metadata for easy access in tRPC context.

## Local Development Setup

1. Copy `.env.example` to `.env`
2. Start Postgres: `docker compose -f database-docker.yml up -d`
3. Run `pnpm db:fix` to initialize and seed the database
4. Get Clerk keys and add to `.env`
5. Run `pnpm dev`

## Picking the right models for workflows and subagents

Rankings, higher = better. Cost reflects what I actually pay (OpenAI has really generous limits), not list price. Intelligence is how hard a problem you can hand the model unsupervised. Taste covers UI/UX, code quality, API design, and copy.

| model    | cost | intelligence | taste |
| -------- | ---- | ------------ | ----- |
| gpt-5.5  | 9    | 8            | 5     |
| sonnet-5 | 5    | 5            | 7     |
| opus-4.8 | 4    | 7            | 8     |
| fable-5  | 2    | 9            | 9     |

How to apply:

- These are defaults, not limits. You have standing permission to override them: if a cheaper model's output doesn't meet the bar, rerun or redo the work with a smarter model without asking. Judge the output, not the price tag. Escalating costs less than shipping mediocre work.
- Cost is a tie-breaker only; when axes conflict for anything that ships, intelligence > taste > cost.
- Bulk/mechanical work (clear-spec implementation, data analysis, migrations): gpt-5.5 — it's effectively free.
- Anything user-facing (UI, copy, API design) needs taste ≥ 7.
- Reviews of plans/implementations: fable-5 or opus-4.8, optionally gpt-5.5 as an extra independent perspective.
- Never use Haiku.
- Mechanics: gpt-5.5 is only reachable through the Codex CLI — `codex exec` / `codex review` (my `~/.codex/config.toml` defaults to gpt-5.5). Use the codex-implementation, codex-review, and codex-computer-use skills; for work they don't cover (investigation, data analysis), run `codex exec -s read-only` directly with a self-contained prompt.
- Claude models (sonnet-5, opus-4.8, fable-5) run via the Agent/Workflow model parameter.

Using gpt-5.5 inside workflows and subagents (the model parameter only takes Claude models, so use a wrapper):

- Spawn a thin Claude wrapper agent with `model: 'sonnet', effort: 'low'` whose prompt instructs it to write a self-contained codex prompt, run `codex exec` via Bash, and return the result.
