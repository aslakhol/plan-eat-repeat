import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalInstagramMediaUrl,
  canonicalInstagramShareUrl,
  instagramMediaIdFromUrl,
  isInstagramMediaUrl,
  isInstagramShareUrl,
  isYouTubeVideoUrl,
  youtubeVideoIdFromUrl,
} from "./recipeImport";

void test("YouTube media URLs identify supported video forms", () => {
  assert.equal(
    youtubeVideoIdFromUrl("https://www.youtube.com/watch?v=BoFkDmTm2uc"),
    "BoFkDmTm2uc",
  );
  assert.equal(isYouTubeVideoUrl("https://youtu.be/BoFkDmTm2uc"), true);
  assert.equal(isYouTubeVideoUrl("https://youtube.com/@cook"), false);
});

void test("Instagram media URLs identify reels, posts, and IGTV links", () => {
  for (const url of [
    "https://www.instagram.com/reel/C7Example_1/",
    "https://instagram.com/p/C7Example-2?igsh=tracking",
    "https://www.instagram.com/tv/C7Example3/",
  ]) {
    assert.equal(isInstagramMediaUrl(url), true, url);
  }

  assert.equal(
    instagramMediaIdFromUrl(
      "https://www.instagram.com/reel/C7Example_1/?utm_source=share",
    ),
    "C7Example_1",
  );
});

void test("Instagram media URLs accept shared plural reels links", () => {
  const url = "https://www.instagram.com/reels/DOybkebkcaw/";

  assert.equal(instagramMediaIdFromUrl(url), "DOybkebkcaw");
  assert.equal(isInstagramMediaUrl(url), true);
  assert.equal(
    canonicalInstagramMediaUrl(url),
    "https://www.instagram.com/reel/DOybkebkcaw/",
  );
});

void test("Instagram media URLs normalize mobile, owner-qualified, legacy, and embed forms", () => {
  for (const [url, canonical] of [
    [
      "https://m.instagram.com/reel/DOybkebkcaw/?igsh=tracking",
      "https://www.instagram.com/reel/DOybkebkcaw/",
    ],
    [
      "https://www.instagram.com/iankyo/reel/DOybkebkcaw/",
      "https://www.instagram.com/reel/DOybkebkcaw/",
    ],
    [
      "https://www.instagram.com/iankyo/reels/DOybkebkcaw/",
      "https://www.instagram.com/reel/DOybkebkcaw/",
    ],
    [
      "https://instagr.am/p/DOybkebkcaw/",
      "https://www.instagram.com/p/DOybkebkcaw/",
    ],
    [
      "https://www.instagram.com/reel/DOybkebkcaw/embed/",
      "https://www.instagram.com/reel/DOybkebkcaw/",
    ],
    [
      "https://www.instagram.com/reel/DOybkebkcaw/embed/captioned/",
      "https://www.instagram.com/reel/DOybkebkcaw/",
    ],
  ] as const) {
    assert.equal(instagramMediaIdFromUrl(url), "DOybkebkcaw", url);
    assert.equal(canonicalInstagramMediaUrl(url), canonical, url);
    assert.equal(isInstagramMediaUrl(url), true, url);
  }
});

void test("Instagram opaque share links are recognized without treating their token as a media ID", () => {
  for (const [url, canonical] of [
    [
      "https://www.instagram.com/share/reel/_69O6RoGd/?igsh=tracking",
      "https://www.instagram.com/share/reel/_69O6RoGd/",
    ],
    [
      "https://m.instagram.com/share/BA2FWY8aBb/",
      "https://www.instagram.com/share/BA2FWY8aBb/",
    ],
    [
      "https://instagram.com/share/p/BALv9Ep4YH",
      "https://www.instagram.com/share/p/BALv9Ep4YH/",
    ],
  ] as const) {
    assert.equal(isInstagramShareUrl(url), true, url);
    assert.equal(isInstagramMediaUrl(url), true, url);
    assert.equal(instagramMediaIdFromUrl(url), null, url);
    assert.equal(canonicalInstagramMediaUrl(url), null, url);
    assert.equal(canonicalInstagramShareUrl(url), canonical, url);
  }
});

void test("Instagram URL detection rejects profiles and lookalike domains", () => {
  for (const url of [
    "https://www.instagram.com/recipecreator/",
    "https://help.instagram.com/p/C7Example/",
    "https://instagram.example/p/C7Example/",
    "https://www.instagram.com/reels/audio/123/",
    "https://www.instagram.com/share/reel/token/extra/",
    "https://instagr.am/reel/C7Example/",
    "https://ig.me/reel/C7Example/",
  ]) {
    assert.equal(isInstagramMediaUrl(url), false, url);
  }
});
