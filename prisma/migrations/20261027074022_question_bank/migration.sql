BEGIN;

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'SHORT_RESPONSE', 'EXTENDED_RESPONSE', 'ARGUMENTATIVE_WRITING');

-- CreateEnum
CREATE TYPE "AssessmentMode" AS ENUM ('OBJECTIVE', 'SELF_REVIEW', 'UNGRADED');

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "subject" "Subject" NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "assessmentMode" "AssessmentMode" NOT NULL,
    "maximumPoints" DECIMAL(6,2),
    "explanation" TEXT,
    "referenceGuidance" TEXT,
    "rubric" JSONB,
    "acceptedAnswers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "correctOptionId" UUID,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_subject_status_createdAt_id_idx" ON "Question"("subject", "status", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Question_id_type_key" ON "Question"("id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_position_key" ON "QuestionOption"("questionId", "position");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_correctOptionId_fkey" FOREIGN KEY ("correctOptionId") REFERENCES "QuestionOption"("id") ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_questionType_fkey" FOREIGN KEY ("questionId", "questionType") REFERENCES "Question"("id", "type") ON DELETE CASCADE ON UPDATE RESTRICT;

-- These invariants must also hold for writes made outside Prisma. Which fields a
-- question needs depends on its type and assessment mode; NULL must never slip
-- through a CHECK, so required fields are tested with IS NOT NULL.
ALTER TABLE "Question"
    ADD CONSTRAINT "Question_prompt_nonblank" CHECK (length(btrim("prompt")) > 0),
    ADD CONSTRAINT "Question_accepted_answers_present" CHECK ("acceptedAnswers" IS NOT NULL),
    ADD CONSTRAINT "Question_maximum_points_nonnegative" CHECK ("maximumPoints" IS NULL OR "maximumPoints" >= 0),
    ADD CONSTRAINT "Question_rubric_is_array" CHECK ("rubric" IS NULL OR jsonb_typeof("rubric") = 'array'),
    -- Multiple choice is always objective; essays and extended responses never are.
    ADD CONSTRAINT "Question_type_assessment_mode" CHECK (
        CASE "type"
            WHEN 'MULTIPLE_CHOICE' THEN "assessmentMode" = 'OBJECTIVE'
            WHEN 'SHORT_RESPONSE' THEN true
            ELSE "assessmentMode" IN ('SELF_REVIEW', 'UNGRADED')
        END
    ),
    -- Objective questions carry points and an explanation; written ones carry guidance
    -- (and optionally a rubric) and never points.
    ADD CONSTRAINT "Question_assessment_fields" CHECK (
        CASE "assessmentMode"
            WHEN 'OBJECTIVE' THEN
                "maximumPoints" IS NOT NULL AND "explanation" IS NOT NULL
                AND "referenceGuidance" IS NULL AND "rubric" IS NULL
            ELSE
                "maximumPoints" IS NULL AND "explanation" IS NULL AND "referenceGuidance" IS NOT NULL
        END
    ),
    ADD CONSTRAINT "Question_accepted_answers_short_response_only" CHECK (
        ("type" = 'SHORT_RESPONSE' AND "assessmentMode" = 'OBJECTIVE') OR cardinality("acceptedAnswers") = 0
    ),
    ADD CONSTRAINT "Question_correct_option_multiple_choice_only" CHECK (
        "correctOptionId" IS NULL OR "type" = 'MULTIPLE_CHOICE'
    ),
    -- Drafts may be incomplete; a published question must be answerable and explained.
    -- Further publication rules, such as option counts, belong to the publishing feature (#73).
    ADD CONSTRAINT "Question_published_is_gradable" CHECK (
        "status" <> 'PUBLISHED' OR (
            CASE "assessmentMode"
                WHEN 'OBJECTIVE' THEN length(btrim(coalesce("explanation", ''))) > 0
                ELSE length(btrim(coalesce("referenceGuidance", ''))) > 0
            END
            AND ("type" <> 'MULTIPLE_CHOICE' OR "correctOptionId" IS NOT NULL)
            AND ("type" <> 'SHORT_RESPONSE' OR "assessmentMode" <> 'OBJECTIVE' OR cardinality("acceptedAnswers") > 0)
        )
    );

ALTER TABLE "QuestionOption"
    ADD CONSTRAINT "QuestionOption_text_nonblank" CHECK (length(btrim("text")) > 0),
    ADD CONSTRAINT "QuestionOption_position_nonnegative" CHECK ("position" >= 0),
    -- With the composite foreign key to Question(id, type), only multiple-choice questions can own options.
    ADD CONSTRAINT "QuestionOption_multiple_choice_only" CHECK ("questionType" = 'MULTIPLE_CHOICE');

-- The correct option must be one of the question's own options. A composite foreign key
-- cannot express this for an optional reference, so triggers enforce it, as for the topic
-- hierarchy above.
CREATE FUNCTION public.enforce_question_correct_option() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    IF NEW."correctOptionId" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public."QuestionOption"
        WHERE "id" = NEW."correctOptionId" AND "questionId" = NEW."id"
    ) THEN
        RAISE EXCEPTION 'The correct option must be an option of the same question'
            USING ERRCODE = '23514', CONSTRAINT = 'Question_correct_option_own_option';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "Question_correct_option_own_option"
BEFORE INSERT OR UPDATE OF "id", "correctOptionId" ON "Question"
FOR EACH ROW EXECUTE FUNCTION public.enforce_question_correct_option();

-- Moving an option to another question must not leave a question pointing at it.
CREATE FUNCTION public.enforce_option_stays_with_question() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public."Question" WHERE "correctOptionId" = OLD."id") THEN
        RAISE EXCEPTION 'An option that is a question''s correct option cannot move to another question'
            USING ERRCODE = '23514', CONSTRAINT = 'QuestionOption_correct_stays_with_question';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "QuestionOption_correct_stays_with_question"
BEFORE UPDATE OF "questionId" ON "QuestionOption"
FOR EACH ROW EXECUTE FUNCTION public.enforce_option_stays_with_question();

COMMIT;
