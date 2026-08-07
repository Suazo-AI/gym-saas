# Guía técnica - FitManager

Procedimientos, catálogos y contexto de producto que **no** hace falta leer al
empezar una sesión. Se consultan cuando se toca el área correspondiente.

`AGENTS.md` conserva solo lo que, si no se lee, produce un daño irreversible o
silencioso: aislamiento entre gimnasios, dinero, secretos, borrado, permisos,
auditoría y biometría.

## Objetivo del producto

Construir un SaaS multi-tenant para administrar gimnasios pequeños de Nicaragua.

La primera versión debe resolver el trabajo diario de recepción y permitir que el dueño controle:

* miembros;
* membresías;
* cargos;
* pagos;
* morosidad;
* entradas;
* personal;
* permisos;
* ingresos;
* alertas;
* estado general del gimnasio.

El producto comenzará dirigido a gimnasios de aproximadamente 25 a 100 miembros.

## Usuarios iniciales

* Dueño del gimnasio.
* Gerente.
* Recepcionista.
* Administrador interno de la plataforma SaaS.

La hipótesis principal es que los gimnasios pierden tiempo y control al manejar pagos, vencimientos y miembros mediante papel, Excel y WhatsApp.

Esta hipótesis debe validarse con al menos 10 dueños o gerentes. No debe tratarse como confirmada antes de completar las entrevistas.

## Autenticación

La autenticación se realiza con Supabase Auth.

Las contraseñas pertenecen exclusivamente a Supabase Auth.

No crear tablas propias para guardar contraseñas.

El esquema relaciona usuarios autenticados mediante `auth.users`.

La creación de un usuario puede generar automáticamente:

* una persona;
* un perfil de usuario;
* información de contacto inicial.

El código de aplicación debe manejar correctamente:

* registro;
* inicio de sesión;
* cierre de sesión;
* recuperación de contraseña;
* verificación de sesión;
* expiración de sesión;
* usuarios invitados;
* usuarios suspendidos;
* usuarios revocados.

Las páginas protegidas deben validar la sesión en el servidor cuando sea posible.

## Acceso a datos desde Next.js

El acceso normal a datos debe hacerse con el cliente oficial de Supabase.

Separar claramente:

* cliente Supabase para navegador;
* cliente Supabase para servidor;
* operaciones privilegiadas;
* funciones de dominio;
* validación de datos;
* componentes de interfaz.

No colocar reglas críticas directamente dentro de componentes React.

Para operaciones simples puede utilizarse Supabase directamente bajo RLS.

Para operaciones complejas o sensibles se deben utilizar:

* funciones RPC;
* Route Handlers;
* Server Actions;
* Edge Functions;
* funciones de servidor confiables.

Las operaciones relacionadas con dinero, cancelaciones, permisos, biometría o eliminación deben ser atómicas.

## Roles y permisos

El esquema incluye:

* pantallas;
* permisos;
* relación entre pantallas y permisos;
* usuarios de gimnasio;
* roles;
* permisos por rol;
* roles asignados a usuarios.

Roles iniciales:

### Dueño

Control total de su gimnasio, configuración, personal, membresías, pagos, ingresos, auditoría y reportes.

### Gerente

Operación y reportes autorizados, sin propiedad de la cuenta SaaS.

### Recepcionista

Miembros, membresías, cobros y entradas, con acceso financiero limitado.

### Administrador de plataforma

Gestión interna del SaaS, soporte y auditoría. Sus operaciones especiales deben quedar registradas.

No asignar permisos basándose solamente en el nombre del rol.

La autorización debe usar códigos de permisos.

No modificar los códigos de permisos existentes sin una migración y revisión del frontend.

## Migraciones

Toda modificación de base de datos debe tener una migración nueva.

Una migración debe incluir, cuando corresponda:

* cambios de tablas;
* índices;
* restricciones;
* funciones;
* triggers;
* políticas RLS;
* grants;
* vistas;
* comentarios;
* rollback documentado cuando sea viable;
* pruebas o consultas de verificación.

No editar una migración que ya fue aplicada en producción para cambiar su comportamiento.

Crear una migración incremental.

Antes de aplicar una migración:

1. revisar dependencias;
2. revisar datos existentes;
3. verificar si es destructiva;
4. crear respaldo cuando exista riesgo;
5. probar en ambiente local o de desarrollo;
6. revisar RLS;
7. revisar permisos;
8. verificar que no exponga datos entre gimnasios.

Después de aplicarla:

1. ejecutar consultas de validación;
2. verificar funciones;
3. verificar políticas;
4. probar con usuarios de diferentes gimnasios;
5. actualizar documentación;
6. registrar el resultado en la tarjeta correspondiente.

