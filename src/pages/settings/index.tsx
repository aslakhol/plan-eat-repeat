import Head from "next/head";
import { SettingsView } from "../../views/Settings/SettingsView";

export default function Settings() {
  return (
    <>
      <Head>
        <title>PlanEatRepeat</title>
        <meta name="description" content="The easiest way to plan dinners" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <SettingsView />
    </>
  );
}
