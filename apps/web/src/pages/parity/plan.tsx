import Head from "next/head";
import { PlanView } from "~/views/Plan/PlanView";

export default function ParityPlanPage() {
  return (
    <>
      <Head>
        <title>Parity Plan | PlanEatRepeat</title>
      </Head>
      <PlanView />
    </>
  );
}
