import { z } from "zod";

export const alertStatusSchema = z.enum(["open", "acknowledged", "resolved", "dismissed"]);

export const alertTransitionSchema = z.object({
  alertId: z.string().uuid("Selecciona una alerta valida."),
  status: z.enum(["acknowledged", "resolved"]),
});
