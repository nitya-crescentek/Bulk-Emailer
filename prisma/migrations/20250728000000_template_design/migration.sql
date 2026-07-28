-- Add structured design + editor mode to templates.
ALTER TABLE "Template" ADD COLUMN "design" JSONB;
ALTER TABLE "Template" ADD COLUMN "editorMode" TEXT NOT NULL DEFAULT 'visual';
