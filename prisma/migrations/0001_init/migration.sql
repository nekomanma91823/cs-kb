-- CreateEnum
CREATE TYPE "public"."LinkType" AS ENUM ('PREREQUISITE', 'DERIVATION', 'APPLICATION');

-- CreateTable
CREATE TABLE "public"."knowledge_entries" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "tags" TEXT[],
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."knowledge_links" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "linkType" "public"."LinkType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_entries_title_key" ON "public"."knowledge_entries"("title");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_links_sourceId_targetId_linkType_key" ON "public"."knowledge_links"("sourceId", "targetId", "linkType");

-- AddForeignKey
ALTER TABLE "public"."knowledge_links" ADD CONSTRAINT "knowledge_links_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."knowledge_links" ADD CONSTRAINT "knowledge_links_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "public"."knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
