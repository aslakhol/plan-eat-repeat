import {
  MAX_RECIPE_IMPORT_IMAGE_DATA_LENGTH,
  MAX_RECIPE_IMPORT_IMAGES,
} from "@planeatrepeat/shared";

export type PreparedPhoto = {
  previewUrl: string;
  data: string;
  mimeType: "image/jpeg";
};

export const PHOTO_LIMIT_MESSAGE = `You can import up to ${MAX_RECIPE_IMPORT_IMAGES} photos. Remove one to add another.`;
export const PHOTO_SIZE_MESSAGE =
  "These photos are too large together. Remove a photo or retake them a little farther away.";

const PHOTO_LONGEST_EDGE = 1_800;
const PHOTO_COMPRESSION = 0.7;

const base64FromBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(blob);
  });

// Always re-encode to JPEG so the server only sees a validated mime type, and
// downscale so an ordered set of pages stays below the request body limit.
export const preparePhotoFile = async (file: File): Promise<PreparedPhoto> => {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      `Your browser can't read ${file.name}. Choose a JPEG or PNG instead.`,
    );
  }

  try {
    const scale = Math.min(
      1,
      PHOTO_LONGEST_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare that photo.");

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", PHOTO_COMPRESSION),
    );
    if (!blob) throw new Error("Could not prepare that photo.");

    const data = await base64FromBlob(blob);
    return {
      previewUrl: `data:image/jpeg;base64,${data}`,
      data,
      mimeType: "image/jpeg",
    };
  } finally {
    bitmap.close();
  }
};

export const appendPreparedPhotos = async (
  current: PreparedPhoto[],
  files: File[],
  prepare: (file: File) => Promise<PreparedPhoto> = preparePhotoFile,
): Promise<{ photos: PreparedPhoto[]; notice: string | null }> => {
  const availableSlots = MAX_RECIPE_IMPORT_IMAGES - current.length;
  if (availableSlots <= 0) {
    return { photos: current, notice: PHOTO_LIMIT_MESSAGE };
  }

  const acceptedFiles = files.slice(0, availableSlots);
  const prepared = await Promise.all(acceptedFiles.map(prepare));
  const photos = [...current, ...prepared];
  const totalDataLength = photos.reduce(
    (total, photo) => total + photo.data.length,
    0,
  );

  if (totalDataLength > MAX_RECIPE_IMPORT_IMAGE_DATA_LENGTH) {
    return { photos: current, notice: PHOTO_SIZE_MESSAGE };
  }

  return {
    photos,
    notice: files.length > availableSlots ? PHOTO_LIMIT_MESSAGE : null,
  };
};
