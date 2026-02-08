import Head from "next/head";
import { DinnersView } from "~/views/Dinners/DinnersView";

export default function ParityDinnersPage() {
  return (
    <>
      <Head>
        <title>Parity Dinners | PlanEatRepeat</title>
      </Head>
      <DinnersView />
    </>
  );
}
