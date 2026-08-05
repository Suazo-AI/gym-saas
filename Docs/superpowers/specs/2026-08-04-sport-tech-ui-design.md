# Diseño visual Sport-tech para FitManager

## Objetivo

Modernizar la interfaz completa de FitManager con una identidad negra y verde, deportiva y profesional. La recepción debe poder operar durante jornadas largas sin fatiga visual ni pérdida de claridad.

## Dirección visual

- Navegación: negro carbón, texto gris claro y verde lima para la sección activa.
- Superficies de trabajo: gris muy claro con tarjetas blancas.
- Acciones primarias: verde oscuro accesible con texto blanco.
- Acentos: verde lima reservado para selección, foco, métricas y detalles pequeños.
- Estados: verde para éxito, ámbar para advertencia y rojo para bloqueo o error.
- Bordes finos, radios moderados y sombras ligeras.
- Encabezados compactos; evitar paneles negros grandes dentro del área de contenido.
- Tipografía actual del sistema, con pesos fuertes solo en títulos, cifras y acciones.

## Tokens

- `brand-green`: verde principal para controles y enlaces.
- `brand-lime`: acento deportivo y foco.
- `ink`: negro carbón, no negro puro.
- `charcoal`: navegación y superficies oscuras.
- `paper`: fondo general gris frío muy claro.
- `surface`: blanco para tarjetas y formularios.
- `muted`: texto secundario gris.

Los nombres heredados naranja/rojo dejarán de utilizarse progresivamente. Durante la transición habrá compatibilidad limitada para evitar pantallas rotas.

## Estructura principal

El menú lateral conserva la arquitectura actual. En escritorio permanece fijo visualmente; en pantallas pequeñas se presenta como navegación compacta. El gimnasio activo y la sesión se muestran sin competir con las tareas principales.

El contenido usa ancho fluido, separación consistente y encabezados blancos con un acento verde. Las acciones principales se ubican cerca del título y permanecen distinguibles de filtros o acciones destructivas.

## Componentes reutilizables

- Botones primario, secundario, neutral y destructivo.
- Tarjeta y tarjeta de métrica.
- Campo, selector, casilla y área de texto con mensajes accesibles.
- Insignias de estado para membresías, pagos, personal, inventario y acceso.
- Tabla responsiva con estado vacío y controles compactos.
- Diálogo accesible para confirmaciones y operaciones sensibles.
- Alertas de éxito, advertencia y error.
- Esqueletos de carga y estados vacíos orientados a la siguiente acción.

No se añadirá una dependencia de componentes si Tailwind y React cubren el patrón de forma accesible y mantenible.

## Aplicación por módulos

1. Shell, navegación, encabezados y tokens.
2. Personal, que será el primer módulo funcional completo.
3. Miembros, sucursales y planes.
4. Pagos, entradas, ingresos y reportes.
5. Notificaciones y promociones.
6. POS, inventario y finanzas ampliadas.
7. Superficie administrativa de plataforma.

Cada módulo debe conservar carga, vacío, éxito, validación y error durante la transformación.

## Accesibilidad

- Contraste WCAG AA para texto y controles.
- Foco visible verde lima con separación suficiente.
- Áreas interactivas de al menos 44 píxeles cuando sea práctico.
- Navegación completa por teclado.
- Etiquetas explícitas y mensajes vinculados a campos.
- El color nunca será la única señal de estado.
- Respeto a `prefers-reduced-motion`.

## Seguridad y datos

El rediseño no moverá reglas críticas al navegador. Permisos, multi-tenancy, dinero, borrado lógico y biometría continúan protegidos por RLS, RPC y código de servidor. Ocultar una acción no sustituye autorización.

## Verificación

- Pruebas existentes de componentes y rutas.
- Pruebas de estados y accesibilidad en componentes nuevos.
- Typecheck, lint y build.
- Recorridos responsivos en escritorio y móvil.
- Revisión de contraste y teclado.
- Verificación funcional de cada tarjeta antes de continuar con la siguiente.

## Criterio de terminado

La interfaz completa utiliza el sistema Sport-tech sin restos visuales naranjas, mantiene las funciones existentes, es consistente entre módulos y cumple los estados y pruebas definidos para cada tarjeta.
