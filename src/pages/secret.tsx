import Head from "next/head";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export default function Secret() {
  const [secret, setSecret] = useState("");

  function superSecret() {
    console.log(secret);
    setSecret("");
  }

  return (
    <>
      <Head>
        <title>Sulten</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Input
        type="text"
        placeholder="Enter superdupersecret phrase"
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
      />
      <Button onClick={superSecret}> Save</Button>
    </>
  );
}
