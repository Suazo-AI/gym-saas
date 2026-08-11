import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { deleteStaffUser, inviteStaffUser, listDeletedStaffUsers, listStaffUsers, mapStaffRoles, restoreStaffUser, updateStaffUser } from "./staff.repository";

const gymId = "20000000-0000-4000-8000-000000000001";
const gymUserId = "30000000-0000-4000-8000-000000000001";
const roleId = "40000000-0000-4000-8000-000000000001";

describe("staff repository", () => {
  it("maps role permissions from the approved database matrix", () => {
    expect(mapStaffRoles([{
      id: roleId,
      code: "receptionist",
      name: "Recepción",
      description: "Atención diaria",
      role_permissions: [
        { permissions: { code: "payments.manage" } },
        { permissions: { code: "members.read" } },
      ],
    }])).toEqual([{
      id: roleId,
      code: "receptionist",
      name: "Recepción",
      description: "Atención diaria",
      permissionCodes: ["members.read", "payments.manage"],
    }]);
  });

  it("loads the protected staff directory", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: gymUserId }], error: null });
    await expect(listStaffUsers(gymId, rpc)).resolves.toEqual([{ id: gymUserId }]);
    expect(rpc).toHaveBeenCalledWith("list_gym_staff", { p_gym_id: gymId });
  });

  it("loads retired staff from the shared recycle-bin RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: gymUserId, label: "Ana", deleted_at: "2026-08-09T00:00:00Z", deletion_reason: "Fin de contrato" }],
      error: null,
    });
    await expect(listDeletedStaffUsers(gymId, rpc)).resolves.toEqual([{
      id: gymUserId,
      label: "Ana",
      deletedAt: "2026-08-09T00:00:00Z",
      reason: "Fin de contrato",
    }]);
    expect(rpc).toHaveBeenCalledWith("list_deleted_entities", {
      p_gym_id: gymId,
      p_entity: "gym_user",
      p_limit: 50,
      p_offset: 0,
    });
  });

  it("updates staff through the atomic RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: gymUserId }, error: null });
    await updateStaffUser({ gymId, gymUserId, employeeCode: "R-1", status: "active", roleIds: [roleId] }, rpc);
    expect(rpc).toHaveBeenCalledWith("update_gym_staff_user", {
      p_gym_id: gymId,
      p_gym_user_id: gymUserId,
      p_employee_code: "R-1",
      p_status: "active",
      p_role_ids: [roleId],
    });
  });

  it("removes a newly invited auth user when tenant linking fails", async () => {
    const inviteUserByEmail = vi.fn().mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
    const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    // El doble distingue las dos llamadas: primero se consulta el permiso, que
    // se concede, y despues falla la vinculacion. Un mockResolvedValue unico
    // devolveria error tambien para el permiso, la invitacion fallaria cerrada
    // antes de crear al usuario, y esta prueba dejaria de medir lo suyo.
    const rpc = vi.fn(async (name: string) =>
      name === "current_user_has_gym_permission"
        ? { data: true, error: null }
        : { data: null, error: { code: "23505" } },
    );

    await expect(inviteStaffUser(
      { gymId, email: "staff@gym.com", employeeCode: null, roleIds: [roleId] },
      { inviteUserByEmail, deleteUser, rpc },
    )).rejects.toThrow();
    expect(deleteUser).toHaveBeenCalledWith("auth-1");
  });

  it("retires staff through the shared soft-delete RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    await deleteStaffUser({ gymUserId, reason: "Fin de contrato" }, rpc);
    expect(rpc).toHaveBeenCalledWith("soft_delete_entity", {
      p_entity: "gym_user",
      p_id: gymUserId,
      p_reason: "Fin de contrato",
    });
  });

  it("restores staff through the shared restore RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    await restoreStaffUser(gymUserId, rpc);
    expect(rpc).toHaveBeenCalledWith("restore_entity", {
      p_entity: "gym_user",
      p_id: gymUserId,
    });
  });
});

