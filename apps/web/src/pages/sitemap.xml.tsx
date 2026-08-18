import { type GetServerSideProps } from "next";

import { env } from "~/env";
import { publishedDinnerUrl } from "~/lib/published-dinner";
import { db } from "~/server/db";
import { findPublishedDinnerSitemapSlugs } from "~/server/published-dinner";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const PublishedDinnerSitemap = () => null;

export const getServerSideProps = (async ({ res }) => {
  const publicSlugs = await findPublishedDinnerSitemapSlugs(db);
  const urls = publicSlugs
    .map(
      (publicSlug) =>
        `<url><loc>${escapeXml(
          publishedDinnerUrl(publicSlug, env.NEXT_PUBLIC_APP_URL),
        )}</loc></url>`,
    )
    .join("");
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.write(sitemap);
  res.end();

  return { props: {} };
}) satisfies GetServerSideProps;

export default PublishedDinnerSitemap;
