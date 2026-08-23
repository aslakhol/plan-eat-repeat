export const displayPublicUrl = (publicUrl: string) =>
  publicUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
