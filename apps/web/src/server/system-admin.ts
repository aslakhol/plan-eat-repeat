export type DeploymentEnvironment =
  | "Production"
  | "Preview"
  | "Development";

export const parseSystemAdminUserIds = (configuredUserIds?: string | null) =>
  new Set(
    (configuredUserIds ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );

export const isSystemAdminUser = (
  userId: string | null | undefined,
  configuredUserIds: ReadonlySet<string>,
) => Boolean(userId && configuredUserIds.has(userId));

export const getDeploymentEnvironment = (
  vercelEnvironment = process.env.VERCEL_ENV,
  nodeEnvironment = process.env.NODE_ENV,
): DeploymentEnvironment => {
  if (vercelEnvironment === "production") return "Production";
  if (vercelEnvironment === "preview") return "Preview";
  if (vercelEnvironment === "development") return "Development";
  return nodeEnvironment === "production" ? "Production" : "Development";
};
