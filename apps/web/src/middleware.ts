import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const householdOptionalRoutes = [
  "/invite/:inviteId",
  "/onboarding",
  "/d/:publicSlug",
  "/h/:publicSlug",
  "/sitemap.xml",
];

const isPublicRoute = createRouteMatcher(["/", ...householdOptionalRoutes]);
export default clerkMiddleware(async (auth, req) => {
  const isApiRoute =
    req.nextUrl.pathname.startsWith("/api") ||
    req.nextUrl.pathname.startsWith("/ingest");
  if (isApiRoute) {
    return NextResponse.next();
  }

  const { userId, redirectToSignIn } = await auth();

  // If the user isn't signed in and the route is private, redirect to sign-in
  if (!userId && !isPublicRoute(req)) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // If the user is logged in and the route is protected, let them view.
  if (userId && !isPublicRoute(req)) {
    return NextResponse.next();
  }
});

export const config = {
  matcher: [
    "/(api|trpc)(.*)",
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!api|trpc|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
