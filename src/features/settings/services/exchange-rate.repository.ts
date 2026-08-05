import { mapSupabaseError } from "@/lib/api/map-supabase-error";
import { createClient } from "@/lib/supabase/server";
type RateRow={nio_per_usd:string|number;effective_at:string};
type RateQuery={select:(columns:string)=>RateQuery;eq:(column:string,value:string)=>RateQuery;maybeSingle:()=>Promise<{data:RateRow|null;error:unknown}>};
export async function getCurrentExchangeRate(gymId:string){const supabase=await createClient();const query=supabase.from("gym_exchange_rate_current" as never) as unknown as RateQuery;const {data,error}=await query.select("nio_per_usd,effective_at").eq("gym_id",gymId).maybeSingle();if(error)throw mapSupabaseError(error);return data?{nioPerUsd:String(data.nio_per_usd),effectiveAt:data.effective_at}:null;}
export async function updateExchangeRate(nioPerUsd:string){const supabase=await createClient();const {error}=await supabase.rpc("update_gym_exchange_rate" as never,{p_nio_per_usd:nioPerUsd} as never);if(error)throw mapSupabaseError(error);}
