import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const faceServiceEnvSchema = z.object({
  FACE_RECOGNITION_SERVICE_URL: z.string().url(),
  FACE_RECOGNITION_SERVICE_TOKEN: z.string().min(32),
});

export function parseServerEnv(input: Record<string, string | undefined>) {
  return serverEnvSchema.parse(input);
}

export function getServerEnv() {
  return parseServerEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export function parseFaceServiceEnv(input: Record<string, string | undefined>) {
  return faceServiceEnvSchema.parse(input);
}

export function getFaceServiceEnv() {
  return parseFaceServiceEnv({
    FACE_RECOGNITION_SERVICE_URL: process.env.FACE_RECOGNITION_SERVICE_URL,
    FACE_RECOGNITION_SERVICE_TOKEN: process.env.FACE_RECOGNITION_SERVICE_TOKEN,
  });
}
