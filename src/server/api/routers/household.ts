import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { addDays } from "date-fns";
import { MembershipRole } from "@prisma/client";
import { env } from "../../../env.mjs";
import { clerkClient } from "@clerk/nextjs/server";

export const householdRouter = createTRPCRouter({
  household: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const household = await ctx.db.household.findUnique({
        where: { id: input.id },
        include: { Members: true },
      });

      return { household };
    }),
  householdsForUser: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.auth.userId) {
      return { households: [] };
    }

    const households = await ctx.db.household.findMany({
      where: { Members: { some: { userId: ctx.auth.userId } } },
    });
    return { households };
  }),
  createHousehold: protectedProcedure
    .input(z.object({ name: z.string(), slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const household = await ctx.db.household.create({
        data: {
          name: input.name,
          slug: input.slug,
          Members: { create: { userId: ctx.auth.userId, role: "ADMIN" } },
        },
        include: { Members: true },
      });

      void (await clerkClient()).users.updateUserMetadata(ctx.auth.userId, {
        publicMetadata: {
          householdId: household.id,
        },
      });

      return { household };
    }),
  updateHousehold: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string(), slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, name, slug } = input;
      const household = await ctx.db.household.update({
        where: { id },
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
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        memberId: z.number(),
        role: z.nativeEnum(MembershipRole),
        householdId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { memberId, role, householdId } = input;

      const admins = await ctx.db.membership.findMany({
        where: { householdId, role: "ADMIN" },
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

      const membership = await ctx.db.membership.create({
        data: {
          userId: ctx.auth.userId,
          householdId: invite.householdId,
          role: "MEMBER",
        },
      });

      void (await clerkClient()).users.updateUserMetadata(ctx.auth.userId, {
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
      return { member };
    }),
});

const generateInviteLink = (inviteId: string) => {
  return `${env.NEXT_PUBLIC_APP_URL}invite/${inviteId}`;
};
