import { clerkClient } from "@clerk/nextjs/server";

export const updateClerkHouseholdMetadata = async (
  userId: string,
  householdId: string | null,
) => {
  try {
    await (
      await clerkClient()
    ).users.updateUserMetadata(userId, {
      publicMetadata: { householdId },
    });
  } catch (error) {
    console.error("Failed to update Clerk household metadata", error);
  }
};
