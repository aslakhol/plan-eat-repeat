import { type OrganizationJSON } from "@clerk/nextjs/dist/types/server";
import { db } from "../db";

export const organizationCreated = async (data: OrganizationJSON) => {
  const household = await db.household.create({
    data: {
      id: data.id,
      name: data.name,
      slug: data.slug,
    },
  });

  return household;
};

export const organizationDeleted = async (id?: string, slug?: string) => {
  if (!id && !slug) {
    throw new Error("No id or slug provided");
  }

  if (id) {
    await db.household.delete({
      where: {
        id,
      },
    });
  }
  if (slug) {
    await db.household.delete({
      where: {
        slug,
      },
    });
  }
};

export const organizationUpdated = async (data: OrganizationJSON) => {
  await db.household.update({
    where: { id: data.id },
    data: { name: data.name, slug: data.slug },
  });
};
