# Configurable Membership Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver tenant-safe configurable plans, prepaid memberships, lifecycle operations, prorated credits/refunds, and an owner-only USD/NIO exchange rate.

**Architecture:** Incremental PostgreSQL migrations and atomic RPCs remain the financial and authorization boundary. Server Actions derive the active gym and pass only user choices; PostgreSQL recalculates prices, rates, credits, refunds, permissions, and audit records. Client components render serializable DTOs and never calculate authoritative money.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, Zod 4, Supabase Auth/PostgreSQL/RLS/RPC, Vitest, pgTAP.

---

### Task 1: Align the operational contract and protect the baseline

**Files:**
- Modify: `Docs/trello-board-template.md`
- Modify: `docs/api-contract.md`
- Test: `supabase/tests/members_api_contract.sql`

- [ ] **Step 1: Replace the obsolete partial-payment requirement**

Update the membership/payment cards to state that each day/week/month period is paid in full and in advance. Preserve the existing local edit in the Trello template.

```markdown
- El cargo del período se paga completo y por adelantado.
- No se permiten pagos parciales.
- Una membresía nueva no habilita acceso hasta confirmar el pago completo.
- La gracia se aplica únicamente a renovaciones.
```

- [ ] **Step 2: Change the old contract test to describe the new invariant**

Replace assertions that accept a partial initial allocation with assertions that expect the future v2 RPC to reject it.

```sql
select throws_ok(
  $$ select public.start_member_subscription(
    '60000000-0000-4000-8000-000000000002'::uuid,
    '40000000-0000-4000-8000-000000000001'::uuid,
    current_date,
    (select id from public.payment_methods where code = 'cash'),
    450.00,
    'NIO'
  ) $$,
  '23514',
  'Full payment is required',
  'a partial prepaid membership is rejected'
);
```

- [ ] **Step 3: Run the focused SQL test and confirm RED**

Run: `npx supabase test db supabase/tests/members_api_contract.sql`  
Expected: FAIL because `start_member_subscription` does not exist or partial payment is still accepted.

- [ ] **Step 4: Document the new API boundary**

Add the approved rules and note that legacy `create_gym_member` must not be used to create an unpaid active subscription.

- [ ] **Step 5: Commit only contract changes**

```powershell
git add Docs/trello-board-template.md docs/api-contract.md supabase/tests/members_api_contract.sql
git commit -m "docs: align prepaid membership contract"
```

### Task 2: Add exchange-rate storage and owner-only mutation

**Files:**
- Create: `supabase/migrations/20260804023000_gym_exchange_rate_contract.sql`
- Create: `supabase/tests/gym_exchange_rate_contract.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write pgTAP fixtures and failing tests**

Cover owner success, manager/receptionist rejection, other-gym rejection, anonymous rejection, positive numeric validation, initial `36.60`, immutable history, and audit output.

```sql
select is(
  (select nio_per_usd from public.gym_exchange_rate_current where gym_id = :'gym_a'),
  36.60::numeric,
  'new gyms start at C$36.60 per US$1'
);
```

- [ ] **Step 2: Run the exchange-rate test and confirm RED**

Run: `npx supabase test db supabase/tests/gym_exchange_rate_contract.sql`  
Expected: FAIL because the table/view/RPC is missing.

- [ ] **Step 3: Add the incremental exchange-rate contract**

Create immutable `gym_exchange_rate_history`, a security-invoker current-rate view, and a private owner check based on an active system-owner role assignment—not a client value or visible label.

```sql
create table public.gym_exchange_rate_history (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete restrict,
  nio_per_usd numeric(14,6) not null check (nio_per_usd > 0),
  effective_at timestamptz not null default timezone('utc', now()),
  changed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);
