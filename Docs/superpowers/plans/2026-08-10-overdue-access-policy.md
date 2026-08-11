# Overdue Access Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make initial-payment blocking, renewal grace and overdue blocking use one PostgreSQL decision across manual and facial entry flows.

**Architecture:** Add a private PostgreSQL function that derives `paid`, `initial_payment_required`, `grace` or `overdue` from the current subscription, charge dates and settled allocations. Keep `member_access_allowed` as the compatibility boolean, expose the richer state through entry/search contracts, and preserve audited `entries.manage` manual overrides.

**Tech Stack:** PostgreSQL 17, Supabase migrations/RPC/RLS, pgTAP, Next.js App Router, TypeScript, React, Vitest.

---

### Task 1: Canonical financial access state

**Files:**
- Create: `supabase/migrations/20260810200000_overdue_access_policy.sql`
- Create: `supabase/tests/overdue_access_policy.sql`

- [ ] **Step 1: Write failing pgTAP cases for the four states**

Create transaction-scoped members and subscriptions in gym `20000000-0000-4000-8000-000000000001`. Insert charges whose paid balance is controlled with settled payments and allocations. Assert:

```sql
select plan(12);

select is(
  private.member_financial_access_state(
    '60000000-0000-4000-8000-000000000091', current_date
  ),
  'initial_payment_required',
  'unpaid first charge blocks without grace'
);

select is(
  private.member_financial_access_state(
    '60000000-0000-4000-8000-000000000092', current_date
  ),
  'grace',
  'unpaid renewal inside grace is allowed with warning'
);

select is(
  private.member_financial_access_state(
    '60000000-0000-4000-8000-000000000093', current_date
  ),
  'overdue',
  'partial renewal after grace blocks access'
);

select is(
  private.member_financial_access_state(
    '60000000-0000-4000-8000-000000000094', current_date
  ),
  'paid',
  'fully paid charges produce paid state'
);
```

Add boolean assertions showing `private.member_access_allowed` is false for initial payment and overdue, true for grace and paid. Add boundary assertions for `due_date + grace_days` inclusive and the following day blocked. Add a settled payment for the overdue balance and assert the state immediately becomes `paid`.

- [ ] **Step 2: Run the new pgTAP file and verify RED**

Run: `npx supabase test db supabase/tests/overdue_access_policy.sql`

Expected: FAIL because `private.member_financial_access_state(uuid,date)` does not exist.

- [ ] **Step 3: Implement the private state function in a new migration**

Use a stable security-definer SQL function with an empty search path. Calculate remaining amounts only from payments in `settled` state and prioritize states explicitly:

```sql
create or replace function private.member_financial_access_state(
  p_gym_member_id uuid,
  p_on_date date default current_date
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with current_subscription as (
    select ms.id, ms.start_date, mp.grace_days
    from public.member_subscriptions ms
    join public.membership_plans mp on mp.id = ms.membership_plan_id
    where ms.gym_member_id = p_gym_member_id
      and ms.status = 'active'
      and ms.start_date <= p_on_date
      and (ms.end_date is null or ms.end_date >= p_on_date)
    order by ms.created_at desc
    limit 1
  ), balances as (
    select
      mc.period_start,
      mc.due_date,
      cs.start_date,
      cs.grace_days,
      mc.amount_due - coalesce(sum(a.amount) filter (
        where p.status = 'settled'
      ), 0) as remaining
    from current_subscription cs
    join public.membership_charges mc on mc.member_subscription_id = cs.id
    left join public.member_payment_allocations a on a.membership_charge_id = mc.id
    left join public.member_payments p on p.id = a.member_payment_id
    where mc.status in ('pending', 'partial', 'overdue')
    group by mc.id, mc.period_start, mc.due_date, mc.amount_due,
      cs.start_date, cs.grace_days
  )
  select case
    when exists (
      select 1 from balances
      where remaining > 0 and period_start = start_date and due_date <= p_on_date
    ) then 'initial_payment_required'
    when exists (
      select 1 from balances
      where remaining > 0 and period_start <> start_date
        and due_date + grace_days < p_on_date
    ) then 'overdue'
    when exists (
      select 1 from balances
      where remaining > 0 and period_start <> start_date
        and due_date < p_on_date
        and due_date + grace_days >= p_on_date
    ) then 'grace'
    else 'paid'
  end
$$;

revoke all on function private.member_financial_access_state(uuid, date) from public;
grant execute on function private.member_financial_access_state(uuid, date)
  to authenticated, service_role;
```

Replace only the financial `not exists` clause inside the latest `private.member_access_allowed` body with:

```sql
and private.member_financial_access_state(gm.id, p_at::date) in ('paid', 'grace')
```

Retain the day-pass path and all member/subscription status and date checks exactly.

