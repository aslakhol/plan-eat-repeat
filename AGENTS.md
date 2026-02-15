# AGENTS.md

Guidance for agents working in this repository.

## Core Rules

- Do not create commits unless asked by the user.
- Always run `pnpm lint` and `pnpm typecheck` after finishing changes.
- Use `pnpm` and root `turbo` scripts.

## Repo Layout

- `apps/web`: Next.js 15 (Pages Router) web app.
- `apps/mobile`: Expo (React Native) mobile app.
- `packages/db`: Prisma schema, generated client, DB helpers, seed scripts.
- `packages/shared`: Shared types/utilities.

## Architecture Essentials

- App is multi-tenant: users belong to households; dinners and plans are household-scoped.
- Main data model is in `packages/db/prisma/schema.prisma` (Household, Dinner, Plan, Membership, Invite).
- Web path alias: `~/` resolves to `apps/web/src`.
- tRPC routers: `apps/web/src/server/api/routers`.
- tRPC procedures: `apps/web/src/server/api/trpc.ts` (`publicProcedure`, `protectedProcedure`, `protectedProcedureWithHousehold`).
- Clerk user sync webhook: `apps/web/src/server/webhooks/user.ts`.

## Commands

- `pnpm dev` (all apps)
- `pnpm dev:web`
- `pnpm dev:mobile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm db:migrate`
- `pnpm db:generate`
- `pnpm db:studio`
- `pnpm db:reset`
- `pnpm db:fix` (destructive: wipes local DB and seeds it)

## Editing Notes

- Do not edit generated Prisma client in `packages/db/generated`.
- Avoid changing build outputs (for example `.next`).
- For DB changes: update `schema.prisma`, run `pnpm db:migrate`, then `pnpm db:generate` if needed.
- For web UI, prefer existing shadcn/ui components in `apps/web/src/components/ui`.