```

Add `public.update_gym_exchange_rate(p_nio_per_usd numeric)` as `security definer`; derive the active gym from the authenticated owner, lock the current row, insert history, and insert an audit record containing only old/new rate values.

- [ ] **Step 4: Restrict grants and add RLS**

Authenticated users with `gym.read` may read their gym’s current rate. No authenticated caller may insert/update/delete history directly. Only the RPC may mutate it.

- [ ] **Step 5: Seed deterministic development rates**

Insert `36.60` for seeded gyms without embedding secrets or production IDs.

- [ ] **Step 6: Run the focused test and confirm GREEN**

Run: `npx supabase test db supabase/tests/gym_exchange_rate_contract.sql`  
Expected: all assertions pass and the test transaction rolls back.

- [ ] **Step 7: Commit**

```powershell
git add supabase/migrations/20260804023000_gym_exchange_rate_contract.sql supabase/tests/gym_exchange_rate_contract.sql supabase/seed.sql
git commit -m "feat(settings): add owner-only gym exchange rate"
```

### Task 3: Add configurable plan and subscription snapshots

**Files:**
- Create: `supabase/migrations/20260804024000_membership_plan_foundation.sql`
- Create: `supabase/tests/membership_plan_contract.sql`
- Create: `supabase/tests/membership_subscription_contract.sql`

- [ ] **Step 1: Write failing plan tests**

Test positive quantities for `day`, `week`, and `month`; USD/NIO only; manual/automatic renewal; grace from zero; immutable subscription snapshots; active-code uniqueness; soft deletion/restoration; authorized/unauthorized/cross-gym/anonymous access.

```sql
select lives_ok(
  $$ select public.create_membership_plan('DAY', 'Pase diario', 1, 'day', 5.00, 'USD', 0, 'manual', '[]') $$,
  'owner can create a daily plan'
);
```

- [ ] **Step 2: Run plan/subscription tests and confirm RED**

Run: `npx supabase test db supabase/tests/membership_plan_contract.sql supabase/tests/membership_subscription_contract.sql`  
Expected: FAIL because duration units, renewal modes, snapshots, and RPCs are missing.

- [ ] **Step 3: Add enums and plan columns incrementally**

Add `membership_duration_unit ('day','week','month')` and `membership_renewal_mode ('manual','automatic')`; add `duration_quantity`, `duration_unit`, and `renewal_mode`; backfill existing plans from `billing_cycle_months` as month units before making fields required.

- [ ] **Step 4: Add complete subscription snapshots**

Store duration quantity/unit, grace days, renewal mode, price, currency, discount terms, and accepted plan metadata on each subscription. Existing subscriptions are backfilled without rewriting charges or payments.

- [ ] **Step 5: Add atomic plan RPCs**

Create `create_membership_plan` and `update_membership_plan`. Derive `gym_id`, require `memberships.manage`, accept money as PostgreSQL numeric, validate benefits JSON, audit changes, and never mutate existing snapshots.

- [ ] **Step 6: Keep legacy monthly columns temporarily compatible**

Do not drop already-used columns in this migration. Add comments marking them compatibility-only and ensure new RPCs use quantity/unit.

- [ ] **Step 7: Run tests and confirm GREEN**

Run: `npx supabase test db supabase/tests/membership_plan_contract.sql supabase/tests/membership_subscription_contract.sql`  
Expected: all assertions pass.

- [ ] **Step 8: Commit**

```powershell
git add supabase/migrations/20260804024000_membership_plan_foundation.sql supabase/tests/membership_plan_contract.sql supabase/tests/membership_subscription_contract.sql
git commit -m "feat(memberships): add configurable plan foundation"
```

### Task 4: Add atomic prepaid lifecycle, discounts, freezes, changes, and refunds

**Files:**
- Create: `supabase/migrations/20260804025000_membership_lifecycle_contract.sql`
- Create: `supabase/tests/membership_payment_contract.sql`
- Create: `supabase/tests/membership_discount_contract.sql`
- Create: `supabase/tests/membership_freeze_contract.sql`
- Create: `supabase/tests/membership_change_contract.sql`
- Create: `supabase/tests/membership_cancellation_refund_contract.sql`
- Create: `supabase/tests/membership_audit_contract.sql`

- [ ] **Step 1: Write failing lifecycle tests**

Cover full payment only, activation after payment, renewal grace, fixed/percentage discounts, no negative charge, freeze overlap rejection, exact expiration extension, immediate/scheduled change, cancellation modes, refund limits, and audit records.

```sql
select throws_ok(
  $$ select public.record_full_membership_payment(:charge_id, :method_id, 9.99, 'USD', null) $$,
  '23514',
  'Full payment is required',
  'payment below the full charge is rejected'
);
```

- [ ] **Step 2: Run lifecycle tests and confirm RED**

Run: `npx supabase test db supabase/tests/membership_payment_contract.sql supabase/tests/membership_discount_contract.sql supabase/tests/membership_freeze_contract.sql supabase/tests/membership_change_contract.sql supabase/tests/membership_cancellation_refund_contract.sql`  
Expected: FAIL because lifecycle tables/RPCs are missing.

- [ ] **Step 3: Add lifecycle history tables**

Create focused tables for discounts, freezes, plan changes, credits, and refunds. Use restrictive foreign keys for financial history. Require reason/actor/date and prevent overlapping active freezes and cumulative over-refunds.

- [ ] **Step 4: Implement period arithmetic**

Create a private function that adds day/week/month quantities using calendar arithmetic. Months must not be treated as 30 days.

```sql
case p_unit
  when 'day' then p_start + p_quantity
  when 'week' then p_start + (p_quantity * 7)
  when 'month' then (p_start + make_interval(months => p_quantity))::date
