export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      householdId?: string;
    };
  }
  interface UserPublicMetadata {
    householdId?: string | null;
  }
}
