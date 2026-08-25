# Runbook del piloto, en planes gratis

Escrito 2026-08-25.
Decision de alcance: el piloto se monta **sin pagar nada**. Los limites de esa decision estan medidos mas abajo, no estimados.

Este documento se lee de arriba hacia abajo una sola vez. Al final corres un comando y el comando dice si quedo bien.

Son tres proveedores y todos tienen plan gratis:

| Proveedor | Que corre ahi | Plan |
|---|---|---|
| Supabase | base de datos, Auth, Storage | Free |
| Vercel | la aplicacion Next.js | Hobby |
| Render | el servicio de reconocimiento facial | Free |

## Antes de empezar

Necesitas dos ambientes separados, no uno: **demostracion** y **piloto**.
El de demostracion lleva datos inventados y se lo mostras a quien sea.
El de piloto lleva socios reales de un gimnasio real y no comparte ni datos ni secretos con nada mas.

El plan gratis de Supabase da dos proyectos. Alcanza justo para los dos.
Todo lo que sigue se hace **dos veces**, una por ambiente, con secretos distintos cada vez.

---

## 1. Supabase, plan gratis

### 1.1 Crear el proyecto

1. Entra a https://supabase.com/dashboard y toca **New project**.
2. Nombre: `fitmanager-demo` o `fitmanager-piloto`, segun cual estes armando.
3. Region: la mas cercana a Nicaragua.
4. Guarda la contrasena de la base que te muestra. No la vuelve a mostrar.

### 1.2 Aplicar las migraciones

Desde la raiz del repositorio:

```bash
npx supabase link --project-ref <REF_DEL_PROYECTO>
```

El `REF_DEL_PROYECTO` sale de la URL del panel: `https://supabase.com/dashboard/project/<REF>`.

```bash
npx supabase db push
```

Eso aplica las migraciones versionadas de `supabase/migrations/` en orden.
No abras el SQL Editor a escribir esquema a mano. Si el esquema cambia sin migracion, el proximo `db push` no sabe que paso.

### 1.3 Cargar los datos iniciales

```bash
npx supabase db execute --file supabase/seed.sql
```

En el ambiente de **piloto** revisa `supabase/seed.sql` antes de correrlo. Trae cuentas de prueba, entre ellas `reception@fitmanager.local`. Para un gimnasio real esas cuentas se borran o se cambian de contrasena.

### 1.4 De donde salen las tres claves

Panel del proyecto, **Project Settings** y despues **API Keys**:

| Valor en el panel | Va en la variable |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key (la publica) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Service role key (la secreta) | `SUPABASE_SERVICE_ROLE_KEY` |

La `service_role` saltea RLS. Nunca va al navegador, nunca en una variable que empiece con `NEXT_PUBLIC_`, nunca en Git.
El preflight del paso 4 verifica esto solo, decodificando el JWT.

---

## 2. Render, plan gratis: el servicio facial

El servicio ya existe: https://fitmanager-face.onrender.com
Comprobado el 2026-08-25: responde 200 en `/health` y **401** en `/embed` sin token. El token si se valida.

Si tenes que crear uno nuevo, o redesplegar:

1. Render, **New** y despues **Web Service**.
2. Repositorio `Suazo-AI/gym-saas`, rama `main`, directorio raiz `services/face-recognition`.
3. Entorno Docker. Healthcheck en `/health`.
4. Variable de entorno `FACE_RECOGNITION_SERVICE_TOKEN`, con 32 caracteres o mas.

Generar el token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**El servicio no arranca sin ese token.** `app.py:29` lanza un `RuntimeError`. Asi que si el servicio levanta, el token quedo puesto. No hace falta comprobarlo aparte.

Ese mismo valor, identico, va tambien en Vercel. Si los dos no coinciden, el reconocimiento facial responde 401 y no funciona.

---

## 3. Vercel, plan Hobby

1. https://vercel.com/new, importa `Suazo-AI/gym-saas`.
2. Framework: Next.js. Se detecta solo.
3. Cargar las siete variables de entorno. Son las mismas de `.env.example`:

