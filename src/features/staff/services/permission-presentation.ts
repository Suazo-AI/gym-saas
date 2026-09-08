export type PermissionPresentationGroup = {
  group: string;
  items: Array<{ code: string; label: string }>;
};

export type RoleLocale = "es" | "en";

const catalog: Record<string, { group: string; label: string }> = {
  "dashboard.read": { group: "Panel", label: "Ver el panel" },
  "gym.read": { group: "Configuración", label: "Ver configuración del gimnasio" },
  "gym.manage": { group: "Configuración", label: "Administrar gimnasio y sucursales" },
  "billing.read": { group: "Suscripción SaaS", label: "Ver suscripción y facturas SaaS" },
  "billing.manage": { group: "Suscripción SaaS", label: "Gestionar la suscripción SaaS" },
  "staff.read": { group: "Administración", label: "Ver personal" },
  "staff.manage": { group: "Administración", label: "Administrar personal" },
  "roles.manage": { group: "Administración", label: "Administrar roles y permisos" },
  "members.read": { group: "Miembros", label: "Ver miembros" },
  "members.manage": { group: "Miembros", label: "Registrar y actualizar miembros" },
  "memberships.read": { group: "Membresías", label: "Ver membresías" },
  "memberships.manage": { group: "Membresías", label: "Asignar y renovar membresías" },
  "payments.read": { group: "Cobros", label: "Ver pagos" },
  "payments.manage": { group: "Cobros", label: "Registrar pagos" },
  "payments.create": { group: "Cobros", label: "Registrar pagos" },
  "income.read": { group: "Ingresos", label: "Ver ingresos" },
  "income.manage": { group: "Ingresos", label: "Registrar y anular otros ingresos" },
  "entries.read": { group: "Entradas", label: "Ver entradas" },
  "entries.manage": { group: "Entradas", label: "Registrar entradas" },
  "media.read": { group: "Archivos", label: "Ver archivos y fotografías" },
  "media.manage": { group: "Archivos", label: "Subir y retirar archivos" },
  "faces.read": { group: "Acceso facial", label: "Ver datos y eventos faciales" },
  "faces.verify": { group: "Acceso facial", label: "Verificar acceso facial" },
  "faces.manage": { group: "Acceso facial", label: "Gestionar datos biométricos" },
  "alerts.read": { group: "Alertas", label: "Ver alertas" },
  "alerts.manage": { group: "Alertas", label: "Atender alertas" },
  "audit.read": { group: "Auditoría", label: "Ver auditoría" },
};

const groupOrder = [
  "Panel",
  "Miembros",
  "Membresías",
  "Cobros",
  "Entradas",
  "Ingresos",
  "Alertas",
  "Acceso facial",
  "Archivos",
  "Configuración",
  "Administración",
  "Suscripción SaaS",
  "Auditoría",
  "Otros permisos",
];

export function describeEffectivePermissions(codes: string[]): PermissionPresentationGroup[] {
  const groups = new Map<string, Array<{ code: string; label: string }>>();

  for (const code of [...new Set(codes)].sort()) {
    if (code.startsWith("billing.")) continue;
    const item = catalog[code] ?? { group: "Otros permisos", label: code };
    groups.set(item.group, [...(groups.get(item.group) ?? []), { code, label: item.label }]);
  }

  return [...groups]
    .map(([group, items]) => ({ group, items }))
    .sort((left, right) => groupOrder.indexOf(left.group) - groupOrder.indexOf(right.group));
}

const roleNames: Record<string, { es: string; en: string }> = {
  owner: { es: "Due\u00f1o", en: "Owner" },
  admin: { es: "Administrador", en: "Administrator" },
  receptionist: { es: "Recepcionista", en: "Receptionist" },
  accountant: { es: "Contador", en: "Accountant" },
  trainer: { es: "Entrenador", en: "Trainer" },
};

const roleDescriptions: Record<string, { es: string; en: string }> = {
  owner: { es: "Control total del gimnasio", en: "Full gym control" },
  admin: { es: "Administraci\u00f3n operativa", en: "Operational administration" },
  receptionist: { es: "Miembros, membres\u00edas, cobros y entradas", en: "Members, memberships, payments and access" },
  accountant: { es: "Pagos, ingresos y reportes", en: "Payments, income and reports" },
  trainer: { es: "Consulta de informaci\u00f3n de miembros", en: "Read member information" },
};

export function displayRoleName(code: string, fallback: string, locale: RoleLocale) {
  return roleNames[code]?.[locale] ?? fallback;
}

export function displayRoleDescription(code: string, fallback: string | null, locale: RoleLocale) {
  return roleDescriptions[code]?.[locale] ?? fallback;
}

export function describeRoleLimits(code: string, permissions: string[]): string[] {
  if (code === "owner") return ["Tiene control total del gimnasio."];
  if (code === "receptionist") {
    return [
      "Puede atender miembros, membresías, cobros y entradas según sus permisos efectivos.",
      "No puede administrar personal ni configuración del gimnasio.",
    ];
  }
  if (permissions.includes("staff.manage")) {
    return ["Puede administrar personal según sus permisos efectivos."];
  }
  return ["No puede administrar personal ni cambiar permisos."];
}
