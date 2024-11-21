import Head from "next/head";
import { InviteView } from "../../views/Invite/InviteView";
import { useRouter } from "next/router";

export default function Invite() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Sulten</title>
        <meta name="description" content="Dinner planning tool" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {router.query.inviteId && (
        <InviteView inviteId={router.query.inviteId as string} />
      )}
    </>
  );
}
