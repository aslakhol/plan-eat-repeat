import { type UserJSON } from "@clerk/nextjs/dist/types/server";
import { db } from "../db";

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
