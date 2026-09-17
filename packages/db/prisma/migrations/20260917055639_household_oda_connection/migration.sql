-- CreateTable
CREATE TABLE "OdaConnection" (
    "householdId" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "reconnectRequired" BOOLEAN NOT NULL DEFAULT false,
    "revision" TEXT NOT NULL,

    CONSTRAINT "OdaConnection_pkey" PRIMARY KEY ("householdId")
);

-- CreateTable
CREATE TABLE "OdaAuthorization" (
    "state" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OdaAuthorization_pkey" PRIMARY KEY ("state")
);

-- CreateIndex
CREATE INDEX "OdaAuthorization_householdId_idx" ON "OdaAuthorization"("householdId");

-- AddForeignKey
ALTER TABLE "OdaConnection" ADD CONSTRAINT "OdaConnection_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdaAuthorization" ADD CONSTRAINT "OdaAuthorization_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
