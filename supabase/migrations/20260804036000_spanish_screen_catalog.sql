begin;
update public.screens set name=case code
  when 'dashboard' then 'Resumen'
  when 'members' then 'Miembros'
  when 'memberships' then 'Membresías'
  when 'payments' then 'Pagos'
  when 'income' then 'Ingresos'
  when 'facial_access' then 'Entradas'
  when 'alerts' then 'Alertas'
  when 'staff' then 'Personal'
  when 'roles' then 'Roles y permisos'
  when 'settings' then 'Configuración'
  when 'saas_billing' then 'Facturación SaaS'
  when 'audit' then 'Auditoría'
  else name end;
commit;
