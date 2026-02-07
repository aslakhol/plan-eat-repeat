// Re-export types for external packages (like mobile app)
// This file avoids path aliases so it can be imported from outside the web app

export type { AppRouter } from "./root";
export type { RouterInputs, RouterOutputs } from "../../utils/api";