- [ ] **Step 4: Run the focused pgTAP test and verify GREEN**

Run: `npx supabase test db supabase/tests/overdue_access_policy.sql`

Expected: all 12 assertions PASS.

- [ ] **Step 5: Commit the canonical policy**

```powershell
git add supabase/migrations/20260810200000_overdue_access_policy.sql supabase/tests/overdue_access_policy.sql
git commit -m "feat(access): derive overdue and grace states"
```

### Task 2: Manual entry, search and alert contracts

**Files:**
- Modify: `supabase/migrations/20260810200000_overdue_access_policy.sql`
- Modify: `supabase/tests/overdue_access_policy.sql`
- Modify: `supabase/tests/member_entries.sql`
- Modify: `supabase/tests/gym_alerts.sql`

- [ ] **Step 1: Add failing contract assertions**

Add `financial_access_status text` to the expected search result and `financialAccessStatus` to entry JSON assertions:

```sql
select is(
  (public.register_member_entry(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000092',
    '30000000-0000-4000-8000-000000000001',
    null
  ) ->> 'financialAccessStatus'),
  'grace',
  'manual entry exposes grace state'
);

select is(
  (public.register_member_entry(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000093',
    '30000000-0000-4000-8000-000000000001',
    'Autorizado por recepción'
  ) ->> 'decision'),
  'manual_review',
  'entries.manage can override overdue block with a reason'
);

select ok(
  exists(select 1 from public.audit_logs where action = 'entry.override'),
  'manual override remains audited'
);
```

Assert `search_entry_members` returns `initial_payment_required`, `grace` and `overdue` without leaking any member from gym 2. Assert a grace entry creates a warning alert and an initial/overdue denial creates a block alert without storing an amount.

- [ ] **Step 2: Run entry and alert tests and verify RED**

Run: `npx supabase test db supabase/tests/member_entries.sql supabase/tests/gym_alerts.sql supabase/tests/overdue_access_policy.sql`

Expected: FAIL because exposed contracts do not contain the financial state.

- [ ] **Step 3: Extend entry persistence and RPCs compatibly**

In the migration add a nullable column with a constrained value:

```sql
alter table public.member_entries
  add column financial_access_status text,
  add constraint member_entries_financial_access_status_valid
    check (financial_access_status is null or financial_access_status in (
      'paid', 'initial_payment_required', 'grace', 'overdue'
    ));
```

Recreate the latest `v_member_access_status` definition and append:

```sql
private.member_financial_access_state(gm.id, current_date)
  as financial_access_status
```

In the latest `register_member_entry` body, read that value into `v_financial_access_status`, store it in `member_entries`, and append it to the JSON response. Set denial reasons by state before the generic overdue fallback:

```sql
when v_financial_access_status = 'initial_payment_required'
  then 'El pago inicial está pendiente.'
when v_financial_access_status = 'overdue'
  then 'El miembro tiene cargos vencidos fuera del período de gracia.'
```

Keep `entries.manage`, mandatory non-empty override reason, duplicate-entry protection and `entry.override` audit unchanged.

Drop and recreate `search_entry_members(uuid,text,integer)` because its table return type changes. Copy the latest phone-search implementation from `20260810160000_entry_member_phone_search.sql`, append `financial_access_status text` to `returns table`, and select the value from `v_member_access_status`. Revoke public execution and restore the current authenticated/service-role grants.

- [ ] **Step 4: Make alerts use the canonical state**

Update the entry-alert trigger in the same migration. Use `new.financial_access_status` to select warning versus block category, preserve gym/member/entry ids, and deduplicate on gym, member, financial state and service date. Do not include amount, phone, embedding or image data in alert metadata.

- [ ] **Step 5: Run focused database tests and verify GREEN**

Run: `npx supabase test db supabase/tests/member_entries.sql supabase/tests/gym_alerts.sql supabase/tests/overdue_access_policy.sql`

Expected: all assertions PASS, including cross-gym rejection and audited override.

- [ ] **Step 6: Commit entry contracts**

```powershell
git add supabase/migrations/20260810200000_overdue_access_policy.sql supabase/tests/overdue_access_policy.sql supabase/tests/member_entries.sql supabase/tests/gym_alerts.sql
git commit -m "feat(entries): expose grace and overdue decisions"
```

### Task 3: TypeScript contracts and clear entry states

**Files:**
- Modify: `src/features/entries/types/entry.dto.ts`
- Modify: `src/features/entries/services/entry-member-search.repository.ts`
- Modify: `src/features/entries/services/entry-member-search.repository.test.ts`
- Modify: `src/features/entries/mappers/entry.mapper.ts`
- Modify: `src/features/entries/mappers/entry.mapper.test.ts`
- Modify: `src/features/entries/entry-decision-state.ts`
- Modify: `src/features/entries/entry-decision-state.test.ts`
- Modify: `src/features/entries/components/entry-access-notice.tsx`
- Modify: `src/features/entries/components/entry-access-notice.test.tsx`
- Regenerate: `src/types/database.types.ts`

