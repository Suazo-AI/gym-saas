# Respaldo y restauración

Este proceso protege PostgreSQL y los archivos privados de `gym-media`.

La restauración siempre se prueba en un proyecto separado.

Nunca use el proyecto de producción como destino de una prueba.

## Qué se respalda

El respaldo de PostgreSQL crea siete archivos.

`roles.sql` contiene los roles.

`schema.sql` contiene tablas, relaciones, funciones, vistas y RLS del esquema de la aplicación.

`data.sql` contiene los datos.

`history-schema.sql` y `history-data.sql` conservan el historial de migraciones.

`auth-storage-custom.sql` conserva el trigger propio de Auth y las políticas propias de Storage.

`privileges.sql` reproduce los permisos exactos de `public` y `private`.

El volcado de Supabase exporta los `GRANT`, pero no exporta los `REVOKE`.

Sin este archivo, la base restaurada queda más abierta que la original.

Un ejemplo medido: sin `privileges.sql`, `anon` recibía `TRUNCATE` sobre `storage_deletion_queue` y las tres RPC biométricas quedaban con `EXECUTE` para `PUBLIC`.

Los objetos reales de Storage no viven dentro del respaldo de PostgreSQL.

Se exportan por separado mediante la API de Storage.

## Crear el respaldo de PostgreSQL

Guarde el respaldo fuera del repositorio.

La carpeta puede contener datos personales.

No la suba a Git.

Defina la conexión en una variable local del proceso.

```powershell
$env:FITMANAGER_SOURCE_DB_URL = '<CONNECTION_STRING>'
```

Cree una carpeta nueva y vacía.

```powershell
$backupRoot = Join-Path $env:TEMP "fitmanager-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
```

Ejecute el respaldo.

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-supabase.ps1 -DatabaseUrl $env:FITMANAGER_SOURCE_DB_URL -OutputDirectory $backupRoot
```

El resultado correcto termina con `POSTGRES_BACKUP=PASS FILES=7`.

## Exportar los objetos de Storage

Confirme que la CLI está enlazada al proyecto de origen.

```powershell
npx supabase storage ls ss:///gym-media --recursive --linked
```

Descargue el bucket privado mediante la API.

```powershell
npx supabase storage cp --recursive ss:///gym-media (Join-Path $backupRoot 'storage\gym-media') --linked
```

Guarde la carpeta con cifrado y acceso restringido.

No copie ni modifique filas de `storage.objects` directamente.

## Restaurar PostgreSQL

Cree un proyecto Supabase separado y vacío.

Defina su conexión solamente en el proceso local.

```powershell
$env:FITMANAGER_RESTORE_DB_URL = '<RESTORE_CONNECTION_STRING>'
```

El restaurador usa Docker y exige que el destino esté vacío.

El control revisa objetos de `public` y `private`, datos de Auth y Storage, historial de migraciones y secuencias.

Mientras revisa los datos, bloquea las tablas de Auth, Storage y migraciones.

Los siete archivos SQL se aplican dentro de una sola transacción.

Si un archivo falla, PostgreSQL revierte la restauración completa.

El control del destino se ejecuta dos veces.

La primera vez corre solo, antes de tocar nada.

La segunda corre dentro de la transacción, para cerrar la ventana entre ambas.

PostgreSQL nunca revierte una secuencia.

Por eso, cuando la restauración falla, el script devuelve las secuencias de `auth`, `storage` y `supabase_migrations` a su valor inicial.

Sin ese paso, un solo intento fallido dejaría el destino rechazado para siempre por su propio control.

Esa recuperación se niega si el destino tiene datos.

Durante la recuperación, esos bloqueos siguen activos hasta restablecer las secuencias y repetir el control completo en la misma transacción.

El reintento solo se acepta si ese segundo control confirma otra vez que el destino está vacío.

Si el destino ya trae el esquema `supabase_migrations` vacío, la restauración lo reemplaza por el del respaldo.

Ese reemplazo vive en la misma transacción y se revierte junto con todo lo demás.

Use siempre una base dedicada a restaurar.

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-supabase.ps1 -DatabaseUrl $env:FITMANAGER_RESTORE_DB_URL -BackupDirectory $backupRoot -ConfirmEmptyTarget
```

El resultado correcto termina con `RESTORE_APPLY=PASS`.

## Restaurar los objetos de Storage

Enlace una copia separada del repositorio al proyecto de destino.

Este paso cambia datos externos.

Confirme el proyecto de destino antes de continuar.

```powershell
npx supabase storage cp --recursive (Join-Path $backupRoot 'storage\gym-media') ss:///gym-media --linked
```

Liste el destino y compare los archivos importantes.

```powershell
npx supabase storage ls ss:///gym-media --recursive --linked
```

## Verificar la restauración

El verificador rechaza conexiones que apuntan a la misma base.

Compara inventarios, contenido de cada tabla, secuencias, columnas, relaciones, índices, funciones, vistas, tipos, propietarios, privilegios, políticas, RLS, triggers, extensiones, roles y membresías de rol.

De cada trigger compara además su modo de activación (`tgenabled`), porque `pg_get_triggerdef` lo omite y un trigger deshabilitado se restauraría habilitado.

De cada extensión compara nombre, versión y esquema. De los roles compara sus atributos y sus membresías por nombre, no por OID.

Después ejecuta las pruebas SQL completas contra el destino restaurado.

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-restored-database.ps1 -SourceDatabaseUrl $env:FITMANAGER_SOURCE_DB_URL -RestoredDatabaseUrl $env:FITMANAGER_RESTORE_DB_URL -EvidenceFile .\Docs\evidence\backup-restore-$(Get-Date -Format 'yyyy-MM-dd').txt
```

El resultado correcto termina con `RESTORE_VERIFICATION=PASS`.

No acepte una restauración si falta una comparación o una prueba.

## Evidencia local del 2026-08-24

La prueba usó un stack Supabase local aparte, con su propio cluster y su propia base vacía.

El respaldo creó los siete archivos.

Las comparaciones de modo de trigger, extensiones, roles y membresías se agregaron después de esta corrida y todavía no se ejercieron contra un destino restaurado.

La comparación cubrió 86 tablas, su contenido, 6 secuencias y su estado, 633 columnas, 249 restricciones, 122 índices, 89 funciones, 10 vistas, 16 tipos, 70 enums, 172 propietarios, 1737 privilegios, 147 políticas, 85 filas de RLS y 75 triggers.

Ninguna comparación tuvo diferencias.

Las 38 pruebas SQL pasaron contra la base restaurada, con 559 pruebas exitosas.

El control rechazó un destino con datos y no cambió nada.

Una falla inyectada después de los datos y de las 50 migraciones revirtió la restauración completa.

El destino quedó en cero objetos, cero usuarios de Auth y la secuencia de Auth en `1|false`.

El reintento sobre esa misma base terminó en `RESTORE_APPLY=PASS`.

El detalle está en `Docs/evidence/backup-restore-2026-08-24.txt`.

La base local no tenía objetos en `gym-media`.

Por eso la recuperación de bytes queda documentada, pero no probada con un archivo real.
