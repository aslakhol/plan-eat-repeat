import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  protectedProcedureWithHousehold,
  publicProcedure,
} from "~/server/api/trpc";
import { addDays } from "date-fns";
import { MembershipRole } from "../../../../generated/prisma/client";
import { env } from "~/env";
import { clerkClient } from "@clerk/nextjs/server";

const onboardingDinnerSchema = z.object({
  name: z.string(),
  date: z.date(),
});

export const householdRouter = createTRPCRouter({
  household: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.auth.userId && !ctx.householdId) {
      throw new Error("No user or household id provided");
    }

    if (!ctx.householdId && ctx.auth.userId) {
      const household = await ctx.db.household.findFirst({
        where: { Members: { some: { userId: ctx.auth.userId } } },
      });

      await (
        await clerkClient()
      ).users.updateUserMetadata(ctx.auth.userId, {
        publicMetadata: {
          householdId: household?.id ?? null,
        },
      });

      return { household };
    }

    const household = await ctx.db.household.findUnique({
      where: { id: ctx.householdId },
      include: { Members: true },
    });

    return { household };
  }),
  createHousehold: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        slug: z.string(),
        onboardingDinners: z.array(onboardingDinnerSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existingMembership = await ctx.db.membership.findFirst({
        where: { userId: ctx.auth.userId },
      });
      if (existingMembership) {
        throw new Error("You can only be part of one household");
      }

      const household = await ctx.db.household.create({
        data: {
          name: input.name,
          slug: input.slug,
          Members: { create: { userId: ctx.auth.userId, role: "ADMIN" } },
        },
        include: { Members: true },
      });

      if (input.onboardingDinners) {
        // Create dinners and plans from onboarding data
        for (const dinnerData of input.onboardingDinners) {
          const dinner = await ctx.db.dinner.create({
            data: {
              name: dinnerData.name,
              householdId: household.id,
            },
          });

          await ctx.db.plan.create({
            data: {
              date: dinnerData.date,
              dinnerId: dinner.id,
            },
          });
        }
      }

      await (
        await clerkClient()
      ).users.updateUserMetadata(ctx.auth.userId, {
        publicMetadata: {
          householdId: household.id,
        },
      });

      return { household };
    }),
  updateHousehold: protectedProcedureWithHousehold
    .input(z.object({ name: z.string(), slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { name, slug } = input;
      const household = await ctx.db.household.update({
        where: { id: ctx.householdId },
        data: { name, slug },
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

      await (
        await clerkClient()
      ).users.updateUserMetadata(ctx.auth.userId, {
        publicMetadata: {
          householdId: membership.householdId,
        },
      });

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

      await (
        await clerkClient()
      ).users.updateUserMetadata(member.userId, {
        publicMetadata: {
          householdId: null,
        },
      });

      return { member };
    }),
});

const generateInviteLink = (inviteId: string) => {
  return `${env.NEXT_PUBLIC_APP_URL}invite/${inviteId}`;
};
