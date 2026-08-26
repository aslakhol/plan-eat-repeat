import assert from "node:assert/strict";
import { test } from "node:test";

import { parseJson3Transcript } from "./youtube-po-token";

void test("JSON3 captions are converted to transcript segments", () => {
  const segments = parseJson3Transcript(
    JSON.stringify({
      events: [
        {
          tStartMs: 1_250,
          dDurationMs: 2_500,
          segs: [{ utf8: "Whisk " }, { utf8: "the\ncream" }],
        },
        { tStartMs: 3_750 },
      ],
    }),
    "en",
  );

  assert.deepEqual(segments, [
    {
      text: "Whisk the cream",
      duration: 2.5,
      offset: 1.25,
      lang: "en",
    },
  ]);
});