end
```

- [ ] **Step 5: Implement atomic start/renew/payment RPCs**

Add `start_member_subscription`, `renew_member_subscription`, and `record_full_membership_payment`. Lock relevant rows, derive plan price and current rate in PostgreSQL, create charge/payment/allocation/receipt atomically, and activate access only after full settlement.

- [ ] **Step 6: Implement discounts and freezes**

Add RPCs to create/end discounts and freeze/resume subscriptions. Freeze blocks access and charge generation; resume extends expiration by exact frozen days. Discounts affect only future charges.

- [ ] **Step 7: Implement plan-change preview and confirmation**

Add a read-only preview RPC and an atomic confirmation RPC. Use `[period_start, period_end)` in the gym timezone; the current day is consumed and refundable days begin tomorrow.

```sql
v_remaining_days := greatest(v_period_end - v_gym_today, 0);
v_credit := round((v_paid_amount / v_total_days) * v_remaining_days, 2);
```

For cross-currency changes, store original amount/currency, `nio_per_usd`, converted amount/currency, and rounding result.

- [ ] **Step 8: Implement cancellation/refund RPCs**

Require a reason. Support immediate with or without proportional refund and end-of-period without refund. Refund against the original payment, in its original currency, record method/status/actor, and reject totals above settled amount minus prior refunds.

- [ ] **Step 9: Audit every sensitive transition**

Write compact `audit_logs` entries without tokens, full permission payloads, or unnecessary financial data.

- [ ] **Step 10: Run lifecycle and audit tests**

Run: `npx supabase test db supabase/tests/membership_payment_contract.sql supabase/tests/membership_discount_contract.sql supabase/tests/membership_freeze_contract.sql supabase/tests/membership_change_contract.sql supabase/tests/membership_cancellation_refund_contract.sql supabase/tests/membership_audit_contract.sql`  
Expected: all assertions pass.

- [ ] **Step 11: Commit**

```powershell
git add supabase/migrations/20260804025000_membership_lifecycle_contract.sql supabase/tests/membership_*_contract.sql
git commit -m "feat(memberships): add atomic prepaid lifecycle"
```

### Task 5: Harden RLS, grants, access status, and member creation

**Files:**
- Create: `supabase/migrations/20260804026000_membership_security_hardening.sql`
- Create: `supabase/tests/membership_rls_contract.sql`
- Create: `supabase/tests/member_access_v2_contract.sql`
- Modify: `supabase/tests/members_api_contract.sql`

- [ ] **Step 1: Write failing direct-DML and access tests**

Assert that authenticated users cannot directly delete financial/history rows or bypass RPCs with direct inserts/updates. Test owner, authorized manager, receptionist, no-permission user, other gym, and anonymous caller.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx supabase test db supabase/tests/membership_rls_contract.sql supabase/tests/member_access_v2_contract.sql`  
Expected: FAIL because current `FOR ALL` policies and global grants permit unsafe mutations.

- [ ] **Step 3: Revoke unsafe table mutations**

Remove `FOR ALL` policies for subscriptions, events, cancellations, charges, payments, allocations, credits, and refunds. Revoke direct `INSERT`, `UPDATE`, and `DELETE` where RPC-only mutation is required. Preserve tenant-filtered reads.

- [ ] **Step 4: Rebuild access decisions from snapshots**

Update `private.member_access_allowed` and access views so unpaid new memberships fail, paid renewals may use snapshotted grace, freezes fail, and retired plans do not invalidate historical subscriptions.

- [ ] **Step 5: Version the member-creation RPC**

Replace unsafe optional-payment behavior with a v2 flow that either creates a prospect without subscription or invokes the atomic prepaid subscription operation. Require `members.manage`, `memberships.manage`, and `payments.manage` according to requested work.

- [ ] **Step 6: Run all focused SQL tests**

Run: `npx supabase test db`  
Expected: all pgTAP suites pass; no cross-tenant or anonymous mutation succeeds.

- [ ] **Step 7: Regenerate database types**

Run: `npx supabase gen types typescript --local > src/types/database.types.ts` using the repository’s approved generation workflow.  
Expected: new enums, tables, views, and RPC signatures appear without manual edits.

- [ ] **Step 8: Commit**

```powershell
git add supabase/migrations/20260804026000_membership_security_hardening.sql supabase/tests src/types/database.types.ts
git commit -m "fix(security): enforce atomic membership mutations"
```

### Task 6: Build owner-only exchange-rate settings

