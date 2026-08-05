"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { updateRoleScreenAccess } from "../services/staff.repository";
export type RoleScreenState={ok:boolean;message?:string};
const schema=z.object({roleId:z.string().uuid(),screenIds:z.array(z.string().uuid())});
export async function updateRoleScreenAction(_:RoleScreenState,form:FormData):Promise<RoleScreenState>{try{const gym=await getActiveGym();if(!gym)return{ok:false,message:"No hay gimnasio activo."};const input=schema.parse({roleId:form.get("roleId"),screenIds:form.getAll("screenIds")});await updateRoleScreenAccess({gymId:gym.gymId,...input});revalidatePath("/staff");revalidatePath("/dashboard","layout");return{ok:true,message:"Pantallas del rol actualizadas."};}catch(e){return{ok:false,message:e instanceof Error?e.message:"No pudimos actualizar el rol."};}}
