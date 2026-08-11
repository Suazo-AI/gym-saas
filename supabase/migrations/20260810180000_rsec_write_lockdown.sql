begin;

-- La lectura biometrica conserva sus politicas faces.read existentes.
-- Toda escritura queda limitada a funciones confiables y service_role.
drop policy if exists biometric_consents_manage
  on public.biometric_consents;
drop policy if exists face_embeddings_manage
  on public.face_embeddings;

revoke insert, update, delete on public.biometric_consents
  from anon, authenticated;
revoke insert, update, delete on public.face_embeddings
  from anon, authenticated;

-- El catalogo solo ofrece rutas implementadas en la aplicacion.
update public.screens
set is_active = false
where code in ('roles', 'saas_billing', 'audit');

update public.screens
set is_active = true
where code = 'facial_access';

-- La funcion se conserva para un flujo futuro, pero sin acceso publico.
revoke execute on function public.start_member_subscription(
  uuid, uuid, date, uuid, numeric, text
) from anon, authenticated;
grant execute on function public.start_member_subscription(
  uuid, uuid, date, uuid, numeric, text
) to service_role;

commit;