## Uso de Supabase SQL Editor

SQL Editor puede utilizarse para:

* consultas de diagnóstico;
* verificaciones;
* pruebas controladas;
* aplicar una migración aprobada.

No debe utilizarse como único historial de cambios.

Todo SQL aplicado manualmente debe copiarse inmediatamente a una migración versionada.

Nunca pegar y ejecutar código destructivo en producción sin revisar primero:

* proyecto seleccionado;
* rama;
* entorno;
* transacción;
* tablas afectadas;
* respaldo;
* impacto multi-tenant.

## Desarrollo del frontend

El frontend debe construirse a partir de contratos reales de Supabase.

Antes de crear una pantalla:

1. identificar tablas, vistas o RPC necesarias;
2. identificar permisos;
3. identificar estados;
4. revisar RLS;
5. definir validaciones;
6. definir estados vacíos;
7. definir errores;
8. definir carga;
9. definir actualización;
10. definir comportamiento sin conexión cuando corresponda.

No inventar campos que no existan en el esquema.

No consultar directamente tablas históricas complejas cuando exista una vista o RPC preparada.

Las vistas actuales deben aprovecharse para:

* estado de acceso del miembro;
* ingresos;
* ingresos diarios;
* dashboard.

## Realtime

No utilizar Supabase Realtime de forma automática en todos los módulos.

Usarlo solamente cuando exista una necesidad concreta, como:

* alertas;
* accesos recientes;
* actualización de recepción;
* cambios de estado relevantes.

Toda suscripción Realtime debe respetar RLS y limpiarse correctamente al desmontar componentes.

## Edge Functions

Usar Edge Functions o un servicio confiable para:

* operaciones con `service_role`;
* procesamiento de imágenes;
* generación de embeddings;
* integración con correo;
* webhooks;
* tareas programadas;
* eliminación física de Storage;
* procesamiento de pagos externos;
* operaciones que requieran secretos.

No usar Edge Functions como reemplazo innecesario de todas las operaciones CRUD.

Las operaciones normales pueden ejecutarse mediante Supabase y RLS.

## Pruebas

Agregar pruebas proporcionales al riesgo.

### Riesgo bajo

* componentes visuales;
* textos;
* estados vacíos.

### Riesgo medio

* formularios;
* filtros;
* búsqueda;
* carga de archivos;
* CRUD administrativo.

### Riesgo alto

* pagos;
* membresías;
* cancelaciones;
* roles;
* permisos;
* RLS;
* multi-tenancy;
* biometría;
* service role;
* eliminación;
* migraciones.

Las pruebas de multi-tenancy deben intentar explícitamente acceder a datos de otro gimnasio.

No afirmar que algo fue probado si no se ejecutó una verificación concreta.

## Forma de trabajo

El trabajo alterna dos funciones.

### Producto y Vibe Coder

* diseña flujos;
* diseña pantallas;
* define estados;
* escribe textos en español;
* crea prototipos;
* usa datos falsos;
* valida facilidad de uso.

No decide por sí solo:

* seguridad;
* permisos;
* dinero;
* migraciones;
* RLS;
* biometría;
* estructura de datos.

### Full-Stack Developer

* revisa arquitectura;
* revisa esquema;
* implementa contratos de datos;
* implementa RLS;
* implementa funciones;
* implementa migraciones;
* revisa seguridad;
* agrega pruebas;
* revisa operaciones monetarias;
* protege el aislamiento multi-tenant;
* prepara despliegue y monitoreo.

Orden normal:

1. Producto define el flujo.
2. Se valida la necesidad.
3. Vibe Coder crea el prototipo.
4. Full-Stack revisa esquema, permisos y riesgos.
5. Se crean migraciones o RPC si hacen falta.
6. Se implementa el frontend.
7. Se ejecutan pruebas.
8. Producto prueba con usuarios.
9. Se corrigen problemas.
10. La tarjeta pasa a terminado.

## Criterio general de terminado

Una función está terminada cuando:

* cumple criterios funcionales claros;
* pertenece al MVP;
* respeta aislamiento entre gimnasios;
* respeta permisos;
* maneja carga, éxito, vacío, validación y error;
* tiene pruebas proporcionales al riesgo;
* fue verificada con un recorrido realista;
* no expone secretos;
* no permite acceso a otro gimnasio;
* actualiza la documentación;
* incluye migración cuando modifica Supabase;
* revisa RLS;
* no rompe datos históricos;
* no deja trabajos de Storage sin procesar;
* no depende solamente de validación del frontend.
