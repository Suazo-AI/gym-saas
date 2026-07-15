# Fit Manager

SaaS de gestión para gimnasios pequeños. Esta primera versión incluye una landing page y un panel administrativo básico con datos ficticios.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Rutas actuales

- `/` — landing page.
- `/admin` — panel administrativo de demostración.

## Verificación

```bash
npm run lint
npm run build
```

## Ramas

- `main` — producción.
- `develop` — integración y pruebas.
- `codex/*`, `feature/*` o `fix/*` — trabajo aislado antes de pasar a `develop`.

## Estado de integración

Supabase está decidido como plataforma futura para datos, autenticación y archivos, pero esta versión todavía no tiene conexiones externas.
