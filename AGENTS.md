# AGENTS.md

Guidance for agents working in this repository.

## Core Rules

- Do not create commits unless asked by the user.
- Always run `pnpm lint` and `pnpm typecheck` making pull requests.
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

## Reading design handoffs

- A mockup may include text such as "1 more" or "6 more" only to show that content continues beyond the captured area. Treat it as a design-process annotation, not as a disclosure control, pagination, or hidden content. Render the full collection with ordinary scrolling unless the written product requirements separately call for progressive disclosure or pagination.

## Local web testing

- Before running `pnpm dev:web`, check whether a Next.js dev server is already running for this checkout. Do not start a second server on another port. Both processes write to `apps/web/.next`, which can cause a continuous Fast Refresh reload loop and make Playwright fail before it can inspect the page.
- Reuse the existing server when it is serving the current checkout and has loaded the latest changes. If a clean restart is needed and the user owns the running process, ask the user to stop it instead of killing it. If an agent started the duplicate process, stop that process before rerunning the browser test.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default five triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Uses a single-context layout with root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
