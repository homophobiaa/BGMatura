BEGIN;

CREATE TABLE "Lesson" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "topicId" UUID NOT NULL,
    "subject" "Subject" NOT NULL DEFAULT 'BULGARIAN_LANGUAGE',
    "content" JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}'::jsonb,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Lesson_title_nonblank" CHECK ("title" ~ '[^[:space:]]'),
    CONSTRAINT "Lesson_slug_nonblank" CHECK ("slug" ~ '[^[:space:]]'),
    CONSTRAINT "Lesson_language_only" CHECK ("subject" = 'BULGARIAN_LANGUAGE'),
    CONSTRAINT "Lesson_content_v1_envelope" CHECK ((
        jsonb_typeof("content") = 'object'
        AND "content"->'version' = '1'::jsonb
        AND jsonb_typeof("content"->'blocks') = 'array'
    ) IS TRUE),
    CONSTRAINT "Lesson_published_has_content" CHECK (
        "status" <> 'PUBLISHED' OR
        CASE WHEN jsonb_typeof("content"->'blocks') = 'array'
            THEN jsonb_array_length("content"->'blocks') > 0 ELSE false END
    )
);

CREATE UNIQUE INDEX "Lesson_slug_key" ON "Lesson"("slug");
CREATE INDEX "Lesson_topicId_status_title_id_idx" ON "Lesson"("topicId", "status", "title", "id");
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_topicId_subject_fkey"
    FOREIGN KEY ("topicId", "subject") REFERENCES "Topic"("id", "subject")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMIT;