| Variable | Publica o secreta | De donde sale |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | publica | Supabase, Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publica | Supabase, publishable key |
| `NEXT_PUBLIC_SITE_URL` | publica | la URL que te da Vercel, con https |
| `SUPABASE_SERVICE_ROLE_KEY` | **secreta** | Supabase, service role key |
| `FACE_RECOGNITION_SERVICE_URL` | secreta | la URL de Render, con https |
| `FACE_RECOGNITION_SERVICE_TOKEN` | **secreta** | el mismo valor que pusiste en Render |
| `STORAGE_DELETION_WORKER_TOKEN` | **secreta** | generalo igual que el otro token |

Las cuatro secretas nunca llevan el prefijo `NEXT_PUBLIC_`. Ese prefijo es lo que decide si Next.js manda el valor al navegador.

4. En Supabase, **Authentication** y despues **URL Configuration**, poner la URL de Vercel en *Site URL* y agregar `<URL>/auth/callback` en *Redirect URLs*. Sin esto el login redirige a localhost y no entra nadie.

---

## 4. Verificacion

No declares el ambiente listo por como se ve. Corre esto:

```bash
npm run preflight:deploy
```

Sale 0 si los siete chequeos pasan. Sale 1 si alguno falla, y te dice cual.

Los chequeos son: las siete variables presentes y sin placeholder, ninguna clave `service_role` en una variable publica, los tres tokens de 32 caracteres o mas, https fuera de localhost, el servicio facial vivo, el servicio facial rechazando peticiones sin token, y cero migraciones sin aplicar.

**Si sale 1, no se sigue.** Ese es todo el sentido de la barrera.

En un CI sin salida a internet:

```bash
npm run preflight:deploy -- --skip-remote
```

---

## 5. Limites del plan gratis, medidos

No son sorpresas. Son el precio de no pagar, y hay que operar sabiendolos.

### El servicio facial duerme

Render apaga el servicio por inactividad. Medido el 2026-08-25 con `curl`:

```
GET https://fitmanager-face.onrender.com/health -> 200 in 22.68s
```

Casi 23 segundos de arranque en frio. Una recepcionista con un socio adelante no espera 23 segundos.

Mitigacion sin pagar: la pantalla de acceso facial precalienta el servicio al abrirse. El despertar ocurre cuando la recepcionista llega al mostrador, no cuando el socio esta enfrente. No elimina el problema, lo corre de lugar.

**Instruccion para el piloto:** abrir la pantalla de acceso facial al empezar el turno, antes de que llegue el primer socio.

### El proyecto de Supabase se pausa

El plan gratis pausa el proyecto tras 7 dias sin actividad. Un ambiente de demostracion que no se toca en una semana aparece caido cuando lo vas a mostrar. Se despausa a mano desde el panel y tarda unos minutos.

**Instruccion:** antes de una demostracion, entra al panel y confirma que el proyecto esta activo.

### No hay respaldos automaticos

El plan gratis no respalda nada. Los respaldos se corren a mano:

```bash
pwsh scripts/backup-supabase.ps1
```

Y se verifican restaurando de verdad:

```bash
pwsh scripts/verify-restored-database.ps1
```

El procedimiento completo, con lo que compara el verificador y la evidencia medida, esta en [backup-restore.md](backup-restore.md). No lo repito aca para que no queden dos versiones que se contradigan.

**Instruccion para el piloto: un respaldo por semana, minimo.** Un gimnasio real con socios reales sin respaldo es la unica falla de este proyecto que no tiene arreglo.

---

## 6. Que queda pendiente cuando haya presupuesto

Ninguna de estas dos es urgente para arrancar. Las dos dejan de doler el dia que se pagan.

| Que | Que resuelve |
|---|---|
| Render, instancia siempre encendida | mata los 23 segundos de raiz, no los corre de lugar |
| Supabase Pro | respaldos automaticos, y el proyecto deja de pausarse |

Cuando se pague alguna, este documento se actualiza en el mismo momento. Un runbook que describe un plan que ya no usamos es peor que no tener runbook.
