import { type AppType } from "next/app";

import { api } from "~/utils/api";

import "~/styles/globals.css";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { ClerkProvider } from "@clerk/nextjs";

import { env } from "~/env";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { Toaster } from "~/components/ui/toaster";
import { Young_Serif, Quicksand } from "next/font/google";

const youngSerif = Young_Serif({
  subsets: ["latin"],
  variable: "--font-young-serif",
  weight: "400",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
});

import { AppLayout } from "~/components/AppLayout";

if (typeof window !== "undefined") {
  posthog.init(env.NEXT_PUBLIC_POSTHOG_API_KEY, {
    api_host:
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000/ingest"
        : "https://www.planeatrepeat.com/ingest",
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
      <ClerkProvider localization={localization}>
        <main
          className={`${youngSerif.variable} ${quicksand.variable} font-sans`}
        >
          <AppLayout>
            <Component {...pageProps} />
          </AppLayout>
          <Toaster />
        </main>
      </ClerkProvider>
    </PostHogProvider>
  );
};

export default api.withTRPC(MyApp);

// Original translations:
// https://github.com/clerk/javascript/blob/main/packages/localizations/src/en-US.ts
const localization = {
  createOrganization: {
    formButtonSubmit: "Create household",
    title: "Create household",
  },
  organizationList: {
    action__createOrganization: "Create household",
    createOrganization: "Create household",
    titleWithoutPersonal: "Choose an household",
  },
  organizationProfile: {
    createDomainPage: {
      subtitle:
        "Add the domain to verify. Users with email addresses at this domain can join the household automatically or request to join.",
    },

    membersPage: {
      invitationsTab: {
        autoInvitations: {
          headerSubtitle:
            "Invite users by connecting an email domain with your household. Anyone who signs up with a matching email domain will be able to join the household anytime.",
        },
      },
      requestsTab: {
        autoSuggestions: {
          headerSubtitle:
            "Users who sign up with a matching email domain, will be able to see a suggestion to request to join your household.",
        },
      },
    },
    navbar: {
      description: "Manage your household.",
      title: "Household",
    },
    profilePage: {
      dangerSection: {
        deleteOrganization: {
          messageLine1: "Are you sure you want to delete this household?",
          successMessage: "You have deleted the household.",
          title: "Delete household",
        },
        leaveOrganization: {
          messageLine1:
            "Are you sure you want to leave this household? You will lose access to this household.",
          successMessage: "You have left the household.",
          title: "Leave household",
        },
      },
      domainSection: {
        subtitle:
          "Allow users to join the household automatically or request to join based on a verified email domain.",
      },
      successMessage: "The household has been updated.",
    },
    removeDomainPage: {
      messageLine2:
        "Users won’t be able to join the household automatically after this.",
    },
    start: {
      profileSection: {
        title: "Household Profile",
      },
    },
    verifiedDomainPage: {
      enrollmentTab: {
        automaticInvitationOption__description:
          "Users are automatically invited to join the household when they sign-up and can join anytime.",
        automaticSuggestionOption__description:
          "Users receive a suggestion to request to join, but must be approved by an admin before they are able to join the household.",
        manualInvitationOption__description:
          "Users can only be invited manually to the household.",
      },
    },
  },
  organizationSwitcher: {
    action__createOrganization: "Create household",
    notSelected: "No household selected",
  },
  unstable__errors: {
    already_a_member_in_organization:
      "{{email}} is already a member of the household.",
    organization_membership_quota_exceeded:
      "You have reached your limit of household memberships, including outstanding invitations.",
    organization_minimum_permissions_needed:
      "There has to be at least one household member with the minimum required permissions.",
  },
};
