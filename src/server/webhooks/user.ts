import { type UserJSON } from "@clerk/nextjs/dist/types/server";
import { db } from "../db";

export const userDeleted = async (id?: string) => {
  if (!id) {
    throw new Error("No id provided");
  }

  return db.user.delete({
    where: {
      id,
    },
  });
};

export const userCreated = async (data: UserJSON) => {
  return upsertUser(data);
};

export const userUpdated = async (data: UserJSON) => {
  return upsertUser(data);
};

const upsertUser = async (data: UserJSON) => {
  const user = await db.user.upsert({
    where: { id: data.id },
    update: { firstName: data.first_name, lastName: data.last_name },
    create: {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
    },
  });
  return user;
};
