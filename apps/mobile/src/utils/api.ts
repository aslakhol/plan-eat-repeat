import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@planeatrepeat/web/trpc";

export const api = createTRPCReact<AppRouter>();

export type { AppRouter };
