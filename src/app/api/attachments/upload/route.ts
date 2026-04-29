import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { randomUUID } from "crypto";

export const maxDuration = 60;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const BUCKET = "chat-attachments";

type UploadErrorStatus =
  | "unauthenticated"
  | "missing_file"
  | "unsupported_type"
  | "file_too_large"
  | "invalid_request"
  | "storage_error"
  | "db_error";

function uploadError(status: UploadErrorStatus, httpStatus: number, message?: string) {
  return NextResponse.json({ error: status, ...(message ? { message } : {}) }, { status: httpStatus });
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
}

// POST /api/attachments/upload
// Accepts multipart/form-data with a single `file` field.
// Validates type and size before writing to storage.
// Returns a pending attachment record; no URLs or storage paths are exposed.
export async function POST(req: NextRequest) {
  // 1. Auth: derive user from session cookie — never trust client-supplied user_id
  const serverClient = await createClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();

  if (!user) {
    return uploadError("unauthenticated", 401);
  }

  // 2. Parse multipart body
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return uploadError("invalid_request", 400, "expected multipart/form-data");
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return uploadError("missing_file", 400, "field 'file' is required");
  }

  // 3. Validate MIME type before any storage write (primary enforcement layer)
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return uploadError("unsupported_type", 400, `unsupported type: ${file.type}`);
  }

  // 4. Validate size before any storage write
  if (file.size > MAX_SIZE_BYTES) {
    return uploadError("file_too_large", 400, `max size is 5 MB, received ${file.size} bytes`);
  }

  // 5. Build user-scoped storage path: {user_id}/{attachment_id}/{sanitized_filename}
  //    attachment_id is generated here so it serves as both the DB primary key
  //    and the folder key in storage — one UUID ties them together.
  const attachmentId = randomUUID();
  const safeName = sanitizeFilename(file.name || "upload");
  const storagePath = `${user.id}/${attachmentId}/${safeName}`;

  // 6. Upload to storage via service role (bypasses storage RLS; upload is server-mediated)
  const service = createServiceClient();
  const fileBuffer = await file.arrayBuffer();

  const { error: storageErr } = await service.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (storageErr) {
    console.error("[upload] storage write failed:", storageErr.message);
    return uploadError("storage_error", 500, "upload failed");
  }

  // 7. Insert pending attachment row in DB
  //    id is supplied explicitly so storage path and DB record share the same UUID.
  const { data: row, error: dbErr } = await service
    .from("attachments")
    .insert({
      id: attachmentId,
      user_id: user.id,
      storage_path: storagePath,
      file_name: file.name || safeName,
      mime_type: file.type,
      size_bytes: file.size,
      status: "pending",
    })
    .select("id, file_name, mime_type, size_bytes, status")
    .single();

  if (dbErr || !row) {
    // Compensate: delete the storage file to avoid an orphan with no DB record.
    // If the delete also fails, the file is untracked — log path for manual review.
    console.error("[upload] DB insert failed after storage write:", dbErr?.message);
    const { error: deleteErr } = await service.storage.from(BUCKET).remove([storagePath]);
    if (deleteErr) {
      console.error(
        "[upload] storage compensation delete failed — orphaned path:",
        storagePath,
        deleteErr.message
      );
    }
    return uploadError("db_error", 500, "failed to record upload");
  }

  return NextResponse.json({ attachment: row }, { status: 201 });
}
