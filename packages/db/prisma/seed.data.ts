import { MembershipRole } from "../generated/prisma/client";

export interface SeedUser {
  id: string;
  firstName: string;
  lastName: string;
  imageUrl?: string;
}

export interface SeedHousehold {
  id: string;
  name: string;
  slug: string;
  members: Array<{
    userId: string;
    role: MembershipRole;
  }>;
}

export const tags = [
  "Quick",
  "Vegetarian",
  "Vegan",
  "Fish",
  "Meat",
  "Pasta",
  "Asian",
  "Italian",
  "Mexican",
  "Healthy",
  "Comfort",
] as const;

export interface DinnerSeed {
  name: string;
  notes?: string;
  tags: (typeof tags)[number][];
  recipe?: {
    servings: number;
    parts: Array<{
      name: string | null;
      ingredients: Array<{
        name: string;
        amount: number | null;
        unit: string | null;
        note: string | null;
      }>;
      steps: string[];
    }>;
  };
}

const aslakUserId = "user_2oya1ep0X6tYxTRBudLctRCXs4k";
const madeleineUserId = "seed-user-madeleine";
export const users: SeedUser[] = [
  {
    id: aslakUserId,
    firstName: "Aslak",
    lastName: "Hollund",
  },
  {
    id: madeleineUserId,
    firstName: "Madeleine",
    lastName: "Lorås",
  },
];

const jb72HouseholdId = "cm3t7szc600005jc3ebtb4v5d";
export const households: SeedHousehold[] = [
  {
    id: jb72HouseholdId,
    name: "JB72",
    slug: "jb72",
    members: [
      {
        userId: aslakUserId,
        role: MembershipRole.ADMIN,
      },
      { userId: madeleineUserId, role: MembershipRole.ADMIN },
    ],
  },
];

