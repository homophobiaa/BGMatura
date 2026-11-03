BEGIN;

-- CreateTable
CREATE TABLE "QuestionSnapshot" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "formatVersion" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionSnapshot_questionId_createdAt_idx" ON "QuestionSnapshot"("questionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSnapshot_questionId_contentHash_key" ON "QuestionSnapshot"("questionId", "contentHash");

-- These invariants must also hold for writes made outside Prisma.
ALTER TABLE "QuestionSnapshot"
    ADD CONSTRAINT "QuestionSnapshot_format_version_positive" CHECK ("formatVersion" >= 1),
    ADD CONSTRAINT "QuestionSnapshot_content_hash_sha256" CHECK ("contentHash" ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "QuestionSnapshot_content_is_object" CHECK (jsonb_typeof("content") = 'object'),
    -- The stored layout version must match the version the content declares about itself.
    ADD CONSTRAINT "QuestionSnapshot_content_format_version" CHECK (
        jsonb_typeof("content" -> 'formatVersion') = 'number'
        AND ("content" ->> 'formatVersion') = "formatVersion"::text
    ),
    -- A snapshot must describe the question it claims to come from.
    ADD CONSTRAINT "QuestionSnapshot_content_matches_question" CHECK (
        ("content" -> 'definition' ->> 'id') = "questionId"::text
    );

-- Snapshots are immutable. Rows can be inserted and, for retention cleanup, deleted, but
-- never changed: a completed result must always be graded and reviewed against the
-- question exactly as the student saw it.
CREATE FUNCTION public.reject_question_snapshot_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    RAISE EXCEPTION 'Question snapshots are immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'QuestionSnapshot_immutable';
END;
$$;

CREATE TRIGGER "QuestionSnapshot_immutable"
BEFORE UPDATE ON "QuestionSnapshot"
FOR EACH ROW EXECUTE FUNCTION public.reject_question_snapshot_change();

COMMIT;
