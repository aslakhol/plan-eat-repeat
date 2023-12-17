# Sulten

This is an app for planning dinners for Madeleine and Aslak.
At it's core it solves two problems:

1. What dinners can we make?
2. What did we plan to make on what day?

Number 2 is pretty straight forward, we just record what dinner whas planned for what day and that's that.
For number 1 we are specifically interested in having a list of dinners that we like to make as an inspiration when we make our dinner plans.
We are not trying to solve the issues of figuring out what can be created with our current ingredients, and we are not making a recipe list (at least yet).

## Hosting

The web app is hosted on [Vercel](https://vercel.com/) at [sulten.aslak.io](https://sulten.aslak.io/)

## Technology

The project was Bootstrapped with [create-t3-app](https://create.t3.gg/).

- [React](https://react.dev/)
- [Next.js](https://nextjs.org)
- [Prisma](https://prisma.io)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)
- [shadcn/ui](https://ui.shadcn.com/)

## Future ideas

For now most of the effort has been put into the planning of the dinners, and we want to put more love into the dinner list section.
We know we want tags that help us deciding what to eat.
F.ex. You could filter by the `Chicken` tag if you would like something with chicken.
And of course we will implement a simple string search.

It might be interesting to expand the scope to make a simple recipe bank in the app, but we will focus on making it lightweight and usuable.
Likely it won't grow beyond a single text field where you copy-paste in text, and perhaps a link to an external website.

We are interested in using this to prepare shopping lists by integrating with [Bring](https://www.getbring.com/), the app we use for shopping lists.
Our thinking is that if it is possible we would like to hit some API that adds products to our list.
Bring makes it very easy to remove products from the shopping list, so the thinking is that we could add all the products very quickly, and then remove what we already have.
For the first version we likely will use the tags as the products, but it might also be a list of ingredients from a future recipe function.
All this of course relies on us being able to integrate with Bring in some way.

We have also discussed using LLMs to help suggest tags or ingredients based on the title and description.
But that feels very far down the road.
