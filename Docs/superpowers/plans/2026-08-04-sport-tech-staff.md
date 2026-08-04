# Sport-tech Foundation and Staff Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the Sport-tech visual foundation and complete tenant-safe staff management, including invitations, editing, roles, lifecycle controls, soft deletion, restoration, and auditing.

**Architecture:** PostgreSQL RPCs remain the atomic authorization boundary for staff and role changes. A server-only Supabase administrator client performs email invitations only after the caller is authenticated and authorized for the active gym. Server Actions validate form data with Zod and the React interface consumes focused repository functions.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, Zod 4, Supabase Auth/PostgreSQL/RLS, Vitest, pgTAP.

---

### Task 1: Validate the staff database contract

**Files:**
- Modify: `supabase/migrations/20260804013000_staff_management_contract.sql`
- Modify: `supabase/tests/staff_management_contract.sql`

- [ ] Verify the pgTAP test fails before applying the migration with `npx supabase test db supabase/tests/staff_management_contract.sql`; expected failure: function missing.
- [ ] Apply the incremental migration locally with `npx supabase migration up`; never replay the initial production schema.
- [ ] Expand pgTAP fixtures to cover an authorized owner, a user without `staff.manage`, a user from another gym, an unauthenticated call, an invalid cross-tenant role, and last-owner protection.
- [ ] Add `link_invited_gym_staff_user(p_gym_id, p_auth_user_id, p_employee_code, p_role_ids)` to atomically create the tenant membership, validate `staff.manage` and `roles.manage`, reject cross-tenant roles, and write `STAFF_INVITED` audit data without email tokens.
- [ ] Test invitation linking for duplicate membership, duplicate employee code, cross-tenant roles, insufficient permission, and valid creation.
- [ ] Run `npx supabase test db supabase/tests/staff_management_contract.sql`; expected: all assertions pass and the transaction rolls back.
- [ ] Regenerate `src/types/database.types.ts` with `npx supabase gen types typescript --local` and commit the migration, SQL test, and generated types.

### Task 2: Add server-only invitation infrastructure

**Files:**
- Create: `src/lib/env.server.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/supabase/admin.test.ts`
- Modify: `.env.example`

- [ ] Write a failing test asserting the administrator client rejects a missing `SUPABASE_SERVICE_ROLE_KEY` and never reads a `NEXT_PUBLIC_*` service key.
- [ ] Add a server-only Zod schema containing `SUPABASE_SERVICE_ROLE_KEY` and import `server-only` before exporting it.
- [ ] Build `createAdminClient()` with `createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })`.
- [ ] Document only the variable name in `.env.example`; do not add its value, log it, or expose it to browser bundles.
- [ ] Run `npm test -- --run src/lib/supabase/admin.test.ts`; expected: pass, then commit.

### Task 3: Implement staff validation and repository operations

**Files:**
- Create: `src/features/staff/schemas/staff.schema.ts`
- Create: `src/features/staff/schemas/staff.schema.test.ts`
- Modify: `src/features/staff/types/staff.dto.ts`
- Modify: `src/features/staff/services/staff.repository.ts`
- Create: `src/features/staff/services/staff.repository.test.ts`

- [ ] Test schemas for trimmed email, UUID gym and role IDs, optional employee code, allowed statuses (`invited`, `active`, `suspended`, `revoked`), and a required deletion reason.
- [ ] Define `StaffUserDto`, `StaffRoleDto`, `InviteStaffInput`, and `UpdateStaffInput` with name, email, roles, effective permissions, status, and lifecycle timestamps.
- [ ] Add repositories for listing staff details and roles, calling `update_gym_staff_user`, `soft_delete_entity('gym_user', ...)`, and `restore_entity('gym_user', ...)`.
- [ ] Implement invitation as: validate active gym, require `staff.manage`, call `admin.auth.admin.inviteUserByEmail`, then create the tenant membership and role assignment through a new audited RPC. If tenant linking fails, report a recoverable partial-invitation error without exposing secrets.
- [ ] Run focused schema and repository tests; expected: pass, then commit.

### Task 4: Add staff Server Actions

**Files:**
- Create: `src/features/staff/actions/staff.actions.ts`
- Create: `src/features/staff/actions/staff.actions.test.ts`

- [ ] Write failing tests for invite, edit, suspend, reactivate, soft-delete, restore, validation errors, permission errors, and duplicate email/employee code messages.
- [ ] Implement actions that derive the active gym on the server, never trust a submitted `gymId`, call focused repository methods, and revalidate `/staff`.
- [ ] Return `{ ok, message, fieldErrors }` for expected failures and preserve internal diagnostics outside user-facing messages.
- [ ] Run focused action tests; expected: pass, then commit.

### Task 5: Establish Sport-tech tokens and application shell

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/features/app/components/app-shell.tsx`
- Modify: `src/features/app/components/module-header.tsx`
- Create: `src/features/app/components/app-shell.test.tsx`

- [ ] Write failing static-render tests for a charcoal navigation surface, green active navigation, visible focus styling, a light content surface, and no orange brand classes.
- [ ] Replace legacy brand tokens with `brand-green`, `brand-lime`, `surface`, `ink`, `charcoal`, and `muted`; retain state-specific amber/red tokens.
- [ ] Restyle the shell and module header with compact white content headers, softer borders, moderate radii, and accessible green controls.
- [ ] Remove the arbitrary-color compatibility block after usages are migrated; run `rg -n 'brand-orange|#ff7a1a|#e86305' src` and expect no results at completion.
- [ ] Run component tests and typecheck; expected: pass, then commit.

### Task 6: Build the complete staff interface

**Files:**
- Modify: `src/app/staff/page.tsx`
- Create: `src/features/staff/components/staff-management.tsx`
- Create: `src/features/staff/components/staff-management.test.tsx`
- Create: `src/features/staff/components/staff-form-status.tsx`

- [ ] Write failing render tests for name/email, role badges, invitation form, edit controls, lifecycle actions, empty/error/loading messaging, and destructive confirmation requiring a reason.
- [ ] Build a responsive staff table/cards view using Sport-tech components and Spanish labels.
- [ ] Add an invitation form for email, employee code, and initial roles; announce action results with `aria-live`.
- [ ] Add edit forms for employee code, status, and roles; distinguish suspend, revoke, soft-delete, and restore.
- [ ] Hide unavailable controls for usability while preserving all server/RLS authorization checks.
- [ ] Run staff UI tests, typecheck, lint, and build; expected: pass, then commit.

### Task 7: Verify security and complete the card

**Files:**
- Modify: `docs/api-contract.md`
- Modify: `docs/trello-board-template.md`

- [ ] Start local Supabase and apply only pending incremental migrations.
- [ ] Run all SQL tests and explicitly confirm authorized, unauthorized, cross-gym, and anonymous behavior.
- [ ] Run `npm test -- --run`, `npm run typecheck`, `npm run lint`, and `npm run build`; expected: all pass.
- [ ] Exercise invite, accept invitation, edit role, suspend, reactivate, soft-delete, and restore with non-production accounts from two gyms.
- [ ] Confirm each sensitive operation created an `audit_logs` record without tokens, passwords, or full permission payloads.
- [ ] Update the Trello checklist and API contract with actual results, unresolved limitations, and migration name; commit the completed card.
