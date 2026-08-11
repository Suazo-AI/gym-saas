# Búsqueda de miembros y alertas privadas en Entradas

## Alcance

Modificar únicamente el flujo existente de `/entries`. No se crea otra pantalla,
ruta ni módulo. El buscador manual permitirá localizar miembros por nombre,
teléfono o código reutilizando `listMembers` y el contrato actual de miembros.

## Búsqueda

- La pantalla conserva un solo campo `search`.
- El texto y el estado vacío mencionan nombre, teléfono o código.
- La consulta se limita siempre al `gym_id` activo.
- El teléfono se usa solamente como criterio de coincidencia; no se devuelve ni se
  muestra en la lista de resultados.
- Cada resultado expone únicamente nombre completo, código de miembro y la acción
  de selección.
- No se implementan búsquedas globales, sugerencias externas ni un índice nuevo
  fuera de los contratos versionados de Supabase.

## Estado de acceso y privacidad

Al seleccionar un miembro, la pantalla debe presentar una alerta operacional clara:

- `Acceso permitido` cuando el estado admite la entrada.
- `Acceso no permitido` cuando requiere intervención.
- Una acción genérica, por ejemplo `Revisar membresía en recepción`, cuando el
  acceso no sea permitido.

La alerta no expondrá teléfono, correo, saldo, monto vencido, fecha de vencimiento,
detalle de cargos, notas ni otros datos personales o financieros. El formulario
existente seguirá siendo la única vía para registrar el intento de entrada y la
RPC seguirá tomando la decisión definitiva.

## Arquitectura y seguridad

La página seguirá obteniendo el gimnasio activo en el servidor. `listMembers`
conservará el filtro obligatorio por `gym_id` y ampliará la búsqueda para incluir
el teléfono mediante un contrato Supabase versionado que respete RLS y permisos.
El frontend no decidirá la autorización de entrada ni confiará en un `gym_id`
proporcionado por el navegador.

## Estados y errores

- Sin término: se invita a buscar por nombre, teléfono o código.
- Sin coincidencias: se informa que no se encontraron miembros, sin confirmar si
  un teléfono pertenece a una persona fuera del gimnasio activo.
- Error: se mantiene un mensaje genérico y reintentable.
- Resultado: se muestra nombre y código; nunca el valor telefónico coincidente.
- Miembro seleccionado: se muestra la alerta operacional mínima y el formulario
  existente.

## Pruebas

- La búsqueda envía el término al contrato existente y acepta coincidencias por
  nombre, código y teléfono.
- Un teléfono de otro gimnasio no produce resultados para el gimnasio activo.
- La lista de resultados no renderiza teléfonos.
- Las alertas de acceso no renderizan teléfono, saldo, montos, fechas de deuda ni
  detalles financieros.
- Los estados permitido y no permitido son claros y accesibles mediante
  `role="status"` o `role="alert"`, según corresponda.
- La suite existente de Entradas y los contratos pgTAP siguen pasando.

## Fuera de alcance

- Crear otra pantalla o ruta.
- Mostrar o editar datos de contacto.
- Cambiar las reglas de entrada, membresía, morosidad o override.
- Cambiar permisos de Entradas.
- Rediseñar el historial o el reconocimiento facial.
