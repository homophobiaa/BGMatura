BEGIN;

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "Subject" AS ENUM ('BULGARIAN_LANGUAGE', 'LITERATURE');

-- CreateTable
CREATE TABLE "Author" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "context" TEXT,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "parentId" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Author_slug_key" ON "Author"("slug");

-- CreateIndex
CREATE INDEX "Author_status_name_id_idx" ON "Author"("status", "name", "id");

-- CreateIndex
CREATE INDEX "Topic_subject_parentId_position_title_id_idx" ON "Topic"("subject", "parentId", "position", "title", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_id_subject_key" ON "Topic"("id", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_subject_slug_key" ON "Topic"("subject", "slug");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_parentId_subject_fkey" FOREIGN KEY ("parentId", "subject") REFERENCES "Topic"("id", "subject") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- These invariants must also hold for writes made outside Prisma.
ALTER TABLE "Author"
    ADD CONSTRAINT "Author_name_nonblank" CHECK (length(btrim("name")) > 0),
    ADD CONSTRAINT "Author_slug_nonblank" CHECK (length(btrim("slug")) > 0),
    ADD CONSTRAINT "Author_published_context" CHECK (
        "status" <> 'PUBLISHED' OR length(btrim(coalesce("context", ''))) > 0
    );

ALTER TABLE "Topic"
    ADD CONSTRAINT "Topic_title_nonblank" CHECK (length(btrim("title")) > 0),
    ADD CONSTRAINT "Topic_slug_nonblank" CHECK (length(btrim("slug")) > 0),
    ADD CONSTRAINT "Topic_position_nonnegative" CHECK ("position" >= 0),
    ADD CONSTRAINT "Topic_not_own_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id");

CREATE FUNCTION public.enforce_topic_acyclic() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    -- Serialize hierarchy edits for this database. The subsequent query sees
    -- any previously committed edit before accepting a new parent chain.
    PERFORM pg_advisory_xact_lock(hashtext('bgmatura.topic-hierarchy'));

    IF NEW."parentId" IS NOT NULL AND EXISTS (
        WITH RECURSIVE ancestors AS (
            SELECT "id", "parentId" FROM public."Topic" WHERE "id" = NEW."parentId"
            UNION
            SELECT parent."id", parent."parentId"
            FROM public."Topic" AS parent
            JOIN ancestors ON parent."id" = ancestors."parentId"
        )
        SELECT 1 FROM ancestors WHERE "id" = NEW."id"
    ) THEN
        RAISE EXCEPTION 'Topic hierarchy cannot contain cycles'
            USING ERRCODE = '23514', CONSTRAINT = 'Topic_acyclic';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "Topic_acyclic"
BEFORE INSERT OR UPDATE OF "id", "parentId", "subject" ON "Topic"
FOR EACH ROW EXECUTE FUNCTION public.enforce_topic_acyclic();

COMMIT;
