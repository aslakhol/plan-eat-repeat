import Head from "next/head";
import { WeekView } from "../views/Plan/PlanView";

export default function Home() {
  return (
    <>
      <Head>
        <title>Sulten</title>
        <meta name="description" content="Dinner planning tool" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <WeekView />
    </>
  );
}