**Files:**
- Create: `src/features/settings/types/exchange-rate.dto.ts`
- Create: `src/features/settings/schemas/exchange-rate.schema.ts`
- Create: `src/features/settings/schemas/exchange-rate.schema.test.ts`
- Create: `src/features/settings/services/exchange-rate.repository.ts`
- Create: `src/features/settings/services/exchange-rate.repository.test.ts`
- Create: `src/features/settings/actions/exchange-rate.actions.ts`
- Create: `src/features/settings/actions/exchange-rate.actions.test.ts`
- Create: `src/features/settings/components/exchange-rate-settings.tsx`
- Create: `src/features/settings/components/exchange-rate-settings.test.tsx`
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Write failing schema tests**

Test trimmed decimal strings, positive values, maximum precision, and rejection of commas, exponents, zero, negative numbers, `NaN`, and client-supplied gym IDs.

```ts
expect(exchangeRateSchema.parse({ nioPerUsd: "36.600000" })).toEqual({ nioPerUsd: "36.600000" });
expect(() => exchangeRateSchema.parse({ nioPerUsd: "0" })).toThrow();
```

- [ ] **Step 2: Run schema test and confirm RED**

Run: `npm test -- --run src/features/settings/schemas/exchange-rate.schema.test.ts`  
Expected: FAIL because the schema is missing.

- [ ] **Step 3: Implement schema and DTO**

Keep the rate as a decimal string end-to-end. Do not convert authoritative money/rates to JavaScript `number`.

- [ ] **Step 4: Write failing repository/action tests**

Assert that reads use the current-rate view; writes call only `update_gym_exchange_rate`; the action derives the active gym/session and ignores any submitted `gymId` or previous rate.

- [ ] **Step 5: Implement repository and Server Action**

Map permission/conflict/validation errors to concise Spanish messages and revalidate `/settings`.

- [ ] **Step 6: Write failing component test**

Verify the `C$ por US$1` label, current `36.60`, update timestamp, owner-only form, disabled pending state, and `aria-live` response.

- [ ] **Step 7: Implement the component and integrate carefully**

Compose it with the existing uncommitted `BranchManagement` changes in `src/app/settings/page.tsx`; do not overwrite or revert branch CRUD work.

- [ ] **Step 8: Run focused tests and typecheck**

Run: `npm test -- --run src/features/settings`  
Run: `npm run typecheck`  
Expected: all settings tests pass and TypeScript reports zero errors.

- [ ] **Step 9: Commit only exchange-rate frontend files plus the merged page**

```powershell
git add src/features/settings src/app/settings/page.tsx
git commit -m "feat(settings): add exchange rate controls"
```

### Task 7: Build configurable plan administration

**Files:**
- Modify: `src/features/memberships/types/membership.dto.ts`
- Create: `src/features/memberships/schemas/membership-plan.schema.ts`
- Create: `src/features/memberships/schemas/membership-plan.schema.test.ts`
- Modify: `src/features/memberships/services/membership.repository.ts`
- Create: `src/features/memberships/services/membership.repository.test.ts`
- Create: `src/features/memberships/actions/membership-plan.actions.ts`
- Create: `src/features/memberships/actions/membership-plan.actions.test.ts`
- Create: `src/features/memberships/components/membership-plan-management.tsx`
- Create: `src/features/memberships/components/membership-plan-management.test.tsx`

- [ ] **Step 1: Write failing schema tests**

Test code/name normalization, decimal price strings, USD/NIO, positive duration, day/week/month, grace from zero, manual/automatic renewal, benefits, and deletion reason.

- [ ] **Step 2: Run schema tests and confirm RED**

Run: `npm test -- --run src/features/memberships/schemas/membership-plan.schema.test.ts`  
Expected: FAIL because the schema is missing.

- [ ] **Step 3: Implement focused DTOs and schemas**

Define plan, benefit, deleted-plan, capability, and action-state DTOs. Preserve all numeric money as strings.

- [ ] **Step 4: Write failing repository/action tests**

Test list/create/update/soft-delete/restore, RPC names and arguments, active-gym derivation, ignored client `gymId`, duplicate code, permission error, and revalidation.

- [ ] **Step 5: Implement repository and actions**

Use plan RPCs for create/update and existing soft-delete/restore RPCs for lifecycle. Never use physical DELETE.

- [ ] **Step 6: Write failing UI tests**

Cover Spanish labels, price/currency, duration, renewal, grace, benefits, active/inactive state, create/edit controls, retirement reason, paper bin, empty/error/pending states, and hidden controls without permission.

- [ ] **Step 7: Implement responsive plan management**

