BEGIN;

-- CreateTable
CREATE TABLE "Work" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "genre" TEXT,
    "summary" TEXT,
    "themes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "characters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importantIdeas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interpretation" TEXT,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Work_slug_key" ON "Work"("slug");

-- CreateIndex
CREATE INDEX "Work_authorId_title_id_idx" ON "Work"("authorId", "title", "id");

-- CreateIndex
CREATE INDEX "Work_status_title_id_idx" ON "Work"("status", "title", "id");

-- AddForeignKey
ALTER TABLE "Work" ADD CONSTRAINT "Work_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- These invariants must also hold for writes made outside Prisma.
-- Study lists may be empty but never contain blank items, where blank includes tabs and line
-- breaks (btrim alone only trims spaces). A CHECK cannot contain a subquery, so the rule lives
-- in a small immutable function.
CREATE FUNCTION public.text_array_has_no_blank_items(items text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
    SELECT NOT EXISTS (SELECT 1 FROM unnest(items) AS item WHERE item IS NULL OR item ~ '^\s*$')
$$;

ALTER TABLE "Work"
    ADD CONSTRAINT "Work_title_nonblank" CHECK (length(btrim("title")) > 0),
    ADD CONSTRAINT "Work_slug_nonblank" CHECK (length(btrim("slug")) > 0),
    -- Prisma maps lists to nullable columns; keep them required so "none" is always an empty list.
    ADD CONSTRAINT "Work_study_lists_present" CHECK (
        "themes" IS NOT NULL AND "characters" IS NOT NULL AND "importantIdeas" IS NOT NULL
    ),
    ADD CONSTRAINT "Work_study_lists_nonblank_items" CHECK (
        public.text_array_has_no_blank_items("themes")
        AND public.text_array_has_no_blank_items("characters")
        AND public.text_array_has_no_blank_items("importantIdeas")
    ),
    -- A draft may be incomplete. Characters are deliberately not required: they do not apply
    -- to every work. Fuller completeness rules belong to the publishing feature (#40).
    ADD CONSTRAINT "Work_published_essentials" CHECK (
        "status" <> 'PUBLISHED' OR (
            length(btrim(coalesce("genre", ''))) > 0 AND length(btrim(coalesce("summary", ''))) > 0
        )
    );

COMMIT;
