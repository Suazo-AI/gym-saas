begin;

alter table public.member_payments
  add column exchange_rate_history_id uuid references public.gym_exchange_rate_history(id) on delete restrict,
  add column applied_nio_per_usd numeric(14,6);

update public.member_payments mp
set (exchange_rate_history_id, applied_nio_per_usd) = (
  select h.id, h.nio_per_usd
  from public.gym_exchange_rate_history h
  where h.gym_id = mp.gym_id
  order by h.effective_at desc, h.created_at desc, h.id desc
  limit 1
);

alter table public.member_payments
  alter column exchange_rate_history_id set not null,
  alter column applied_nio_per_usd set not null,
  add constraint member_payments_applied_rate_positive check (applied_nio_per_usd > 0);

create function private.snapshot_member_payment_exchange_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.exchange_rate_history_id is null or new.applied_nio_per_usd is null then
    select h.id, h.nio_per_usd
    into new.exchange_rate_history_id, new.applied_nio_per_usd
    from public.gym_exchange_rate_history h
    where h.gym_id = new.gym_id
    order by h.effective_at desc, h.created_at desc, h.id desc
    limit 1;
  end if;
  if new.exchange_rate_history_id is null then
    raise exception 'Gym exchange rate is not configured' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_member_payments_snapshot_exchange_rate
before insert on public.member_payments
for each row execute function private.snapshot_member_payment_exchange_rate();

create function public.list_payable_member_charges(p_gym_id uuid)
returns table (
  charge_id uuid, gym_member_id uuid, member_label text, due_date date,
  amount_due numeric(14,2), currency char(3), status public.charge_status
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.has_permission(p_gym_id, 'payments.manage') then
    raise exception 'Insufficient permission: payments.manage' using errcode = '42501';
  end if;
  return query
  select mc.id, gm.id, concat(gm.member_code, ' - ', p.first_name, ' ', p.last_name),
    mc.due_date,
    (mc.amount_due - coalesce((select sum(a.amount) from public.member_payment_allocations a join public.member_payments mp on mp.id=a.member_payment_id where a.membership_charge_id=mc.id and mp.status='settled'), 0))::numeric(14,2),
    mc.currency, mc.status
  from public.membership_charges mc
  join public.gym_members gm on gm.id=mc.gym_member_id
  join public.persons p on p.id=gm.person_id
  where gm.gym_id=p_gym_id and gm.deleted_at is null and mc.status in ('pending','partial','overdue')
  order by mc.due_date, p.first_name, p.last_name;
end;
$$;

create function public.record_member_payment(
  p_gym_id uuid, p_charge_id uuid, p_payment_method_id uuid,
  p_amount numeric, p_currency char(3), p_paid_at timestamptz default timezone('utc', now()),
  p_notes text default null
)
returns public.member_payments
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid(); v_charge public.membership_charges; v_member public.gym_members;
  v_paid numeric(14,2); v_remaining numeric(14,2); v_payment public.member_payments; v_id uuid := gen_random_uuid();
begin
  if not private.has_permission(p_gym_id, 'payments.manage') then
    raise exception 'Insufficient permission: payments.manage' using errcode = '42501';
  end if;
  select mc.* into v_charge from public.membership_charges mc
  join public.gym_members gm on gm.id=mc.gym_member_id
  where mc.id=p_charge_id and gm.gym_id=p_gym_id and gm.deleted_at is null for update of mc;
  if not found or v_charge.status not in ('pending','partial','overdue') then
    raise exception 'Charge is not payable' using errcode = '23514';
  end if;
  select * into v_member from public.gym_members where id=v_charge.gym_member_id and gym_id=p_gym_id and deleted_at is null;
  if not exists (select 1 from public.payment_methods pm where pm.id=p_payment_method_id and pm.is_active) then
    raise exception 'Payment method is not active' using errcode = '23514';
  end if;
  select coalesce(sum(a.amount),0) into v_paid from public.member_payment_allocations a
  join public.member_payments mp on mp.id=a.member_payment_id
  where a.membership_charge_id=v_charge.id and mp.status='settled';
  v_remaining := v_charge.amount_due-v_paid;
  if p_currency <> v_charge.currency then
    raise exception 'Payment currency must match charge currency' using errcode = '23514';
  end if;
  if p_amount is null or p_amount <> v_remaining then
    raise exception 'Full remaining charge amount is required' using errcode = '23514';
  end if;
  insert into public.member_payments(id,gym_id,gym_member_id,branch_id,payment_method_id,status,amount,currency,receipt_number,paid_at,received_by,notes)
  values(v_id,p_gym_id,v_member.id,v_member.home_branch_id,p_payment_method_id,'settled',p_amount,p_currency,
    'PAY-' || to_char(timezone('utc',coalesce(p_paid_at,timezone('utc',now()))),'YYYYMMDD') || '-' || upper(substr(replace(v_id::text,'-',''),1,10)),
    coalesce(p_paid_at,timezone('utc',now())),v_actor,nullif(trim(p_notes),'')) returning * into v_payment;
  insert into public.member_payment_allocations(member_payment_id,membership_charge_id,amount) values(v_payment.id,v_charge.id,p_amount);
  insert into public.audit_logs(gym_id,actor_user_id,action,entity_table,entity_id,after_data)
  values(p_gym_id,v_actor,'member_payment.recorded','member_payments',v_payment.id::text,
    jsonb_build_object('charge_id',v_charge.id,'amount',v_payment.amount,'currency',v_payment.currency,'receipt_number',v_payment.receipt_number,'applied_nio_per_usd',v_payment.applied_nio_per_usd));
  return v_payment;
end;
$$;

create function public.void_member_payment(p_payment_id uuid, p_reason text)
returns public.member_payments
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_payment public.member_payments; v_before jsonb;
begin
  select * into v_payment from public.member_payments where id=p_payment_id for update;
  if not found or not private.has_permission(v_payment.gym_id,'payments.manage') then
    raise exception 'Payment not found or insufficient permission' using errcode='42501';
  end if;
  if v_payment.status <> 'settled' then raise exception 'Only settled payments can be voided' using errcode='23514'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Void reason is required' using errcode='23514'; end if;
  v_before:=to_jsonb(v_payment);
  update public.member_payments set status='void',notes=concat_ws(E'\n',notes,'Anulación: '||trim(p_reason)),updated_at=timezone('utc',now()) where id=p_payment_id returning * into v_payment;
  insert into public.audit_logs(gym_id,actor_user_id,action,entity_table,entity_id,before_data,after_data)
  values(v_payment.gym_id,v_actor,'member_payment.voided','member_payments',v_payment.id::text,v_before,jsonb_build_object('status','void','reason',trim(p_reason)));
  return v_payment;
end;
$$;

revoke all on function public.list_payable_member_charges(uuid) from public;
revoke all on function public.record_member_payment(uuid,uuid,uuid,numeric,char,timestamptz,text) from public;
revoke all on function public.void_member_payment(uuid,text) from public;
grant execute on function public.list_payable_member_charges(uuid) to authenticated,service_role;
grant execute on function public.record_member_payment(uuid,uuid,uuid,numeric,char,timestamptz,text) to authenticated,service_role;
grant execute on function public.void_member_payment(uuid,text) to authenticated,service_role;

commit;
