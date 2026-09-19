ALTER TABLE "User" ADD COLUMN "welcomeSeenAt" TIMESTAMP(3);

-- Existing users have already started using the app. Only new users see the welcome.
UPDATE "User" SET "welcomeSeenAt" = CURRENT_TIMESTAMP;
