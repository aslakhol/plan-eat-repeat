export const publicSlugForName = (
  name: string,
  publicId: string,
  fallbackName: string,
) => {
  const readableName = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return `${readableName || fallbackName}-${publicId}`;
};
