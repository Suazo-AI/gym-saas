"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateExchangeRate } from "../services/exchange-rate.repository";
export type ExchangeRateState={ok:boolean;message?:string};
const schema=z.string().regex(/^\d+(\.\d{1,6})?$/,"Ingresa una tasa válida.").refine(v=>Number(v)>0,"La tasa debe ser mayor que cero.");
export async function updateExchangeRateAction(_:ExchangeRateState,form:FormData):Promise<ExchangeRateState>{try{await updateExchangeRate(schema.parse(form.get("nioPerUsd")));revalidatePath("/settings");return{ok:true,message:"Tasa actualizada para transacciones nuevas."};}catch(e){return{ok:false,message:e instanceof Error?e.message:"No pudimos actualizar la tasa."};}}
