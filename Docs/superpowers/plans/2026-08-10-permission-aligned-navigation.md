# Permission-Aligned Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make gym staff management and both navigation menus accurately reflect the approved permission contracts while enforcing authorization on the server.

**Architecture:** Keep gym authorization in the existing Supabase permission matrix and staff RPCs, adding a presentation-only catalog that explains effective permissions and role limits. Centralize the existing `platform_role=admin` rule in a server helper and route all platform pages and navigation through it; no new platform roles or database contracts are introduced.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase Auth/PostgreSQL/RLS/RPC, Vitest, Testing Library.

---

### Task 1: Human-readable gym permission catalog

**Files:**
- Create: `src/features/staff/services/permission-presentation.ts`
- Test: `src/features/staff/services/permission-presentation.test.ts`
- Modify: `src/features/staff/types/staff.dto.ts`
- Modify: `src/features/staff/services/staff.repository.ts`
- Modify: `src/features/staff/services/staff.repository.test.ts`

- [ ] **Step 1: Write the failing permission-presentation tests**

```ts
import { describe, expect, it } from "vitest";
import { describeEffectivePermissions, describeRoleLimits } from "./permission-presentation";

describe("permission presentation", () => {
  it("translates, groups and sorts effective permission codes", () => {
    expect(describeEffectivePermissions(["payments.create", "members.read"])).toEqual([
      { group: "Miembros", items: [{ code: "members.read", label: "Ver miembros" }] },
      { group: "Cobros", items: [{ code: "payments.create", label: "Registrar pagos" }] },
    ]);
  });

  it("states explicit role limits without granting permissions", () => {
    expect(describeRoleLimits("receptionist", ["members.read", "payments.create"])).toContain(
      "No puede administrar personal ni configuración del gimnasio.",
    );
  });

  it("keeps unknown codes visible instead of silently hiding them", () => {
    expect(describeEffectivePermissions(["future.capability"])[0].items[0]).toEqual({
      code: "future.capability",
      label: "future.capability",
    });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/features/staff/services/permission-presentation.test.ts`

Expected: FAIL because `permission-presentation` does not exist.

- [ ] **Step 3: Implement the minimal pure presentation catalog**

```ts
type PermissionItem = { code: string; label: string };
type PermissionGroup = { group: string; items: PermissionItem[] };

const catalog: Record<string, { group: string; label: string }> = {
  "members.read": { group: "Miembros", label: "Ver miembros" },
  "members.manage": { group: "Miembros", label: "Registrar y actualizar miembros" },
  "memberships.read": { group: "Membresías", label: "Ver membresías" },
  "memberships.manage": { group: "Membresías", label: "Asignar y renovar membresías" },
  "payments.read": { group: "Cobros", label: "Ver pagos" },
  "payments.create": { group: "Cobros", label: "Registrar pagos" },
  "entries.read": { group: "Entradas", label: "Ver entradas" },
  "entries.create": { group: "Entradas", label: "Registrar entradas" },
  "staff.manage": { group: "Administración", label: "Administrar personal y roles" },
};

export function describeEffectivePermissions(codes: string[]): PermissionGroup[] {
  const groups = new Map<string, PermissionItem[]>();
  for (const code of [...new Set(codes)].sort()) {
    const item = catalog[code] ?? { group: "Otros permisos", label: code };
    groups.set(item.group, [...(groups.get(item.group) ?? []), { code, label: item.label }]);
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}

export function describeRoleLimits(code: string, permissions: string[]): string[] {
  if (code === "owner") return ["Tiene control total del gimnasio."];
  if (code === "receptionist") return ["No puede administrar personal ni configuración del gimnasio."];
  return permissions.includes("staff.manage")
    ? ["Puede administrar personal según sus permisos efectivos."]
    : ["No puede administrar personal ni cambiar permisos."];
}
```

Extend `StaffRoleDto` with `permissionCodes: string[]`. Change `listStaffRoles` to select `role_permissions(permissions(code))` and map the nested rows into that flat property. Add a repository test whose injected role query returns `members.read` and assert that the DTO contains `permissionCodes: ["members.read"]`; this keeps role explanations sourced from the approved matrix rather than guessed in the component.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- src/features/staff/services/permission-presentation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the catalog**

