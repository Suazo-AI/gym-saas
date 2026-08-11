import { z } from "zod";

const requiredName = z.string().trim().min(2, "Ingresa al menos 2 caracteres.").max(160, "Usa 160 caracteres o menos.");

export const createPlatformGymSchema = z.object({
  legalName: requiredName,
  tradeName: requiredName,
  slug: z.string().trim().toLowerCase().min(2, "Ingresa un slug.").max(80, "Usa 80 caracteres o menos.").regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Usa letras minusculas, numeros y guiones.",
  ),
  taxIdentifier: z.string().trim().max(64, "Usa 64 caracteres o menos.").transform((value) => value || null),
  defaultCurrency: z.enum(["NIO", "USD"]),
  timezone: z.literal("America/Managua"),
  ownerName: z.string().trim().min(2, "Ingresa el nombre del dueño.").max(120, "Usa 120 caracteres o menos."),
  ownerEmail: z.string().trim().toLowerCase().email("Ingresa un correo valido."),
});

export type CreatePlatformGymInput = z.infer<typeof createPlatformGymSchema>;
