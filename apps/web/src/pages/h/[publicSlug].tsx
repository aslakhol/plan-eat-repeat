import Head from "next/head";
import { type GetServerSideProps } from "next";

import { env } from "~/env";
import {
  type PublicDinnerList,
  publicDinnerListUrl,
} from "~/lib/public-dinner-list";
import { type NextPageWithLayout } from "~/pages/_app";
import { db } from "~/server/db";
import { findPublicDinnerList } from "~/server/public-dinner-list";
import { PublicDinnerListUnavailable } from "~/views/PublicDinnerList/PublicDinnerListUnavailable";
import { PublicDinnerListView } from "~/views/PublicDinnerList/PublicDinnerListView";

type Props = { dinnerList: PublicDinnerList | null };

const PublicDinnerListPage: NextPageWithLayout<Props> = ({ dinnerList }) => {
  if (!dinnerList) {
    return (
      <>
        <Head>
          <title>Shared dinners unavailable · Plan Eat Repeat</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <PublicDinnerListUnavailable />
      </>
    );
  }

  const title = `Dinners shared by ${dinnerList.householdName} · Plan Eat Repeat`;
  const description = `Browse dinners shared publicly by ${dinnerList.householdName} on Plan Eat Repeat.`;
  const canonicalUrl = publicDinnerListUrl(
    dinnerList.publicSlug,
    env.NEXT_PUBLIC_APP_URL,
  );

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
      </Head>
      <PublicDinnerListView dinnerList={dinnerList} />
    </>
  );
};

PublicDinnerListPage.getLayout = (page) => page;

export const getServerSideProps = (async ({ params, res }) => {
  const publicSlug = params?.publicSlug;
  if (typeof publicSlug !== "string") return { notFound: true };

  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const dinnerList = await findPublicDinnerList(db, publicSlug);
  if (!dinnerList) res.statusCode = 404;

  return { props: { dinnerList } };
}) satisfies GetServerSideProps<Props>;

export default PublicDinnerListPage;
