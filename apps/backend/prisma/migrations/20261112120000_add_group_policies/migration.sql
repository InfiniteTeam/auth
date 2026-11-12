CREATE TABLE "GroupPolicy" (
    "groupId" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "permissions" TEXT NOT NULL DEFAULT '0',

    CONSTRAINT "GroupPolicy_pkey" PRIMARY KEY ("groupId")
);
