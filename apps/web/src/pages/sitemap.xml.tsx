import { type GetServerSideProps } from "next";

import { env } from "~/env";
import { publicDinnerListUrl } from "~/lib/public-dinner-list";
import { publishedDinnerUrl } from "~/lib/published-dinner";
import { db } from "~/server/db";
import { findPublicDinnerListSitemapSlugs } from "~/server/public-dinner-list";
import { findPublishedDinnerSitemapSlugs } from "~/server/published-dinner";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const Sitemap = () => null;

export const getServerSideProps = (async ({ res }) => {
  const [publishedDinnerSlugs, publicDinnerListSlugs] = await Promise.all([
    findPublishedDinnerSitemapSlugs(db),
    findPublicDinnerListSitemapSlugs(db),
  ]);
  const publicUrls = [
    ...publishedDinnerSlugs.map((publicSlug) =>
      publishedDinnerUrl(publicSlug, env.NEXT_PUBLIC_APP_URL),
    ),
    ...publicDinnerListSlugs.map((publicSlug) =>
      publicDinnerListUrl(publicSlug, env.NEXT_PUBLIC_APP_URL),
    ),
  ];
  const urls = publicUrls
    .map((publicUrl) => `<url><loc>${escapeXml(publicUrl)}</loc></url>`)
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

export default Sitemap;
