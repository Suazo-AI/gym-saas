begin;

create or replace function private.create_alert_from_member_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert_type_code text;
  v_alert_type_id uuid;
  v_severity public.alert_severity;
  v_title text;
begin
  if new.source <> 'manual'::public.entry_source
    or new.decision <> 'denied'::public.access_decision then
    return new;
  end if;

  if new.has_overdue_charges then
    v_alert_type_code := 'MEMBERSHIP_UNPAID';
    v_title := 'Entrada denegada por cargos vencidos';
  elsif new.membership_status = 'expired' then
    v_alert_type_code := 'MEMBERSHIP_EXPIRED';
    v_title := 'Entrada denegada por membresia vencida';
  else
    return new;
  end if;

  select at.id, at.default_severity
  into v_alert_type_id, v_severity
  from public.alert_types at
  where at.code = v_alert_type_code;

  if v_alert_type_id is not null then
    insert into public.gym_alerts(
      gym_id,
      branch_id,
      alert_type_id,
      gym_member_id,
      severity,
      title,
      message
    ) values (
      new.gym_id,
      new.branch_id,
      v_alert_type_id,
      new.gym_member_id,
      v_severity,
      v_title,
      coalesce(new.decision_reason, 'El miembro no cumple las condiciones de acceso.')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_member_entry_create_alert on public.member_entries;
create trigger trg_member_entry_create_alert
after insert on public.member_entries
for each row execute function private.create_alert_from_member_entry();

commit;
