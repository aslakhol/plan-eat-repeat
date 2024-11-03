import { type AppType } from "next/app";

import { api } from "~/utils/api";

import "~/styles/globals.css";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { ClerkProvider } from "@clerk/nextjs";

import { env } from "../env.mjs";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { Toaster } from "~/components/ui/toaster";

if (typeof window !== "undefined") {
  posthog.init(env.NEXT_PUBLIC_POSTHOG_API_KEY, {
    api_host:
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000/ingest"
        : "https://sulten.aslak.io/ingest",
    loaded: (posthog) => {
      if (process.env.NODE_ENV === "development") posthog.debug();
    },
    autocapture: false,
  });
}

const MyApp: AppType = ({ Component, pageProps }) => {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = () => posthog?.capture("$pageview");
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  return (
    <PostHogProvider client={posthog}>
      <ClerkProvider>
        <Component {...pageProps} />
        <Toaster />
      </ClerkProvider>
    </PostHogProvider>
  );
};

export default api.withTRPC(MyApp);
