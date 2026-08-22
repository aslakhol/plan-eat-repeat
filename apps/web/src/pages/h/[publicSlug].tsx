import Head from "next/head";
import { type GetServerSideProps } from "next";

import { type PublicDinnerList } from "~/lib/public-dinner-list";
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

  return (
    <>
      <Head>
        <title>{`${dinnerList.householdName} · Plan Eat Repeat`}</title>
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
