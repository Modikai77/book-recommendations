CREATE TABLE IF NOT EXISTS "ReadBookLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "ratingOutOf10" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReadBookLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReadBookLog_userId_bookId_key" ON "ReadBookLog"("userId", "bookId");
CREATE INDEX IF NOT EXISTS "ReadBookLog_userId_readAt_idx" ON "ReadBookLog"("userId", "readAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReadBookLog_userId_fkey'
  ) THEN
    ALTER TABLE "ReadBookLog"
      ADD CONSTRAINT "ReadBookLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReadBookLog_bookId_fkey'
  ) THEN
    ALTER TABLE "ReadBookLog"
      ADD CONSTRAINT "ReadBookLog_bookId_fkey"
      FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
