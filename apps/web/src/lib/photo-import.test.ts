import assert from "node:assert/strict";
import test from "node:test";

import {
  appendPreparedPhotos,
  PHOTO_LIMIT_MESSAGE,
  PHOTO_SIZE_MESSAGE,
  type PreparedPhoto,
} from "./photo-import";

const preparedPhoto = (id: string, dataLength = 4): PreparedPhoto => ({
  previewUrl: `data:image/jpeg;base64,${id}`,
  data: id.padEnd(dataLength, "x"),
  mimeType: "image/jpeg",
});

void test("photo preparation preserves selection order and caps imports at four", async () => {
  const selected = ["page-2", "page-3", "page-4", "page-5"].map(
    (name) => new File([], name),
  );
  const result = await appendPreparedPhotos(
    [preparedPhoto("page-1")],
    selected,
    (file) => Promise.resolve(preparedPhoto(file.name)),
  );

  assert.deepEqual(
    result.photos.map((photo) => photo.previewUrl),
    [
      "data:image/jpeg;base64,page-1",
      "data:image/jpeg;base64,page-2",
      "data:image/jpeg;base64,page-3",
      "data:image/jpeg;base64,page-4",
    ],
  );
  assert.equal(result.notice, PHOTO_LIMIT_MESSAGE);
});

void test("oversized prepared photos leave the existing selection intact", async () => {
  const existing = [preparedPhoto("page-1")];
  const result = await appendPreparedPhotos(
    existing,
    [new File([], "page-2")],
    (file) => Promise.resolve(preparedPhoto(file.name, 4_000_001)),
  );

  assert.deepEqual(result.photos, existing);
  assert.equal(result.notice, PHOTO_SIZE_MESSAGE);
});

void test("a recoverable processing failure leaves the existing selection available", async () => {
  const existing = [preparedPhoto("page-1")];

  await assert.rejects(
    appendPreparedPhotos(existing, [new File([], "bad-page")], () =>
      Promise.reject(new Error("Could not read that photo.")),
    ),
    /Could not read that photo/,
  );
  assert.equal(existing.length, 1);
});
