# Fit Manager

SaaS multi-tenant para administrar gimnasios pequenos en Nicaragua. El frontend usa Next.js App Router, TypeScript, Tailwind CSS y Supabase SSR sobre una base Supabase existente con RLS.

## Requisitos

- Node.js 24.x.
- npm 11.x.
- Supabase CLI.
- Docker Desktop para `supabase db reset` y `supabase test db`.

## Instalacion

```bash
npm install
```

## Variables de Entorno

Crear `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

No usar `service_role` en el frontend ni en variables `NEXT_PUBLIC_*`.

## Comandos

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Supabase local:

```bash
npx supabase migration list
npx supabase db reset
npx supabase test db
```

Generar tipos:

```bash
npx supabase gen types typescript --project-id qyqehfctoucgknyqoygh > src/types/database.types.ts
```

No ejecutar `npx supabase db push` real sin autorizacion explicita. Usar primero:

```bash
npx supabase db push --dry-run
```

## Estructura

```text
src/
  app/
  features/
    auth/
    gyms/
    members/
  lib/
    api/
    supabase/
  types/
supabase/
  migrations/
  tests/
  seed.sql
docs/
  api-contract.md
```

## Seguridad

- RLS es la frontera principal de autorizacion.
- El frontend no decide permisos, precios, totales ni `gym_id` de confianza.
- Las operaciones sensibles usan RPC o servidor.
- Los montos monetarios se representan como `numeric` en PostgreSQL y como string decimal en DTOs.
- Las vistas API usan `security_invoker = true`.
- Las RPC `security definer` usan `set search_path = ''` y tablas calificadas.

## Flujo de Miembros

Contrato inicial:

- Listado: `public.api_v1_member_summaries`.
- Detalle: `public.api_v1_member_details`.
- Crear: `public.create_gym_member(...)`.
- Actualizar: `public.update_gym_member(...)`.
- Eliminar logicamente: `public.soft_delete_entity('gym_member', ...)`.
- Restaurar: `public.restore_entity('gym_member', ...)`.

`create_gym_member` puede crear persona, contactos, miembro, suscripcion opcional, cargo inicial opcional, pago inicial opcional, asignacion de pago y auditoria en una transaccion.

## Seed Local

`supabase/seed.sql` contiene datos falsos para desarrollo:

- dos usuarios Auth locales;
- dos gimnasios;
- sucursales;
- planes;
- miembros;
- cargos y pagos ficticios.

No ejecutar el seed en produccion.