```powershell
git add src/features/staff/services/permission-presentation.ts src/features/staff/services/permission-presentation.test.ts src/features/staff/types/staff.dto.ts src/features/staff/services/staff.repository.ts src/features/staff/services/staff.repository.test.ts
git commit -m "feat(staff): describe effective permissions and role limits"
```

### Task 2: Explain roles and access states in staff management

**Files:**
- Modify: `src/features/staff/components/staff-management.tsx`
- Modify: `src/features/staff/components/staff-management.test.tsx`
- Modify: `src/features/staff/components/role-screen-management.tsx`
- Modify: `src/features/staff/components/role-screen-management.test.tsx`

- [ ] **Step 1: Add failing component tests**

```tsx
it("explains role capabilities and limits before assignment", () => {
  const html = renderToStaticMarkup(<StaffManagement staff={staff} roles={roles} />);
  expect(html).toContain("Qué permite este rol");
  expect(html).toContain("No puede administrar personal ni configuración del gimnasio.");
});

it("shows translated effective permissions and explicit access actions", () => {
  const html = renderToStaticMarkup(<StaffManagement staff={staff} roles={roles} />);
  expect(html).toContain("Ver miembros");
  expect(html).toContain("Suspender acceso");
  expect(html).toContain("Reactivar acceso");
  expect(html).not.toContain(">members.read<");
});
```

- [ ] **Step 2: Run component tests and verify RED**

Run: `npm test -- src/features/staff/components/staff-management.test.tsx src/features/staff/components/role-screen-management.test.tsx`

Expected: FAIL because role explanations, translated permissions and explicit state actions are absent.

- [ ] **Step 3: Render role explanations and effective-permission groups**

Use `describeEffectivePermissions(person.permissions)` for grouped labels and `describeRoleLimits(role.code, role.permissionCodes ?? [])` inside role choices. Keep the submitted values as permission/role identifiers from the server; presentation helpers must not alter authorization data.

```tsx
{describeEffectivePermissions(person.permissions).map((group) => (
  <section key={group.group}>
    <h4>{group.group}</h4>
    {group.items.map((item) => <span key={item.code}>{item.label}</span>)}
  </section>
))}
```

Render status-specific actions with the existing `updateStaffAction`: active users get `Suspender acceso`, suspended users get `Reactivar acceso`, and invited/revoked states retain an explicit labeled selector. Do not remove the server-controlled status field or the last-owner safeguard.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `npm test -- src/features/staff/components/staff-management.test.tsx src/features/staff/components/role-screen-management.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run staff action/repository regression tests**

Run: `npm test -- src/features/staff`

Expected: PASS, including invitation, role assignment and suspended status payloads.

- [ ] **Step 6: Commit the staff interface**

```powershell
git add src/features/staff/components/staff-management.tsx src/features/staff/components/staff-management.test.tsx src/features/staff/components/role-screen-management.tsx src/features/staff/components/role-screen-management.test.tsx
git commit -m "feat(staff): explain roles and access states"
```

### Task 3: Central platform authorization and permission-aligned menu

**Files:**
- Create: `src/features/platform/services/platform-access.ts`
- Test: `src/features/platform/services/platform-access.test.ts`
- Modify: `src/features/platform/components/platform-shell.tsx`
- Modify: `src/features/platform/components/platform-shell.test.tsx`
- Create or modify: `src/app/platform/layout.tsx`
- Modify: platform pages under `src/app/platform/**/page.tsx` only where duplicated role checks can be removed after layout protection exists.

- [ ] **Step 1: Write failing platform-access tests**

```ts
import { describe, expect, it } from "vitest";
import { getPlatformNavigation, hasPlatformAccess } from "./platform-access";

