# Contraste de botones en modo oscuro

## Objetivo

Hacer legibles todos los botones en modo oscuro usando verde como color principal y conservando rojo únicamente para acciones peligrosas.

## Diseño

- Los botones principales usan fondo verde `#15803d` y texto blanco.
- El estado hover usa verde `#166534` y texto blanco.
- Los botones secundarios conservan fondo transparente, borde verde y texto verde claro en modo oscuro.
- Los botones de peligro conservan fondo rojo y texto blanco.
- Las clases heredadas con nombre naranja se mantienen como compatibilidad, pero se renderizan en verde.
- La solución vive en `src/app/globals.css` para cubrir componentes existentes sin modificar su comportamiento.

## Verificación

- Prueba automatizada de las reglas globales de contraste.
- Lint, typecheck, pruebas y build.
- Inspección visual en modo claro y oscuro.

