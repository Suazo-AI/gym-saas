import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/types/database.types";

type AdminClientOptions = {
  auth: {
    persistSession: false;
    autoRefreshToken: false;
    detectSessionInUrl: false;
  };
};

type AdminClientFactory<T> = (url: string, key: string, options: AdminClientOptions) => T;

export function buildAdminClient<T>(
  factory: AdminClientFactory<T>,
  config: { NEXT_PUBLIC_SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string },
) {
  return factory(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export function createAdminClient() {
  return buildAdminClient(
    createClient<Database>,
    getServerEnv(),
  );
}
