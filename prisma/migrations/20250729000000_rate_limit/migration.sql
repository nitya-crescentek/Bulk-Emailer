-- Attempt counters for per-IP / per-email limits on sign-in and registration.
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- Lets the sweep in lib/rate-limit.ts find expired windows cheaply.
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");
