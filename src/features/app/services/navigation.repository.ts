import { createClient } from "@/lib/supabase/server";
export type AllowedScreen={code:string;name:string;route:string;sort_order:number};
export async function listCurrentUserScreens(gymId:string):Promise<AllowedScreen[]>{const supabase=await createClient();const {data,error}=await supabase.rpc("list_current_user_screens" as never,{p_gym_id:gymId} as never);if(error)throw error;return (data??[]) as AllowedScreen[];}
