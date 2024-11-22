import Head from "next/head";
import { InviteView } from "../../views/Invite/InviteView";
import { useRouter } from "next/router";

export default function Invite() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>PlanEatRepeat</title>
        <meta name="description" content="The easiest way to plan dinners" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {router.query.inviteId && (
        <InviteView inviteId={router.query.inviteId as string} />
      )}
    </>
  );
}
