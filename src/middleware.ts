import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/", "/invite/*"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims, redirectToSignIn } = await auth();

  const isApiRoute =
    req.nextUrl.pathname.startsWith("/api") ||
    req.nextUrl.pathname.startsWith("/ingest");
  if (isApiRoute) {
    return NextResponse.next();
  }

  // If the user isn't signed in and the route is private, redirect to sign-in
  if (!userId && !isPublicRoute(req)) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // Catch users who do not have `householdId` in their publicMetadata
  // Redirect them to the /settings/household route to create a household
  if (
    userId &&
    !sessionClaims?.metadata?.householdId &&
    !req.nextUrl.pathname.includes("/settings")
  ) {
    const onboardingUrl = new URL("/settings/household", req.url);
    return NextResponse.redirect(onboardingUrl);
  }

  // If the user is logged in and the route is protected, let them view.
  if (userId && !isPublicRoute(req)) {
    return NextResponse.next();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    "/",
  ],
};