Follow Sport-tech tokens and existing accessible form patterns. Keep critical validation on server/PostgreSQL.

- [ ] **Step 8: Run focused tests and typecheck**

Run: `npm test -- --run src/features/memberships`  
Run: `npm run typecheck`  
Expected: all pass.

- [ ] **Step 9: Commit**

```powershell
git add src/features/memberships
git commit -m "feat(memberships): add configurable plan management"
```

### Task 8: Build subscription lifecycle interface

**Files:**
- Create: `src/features/memberships/schemas/subscription.schema.ts`
- Create: `src/features/memberships/schemas/subscription.schema.test.ts`
- Create: `src/features/memberships/actions/subscription.actions.ts`
- Create: `src/features/memberships/actions/subscription.actions.test.ts`
- Create: `src/features/memberships/components/subscription-management.tsx`
- Create: `src/features/memberships/components/subscription-management.test.tsx`
- Modify: `src/app/memberships/page.tsx`
- Create: `src/app/memberships/loading.tsx`
- Create: `src/app/memberships/page.test.tsx`

- [ ] **Step 1: Write failing subscription-schema tests**

Use discriminated unions for start/renew, freeze/resume, scheduled/immediate plan change, credit/refund choice, cancellation timing, and required reasons.

- [ ] **Step 2: Run schema tests and confirm RED**

Run: `npm test -- --run src/features/memberships/schemas/subscription.schema.test.ts`  
Expected: FAIL because the schema is missing.

- [ ] **Step 3: Implement schemas and repository methods**

Client inputs contain entity IDs and decisions only. Prices, balances, rates, refund amounts, actor, and gym are returned/derived by server RPCs.

- [ ] **Step 4: Write failing action tests**

Cover assign with full payment, renewal, discount, freeze/resume, cancellation, preview/confirm plan change, permission/conflict errors, cross-gym-safe server derivation, and path revalidation.

- [ ] **Step 5: Implement Server Actions**

Return `{ ok, message, fieldErrors, preview }` for expected outcomes. Revalidate `/memberships`, affected member detail, `/payments`, and `/dashboard` after committed mutations.

- [ ] **Step 6: Write failing component/page tests**

Cover member/plan selection, full prepaid amount returned by server, payment method, renewal, lifecycle timeline, preview dialog content, apply-credit/refund options, explicit confirmation, empty/error/loading, and `aria-live` results.

- [ ] **Step 7: Implement the interface**

Display authoritative string amounts from RPC previews. Never compute proration or FX in React. Separate plan administration from subscription operations with clear responsive sections.

- [ ] **Step 8: Run focused frontend verification**

Run: `npm test -- --run src/features/memberships src/app/memberships/page.test.tsx`  
Run: `npm run typecheck`  
Expected: all pass.

- [ ] **Step 9: Commit**

```powershell
git add src/features/memberships src/app/memberships
git commit -m "feat(memberships): add prepaid lifecycle interface"
```

### Task 9: Verify the card and record the next dashboard task

**Files:**
- Modify: `docs/api-contract.md`
- Modify: `Docs/trello-board-template.md`
- Create: `Docs/superpowers/specs/2026-08-04-owner-dashboard-design.md`

- [ ] **Step 1: Run all SQL tests**

Run: `npx supabase test db`  
Expected: all tests pass, including authorized, no-permission, other-gym, anonymous, direct-DML rejection, money, access, and audit cases.

- [ ] **Step 2: Run all application checks**

Run: `npm test -- --run`  
Run: `npm run typecheck`  
Run: `npm run lint`  
Run: `npm run build`  
Expected: zero failures/errors and a successful production build.

- [ ] **Step 3: Exercise a two-gym realistic flow**

Create daily, weekly, and monthly plans; start and pay subscriptions; renew with grace; freeze/resume; schedule and immediately change plans; apply credit; refund; cancel; update FX as owner; attempt each operation as disallowed roles and another gym.

- [ ] **Step 4: Verify audit and historical immutability**

Confirm sensitive actions create compact audit rows and that changing plans/rates never modifies prior charges, payments, rates, snapshots, credits, or refunds.

- [ ] **Step 5: Document the dashboard as the next card**

Record verified metric definitions and dependencies. The future dashboard must distinguish active paid memberships from administrative members, distinct delinquent members from overdue charges, USD from NIO, gym-local dates from UTC, and manual entries from face events.

- [ ] **Step 6: Commit final documentation**

```powershell
git add docs/api-contract.md Docs/trello-board-template.md Docs/superpowers/specs/2026-08-04-owner-dashboard-design.md
git commit -m "docs: complete membership lifecycle contract"
```
