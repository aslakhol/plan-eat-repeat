import Head from "next/head";

import { SharedDinnersView } from "~/views/Dinners/SharedDinnersView";

export default function SharedDinnersPage() {
  return (
    <>
      <Head>
        <title>Shared dinners · PlanEatRepeat</title>
        <meta
          name="description"
          content="Manage the dinners your household shares publicly"
        />
      </Head>
      <SharedDinnersView />
    </>
  );
}
