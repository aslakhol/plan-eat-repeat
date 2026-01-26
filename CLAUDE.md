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
