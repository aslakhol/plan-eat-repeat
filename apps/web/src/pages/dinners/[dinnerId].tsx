import Head from "next/head";
import { DinnerDetail } from "../../views/Dinners/DinnerDetail";

export default function DinnerDetailPage() {
  return (
    <>
      <Head>
        <title>Dinner · PlanEatRepeat</title>
        <meta name="description" content="View and edit a dinner recipe" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <DinnerDetail />
    </>
  );
}
