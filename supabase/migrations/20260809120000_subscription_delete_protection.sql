-- Las suscripciones conservan historial financiero que no debe borrarse por cascada.
revoke insert, update, delete on public.member_subscriptions from authenticated;

drop trigger if exists trg_member_subscriptions_prevent_delete
  on public.member_subscriptions;

create trigger trg_member_subscriptions_prevent_delete
before delete on public.member_subscriptions
for each row
execute function private.prevent_physical_delete();
