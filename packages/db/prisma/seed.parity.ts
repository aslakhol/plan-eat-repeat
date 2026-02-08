import { MembershipRole } from "../generated/prisma/client.ts";

export const PARITY_USER_ID = "parity-user";
export const PARITY_HOUSEHOLD_ID = "parity-household";

export interface ParitySeedUser {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ParitySeedHousehold {
  id: string;
  name: string;
  slug: string;
  members: Array<{
    userId: string;
    role: MembershipRole;
  }>;
}

export interface ParityDinnerSeed {
  name: string;
  notes?: string;
  tags: string[];
}

export const parityUsers: ParitySeedUser[] = [
  {
    id: PARITY_USER_ID,
    firstName: "Parity",
    lastName: "User",
  },
];

export const parityHouseholds: ParitySeedHousehold[] = [
  {
    id: PARITY_HOUSEHOLD_ID,
    name: "Parity Household",
    slug: "parity-household",
    members: [{ userId: PARITY_USER_ID, role: MembershipRole.ADMIN }],
  },
];

export const parityTags = [
  "Quick",
  "Vegetarian",
  "Meat",
  "Pasta",
  "Asian",
  "Healthy",
  "Comfort",
] as const;

export const parityDinners: ParityDinnerSeed[] = [
  {
    name: "Spaghetti Carbonara",
    notes: "Creamy pasta with pancetta and pecorino.",
    tags: ["Pasta", "Quick", "Comfort"],
  },
  {
    name: "Chicken Stir Fry",
    notes: "Chicken with broccoli and peppers in soy sauce.",
    tags: ["Asian", "Meat", "Quick"],
  },
  {
    name: "Mushroom Risotto",
    notes: "Creamy risotto with parmesan and mushrooms.",
    tags: ["Vegetarian", "Comfort"],
  },
  {
    name: "Salmon and Rice",
    notes: "Baked salmon with rice and greens.",
    tags: ["Healthy", "Quick"],
  },
  {
    name: "Veggie Tacos",
    notes: "Black bean tacos with avocado and salsa.",
    tags: ["Vegetarian", "Quick"],
  },
  {
    name: "Thai Green Curry",
    notes: "Coconut curry with vegetables and basil.",
    tags: ["Asian", "Vegetarian"],
  },
  {
    name: "Burger Night",
    notes: "Beef burgers with oven fries.",
    tags: ["Meat", "Comfort"],
  },
  {
    name: "Pasta Primavera",
    notes: "Pasta with seasonal vegetables and lemon.",
    tags: ["Pasta", "Vegetarian", "Healthy"],
  },
];

export const parityWeekPlans = {
  previous: [
    "Chicken Stir Fry",
    "Mushroom Risotto",
    "Salmon and Rice",
    "Veggie Tacos",
    "Thai Green Curry",
    "Burger Night",
    "Pasta Primavera",
  ],
  current: [
    "Spaghetti Carbonara",
    "Chicken Stir Fry",
    "Mushroom Risotto",
    "Salmon and Rice",
    "Veggie Tacos",
    "Thai Green Curry",
    "Burger Night",
  ],
  next: [
    "Pasta Primavera",
    "Spaghetti Carbonara",
    "Chicken Stir Fry",
    "Mushroom Risotto",
    "Salmon and Rice",
    "Veggie Tacos",
    "Thai Green Curry",
  ],
} as const;
