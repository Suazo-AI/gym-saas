import crypto from "node:crypto";

import { ApiError } from "@/lib/api/api-error";
import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function updateGymLogo(gymId: string, imageBase64: string): Promise<void> {
  const match = /^data:image\/webp;base64,([A-Za-z0-9+/=]+)$/.exec(imageBase64);
  if (!match) throw new ApiError("VALIDATION_ERROR", "El logo debe ser una imagen válida.");
  const bytes = Buffer.from(match[1], "base64");
  if (!bytes.length || bytes.length > MAX_LOGO_BYTES) throw new ApiError("VALIDATION_ERROR", "El logo debe pesar menos de 2 MB.");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new ApiError("UNAUTHENTICATED", "Tu sesión expiró.");

  const { data: gym, error: gymError } = await supabase.from("gyms").select("logo_media_asset_id").eq("id", gymId).single();
  if (gymError) throw mapSupabaseError(gymError);

  const objectPath = `${gymId}/general/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage.from("gym-media").upload(objectPath, bytes, { contentType: "image/webp", upsert: false });
  if (uploadError) throw mapSupabaseError(uploadError);

  const { data: asset, error: assetError } = await supabase.from("media_assets").insert({
    gym_id: gymId,
    bucket_name: "gym-media",
    object_path: objectPath,
    original_filename: "gym-logo.webp",
    mime_type: "image/webp",
    compression_codec: "webp",
    size_bytes: bytes.length,
    sha256_hex: crypto.createHash("sha256").update(bytes).digest("hex"),
    created_by: auth.user.id,
  }).select("id").single();

  if (assetError || !asset) {
    await supabase.storage.from("gym-media").remove([objectPath]);
    throw mapSupabaseError(assetError ?? new Error("No se creó el archivo."));
  }

  const { error: updateError } = await supabase.from("gyms").update({ logo_media_asset_id: asset.id }).eq("id", gymId);
  if (updateError) {
    await supabase.rpc("soft_delete_entity", { p_entity: "media_asset", p_id: asset.id, p_reason: "Falló la asignación del logo" });
    throw mapSupabaseError(updateError);
  }

  if (gym.logo_media_asset_id) {
    await supabase.rpc("soft_delete_entity", { p_entity: "media_asset", p_id: gym.logo_media_asset_id, p_reason: "Logo reemplazado" });
  }
}
