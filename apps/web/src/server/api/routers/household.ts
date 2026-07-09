import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  protectedProcedureWithHousehold,
  publicProcedure,
} from "~/server/api/trpc";
import { addDays } from "date-fns";
import { MembershipRole } from "@planeatrepeat/db";
import { env } from "~/env";
import { clerkClient } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";

const onboardingDinnerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  date: z.date(),
});

const importInstructionsSchema = z
  .string()
  .trim()
  .max(1000, "Import instructions must be at most 1000 characters")
  .nullable()
  .optional();

export const householdRouter = createTRPCRouter({
  household: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.auth.userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    if (!ctx.householdId) {
      if (ctx.auth.sessionClaims?.metadata.householdId) {
        await updateClerkHouseholdMetadata(ctx.auth.userId, null);
      }
      return { household: null };
    }

    const household = await ctx.db.household.findUnique({
      where: { id: ctx.householdId },
      include: { Members: true },
    });

    if (
      ctx.auth.sessionClaims?.metadata.householdId !== (household?.id ?? null)
    ) {
      await updateClerkHouseholdMetadata(
        ctx.auth.userId,
        household?.id ?? null,
      );
    }

    return { household };
  }),
  createHousehold: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        slug: z.string().trim().max(100),
        importInstructions: importInstructionsSchema,
        onboardingDinners: z.array(onboardingDinnerSchema).max(31).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const household = await ctx.db.$transaction(async (tx) => {
        const existingMembership = await tx.membership.findFirst({
          where: { userId: ctx.auth.userId },
        });
        if (existingMembership) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You can only be part of one household",
          });
        }

        const baseSlug = normalizeSlug(input.slug || input.name);
        const slugExists = await tx.household.findUnique({
          where: { slug: baseSlug },
          select: { id: true },
        });
        const slug = slugExists
          ? `${baseSlug}-${randomUUID().slice(0, 8)}`
          : baseSlug;

        return tx.household.create({
          data: {
            name: input.name,
            slug,
            importInstructions:
              input.importInstructions === "" ? null : input.importInstructions,
            Members: {
              create: { userId: ctx.auth.userId, role: "ADMIN" },
            },
            Dinners: {
              create: (input.onboardingDinners ?? []).map((dinnerData) => ({
                name: dinnerData.name,
                Plan: {
                  create: {
                    date: dinnerData.date,
                  },
                },
              })),
            },
          },
          include: { Members: true },
        });
      });

      await updateClerkHouseholdMetadata(ctx.auth.userId, household.id);

      return { household };
    }),
  updateHousehold: protectedProcedureWithHousehold
    .input(
      z.object({
        name: z.string(),
        slug: z.string(),
        importInstructions: importInstructionsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const household = await ctx.db.household.update({
        where: { id: ctx.householdId },
        data: {
          name: input.name,
          slug: input.slug,
          ...(input.importInstructions !== undefined && {
            importInstructions:
              input.importInstructions === "" ? null : input.importInstructions,
          }),
        },
      });

      return { household };
    }),
  members: publicProcedure
    .input(z.object({ householdId: z.string() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.db.membership.findMany({
        where: { householdId: input.householdId },
        include: { user: true },
      });
      return { members };
    }),
  updateMemberRole: protectedProcedureWithHousehold
    .input(
      z.object({
        memberId: z.number(),
        role: z.nativeEnum(MembershipRole),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { memberId, role } = input;

      const admins = await ctx.db.membership.findMany({
        where: { householdId: ctx.householdId, role: "ADMIN" },
      });

      const callerIsAdmin = admins.find((m) => m.userId === ctx.auth.userId);
      if (!callerIsAdmin) {
        throw new Error("Only admins can update member roles");
      }

      const targetIsAdmin = !!admins.find((m) => m.id === memberId);
      if (targetIsAdmin && role !== "ADMIN" && admins.length <= 1) {
        throw new Error("There must be at least one admin");
      }

      const member = await ctx.db.membership.update({
        where: { id: memberId },
        data: { role },
      });
      return { member };
    }),
  getInvite: publicProcedure
    .input(z.object({ inviteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const invite = await ctx.db.invite.findUnique({
        where: { id: input.inviteId, expiresAt: { gt: new Date() } },
        include: {
          household: true,
        },
      });
      return { invite };
    }),
  invites: protectedProcedure
    .input(z.object({ householdId: z.string() }))
    .query(async ({ ctx, input }) => {
      const invites = await ctx.db.invite.findMany({
        where: {
          householdId: input.householdId,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      return {
        invites: invites.map((invite) => ({
          ...invite,
          link: generateInviteLink(invite.id),
        })),
      };
    }),
  createInvite: protectedProcedure
    .input(
      z.object({ householdId: z.string(), duration: z.number().optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      const admins = await ctx.db.membership.findMany({
        where: { householdId: input.householdId, role: "ADMIN" },
      });
      const callerIsAdmin = admins.find((m) => m.userId === ctx.auth.userId);
      if (!callerIsAdmin) {
        throw new Error("Only admins can create invites");
      }

      const invite = await ctx.db.invite.create({
        data: {
          householdId: input.householdId,
          expiresAt: addDays(new Date(), input.duration ?? 30),
        },
      });
      return { invite };
    }),
  manuallyExpireInvite: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.invite.update({
        where: { id: input.inviteId },
        data: { expiresAt: new Date() },
      });
      return { invite };
    }),
  join: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.invite.findUnique({
        where: { id: input.inviteId, expiresAt: { gt: new Date() } },
      });
      if (!invite) {
        throw new Error("Invite not found");
      }

      const existingMembership = await ctx.db.membership.findFirst({
        where: { userId: ctx.auth.userId },
      });
      if (existingMembership) {
        if (existingMembership.householdId === invite.householdId) {
          throw new Error("You are already a member of this household");
        }
        throw new Error("You can only be part of one household");
      }

      const membership = await ctx.db.membership.create({
        data: {
          userId: ctx.auth.userId,
          householdId: invite.householdId,
          role: "MEMBER",
        },
      });

      await updateClerkHouseholdMetadata(
        ctx.auth.userId,
        membership.householdId,
      );

      return { membership };
    }),
  removeMember: protectedProcedure
    .input(z.object({ memberId: z.number(), householdId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { memberId, householdId } = input;
      const admins = await ctx.db.membership.findMany({
        where: { householdId, role: "ADMIN" },
      });
      const callerIsAdmin = admins.find((m) => m.userId === ctx.auth.userId);
      if (!callerIsAdmin) {
        throw new Error("Only an admin can remove members");
      }

      const removedIsAdmin = admins.find((m) => m.id === memberId);
      if (removedIsAdmin && admins.length <= 1) {
        throw new Error("There must be at least one admin");
      }

      const member = await ctx.db.membership.delete({
        where: { id: memberId },
      });

      await updateClerkHouseholdMetadata(member.userId, null);

      return { member };
    }),
});

const generateInviteLink = (inviteId: string) => {
  return `${env.NEXT_PUBLIC_APP_URL}invite/${inviteId}`;
};

const normalizeSlug = (value: string) => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return slug || "household";
};

const updateClerkHouseholdMetadata = async (
  userId: string,
  householdId: string | null,
) => {
  try {
    await (
      await clerkClient()
    ).users.updateUserMetadata(userId, {
      publicMetadata: {
        householdId,
      },
    });
  } catch (error) {
    console.error("Failed to update Clerk household metadata", error);
  }
};
