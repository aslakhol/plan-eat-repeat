import {
  type UserJSON,
  type OrganizationJSON,
} from "@clerk/nextjs/dist/types/server";
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

export const userCreated = async (data: UserJSON) => {
  const user = await db.user.create({
    data: {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
    },
  });

  return user;
};

export const userDeleted = async (id?: string) => {
  if (!id) {
    throw new Error("No id provided");
  }

  await db.user.delete({
    where: {
      id,
    },
  });
};

export const userUpdated = async (data: UserJSON) => {
  await db.user.update({
    where: { id: data.id },
    data: { firstName: data.first_name, lastName: data.last_name },
  });
};
