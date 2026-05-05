import { createServiceClient } from "@/lib/supabase/service";

const BUCKET = "chat-attachments";

// --- Classification ---

export type AttachmentMode = "medical_document" | "generic_attachment";

// Keywords that, when found in a normalized image filename, indicate a medical document.
// PDFs are always medical_document regardless of filename.
// Keep this list small, explicit, and easy to audit — no regex, no ML.
const MEDICAL_FILENAME_KEYWORDS: readonly string[] = [
  // Latin / transliterated
  "analiz", "analysis", "result", "results", "lab",
  "biopsy", "doctor", "diagnosis", "conclusion", "report",
  "test", "antibody", "iga", "igg", "ttg", "ema", "dgp",
  "celiac", "blood", "panel", "profile",
  // Cyrillic
  "анализ", "анализы", "результат", "лаборат", "биопси",
  "врач", "диагноз", "заключение", "отчет", "отчёт",
  "тест", "антител", "целиак", "кровь", "панел",
];

// Pure deterministic classifier — no I/O, no content inspection.
// PDFs → medical_document unconditionally.
// Images → medical_document if filename (sans extension, lowercased) contains a keyword.
export function classifyAttachment(mimeType: string, fileName: string): AttachmentMode {
  if (mimeType === "application/pdf") return "medical_document";

  const normalizedName = fileName.toLowerCase().replace(/\.[^.]+$/, "");
  for (const kw of MEDICAL_FILENAME_KEYWORDS) {
    if (normalizedName.includes(kw)) return "medical_document";
  }
  return "generic_attachment";
}

// Persists attachment_mode to the already-confirmed row.
// The .eq("status","confirmed") guard ensures we only update the row that was just confirmed,
// never a pending or orphaned row.
export async function persistAttachmentMode(
  attachmentId: string,
  userId: string,
  mode: AttachmentMode
): Promise<boolean> {
  const service = createServiceClient();
  const { error } = await service
    .from("attachments")
    .update({ attachment_mode: mode })
    .eq("id", attachmentId)
    .eq("user_id", userId)
    .eq("status", "confirmed");

  if (error) {
    console.error("[attachments] persistAttachmentMode failed:", error.message);
    return false;
  }
  return true;
}

// Short-lived URL for n8n processing. /api/chat has maxDuration=60 and n8n timeout=35s,
// so 300s gives a comfortable buffer without leaving a long-lived window.
const SIGNED_URL_TTL_SECONDS = 300;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type AttachmentValidationError =
  | "attachment_not_found"
  | "attachment_not_owned"
  | "attachment_not_pending"
  | "attachment_invalid";

export type AttachmentValidation =
  | { ok: true; storagePath: string; mimeType: string; fileName: string }
  | { ok: false; reason: AttachmentValidationError; httpStatus: number };

// Verifies the attachment exists, belongs to userId, is pending, and has an allowed MIME type.
// Scoped to userId at the query level — never trusts client-supplied ownership.
export async function validatePendingAttachment(
  attachmentId: string,
  userId: string
): Promise<AttachmentValidation> {
  const service = createServiceClient();

  const { data, error } = await service
    .from("attachments")
    .select("user_id, storage_path, mime_type, file_name, status")
    .eq("id", attachmentId)
    .maybeSingle();

  if (error) {
    console.error("[attachments] validatePendingAttachment DB error:", error.message);
    return { ok: false, reason: "attachment_not_found", httpStatus: 404 };
  }

  if (!data) {
    return { ok: false, reason: "attachment_not_found", httpStatus: 404 };
  }

  if (data.user_id !== userId) {
    return { ok: false, reason: "attachment_not_owned", httpStatus: 403 };
  }

  if (data.status !== "pending") {
    return { ok: false, reason: "attachment_not_pending", httpStatus: 409 };
  }

  if (!ALLOWED_MIME_TYPES.has(data.mime_type)) {
    return { ok: false, reason: "attachment_invalid", httpStatus: 400 };
  }

  return {
    ok: true,
    storagePath: data.storage_path,
    mimeType: data.mime_type,
    fileName: data.file_name,
  };
}

export type AttachmentConfirm =
  | { ok: true; storagePath: string }
  | { ok: false };

// Transitions the attachment to confirmed and sets retention timestamps.
// The .eq("status", "pending") guard prevents a double-confirm race: if two concurrent
// requests validate the same attachment, only the first UPDATE will match; the second
// gets no rows back and returns ok: false.
export async function confirmAttachment(
  attachmentId: string,
  userId: string
): Promise<AttachmentConfirm> {
  const service = createServiceClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const { data, error } = await service
    .from("attachments")
    .update({
      status: "confirmed",
      confirmed_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", attachmentId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("storage_path")
    .single();

  if (error || !data) {
    console.error("[attachments] confirmAttachment failed:", error?.message ?? "no row matched");
    return { ok: false };
  }

  return { ok: true, storagePath: data.storage_path };
}

// Reverts a confirmed attachment back to pending, clearing the lifecycle timestamps.
// Used as compensation when signed URL generation fails after a successful confirm —
// leaves the attachment in a retryable state rather than a dead confirmed-but-unusable one.
export async function revertAttachmentToPending(
  attachmentId: string,
  userId: string
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("attachments")
    .update({ status: "pending", confirmed_at: null, expires_at: null })
    .eq("id", attachmentId)
    .eq("user_id", userId)
    .eq("status", "confirmed");

  if (error) {
    console.error("[attachments] revertAttachmentToPending failed:", error.message, "id:", attachmentId);
  }
}

// Generates a short-lived signed URL for an already-confirmed storage object.
// Returns null on error — callers must treat null as a hard failure.
export async function generateAttachmentSignedUrl(storagePath: string): Promise<string | null> {
  const service = createServiceClient();

  const { data, error } = await service.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[attachments] createSignedUrl failed:", error?.message);
    return null;
  }

  return data.signedUrl;
}
