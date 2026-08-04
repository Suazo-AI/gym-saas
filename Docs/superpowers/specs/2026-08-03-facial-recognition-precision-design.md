# Diseño: precisión del reconocimiento facial

Fecha: 2026-08-03

## Tarjeta

- Tarjeta: `Reconocimiento facial completo`.
- Fuente operativa autorizada por el responsable: `docs/trello-board-template.md`.
- Responsable: propietario del producto.
- Etiquetas: `DESPUÉS`, `SEGURIDAD`.
- Alcance autorizado: adelantar esta tarjeta para corregir captura, calidad, precisión, verificación y controles biométricos.

## Resultado esperado

El sistema debe enrolar y verificar rostros con una captura centrada y de buena calidad, minimizar coincidencias incorrectas y enviar los casos dudosos a revisión manual. El reconocimiento facial nunca será la única evidencia para una denegación irreversible.

Metas de aceptación del piloto:

- tasa de falsos positivos (FAR) menor o igual a 0.1 %;
- tasa de falsos rechazos (FRR) menor o igual a 3 % bajo condiciones admitidas;
- revisión manual para toda coincidencia ambigua;
- alternativa manual disponible cuando no haya coincidencia o la cámara no cumpla la calidad mínima.

## Diagnóstico actual

El servicio ya usa el modelo preentrenado `buffalo_l`, pero el pipeline degrada su entrada:

- detecta con Haar y recorta sin landmarks ni alineación facial;
- reduce el enrolamiento a un ancho máximo de 480 px y WebP con calidad 0.72;
- guarda una sola muestra por miembro;
- no valida desenfoque, iluminación, exposición, pose, oclusión o tamaño facial;
- la vista previa usa `object-cover`, mientras el canvas captura el cuadro completo, por lo que el encuadre mostrado no coincide con el enviado;
- la verificación usa un único cuadro;
- el umbral global actual no fue calibrado con datos representativos del piloto;
- las pruebas automatizadas existentes validan contratos y seguridad, pero no miden precisión biométrica.

## Decisión de modelo y licencia

Se conservará InsightFace `buffalo_l` con su detector SCRFD, landmarks, alineación y reconocedor ArcFace de 512 dimensiones. No se entrenará un modelo desde cero ni se descargarán datasets faciales externos.

Los pesos de `buffalo_l` requieren una licencia comercial para su uso en este SaaS. La implementación podrá prepararse, pero no podrá desplegarse ni declararse terminada hasta obtener autorización escrita del proveedor y registrar sus condiciones. Si la licencia no se obtiene, será necesario aprobar un diseño alternativo y una migración de modelo.

## Arquitectura

### Captura compartida

Un componente de cámara reutilizable servirá al enrolamiento y a la verificación. Debe:

- solicitar cámara frontal con resolución ideal de al menos 1280×720;
- comprobar la resolución entregada realmente por el dispositivo;
- admitir cámaras frontales móviles y webcams modernas con resolución real mínima de 720p;
- aplicar la misma transformación geométrica a la vista previa y a la imagen capturada;
- mostrar una guía de encuadre y mensajes accionables;
- detener todas las pistas al cerrar, cancelar, navegar o desmontar el componente;
- impedir capturar hasta que el video y sus dimensiones estén listos.

El navegador ayuda a encuadrar, pero no toma decisiones biométricas críticas.

### Servicio biométrico confiable

El servicio local/confiable reemplazará Haar por el pipeline oficial de InsightFace:

1. decodificar y validar la imagen;
2. detectar exactamente un rostro con SCRFD;
3. obtener landmarks;
4. medir calidad y pose;
5. alinear el rostro al contrato esperado por ArcFace;
6. generar y normalizar el embedding de 512 dimensiones;
7. devolver métricas no sensibles, versión exacta del modelo y duración.

Los controles de calidad cubrirán como mínimo nitidez, iluminación, sobreexposición, tamaño del rostro, distancia entre ojos, centrado, pose y múltiples rostros. Los umbrales técnicos serán configuración versionada y deberán calibrarse, no quedar dispersos como constantes sin procedencia.

### Persistencia y Supabase

Una migración incremental nueva ampliará el contrato sin editar migraciones aplicadas. Permitirá:

- varias fotografías y embeddings activos por persona y versión de modelo;
- métricas de calidad necesarias para trazabilidad;
- estado y causa de revocación;
- compatibilidad explícita entre versión de embedding y versión de comparación;
- umbrales versionados por modelo o configuración aprobada;
- aislamiento estricto por `gym_id` y permisos `faces.manage`, `faces.verify` y `faces.read`;
- auditoría sin imágenes ni vectores completos.

La migración deberá revisar RLS, grants, funciones, índices y pruebas entre dos gimnasios. Las fotografías permanecerán en el bucket privado `gym-media`; PostgreSQL almacenará metadatos y embeddings, no binarios.

## Flujo de enrolamiento

El enrolamiento requiere consentimiento biométrico explícito y vigente antes de procesar o persistir muestras.

Se solicitarán cinco capturas válidas:

1. frontal neutral;
2. giro leve a la izquierda;
3. giro leve a la derecha;
4. frontal adicional;
5. frontal adicional.

Cada captura debe superar controles de calidad. El servicio alineará cada rostro y generará un embedding independiente. Una muestra no sustituirá silenciosamente a otra. Un enrolamiento incompleto no se marcará como activo.

## Flujo de verificación

La verificación capturará una ráfaga corta de tres cuadros válidos. El servicio exigirá consistencia temporal y comparará las muestras contra todos los embeddings activos y compatibles del gimnasio.