describe("platform access", () => {
  it("allows only the approved global administrator role", () => {
    expect(hasPlatformAccess({ platform_role: "admin" })).toBe(true);
    expect(hasPlatformAccess({ platform_role: "support" })).toBe(false);
    expect(hasPlatformAccess({})).toBe(false);
  });

  it("returns no SaaS navigation to an unauthorized user", () => {
    expect(getPlatformNavigation({})).toEqual([]);
    expect(getPlatformNavigation({ platform_role: "admin" }).map((item) => item.href)).toContain("/platform/audit");
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/features/platform/services/platform-access.test.ts`

Expected: FAIL because `platform-access` does not exist.

- [ ] **Step 3: Implement the approved platform-role contract**

```ts
export type PlatformMetadata = { platform_role?: unknown };

const platformNavigation = [
  { label: "Resumen", href: "/platform" },
  { label: "Gimnasios", href: "/platform/gyms" },
  { label: "Suscripciones", href: "/platform/subscriptions" },
  { label: "Facturas", href: "/platform/invoices" },
  { label: "Pagos", href: "/platform/payments" },
  { label: "Auditoría", href: "/platform/audit" },
] as const;

export function hasPlatformAccess(metadata: PlatformMetadata): boolean {
  return metadata.platform_role === "admin";
}

export function getPlatformNavigation(metadata: PlatformMetadata) {
  return hasPlatformAccess(metadata) ? platformNavigation : [];
}
```

Create a server-only `requirePlatformAdmin()` wrapper around `requireUser()` that redirects unauthorized users to `/dashboard`. Call it from `src/app/platform/layout.tsx`, pass its navigation to `PlatformShell`, and render only those received entries. The route layout is the common server authorization boundary; existing PostgreSQL RPC checks remain unchanged as defense in depth.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/features/platform/services/platform-access.test.ts src/features/platform/components/platform-shell.test.tsx`

Expected: PASS for admin navigation and empty unauthorized navigation.

- [ ] **Step 5: Verify all platform pages inherit the protected layout**

Run: `rg -L "PlatformShell|redirect|requirePlatformAdmin" src/app/platform/**/page.tsx`

Expected: every page is below `src/app/platform/layout.tsx`; no independent route exists outside the protected segment.

- [ ] **Step 6: Commit platform authorization**

```powershell
git add src/features/platform/services/platform-access.ts src/features/platform/services/platform-access.test.ts src/features/platform/components/platform-shell.tsx src/features/platform/components/platform-shell.test.tsx src/app/platform
git commit -m "feat(platform): align SaaS navigation with admin access"
```

### Task 4: Security regressions and full verification

**Files:**
- Modify only if a missing assertion is confirmed: `supabase/tests/staff_management_contract.sql`
- Modify only if needed: `src/features/app/components/app-shell.test.tsx`
- Modify: `Docs/trello-board-template.md` only if the repository records completed checklist state there; otherwise leave Trello state external.

- [ ] **Step 1: Confirm existing SQL coverage before changing migrations or pgTAP**

Run: `rg -n "staff.manage|suspended|other gym|last active owner" supabase/tests supabase/migrations/20260804013000_staff_management_contract.sql supabase/migrations/20260804035000_role_screen_access.sql`

Expected: identify explicit coverage for permission denial, tenant isolation, suspended membership and last-owner protection. Add a failing pgTAP assertion only for a verified gap; do not create a migration when the existing contract is correct.

- [ ] **Step 2: Run focused application tests**

Run: `npm test -- src/features/staff src/features/app/components/app-shell.test.tsx src/features/platform`

Expected: PASS.

- [ ] **Step 3: Run database contract tests when Docker/Supabase is available**

Run: `npx supabase test db`

Expected: all pgTAP files PASS. If the local stack is unavailable, record the concrete environment blocker and do not claim database verification.

- [ ] **Step 4: Run static and production checks**

Run: `npm run lint`

Expected: exit 0.

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0 and all `/platform` plus gym routes compile.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`

Expected: all tests PASS with no unhandled errors.

- [ ] **Step 6: Commit any verification-only additions**

```powershell
git add supabase/tests src/features/app/components/app-shell.test.tsx Docs/trello-board-template.md
git commit -m "test: verify permission aligned navigation"
```

- [ ] **Step 7: Review the branch and open a PR**

Run: `git diff --check origin/develop...HEAD`

Expected: no whitespace errors.

Run: `git status --short`

Expected: empty output.

Push `feat/permission-aligned-navigation` and open a PR targeting `develop`, summarizing the gym permission UX, centralized SaaS authorization and verification evidence.
