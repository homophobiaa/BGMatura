BEGIN;

-- CreateEnum
CREATE TYPE "ExamVerification" AS ENUM ('UNVERIFIED', 'CONDITIONAL', 'VERIFIED');

-- CreateEnum
CREATE TYPE "AttemptMode" AS ENUM ('PRACTICE', 'EXAM');

-- CreateEnum
CREATE TYPE "AttemptState" AS ENUM ('ACTIVE', 'SUBMITTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ExamConfiguration" (
    "id" UUID NOT NULL,
    "targetYear" INTEGER NOT NULL,
    "session" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "verification" "ExamVerification" NOT NULL,
    "blueprint" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "classification" "QuestionOrigin" NOT NULL,
    "attribution" TEXT,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "configurationId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "examId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "points" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("examId","questionId")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" UUID NOT NULL,
    "mode" "AttemptMode" NOT NULL,
    "state" "AttemptState" NOT NULL DEFAULT 'ACTIVE',
    "ownerDigest" TEXT NOT NULL,
    "accessUntil" TIMESTAMPTZ(3) NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "deadline" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "topicId" UUID,
    "examId" UUID,
    "configurationId" UUID,
    "title" TEXT NOT NULL,
    "result" JSONB,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptQuestion" (
    "attemptId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "points" DECIMAL(6,2),
    "answer" JSONB,
    "evaluation" JSONB,
    "correct" BOOLEAN,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "savedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AttemptQuestion_pkey" PRIMARY KEY ("attemptId","questionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamConfiguration_targetYear_session_version_key" ON "ExamConfiguration"("targetYear", "session", "version");

-- CreateIndex
CREATE INDEX "Exam_status_createdAt_id_idx" ON "Exam"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ExamQuestion_questionId_idx" ON "ExamQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_position_key" ON "ExamQuestion"("examId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_ownerDigest_key" ON "Attempt"("ownerDigest");

-- CreateIndex
CREATE INDEX "Attempt_accessUntil_idx" ON "Attempt"("accessUntil");

-- CreateIndex
CREATE INDEX "Attempt_examId_idx" ON "Attempt"("examId");

-- CreateIndex
CREATE INDEX "Attempt_configurationId_idx" ON "Attempt"("configurationId");

-- CreateIndex
CREATE INDEX "AttemptQuestion_snapshotId_questionId_idx" ON "AttemptQuestion"("snapshotId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptQuestion_attemptId_position_key" ON "AttemptQuestion"("attemptId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSnapshot_id_questionId_key" ON "QuestionSnapshot"("id", "questionId");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ExamConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ExamConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_snapshotId_questionId_fkey" FOREIGN KEY ("snapshotId", "questionId") REFERENCES "QuestionSnapshot"("id", "questionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExamConfiguration" ADD CONSTRAINT "ExamConfiguration_valid" CHECK (
    "targetYear" BETWEEN 2000 AND 2200 AND "version" > 0
    AND length(trim("session")) > 0 AND jsonb_typeof("blueprint") = 'object'
);
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_position_points" CHECK ("position" >= 0 AND "points" >= 0);
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_owner_time" CHECK (
    "ownerDigest" ~ '^[0-9a-f]{64}$' AND "accessUntil" > "startedAt" AND "position" >= 0
);
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_mode_fields" CHECK (
    ("mode" = 'PRACTICE' AND "topicId" IS NOT NULL AND "examId" IS NULL
     AND "configurationId" IS NULL AND "deadline" IS NULL AND "state" <> 'EXPIRED')
    OR
    ("mode" = 'EXAM' AND "topicId" IS NULL AND "examId" IS NOT NULL
     AND "configurationId" IS NOT NULL AND "deadline" IS NOT NULL
     AND "deadline" > "startedAt" AND "deadline" < "accessUntil")
);
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_state_result" CHECK (
    ("state" = 'ACTIVE' AND "completedAt" IS NULL AND "result" IS NULL)
    OR ("state" <> 'ACTIVE' AND "completedAt" IS NOT NULL AND "completedAt" >= "startedAt"
        AND "result" IS NOT NULL AND jsonb_typeof("result") = 'object')
);
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_response_fields" CHECK (
    "position" >= 0 AND ("points" IS NULL OR "points" >= 0) AND "revision" >= 0
    AND (("revision" = 0 AND "savedAt" IS NULL AND "answer" IS NULL)
         OR ("revision" > 0 AND "savedAt" IS NOT NULL))
    AND ("answer" IS NULL OR jsonb_typeof("answer") = 'object')
    AND ("evaluation" IS NULL OR ("answer" IS NOT NULL AND jsonb_typeof("evaluation") = 'object'))
    AND ("correct" IS NULL OR "evaluation" IS NOT NULL)
);

CREATE FUNCTION public.reject_exam_configuration_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    RAISE EXCEPTION 'Exam configuration versions are immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'ExamConfiguration_immutable';
END;
$$;

CREATE TRIGGER "ExamConfiguration_immutable"
BEFORE UPDATE ON "ExamConfiguration"
FOR EACH ROW EXECUTE FUNCTION public.reject_exam_configuration_change();

COMMIT;
