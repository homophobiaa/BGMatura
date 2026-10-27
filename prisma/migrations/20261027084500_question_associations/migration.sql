BEGIN;

-- CreateEnum
CREATE TYPE "QuestionOrigin" AS ENUM ('ORIGINAL', 'ADAPTED', 'OFFICIAL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('UNREVIEWED', 'REVIEWED');

-- CreateTable
CREATE TABLE "QuestionTopic" (
    "questionId" UUID NOT NULL,
    "topicId" UUID NOT NULL,
    "subject" "Subject" NOT NULL,

    CONSTRAINT "QuestionTopic_pkey" PRIMARY KEY ("questionId","topicId")
);

-- CreateTable
CREATE TABLE "QuestionWork" (
    "questionId" UUID NOT NULL,
    "workId" UUID NOT NULL,
    "subject" "Subject" NOT NULL DEFAULT 'LITERATURE',

    CONSTRAINT "QuestionWork_pkey" PRIMARY KEY ("questionId","workId")
);

-- CreateTable
CREATE TABLE "QuestionProvenance" (
    "questionId" UUID NOT NULL,
    "origin" "QuestionOrigin" NOT NULL,
    "attribution" TEXT,
    "sourceReference" TEXT,
    "editorName" TEXT,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "QuestionProvenance_pkey" PRIMARY KEY ("questionId")
);

-- CreateIndex
CREATE INDEX "QuestionTopic_topicId_questionId_idx" ON "QuestionTopic"("topicId", "questionId");

-- CreateIndex
CREATE INDEX "QuestionWork_workId_questionId_idx" ON "QuestionWork"("workId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_id_subject_key" ON "Question"("id", "subject");

-- AddForeignKey
ALTER TABLE "QuestionTopic" ADD CONSTRAINT "QuestionTopic_questionId_subject_fkey" FOREIGN KEY ("questionId", "subject") REFERENCES "Question"("id", "subject") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionTopic" ADD CONSTRAINT "QuestionTopic_topicId_subject_fkey" FOREIGN KEY ("topicId", "subject") REFERENCES "Topic"("id", "subject") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionWork" ADD CONSTRAINT "QuestionWork_questionId_subject_fkey" FOREIGN KEY ("questionId", "subject") REFERENCES "Question"("id", "subject") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionWork" ADD CONSTRAINT "QuestionWork_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionProvenance" ADD CONSTRAINT "QuestionProvenance_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- These invariants must also hold for writes made outside Prisma.
-- Work links exist for literature only. With the composite foreign key to
-- Question(id, subject), a work can be linked only to a literature question.
ALTER TABLE "QuestionWork"
    ADD CONSTRAINT "QuestionWork_literature_only" CHECK ("subject" = 'LITERATURE');

-- Optional text is either absent or contains a visible character (this also rejects
-- tabs and line breaks, which btrim would not).
ALTER TABLE "QuestionProvenance"
    ADD CONSTRAINT "QuestionProvenance_attribution_nonblank" CHECK ("attribution" IS NULL OR "attribution" ~ '\S'),
    ADD CONSTRAINT "QuestionProvenance_source_reference_nonblank" CHECK ("sourceReference" IS NULL OR "sourceReference" ~ '\S'),
    ADD CONSTRAINT "QuestionProvenance_editor_name_nonblank" CHECK ("editorName" IS NULL OR "editorName" ~ '\S'),
    ADD CONSTRAINT "QuestionProvenance_reviewed_by_nonblank" CHECK ("reviewedBy" IS NULL OR "reviewedBy" ~ '\S'),
    ADD CONSTRAINT "QuestionProvenance_review_notes_nonblank" CHECK ("reviewNotes" IS NULL OR "reviewNotes" ~ '\S'),
    -- A review is either complete (who and when) or absent; notes may exist either way.
    ADD CONSTRAINT "QuestionProvenance_review_state" CHECK (
        ("reviewStatus" = 'REVIEWED' AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL)
        OR ("reviewStatus" = 'UNREVIEWED' AND "reviewedBy" IS NULL AND "reviewedAt" IS NULL)
    ),
    -- Adapted and official material must credit its source before it can count as reviewed.
    ADD CONSTRAINT "QuestionProvenance_reviewed_needs_attribution" CHECK (
        "reviewStatus" <> 'REVIEWED' OR "origin" = 'ORIGINAL' OR "attribution" IS NOT NULL
    );

COMMIT;
