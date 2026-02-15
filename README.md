# PlanEatRepeat

This is an app for planning dinners for Madeleine and Aslak.
At it's core it solves two problems:

1. What dinners can we make?
2. What did we plan to make on what day?

Number 2 is pretty straight forward, we just record what dinner was planned for what day and that's that.
For number 1 we are specifically interested in having a list of dinners that we like to make as an inspiration when we make our dinner plans.
We are not trying to solve the issues of figuring out what can be created with our current ingredients, and we are not making a recipe list (at least yet).

## Hosting

The web app is hosted on [Vercel](https://vercel.com/) at [PlanEatRepeat.com](https://planeatrepeat.com/)

## Technology

The project was Bootstrapped with [create-t3-app](https://create.t3.gg/).

- [React](https://react.dev/)
- [Next.js](https://nextjs.org)
- [Prisma](https://prisma.io)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)
- [shadcn/ui](https://ui.shadcn.com/)
- [Vercel](https://vercel.com/)
- [Supabase](https://supabase.com/)
- [Clerk](https://clerk.com/)

## Local Setup

### Install

```bash
pnpm install
cp .env.example .env
```

### Database

Start Postgres:

```bash
docker compose -f database-docker.yml up -d
```

Initialize/seed local DB:

```bash
pnpm db:reset
```

Reset everything (destructive local reset):

```bash
pnpm db:fix
```

## Commands

```bash
# run
pnpm dev:web          # web
pnpm dev:mobile       # mobile (Android)
pnpm dev              # all dev tasks

# quality/build
pnpm lint
pnpm build

# database
pnpm db:migrate
pnpm db:studio
pnpm db:reset
pnpm db:fix           # destructive local reset

# screenshots
pnpm capture         # web + mobile + side-by-side
pnpm capture:web     # web + side-by-side (requires capture/mobile/*.png)
pnpm capture:mobile  # mobile + side-by-side (requires capture/web/*.png)
```

## Capture Screenshots

Use these commands to capture screenshots and compose side-by-side images.

### Prerequisites

- `pnpm dev:web` is running on `http://localhost:3000`
- `pnpm dev:mobile` is running on `http://localhost:8081`
- Mobile app is logged in (tap `local login` once after startup)
- `adb` and ImageMagick (`magick`) are installed
- Playwright Chromium is installed once:

```bash
pnpm --filter @planeatrepeat/web exec playwright install chromium
```

### Run

```bash
pnpm capture         # full flow
pnpm capture:web     # web only + side-by-side refresh
pnpm capture:mobile  # mobile only + side-by-side refresh
```

### What It Does

1. `pnpm capture`: verifies web and mobile dev servers, captures both platforms, then creates side-by-side images.
2. `pnpm capture:web`: verifies web dev server, captures web, then re-creates side-by-side images using existing mobile screenshots.
3. `pnpm capture:mobile`: verifies web and mobile dev servers, captures mobile, then re-creates side-by-side images using existing web screenshots.

### Outputs

- `capture/web/plan.png`
- `capture/web/dinners.png`
- `capture/mobile/plan.png`
- `capture/mobile/dinners.png`
- `capture/side-by-side/plan.png`
- `capture/side-by-side/dinners.png`
