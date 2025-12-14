import { PrismaClient, type Dinner } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { addDays, startOfWeek, subWeeks } from "date-fns";
import { users, households, tags, dinners } from "./seed.data";
import { env } from "../src/env";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Check for production environment
  if (env.NODE_ENV === "production") {
    throw new Error("🚫 Seed script should not be run in production");
  }

  // Check for development database
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl?.includes("supabase")) {
    throw new Error(
      "🚫 Seed script should not be run against production database",
    );
  }

  console.log("🌱 Starting seed script...");

  // Create users
  const createdUsers = await Promise.all(
    users.map((user) =>
      prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: user,
      }),
    ),
  );

  console.log(
    "Created users:",
    createdUsers.map((u) => `${u.firstName} ${u.lastName}`).join(", "),
  );

  // Create households with members
  const createdHouseholds = await Promise.all(
    households.map(async (household) => {
      const created = await prisma.household.create({
        data: {
          id: household.id,
          name: household.name,
          slug: household.slug,
          Members: {
            create: household.members,
          },
        },
      });
      console.log(`Created household: ${created.name}`);
      return created;
    }),
  );

  // Create tags
  await Promise.all(
    tags.map((tagValue) =>
      prisma.tag.create({
        data: {
          value: tagValue,
        },
      }),
    ),
  );

  // Create dinners for each household
  for (const household of createdHouseholds) {
    const createdDinners = await Promise.all(
      dinners.map((dinner) =>
        prisma.dinner.create({
          data: {
            name: dinner.name,
            notes: dinner.notes,
            householdId: household.id,
            tags: {
              connect: dinner.tags.map((tag) => ({ value: tag })),
            },
          },
        }),
      ),
    );

    // Create dinner plans for weeks
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const nextWeekStart = addDays(currentWeekStart, 7);
    const prevWeekStart = subWeeks(currentWeekStart, 1);

    await createWeekPlans(prevWeekStart, createdDinners);
    await createWeekPlans(currentWeekStart, createdDinners);
    await createWeekPlans(nextWeekStart, createdDinners);

    console.log(`Created dinners and plans for household: ${household.name}`);
  }

  console.log("Seeding completed!");
}

// Helper function to get random dinner
function getRandomDinner(dinners: Dinner[]): Dinner {
  const dinner = dinners[Math.floor(Math.random() * dinners.length)];
  if (!dinner) {
    throw new Error("No dinner found");
  }
  return dinner;
}

// Helper function to create week plans
async function createWeekPlans(weekStart: Date, dinners: Dinner[]) {
  for (let i = 0; i < 7; i++) {
    // 80% chance to have a dinner planned
    if (Math.random() < 0.8) {
      const planDate = addDays(weekStart, i);
      await prisma.plan.create({
        data: {
          date: planDate,
          dinnerId: getRandomDinner(dinners).id,
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
