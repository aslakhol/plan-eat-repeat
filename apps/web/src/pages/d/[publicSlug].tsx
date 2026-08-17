import Head from "next/head";
import { type GetServerSideProps } from "next";

import { type PublishedDinner } from "~/lib/published-dinner";
import { type NextPageWithLayout } from "~/pages/_app";
import { db } from "~/server/db";
import { findPublishedDinner } from "~/server/published-dinner";
import { PublishedDinnerView } from "~/views/PublishedDinner/PublishedDinnerView";

type Props = { dinner: PublishedDinner | null };

const PublishedDinnerPage: NextPageWithLayout<Props> = ({ dinner }) => {
  if (!dinner) {
    return (
      <>
        <Head>
          <title>Dinner unavailable · Plan Eat Repeat</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <main className="bg-background flex min-h-screen items-center justify-center px-6">
          <div className="max-w-md text-center">
            <p className="text-primary font-serif text-lg">Plan Eat Repeat</p>
            <h1 className="mt-4 font-serif text-3xl font-normal">
              This dinner is no longer shared
            </h1>
            <p className="text-muted-foreground mt-3 text-sm font-semibold">
              Sharing may have been stopped or the Dinner may have been deleted.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{dinner.name} · Plan Eat Repeat</title>
        <meta
          name="description"
          content={`A dinner shared by ${dinner.householdName} on Plan Eat Repeat.`}
        />
      </Head>
      <PublishedDinnerView dinner={dinner} />
    </>
  );
};

PublishedDinnerPage.getLayout = (page) => page;

export const getServerSideProps = (async ({ params, res }) => {
  const publicSlug = params?.publicSlug;
  if (typeof publicSlug !== "string") return { notFound: true };

  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const dinner = await findPublishedDinner(db, publicSlug);
  if (!dinner) {
    res.statusCode = 404;
    return { props: { dinner: null } };
  }

  return { props: { dinner } };
}) satisfies GetServerSideProps<Props>;

export default PublishedDinnerPage;
