import { SignUp } from "@clerk/nextjs";
import { getAuth } from "@clerk/nextjs/server";
import type { GetServerSideProps } from "next";
import Head from "next/head";

export const getServerSideProps: GetServerSideProps = ({ req }) => {
  if (getAuth(req).userId) {
    return Promise.resolve({
      redirect: { destination: "/", permanent: false },
    });
  }
  return Promise.resolve({ props: {} });
};

export default function Onboarding() {
  return (
    <>
      <Head>
        <title>Get started | Plan Eat Repeat</title>
      </Head>
      <div className="flex min-h-[80vh] items-center justify-center">
        <SignUp
          routing="hash"
          forceRedirectUrl="/"
          signInForceRedirectUrl="/"
        />
      </div>
    </>
  );
}
