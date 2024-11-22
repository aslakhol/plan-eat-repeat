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

## Database

Locally we're using docker to run a postgres database.
Use `make db:fix` to wipe the database and start it fresh.
To make a migration you use `npm run db:migrate`.
The migration is deployed to vercel automatically when pushing to main by `vercel-build`.
