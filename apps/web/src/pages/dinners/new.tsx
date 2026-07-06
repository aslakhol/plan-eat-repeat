import Head from "next/head";
import { CreateDinner } from "../../views/Dinners/CreateDinner";

export default function NewDinnerPage() {
  return (
    <>
      <Head>
        <title>New dinner · PlanEatRepeat</title>
        <meta name="description" content="Create a new dinner recipe" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <CreateDinner />
    </>
  );
}
