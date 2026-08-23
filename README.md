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

- cinco usuarios Auth locales, todos con la contrasena falsa `LocalDev123!`;
- dos gimnasios;
- sucursales;
- planes;
- miembros;
- cargos y pagos ficticios.

Cuentas locales y su rol efectivo:

| Correo | Rol |
|---|---|
| `owner1@fitmanager.local` | dueno de Impulso Fitness (`owner`) |
| `owner2@fitmanager.local` | dueno de Norte Gym (`owner`) |
| `platform-admin@fitmanager.local` | administrador de plataforma, sin `gym_users` |
| `gym-admin@fitmanager.local` | rol `admin` en Impulso Fitness |
| `reception@fitmanager.local` | rol `receptionist` en Impulso Fitness |

Los roles de sistema y sus permisos los crea `private.bootstrap_new_gym()` al
insertar el gimnasio. El seed solo los asigna. Para probar recepcion hay que
usar `reception@fitmanager.local`: una cuenta `admin` ve todo y no ejerce
ninguna restriccion de la matriz de permisos.

El seed es idempotente: se puede volver a correr sobre una base que ya lo tiene
y solo agrega lo que falta. Sirve para incorporar cuentas nuevas sin perder los
datos locales:

```bash
docker exec -i supabase_db_gym-saas psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/seed.sql
```

No ejecutar el seed en produccion.
