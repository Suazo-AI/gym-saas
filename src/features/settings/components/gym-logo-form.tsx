"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";

import { ActionFeedback } from "@/features/app/components/action-feedback";

import { updateGymLogoAction, type GymLogoState } from "../actions/gym-logo.actions";

const initial: GymLogoState = { ok: false };

export function GymLogoForm({ currentLogoUrl }: { currentLogoUrl: string | null }) {
  const [state, action, pending] = useActionState(updateGymLogoAction, initial);
  const [imageBase64, setImageBase64] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function selectLogo(file?: File) {
    if (!file) {
      setFileName("");
      return setImageBase64("");
    }
    setFileName(file.name);
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    setImageBase64(canvas.toDataURL("image/webp", 0.82));
    bitmap.close();
  }

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.16em] text-brand-green">Identidad</p>
      <h2 className="mt-2 text-xl font-black text-ink">Logo del gimnasio</h2>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {imageBase64 || currentLogoUrl ? <Image alt="Logo actual del gimnasio" className="size-20 rounded-xl object-cover" height={80} src={imageBase64 || currentLogoUrl || ""} unoptimized width={80} /> : <span className="grid size-20 place-items-center rounded-xl bg-brand-lime text-2xl font-black text-ink">F</span>}
        <form action={action} className="grid flex-1 gap-3">
          <input name="imageBase64" type="hidden" value={imageBase64} />
          <input accept="image/avif,image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void selectLogo(event.target.files?.[0])} ref={fileInput} required type="file" />
          <div className="flex flex-wrap items-center gap-3">
            <button className="min-h-11 rounded-lg border border-brand-green px-4 py-3 text-sm font-black text-brand-green hover:bg-brand-sand" onClick={() => fileInput.current?.click()} type="button">
              Elegir logo
            </button>
            <span className="text-sm text-gray">{fileName || "Ningún archivo seleccionado"}</span>
          </div>
          <ActionFeedback state={state} />
          <button className="min-h-11 rounded-lg bg-brand-green px-4 font-black text-white disabled:opacity-60" disabled={!imageBase64 || pending} type="submit">{pending ? "Guardando…" : "Guardar logo"}</button>
        </form>
      </div>
      <p className="mt-3 text-xs text-gray">La imagen se ajusta automáticamente antes de guardarla.</p>
    </section>
  );
}
