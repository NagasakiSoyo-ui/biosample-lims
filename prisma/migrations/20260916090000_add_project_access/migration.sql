-- Project-level access control. Administrators bypass these grants in the app.
CREATE TABLE "UserProjectAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserProjectAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProjectAccess_userId_projectId_key"
ON "UserProjectAccess"("userId", "projectId");

CREATE INDEX "UserProjectAccess_projectId_idx"
ON "UserProjectAccess"("projectId");

ALTER TABLE "UserProjectAccess"
ADD CONSTRAINT "UserProjectAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserProjectAccess"
ADD CONSTRAINT "UserProjectAccess_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve current behavior for existing ordinary users during rollout.
-- Administrators can narrow these grants immediately from 用户管理.
INSERT INTO "UserProjectAccess" ("id", "userId", "projectId", "createdAt")
SELECT
  'legacy_' || md5(u."id" || ':' || p."id"),
  u."id",
  p."id",
  CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN "Project" p
WHERE u."role" = 'USER';
