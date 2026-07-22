import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Escribe un correo válido."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Escribe un correo válido."),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Usa al menos 8 caracteres."),
    confirmPassword: z.string().min(8, "Confirma la contraseña."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });
