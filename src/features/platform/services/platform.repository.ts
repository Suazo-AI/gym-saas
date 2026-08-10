import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type { CreatePlatformGymInput } from "../schemas/platform-gym.schema";
import type { PlatformDashboardDto, PlatformGymDetailDto } from "../types/platform.dto";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
type ProvisionDependencies = {
  inviteUserByEmail: (
    email: string,
    options: { data: { name: string }; redirectTo?: string },
  ) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  deleteUser: (id: string) => Promise<unknown>;
  rpc: Rpc;
};

function isDeterministicDatabaseFailure(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^(22|23|28|40|42|P0)/.test(code);
}

export type CreatedPlatformGym = {
  gymId: string;
  ownerAuthUserId: string;
  tradeName: string;
  legalName: string;
  slug: string;
  defaultCurrency: "NIO" | "USD";
  timezone: string;
};

export async function getPlatformDashboard(): Promise<PlatformDashboardDto> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_dashboard" as never);

  if (error) {
    throw mapSupabaseError(error);
  }

  return data as unknown as PlatformDashboardDto;
}

export async function getPlatformGymDetail(gymId: string): Promise<PlatformGymDetailDto> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_gym_detail" as never, {
    p_gym_id: gymId,
  } as never);

  if (error) {
    throw mapSupabaseError(error);
  }

  return data as unknown as PlatformGymDetailDto;
}

export async function createPlatformGymWithOwner(
  input: CreatePlatformGymInput,
  injected?: ProvisionDependencies,
): Promise<CreatedPlatformGym> {
  const dependencies = injected ?? await provisionDependencies();
  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`
    : undefined;
  const { data, error } = await dependencies.inviteUserByEmail(input.ownerEmail, {
    data: { name: input.ownerName },
    redirectTo,
  });
  if (error || !data.user) {
    throw mapSupabaseError(error ?? { message: "Invitation user missing" });
  }

  const { data: created, error: createError } = await dependencies.rpc("create_platform_gym_with_owner", {
    p_owner_auth_user_id: data.user.id,
    p_legal_name: input.legalName,
    p_trade_name: input.tradeName,
    p_slug: input.slug,
    p_tax_identifier: input.taxIdentifier,
    p_default_currency: input.defaultCurrency,
    p_timezone: input.timezone,
  });
  if (createError) {
    if (isDeterministicDatabaseFailure(createError)) {
      await dependencies.deleteUser(data.user.id);
    }
    throw mapSupabaseError(createError);
  }

  return created as CreatedPlatformGym;
}

async function provisionDependencies(): Promise<ProvisionDependencies> {
  const admin = createAdminClient();
  const supabase = await createClient();
  return {
    inviteUserByEmail: (email, options) => admin.auth.admin.inviteUserByEmail(email, options),
    deleteUser: (id) => admin.auth.admin.deleteUser(id),
    rpc: async (name, args) => supabase.rpc(name as never, args as never),
  };
}
