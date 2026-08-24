# Respaldo y restauración

Este proceso protege PostgreSQL y los archivos privados de `gym-media`.

La restauración siempre se prueba en un proyecto separado.

Nunca use el proyecto de producción como destino de una prueba.

## Qué se respalda

El respaldo de PostgreSQL crea seis archivos.

`roles.sql` contiene los roles.

`schema.sql` contiene tablas, relaciones, funciones, vistas y RLS del esquema de la aplicación.

`data.sql` contiene los datos.

`history-schema.sql` y `history-data.sql` conservan el historial de migraciones.

`auth-storage-custom.sql` conserva el trigger propio de Auth y las políticas propias de Storage.

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

El resultado correcto termina con `POSTGRES_BACKUP=PASS FILES=6`.

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

El control bloquea y revisa objetos de `public` y `private`, datos de Auth y Storage, historial de migraciones y secuencias.

Los seis archivos SQL se aplican dentro de una sola transacción.

Si un archivo falla, PostgreSQL revierte la restauración completa.

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

Compara inventarios, contenido de cada tabla, secuencias, columnas, relaciones, índices, funciones, vistas, tipos, propietarios, privilegios, políticas, RLS y triggers.

Después ejecuta las pruebas SQL completas contra el destino restaurado.

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-restored-database.ps1 -SourceDatabaseUrl $env:FITMANAGER_SOURCE_DB_URL -RestoredDatabaseUrl $env:FITMANAGER_RESTORE_DB_URL -EvidenceFile .\Docs\evidence\backup-restore.txt
```

El resultado correcto termina con `RESTORE_VERIFICATION=PASS`.

No acepte una restauración si falta una comparación o una prueba.

## Evidencia local del 2026-08-24

La prueba usó una base Supabase separada.

El respaldo restauró 55 tablas y conjuntos de datos comparados.

También restauró 50 migraciones, 89 funciones, 147 políticas y 75 triggers.

Las 38 pruebas SQL pasaron.

El total fue 559 pruebas exitosas.

La base local no tenía objetos en `gym-media`.

Por eso la recuperación de bytes queda documentada, pero no probada con un archivo real.
