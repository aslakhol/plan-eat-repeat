import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalInstagramMediaUrl,
  instagramMediaIdFromUrl,
  isInstagramMediaUrl,
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

void test("Instagram URL detection rejects profiles and lookalike domains", () => {
  for (const url of [
    "https://www.instagram.com/recipecreator/",
    "https://help.instagram.com/p/C7Example/",
    "https://instagram.example/p/C7Example/",
    "https://www.instagram.com/reels/audio/123/",
  ]) {
    assert.equal(isInstagramMediaUrl(url), false, url);
  }
});
