import Head from "next/head";
import { DinnersView } from "../../views/Dinners/DinnersView";

export default function Home() {
  return (
    <>
      <Head>
        <title>PlanEatRepeat</title>
        <meta name="description" content="The easiest way to plan dinners" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <DinnersView />
    </>
  );
}
