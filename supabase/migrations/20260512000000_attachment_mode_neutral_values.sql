-- Extend attachment_mode CHECK constraint to include neutral media-level values.
--
-- Old values ('medical_document', 'generic_attachment') came from filename-based
-- semantic classification in the app layer. New values ('image', 'pdf') reflect
-- media type only — semantic routing is now handled inside n8n after content inspection.
--
-- Old values are retained in the constraint so existing confirmed rows remain valid.
-- They will not be written by new app code and can be removed in a future cleanup
-- migration once all legacy rows have expired (30-day retention).

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_attachment_mode_check;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_attachment_mode_check
  CHECK (attachment_mode IN ('medical_document', 'generic_attachment', 'image', 'pdf'));