La decisión considerará:

- similitud agregada con las muestras del candidato principal;
- consistencia entre los tres cuadros;
- separación respecto al segundo candidato;
- calidad de la captura;
- consentimiento vigente;
- membresía y reglas de acceso existentes.

Resultados:

- `allowed`: coincidencia alta y consistente, además de reglas de acceso satisfechas;
- `manual_review`: coincidencia biométrica ambigua o cercana a otro candidato;
- `no_match`: similitud insuficiente;
- `denied`: reservado para reglas operativas verificables, nunca como identidad irreversible basada solo en el rostro.

Los umbrales iniciales no se tomarán del valor `0.75` actual. Se seleccionarán mediante la evaluación del piloto para cumplir FAR y FRR acordados.

## Validación anti-suplantación

Antes de comparar identidad se ejecutará un reto activo corto y aleatorio: mirar al frente y girar ligeramente la cabeza hacia una dirección indicada. La validación usará landmarks y coherencia temporal; una variación de píxeles por sí sola no será suficiente.

Los cuadros temporales del reto se procesarán en memoria y no se almacenarán. Un reto fallido mostrará una instrucción para reintentar o usar revisión manual; no producirá una denegación irreversible.

Esta validación reduce ataques simples con fotografías, pero no debe describirse como protección absoluta contra toda suplantación.

## Consentimiento, revocación y retención

Al revocar consentimiento:

1. todos los embeddings del miembro se desactivan inmediatamente;
2. las fotografías biométricas se borran lógicamente;
3. se crean trabajos en `storage_deletion_queue`;
4. el worker confiable elimina los objetos mediante Supabase Storage;
5. se conserva solo auditoría mínima sin imagen ni embedding.

No se procesará una captura nueva ni se comparará un embedding si el consentimiento no está vigente.

## Errores y privacidad

La interfaz distinguirá:

- cámara no disponible o sin permiso;
- resolución insuficiente;
- video aún no listo;
- rostro descentrado o demasiado pequeño;
- desenfoque;
- iluminación o exposición deficientes;
- pose no admitida;
- más de un rostro;
- reto de presencia fallido;
- servicio biométrico no disponible;
- ausencia de coincidencia;
- caso enviado a revisión manual.

Se aplicará rate limiting. Los logs no incluirán imágenes, Base64, embeddings, secretos ni datos biométricos innecesarios.

## Estrategia de pruebas

### Automatizadas

- geometría idéntica entre vista previa y captura;
- resolución y ciclo de vida de cámara;
- validadores de calidad y mensajes;
- alineación y tamaño de entrada del modelo;
- cinco muestras completas para activar enrolamiento;
- agregación consistente de tres cuadros;
- separación entre primer y segundo candidato;
- reto aleatorio y coherencia temporal;
- consentimiento ausente, revocado o expirado;
- permiso autorizado, sin permiso, otro gimnasio y no autenticado;
- cola de eliminación y auditoría mínima;
- errores del servicio sin filtración de datos.

### Evaluación biométrica

Se creará un conjunto de evaluación del piloto con consentimiento, separado de las imágenes usadas para enrolar. Incluirá pares genuinos e impostores bajo las condiciones admitidas y variedad representativa de dispositivos, iluminación y personas del piloto.

El informe calculará FAR, FRR, distribución de similitudes, zona de revisión manual y resultados desagregados cuando el tamaño de muestra permita conclusiones responsables. No se ajustará y evaluará el umbral sobre exactamente los mismos pares sin separación.

La tarjeta no estará terminada hasta alcanzar FAR ≤ 0.1 % y FRR ≤ 3 % o documentar que el objetivo no se alcanzó y mantener el flujo en revisión manual.

## Fuera de alcance

- entrenar un modelo facial desde cero;
- recolectar o descargar datasets faciales externos;
- control físico automático de puertas;
- afirmar resistencia absoluta a suplantación;
- usar reconocimiento facial como única prueba irreversible de identidad;
- desplegar pesos sin licencia comercial válida.

## Dependencias y criterio de terminado

Dependencias:

- licencia comercial escrita para `buffalo_l`;
- flujo básico de miembros, membresías, cargos, pagos y entradas verificable;
- consentimiento biométrico y worker de eliminación operativos;
- conjunto de evaluación consentido del piloto.

Terminado cuando:

- captura, enrolamiento, verificación y revocación cumplen este diseño;
- las migraciones son incrementales y están versionadas;
- RLS y permisos pasan pruebas de aislamiento con dos gimnasios;
- las pruebas automatizadas pasan;
- la evaluación independiente alcanza las metas acordadas;
- los casos dudosos conservan revisión manual y alternativa no biométrica;
- la licencia comercial y la documentación operativa están registradas;
- se verificó un recorrido realista sin exponer secretos ni datos biométricos en logs.

## Referencias técnicas

- InsightFace, repositorio y política de licencias: https://github.com/deepinsight/insightface
- InsightFace Python model zoo: https://github.com/deepinsight/insightface/blob/master/python-package/README.md
- ArcFace, CVPR 2019: https://openaccess.thecvf.com/content_CVPR_2019/html/Deng_ArcFace_Additive_Angular_Margin_Loss_for_Deep_Face_Recognition_CVPR_2019_paper.html
- NIST Face Recognition Technology Evaluation: https://www.nist.gov/programs-projects/face-recognition-vendor-test-frvt
- NIST Face Image Quality: https://pages.nist.gov/frvt/html/frvt_quality.html
