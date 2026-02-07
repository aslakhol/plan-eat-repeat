# AGENTS.md

This file provides guidance for AI agents working in this repository.

## Project Summary
PlanEatRepeat is a dinner planning app that helps households track dinner ideas and schedule meals for specific days. It is a monorepo with a Next.js web app, an Expo mobile app, and shared packages.

## Repo Layout
- `apps/web`: Next.js 15 (Pages Router) web app.
- `apps/mobile`: Expo (React Native) mobile app.
- `packages/db`: Prisma schema, generated client, and DB helpers.
- `packages/shared`: Shared types/utilities.

## Tech Stack
- Next.js 15 (Pages Router)
- tRPC + React Query
- Prisma + PostgreSQL
- Clerk auth
- Tailwind CSS + shadcn/ui
- Turbo + pnpm workspaces

## Conventions
- Use `pnpm` and root `turbo` scripts (`pnpm dev`, `pnpm lint`, `pnpm build`).
- Node version: `>= 24.12.0` (see `package.json`).
- Web path alias: `~/` resolves to `apps/web/src`.
- tRPC routers live in `apps/web/src/server/api/routers`.
- Procedure helpers are in `apps/web/src/server/api/trpc.ts`: `publicProcedure`, `protectedProcedure`, `protectedProcedureWithHousehold`.
- Data model is defined in `packages/db/prisma/schema.prisma`.

## Common Commands
- `pnpm dev` (all apps)
- `pnpm dev:web` (web only)
- `pnpm dev:mobile` (mobile only)
- `pnpm lint`
- `pnpm build`
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:studio`
- `pnpm db:reset`
- `pnpm db:fix` (destructive: wipes local DB and seeds it)

## Local Setup
- Copy `.env.example` to `.env` and fill required values (Clerk keys, DB URL).
- Start Postgres: `docker compose -f database-docker.yml up -d`.
- Initialize/seed DB: `pnpm db:reset` or `pnpm db:fix`.

## Editing Notes
- Do not edit generated Prisma client in `packages/db/generated`.
- Avoid changing build outputs (e.g., `.next`).
- For DB changes: update `schema.prisma`, run `pnpm db:migrate`, then `pnpm db:generate` if needed.
- For UI work, prefer existing shadcn/ui components in `apps/web/src/components/ui`.
