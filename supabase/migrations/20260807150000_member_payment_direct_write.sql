begin;

lock table public.member_payments in access exclusive mode;

with null_payments as (
  select
    mp.id,
    mp.gym_id,
    'R-LEGACY-' || upper(replace(mp.id::text, '-', '')) as base_receipt
  from public.member_payments mp
  where mp.receipt_number is null
),
backfill as (
  select np.id, candidate.receipt_number
  from null_payments np
  cross join lateral (
    select case
      when suffix.value = 0 then np.base_receipt
      else np.base_receipt || '-' || suffix.value::text
    end as receipt_number
    from generate_series(
      0,
      (
        select count(*)::integer
        from public.member_payments existing
        where existing.gym_id = np.gym_id
          and existing.receipt_number is not null
      )
    ) as suffix(value)
    where not exists (
      select 1
      from public.member_payments existing
      where existing.gym_id = np.gym_id
        and existing.receipt_number = case
          when suffix.value = 0 then np.base_receipt
          else np.base_receipt || '-' || suffix.value::text
        end
    )
    order by suffix.value
    limit 1
  ) candidate
)
update public.member_payments mp
set receipt_number = backfill.receipt_number
from backfill
where mp.id = backfill.id;

alter table public.member_payments
  alter column receipt_number set not null;

revoke insert, update, delete on public.member_payments from authenticated;
revoke insert, update, delete on public.membership_charges from authenticated;
revoke insert, update, delete on public.member_payment_allocations from authenticated;

commit;
