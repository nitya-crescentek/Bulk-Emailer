-- Carry the structured builder design on the campaign snapshot so a campaign
-- can be reopened and edited in the visual builder. Existing campaigns are
-- raw-HTML snapshots, hence editorMode defaults to 'html'.
ALTER TABLE "Campaign" ADD COLUMN "design" JSONB;
ALTER TABLE "Campaign" ADD COLUMN "editorMode" TEXT NOT NULL DEFAULT 'html';
