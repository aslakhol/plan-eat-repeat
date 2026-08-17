import Head from "next/head";
import { type GetServerSideProps } from "next";

import { env } from "~/env";
import { pickPublishedDinnerUpsell } from "~/lib/published-dinner-upsell";
import {
  type PublishedDinner,
  publishedDinnerUrl,
  serializePublishedDinnerRecipeJsonLd,
} from "~/lib/published-dinner";
import { type NextPageWithLayout } from "~/pages/_app";
import { db } from "~/server/db";
import { findPublishedDinner } from "~/server/published-dinner";
import { PublishedDinnerView } from "~/views/PublishedDinner/PublishedDinnerView";

type Props = {
  dinner: PublishedDinner | null;
  canonicalUrl: string | null;
  upsell: string | null;
};

const PublishedDinnerPage: NextPageWithLayout<Props> = ({
  dinner,
  canonicalUrl,
  upsell,
}) => {
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

  if (!canonicalUrl || !upsell) return null;

  const title = `${dinner.name} · Plan Eat Repeat`;
  const description = `A dinner shared by ${dinner.householdName} on Plan Eat Repeat.`;
  const previewImageUrl = new URL(
    "/published-dinner-preview.png",
    canonicalUrl,
  ).toString();
  const recipeJsonLd = serializePublishedDinnerRecipeJsonLd(dinner);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={previewImageUrl} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content="Plan Eat Repeat — a free cookbook and dinner planner"
        />
        {recipeJsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: recipeJsonLd }}
          />
        )}
      </Head>
      <PublishedDinnerView dinner={dinner} upsell={upsell} />
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
    return { props: { dinner: null, canonicalUrl: null, upsell: null } };
  }

  return {
    props: {
      dinner,
      canonicalUrl: publishedDinnerUrl(
        dinner.publicSlug,
        env.NEXT_PUBLIC_APP_URL,
      ),
      upsell: pickPublishedDinnerUpsell(),
    },
  };
}) satisfies GetServerSideProps<Props>;

export default PublishedDinnerPage;
