import { getDb } from "@planeatrepeat/db";
import { env } from "~/env";

export const db = getDb(env.DATABASE_URL, env.NODE_ENV === "development");
