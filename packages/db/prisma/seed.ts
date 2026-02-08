import { PrismaClient, type Dinner } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { addDays, startOfWeek, subWeeks } from "date-fns";
import { users, households, tags, dinners } from "./seed.data.ts";
import {
  parityUsers,
  parityHouseholds,
  parityTags,
  parityDinners,
  parityWeekPlans,
} from "./seed.parity.ts";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Check for production environment
  if (process.env.NODE_ENV === "production") {
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

  const seedMode = process.env.SEED_MODE;
  if (seedMode === "parity") {
    await seedParity();
  } else {
    await seedDefault();
  }

  console.log("Seeding completed!");
}

async function seedDefault() {
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

  await Promise.all(
    tags.map((tagValue) =>
      prisma.tag.create({
        data: {
          value: tagValue,
        },
      }),
    ),
  );

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

    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const nextWeekStart = addDays(currentWeekStart, 7);
    const prevWeekStart = subWeeks(currentWeekStart, 1);

    await createRandomWeekPlans(prevWeekStart, createdDinners);
    await createRandomWeekPlans(currentWeekStart, createdDinners);
    await createRandomWeekPlans(nextWeekStart, createdDinners);

    console.log(`Created dinners and plans for household: ${household.name}`);
  }
}

async function seedParity() {
  const createdUsers = await Promise.all(
    parityUsers.map((user) =>
      prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: user,
      }),
    ),
  );

  console.log(
    "Created parity users:",
    createdUsers.map((u) => `${u.firstName} ${u.lastName}`).join(", "),
  );

  const createdHouseholds = await Promise.all(
    parityHouseholds.map(async (household) => {
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
      console.log(`Created parity household: ${created.name}`);
      return created;
    }),
  );

  await Promise.all(
    parityTags.map((tagValue) =>
      prisma.tag.upsert({
        where: { value: tagValue },
        update: {},
        create: {
          value: tagValue,
        },
      }),
    ),
  );

  for (const household of createdHouseholds) {
    const createdDinners = await Promise.all(
      parityDinners.map((dinner) =>
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

    const dinnerByName = new Map(createdDinners.map((dinner) => [dinner.name, dinner]));
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    await createDeterministicWeekPlans(
      subWeeks(currentWeekStart, 1),
      parityWeekPlans.previous,
      dinnerByName,
    );
    await createDeterministicWeekPlans(
      currentWeekStart,
      parityWeekPlans.current,
      dinnerByName,
    );
    await createDeterministicWeekPlans(
      addDays(currentWeekStart, 7),
      parityWeekPlans.next,
      dinnerByName,
    );

    console.log(
      `Created parity dinners and plans for household: ${household.name}`,
    );
  }
}

// Helper function to get random dinner
function getRandomDinner(dinners: Dinner[]): Dinner {
  const dinner = dinners[Math.floor(Math.random() * dinners.length)];
  if (!dinner) {
    throw new Error("No dinner found");
  }
  return dinner;
}

async function createRandomWeekPlans(weekStart: Date, dinners: Dinner[]) {
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

async function createDeterministicWeekPlans(
  weekStart: Date,
  dinnerNames: readonly string[],
  dinnerByName: Map<string, Dinner>,
) {
  for (let i = 0; i < 7; i++) {
    const dinnerName = dinnerNames[i];
    if (!dinnerName) {
      throw new Error(`Missing parity dinner for weekday index ${i}`);
    }

    const dinner = dinnerByName.get(dinnerName);
    if (!dinner) {
      throw new Error(`Parity dinner not found: ${dinnerName}`);
    }

    await prisma.plan.create({
      data: {
        date: addDays(weekStart, i),
        dinnerId: dinner.id,
      },
    });
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