- [ ] **Step 1: Write failing mapper and presentation tests**

```ts
it("maps the server financial access state", () => {
  expect(mapEntryMemberSearchRow({
    gym_member_id: "member-1",
    member_code: "M-1",
    full_name: "Ana López",
    status: "active",
    membership_status: "active",
    has_overdue_charges: true,
    financial_access_status: "grace",
  }).financialAccessStatus).toBe("grace");
});

it("shows an allowed renewal in grace as a warning", () => {
  expect(getEntryDecisionState({
    decision: "allowed",
    financialAccessStatus: "grace",
  })).toMatchObject({ label: "En gracia", tone: "warning" });
});

it("distinguishes initial payment from overdue renewal", () => {
  expect(getEntryDecisionState({
    decision: "denied",
    financialAccessStatus: "initial_payment_required",
  }).label).toBe("Pago pendiente");
  expect(getEntryDecisionState({
    decision: "denied",
    financialAccessStatus: "overdue",
  }).label).toBe("Morosa");
});
```

- [ ] **Step 2: Run focused Vitest tests and verify RED**

Run: `npm test -- src/features/entries`

Expected: FAIL because DTOs and decision state lack `financialAccessStatus`.

- [ ] **Step 3: Add the shared TypeScript union and map server-only decisions**

```ts
export type FinancialAccessStatus =
  | "paid"
  | "initial_payment_required"
  | "grace"
  | "overdue";
```

Add `financialAccessStatus: FinancialAccessStatus` to search and registered-entry DTOs, and `financial_access_status` to database rows. Map the snake-case field without deriving it from `hasOverdueCharges` in the browser.

Extend `EntryDecisionState["label"]` with `"En gracia"` and `"Pago pendiente"`. Evaluate `manual_review` first so its audit reason remains visible, then return warning for allowed `grace`, warning for denied initial payment, warning for overdue, and preserve the existing prospect/inactive/blocked distinctions.

- [ ] **Step 4: Render clear, private labels in the existing entry component**

Show only the four labels and the existing generic explanation. Do not display balance, phone, membership price or payment history in the entry result. Keep the override form visible only after a denied server decision.

- [ ] **Step 5: Regenerate local database types**

Run: `npx supabase gen types typescript --local`

Replace `src/types/database.types.ts` with the generated output using the repository's documented generation command; do not hand-edit generated types.

- [ ] **Step 6: Run entry tests and typecheck**

Run: `npm test -- src/features/entries`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS with the new RPC/view fields.

- [ ] **Step 7: Commit the application contract**

```powershell
git add src/features/entries src/types/database.types.ts
git commit -m "feat(entries): show grace and payment blocks clearly"
```

### Task 4: Facial-access regression and full verification

**Files:**
- Modify: `supabase/tests/face_access_contract.sql`

- [ ] **Step 1: Add face-access regression assertions**

Create enrolled candidates linked to members in each financial state using the existing fixtures in `face_access_contract.sql`. Assert the existing `verify_face_access` decision is allowed for `paid` and `grace`, denied for `initial_payment_required` and `overdue`, and never creates `manual_review` from a facial call.

```sql
select is(
  public.verify_face_access(
    p_gym_id, p_embedding, p_branch_id, p_device_id,
    0.363, 5, null
  ) ->> 'decision',
  'denied',
  'facial access cannot override an overdue block'
);
```

- [ ] **Step 2: Run face and access tests and verify RED/GREEN behavior**

Run before any face implementation change: `npx supabase test db supabase/tests/face_access_contract.sql supabase/tests/overdue_access_policy.sql`

Expected: PASS if `verify_face_access` already delegates to `member_access_allowed`. If a test fails, change only the face RPC branch that bypasses that helper, rerun, and require PASS.

- [ ] **Step 3: Run full pgTAP**

Run: `npx supabase test db`

Expected: all database contract files PASS.

- [ ] **Step 4: Run full application verification**

Run: `npm test`

Expected: all Vitest tests PASS.

Run: `npm run lint`

Expected: exit 0.

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0 and `/entries` plus `/facial-access` compile.

- [ ] **Step 5: Review scope and commit regression coverage**

Run: `git diff --check origin/main...HEAD`

Expected: no whitespace errors.

```powershell
git add supabase/tests/face_access_contract.sql
git commit -m "test(access): align facial checks with overdue policy"
```

- [ ] **Step 6: Push and create a PR**

Push `feat/overdue-access-policy` and create a PR against `main`. Include the migration name, compatibility fields, override rule and exact Vitest/pgTAP/build evidence. Preserve the implementation worktree for review feedback.