// F020. inviteStaffUser llama a inviteUserByEmail con el cliente admin ANTES de
// verificar ningun permiso. El server action que lo envuelve solo resuelve el
// gimnasio activo con getActiveGym() y no comprueba nada mas. La RPC
// link_invited_gym_staff_user si valida staff.manage, pero corre despues: para
// entonces el usuario ya existe en auth.users y el correo de invitacion ya
// salio desde el dominio del producto.
//
// Consecuencia: cualquier autenticado con un gimnasio activo dispara altas en
// auth.users y correos a direcciones arbitrarias. Es relay de correo y basura
// en la tabla de usuarios, sin permiso de personal.
//
// El repositorio ya expone la pieza que falta: la RPC
// current_user_has_gym_permission(p_gym_id, p_permission_code) existe en la
// base. El arreglo es consultarla primero y fallar cerrado.
//
// Criterio escrito por el autor del contrato antes de delegar. El ejecutor no
// puede modificar este archivo.
describe("F020: invitar personal exige staff.manage antes de tocar el cliente admin", () => {
  const PERMISO = "staff.manage";

  const dobles = (opciones: { permitido?: unknown; permisoError?: unknown; linkError?: unknown } = {}) => {
    const llamadas: string[] = [];
    const inviteUserByEmail = vi.fn(async () => {
      llamadas.push("invite");
      return { data: { user: { id: "auth-1" } }, error: null };
    });
    const deleteUser = vi.fn(async () => {
      llamadas.push("delete");
      return null;
    });
    const rpc = vi.fn(async (name: string) => {
      llamadas.push(name);
      if (name === "current_user_has_gym_permission") {
        return { data: opciones.permitido, error: opciones.permisoError ?? null };
      }
      return { data: { id: gymUserId }, error: opciones.linkError ?? null };
    });
    return { inviteUserByEmail, deleteUser, rpc, llamadas };
  };

  const entrada = { gymId, email: "nuevo@fitmanager.local", employeeCode: "R-9", roleIds: [roleId] };

  it("sin staff.manage no crea el usuario ni manda el correo", async () => {
    const d = dobles({ permitido: false });
    await expect(inviteStaffUser(entrada, d)).rejects.toThrow();
    expect(d.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("sin staff.manage tampoco intenta vincular", async () => {
    const d = dobles({ permitido: false });
    await expect(inviteStaffUser(entrada, d)).rejects.toThrow();
    expect(d.llamadas).not.toContain("link_invited_gym_staff_user");
  });

  it("consulta el permiso exacto contra el gimnasio del pedido", async () => {
    const d = dobles({ permitido: true });
    await inviteStaffUser(entrada, d);
    expect(d.rpc).toHaveBeenCalledWith("current_user_has_gym_permission", {
      p_gym_id: gymId,
      p_permission_code: PERMISO,
    });
  });

  it("pregunta por el permiso antes de tocar el cliente admin, no despues", async () => {
    const d = dobles({ permitido: true });
    await inviteStaffUser(entrada, d);
    const consulta = d.llamadas.indexOf("current_user_has_gym_permission");
    const invitacion = d.llamadas.indexOf("invite");
    // Las dos tienen que existir. Comparar indices a secas no sirve: si nunca
    // se consulta el permiso, indexOf devuelve -1 y -1 es menor que cualquier
    // posicion, asi que la asercion pasaria justo en el caso que debe atrapar.
    expect(consulta).toBeGreaterThanOrEqual(0);
    expect(invitacion).toBeGreaterThan(consulta);
  });

  it("con staff.manage invita y vincula como siempre", async () => {
    const d = dobles({ permitido: true });
    await expect(inviteStaffUser(entrada, d)).resolves.toEqual({ id: gymUserId });
    expect(d.inviteUserByEmail).toHaveBeenCalledWith("nuevo@fitmanager.local", expect.anything());
    expect(d.llamadas).toContain("link_invited_gym_staff_user");
  });

  it("si la consulta de permiso falla, no invita: falla cerrado", async () => {
    const d = dobles({ permitido: true, permisoError: { message: "sin conexion" } });
    await expect(inviteStaffUser(entrada, d)).rejects.toThrow();
    expect(d.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("una respuesta que no es exactamente true tampoco autoriza", async () => {
    // null, undefined y cualquier valor ambiguo se tratan como negativa. Un
    // permiso que se concede por omision no es un permiso.
    //
    // La lista incluye a proposito valores que son verdaderos por conversion:
    // la cadena "false", el numero 1 y un objeto vacio. Sin ellos, un chequeo
    // laxo del tipo if (!permiso) pasaria esta prueba igual que la comparacion
    // estricta, y la asercion no distinguiria una implementacion de la otra.
    for (const respuesta of [null, undefined, "", 0, "false", 1, {}]) {
      const d = dobles({ permitido: respuesta });
      await expect(inviteStaffUser(entrada, d)).rejects.toThrow();
      expect(d.inviteUserByEmail).not.toHaveBeenCalled();
    }
  });

  it("si la vinculacion falla, el usuario recien creado se borra", async () => {
    // Comportamiento que ya existia y no se puede perder al reordenar.
    const d = dobles({ permitido: true, linkError: { message: "rol invalido" } });
    await expect(inviteStaffUser(entrada, d)).rejects.toThrow();
    expect(d.deleteUser).toHaveBeenCalledWith("auth-1");
  });
});
