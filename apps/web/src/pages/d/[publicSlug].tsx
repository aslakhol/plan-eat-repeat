import Head from "next/head";
import { type GetServerSideProps } from "next";

import { type PublishedDinner } from "~/lib/published-dinner";
import { type NextPageWithLayout } from "~/pages/_app";
import { db } from "~/server/db";
import { findPublishedDinner } from "~/server/published-dinner";
import { PublishedDinnerView } from "~/views/PublishedDinner/PublishedDinnerView";

type Props = { dinner: PublishedDinner };

const PublishedDinnerPage: NextPageWithLayout<Props> = ({ dinner }) => (
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

PublishedDinnerPage.getLayout = (page) => page;

export const getServerSideProps = (async ({ params, res }) => {
  const publicSlug = params?.publicSlug;
  if (typeof publicSlug !== "string") return { notFound: true };

  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const dinner = await findPublishedDinner(db, publicSlug);
  if (!dinner) return { notFound: true };

  return { props: { dinner } };
}) satisfies GetServerSideProps<Props>;

export default PublishedDinnerPage;