export const dinners: DinnerSeed[] = [
  {
    name: "Spaghetti Carbonara",
    notes:
      "Boil pasta. Meanwhile, fry pancetta. Mix eggs, pecorino and lots of black pepper in a bowl. When pasta is done, reserve some water and drain. Mix hot pasta with pancetta, then quickly stir in egg mixture off the heat. Add pasta water if needed. More pepper!",
    tags: ["Pasta", "Italian", "Quick", "Comfort"],
    recipe: {
      servings: 4,
      parts: [
        {
          name: null,
          ingredients: [
            { name: "spaghetti", amount: 400, unit: "g", note: null },
            { name: "pancetta", amount: 150, unit: "g", note: "diced" },
            { name: "eggs", amount: 4, unit: "pcs", note: null },
            { name: "pecorino", amount: 100, unit: "g", note: "finely grated" },
            {
              name: "black pepper",
              amount: null,
              unit: null,
              note: "freshly ground",
            },
          ],
          steps: [
            "Boil the spaghetti in well-salted water until al dente.",
            "Fry the pancetta until crisp while the pasta cooks.",
            "Whisk the eggs, pecorino, and plenty of black pepper together.",
            "Toss the drained pasta with pancetta, remove from the heat, and stir in the egg mixture with a splash of pasta water.",
          ],
        },
      ],
    },
  },
  {
    name: "Grilled Salmon",
    notes:
      "Marinate salmon in soy, mirin and ginger if you have time. Heat oven to 200C. Put salmon on a bed of sliced lemon. 12-15 min in oven. Steam broccoli and make rice. Finish with sesame seeds and spring onions.",
    tags: ["Fish", "Healthy", "Quick"],
  },
  {
    name: "Vegetable Stir Fry",
    notes:
      "Prep all veg first! Heat wok until smoking. Fry tofu until golden, set aside. Stir fry harder veg first (carrots, broccoli), then softer ones. Add noodles, sauce (soy, oyster, mirin), tofu back in. Finish with sesame oil.",
    tags: ["Vegetarian", "Vegan", "Asian", "Healthy", "Quick"],
  },
  {
    name: "Taco Tuesday Special",
    notes:
      "Brown mince with onion and garlic. Add spices (cumin, paprika, chili, oregano). Add tomato paste and stock, simmer. Warm tortillas. Prep toppings: lettuce, tomato, cheese, sour cream, lime, coriander. Don't forget hot sauce!",
    tags: ["Mexican", "Meat", "Quick"],
  },
  {
    name: "Chicken Curry",
    notes:
      "Fry onion, garlic, ginger, curry paste. Add chicken and brown. Chuck in potatoes if using. Add coconut milk and stock, simmer until chicken is done. Can add frozen peas at the end. Serve with rice and naan.",
    tags: ["Asian", "Meat", "Comfort"],
    recipe: {
      servings: 4,
      parts: [
        {
          name: "Marinade",
          ingredients: [
            {
              name: "chicken thighs",
              amount: 600,
              unit: "g",
              note: "cut into pieces",
            },
            { name: "yoghurt", amount: 2, unit: "tbsp", note: null },
            { name: "curry powder", amount: 2, unit: "tsp", note: null },
          ],
          steps: [
            "Mix the chicken with yoghurt and curry powder.",
            "Leave to marinate while preparing the sauce.",
          ],
        },
        {
          name: "Sauce",
          ingredients: [
            { name: "onion", amount: 1, unit: "pcs", note: "finely chopped" },
            { name: "garlic", amount: 3, unit: "pcs", note: "minced" },
            { name: "ginger", amount: 1, unit: "tbsp", note: "grated" },
            { name: "coconut milk", amount: 400, unit: "ml", note: null },
          ],
          steps: [
            "Soften the onion, garlic, and ginger.",
            "Add the coconut milk and simmer until slightly thickened.",
          ],
        },
        {
          name: null,
          ingredients: [
            { name: "rice", amount: 300, unit: "g", note: null },
            { name: "frozen peas", amount: 150, unit: "g", note: null },
            { name: "coriander", amount: null, unit: null, note: "to serve" },
          ],
          steps: [
            "Brown the marinated chicken, then add it to the sauce and cook through.",
            "Stir in the peas for the final few minutes and serve with rice and coriander.",
          ],
        },
      ],
    },
  },
  {
    name: "Mushroom Risotto",
    notes:
      "Soak porcini mushrooms. Fry fresh mushrooms until really brown. Set aside. Soften onion in butter, add rice, wine. Add hot stock ladle by ladle, stirring. When almost done, add mushrooms back, porcini liquid, parmesan, butter. Rest 5 min before serving!",
    tags: ["Vegetarian", "Italian", "Comfort"],
  },
  {
    name: "Pizza Margherita",
    notes:
      "If using dough from fridge, take it out 2h before. Heat oven to max with pizza stone. Stretch dough (don't use rolling pin!). Top with crushed tomatoes, torn mozzarella, basil. Bake until spotty brown. Olive oil after!",
    tags: ["Vegetarian", "Italian", "Comfort"],
  },
  {
    name: "Thai Green Curry",
    notes:
      "Fry curry paste in coconut cream until fragrant. Add chicken/tofu, rest of coconut milk, fish sauce, palm sugar. Add veg based on cooking time (aubergine→bamboo shoots→snap peas). Finish with thai basil. Serve with rice.",
    tags: ["Asian", "Vegetarian", "Healthy"],
  },
  {
    name: "Beef Burger",
    notes:
      "Mix mince with salt, shape patties (make dimple in middle). Get pan smoking hot. 3-4 min each side for medium. Add cheese last minute. Toast buns. Layer: mayo, lettuce, tomato, patty, onion, pickles. Whatever sauce you like.",
    tags: ["Meat", "Comfort", "Quick"],
  },
  {
    name: "Vegetable Lasagna",
    notes:
      "Roast vegetables (aubergine, zucchini, peppers) with olive oil. Make white sauce (butter, flour, milk). Layer: tomato sauce, pasta, roasted veg, white sauce, cheese. Repeat. Extra cheese on top. 180C for 45min. Rest before cutting!",
    tags: ["Vegetarian", "Italian", "Pasta"],
  },
  {
    name: "Fish and Chips",
    notes: "Classic battered fish with crispy fries",
    tags: ["Fish", "Comfort"],
  },
  {
    name: "Pad Thai",
    notes: "Thai rice noodles with tofu and peanuts",
    tags: ["Asian", "Vegetarian", "Quick"],
  },
  {
    name: "Caesar Salad",
    notes: "Classic salad with homemade dressing",
    tags: ["Quick", "Healthy"],
  },
  {
    name: "Butter Chicken",
    notes: "Creamy Indian curry with tender chicken",
    tags: ["Asian", "Meat", "Comfort"],
  },
  {
    name: "Veggie Buddha Bowl",
    notes: "Nutritious bowl with quinoa and roasted vegetables",
    tags: ["Vegan", "Healthy", "Vegetarian"],
  },
  {
    name: "Shrimp Scampi",
    notes: "Garlic butter shrimp with pasta",
    tags: ["Fish", "Pasta", "Italian", "Quick"],
  },
  {
    name: "Beef Stir Fry",
    notes: "Quick beef and vegetable stir fry",
    tags: ["Meat", "Asian", "Quick"],
  },
  {
    name: "Eggplant Parmesan",
    notes: "Breaded eggplant with tomato sauce and cheese",
    tags: ["Vegetarian", "Italian", "Comfort"],
  },
  {
    name: "Teriyaki Chicken",
    notes: "Sweet and savory chicken with rice",
    tags: ["Asian", "Meat", "Quick"],
  },
  {
    name: "Mediterranean Quinoa Bowl",
    notes: "Healthy bowl with quinoa, feta, and vegetables",
    tags: ["Vegetarian", "Healthy", "Quick"],
  },
];
