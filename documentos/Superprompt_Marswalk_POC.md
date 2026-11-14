# SUPERPROMPT — Marswalk Decision Support POC
## Dirección de producto, arquitectura, ciencia de datos y desarrollo asistido por Claude

> **Objetivo:** convertir el repositorio existente `Hackaton_NASA` en una prueba de concepto funcional de un sistema de apoyo a la planificación de caminatas marcianas. El sistema debe integrar terreno 3D, movilidad, seguridad, radiación, clima y objetivos científicos en una experiencia clara, trazable y fácil de interpretar.
>
> **Modo de trabajo:** Claude debe actuar como un equipo técnico senior, pero trabajar de forma incremental, auditable y coordinada. No debe empezar generando código de interfaz sin antes inspeccionar los datos, el repositorio y las decisiones ya tomadas.

---

# PARTE I — CONTEXTO Y MISIÓN

## 1. Rol que debe asumir Claude

Actuá como un equipo multidisciplinario compuesto por:

1. **Product Manager / Product Strategist:** define el problema, el usuario, el alcance del POC y los criterios de éxito.
2. **Scientific Data Engineer:** audita los datasets, sus metadatos, unidades, resolución, cobertura temporal y limitaciones.
3. **Geospatial / Planetary GIS Engineer:** resuelve coordenadas marcianas, DEM, pendientes, rugosidad, reproyección local y alineación de capas.
4. **Route Optimization Engineer:** diseña rutas alternativas y una función de costo explicable.
5. **Radiation & Environmental Data Analyst:** integra RAD y REMS sin presentar datos históricos como condiciones actuales.
6. **3D Frontend Architect:** construye el visor 3D y su interacción.
7. **UX/UI Designer:** convierte datos complejos en decisiones legibles, con jerarquía visual y carga cognitiva controlada.
8. **QA / Scientific Reviewer:** valida consistencia, unidades, supuestos, rendimiento y reproducibilidad.

No simules certezas científicas. Cuando falte información, separá explícitamente:
- dato medido;
- dato derivado de otro dato;
- estimación del modelo;
- supuesto elegido para el escenario;
- dato no disponible.

## 2. Problema que resuelve el producto

El producto no es solamente un mapa 3D de Marte. Es una herramienta para ayudar a planificar y ejecutar una EVA (*Extra-Vehicular Activity*) en superficie.

Debe responder, de forma concreta:

- ¿Por dónde puede desplazarse el astronauta?
- ¿Qué ruta es más rápida, cuál es más conservadora y cuál prioriza el interés científico?
- ¿Qué pendientes, desniveles y zonas de terreno potencialmente difícil encontrará?
- ¿Cuánto tiempo podría tomar el recorrido bajo los supuestos del escenario?
- ¿Qué presupuesto de exposición a radiación se estima para la EVA?
- ¿Qué información ambiental existe y qué tan representativa es?
- ¿Qué objetivos científicos y fotografías de superficie encontrará en cada parada?
- ¿Qué riesgos, incertidumbres y limitaciones debería conocer antes de elegir una ruta?

**Principio rector:** el sistema debe transformar capas de datos heterogéneas en información accionable. No mostrar una capa solo porque existe.

## 3. Usuario principal y contexto operativo

Diseñá para un astronauta que prepara una caminata desde un hábitat o punto de partida y necesita una lectura rápida de terreno, recorrido y condiciones.

Para el POC:
- Usuario principal: un astronauta que consulta el mapa y toma decisiones.
- Escenario inicial: una EVA planificada, con inicio, destino, paradas científicas y duración configurables.
- Representación de tripulación: permitir elegir 1 o 2 integrantes como parámetro de escenario, pero no desarrollar logística de equipos ni coordinación multiusuario.
- Vista principal: mapa 3D interactivo.
- Vista secundaria: mapa cenital 2D/ortográfico para comprender distancias y orientación.
- No desarrollar un HUD de casco ni una simulación inmersiva completa.

No confundas la cantidad de astronautas con la cantidad de personas que usan el software. Para esta prueba, la interfaz es una consola de planificación individual.

---

# PARTE II — CONTEXTO DEL REPOSITORIO Y DATOS EXISTENTES

## 4. Primera tarea obligatoria: auditar antes de construir

El repositorio entregado es `Hackaton_NASA`. Antes de modificar archivos:

1. Inspeccioná el árbol del proyecto, README, documentos, configuración y scripts.
2. Leé como mínimo:
   - `README.md`
   - `data/README.md`
   - `documentos/PLAN.md`
   - `documentos/BITACORA.md`
   - `documentos/Resumen_2_Proyecto.md`
   - `documentos/enunciado_oficial.md`
   - `configs/sites/gale.yaml`
   - `src/marswalk/README.md`
   - `web/README.md`
   - `data/generacion/README.md`
   - `data/raw/MANIFEST.json`
3. Inspeccioná los archivos reales, no solo los nombres.
4. Verificá que los archivos requeridos existan, que sus tamaños sean plausibles y que los sidecars JSON describan correctamente los rásters.
5. Revisá los scripts de descarga y generación para entender cómo se obtuvieron los datos.
6. No borres, sobrescribas ni regeneres datos existentes sin una razón concreta y aprobación explícita.
7. Entregá un informe de auditoría antes de implementar: qué está listo, qué falta, qué está roto, qué es dudoso y qué puede reutilizarse.

### 4.1 Inventario conocido que debe verificarse

El repositorio ya contiene o documenta:

| Dominio | Dataset / fuente | Uso potencial | Advertencia |
|---|---|---|---|
| Topografía | DEM HiRISE `Gale_DEM_SMG_1m`, vía Mars Trek | Malla 3D, elevación, pendiente, desnivel | Los recortes disponibles son de 2 m, 3 m y 25 m por píxel; no asumir que todos tienen la misma escala |
| Imagen óptica | Mosaicos HiRISE | Textura de terreno de alta resolución | Alinear con el DEM correspondiente |
| Contexto óptico | CTX | Orientación regional | Resolución menor que HiRISE |
| Térmico | THEMIS IR día/noche | Contexto térmico regional | Aproximadamente 81 m/px; son imágenes renderizadas, no mediciones calibradas por píxel |
| Geología | USGS SIM 3292 | Contexto geológico | Escala 1:20M; demasiado gruesa para inferir obstáculos locales |
| Recorrido | Mars Trek + waypoints oficiales JPL de Curiosity | Contexto y validación histórica | No equivale a una ruta peatonal segura para humanos |
| Radiación | MSL RAD, CDAWeb `MSL_RAD_OBS-L2` | Contexto de dosis y presupuesto de EVA | Medición histórica del sitio/rover, no pronóstico en vivo ni mapa espacial por píxel |
| Clima | MSL REMS, productos MODRDR | Contexto de temperatura, viento y otras variables | Hay 8 soles representativos; no es pronóstico meteorológico actual |
| Imágenes de superficie | 56 Navcam de Curiosity | Vista de punto de vista en waypoints | Elegir imágenes mirando al horizonte y asociarlas al waypoint correcto |

El catálogo del proyecto indica:
- sitio principal: Gale, tramo Pahrump Hills → Hematite Hotspot;
- recorrido de Curiosity Bradbury Landing → Hematite Hotspot: 18,8 km recorridos y 8,8 km en línea recta;
- tramo Pahrump Hills → Hematite Hotspot: 9,6 km recorridos;
- segundo recorte opcional: zona de formaciones boxwork;
- DEM detalle: 2 m/px; recorrido completo: 3 m/px; contexto: 25 m/px;
- el DEM de detalle cubre aproximadamente 1,7 × 4 km en el tramo de interés según el plan;
- RAD tiene un hueco temporal entre septiembre de 2012 y febrero de 2013;
- REMS contiene ocho soles separados a lo largo de un año marciano;
- no hay detecciones de minerales hidratados en la capa CRISM/OMEGA disponible dentro de Gale;
- TES fue descartado por resolución insuficiente para este nivel de detalle.

**No tomes estos valores como verdad sin comprobarlos en los archivos del repositorio.** Si detectás contradicciones entre documentos y archivos, informalas y proponé una resolución; no elijas silenciosamente una versión.

## 5. ¿Hay que volver a hacer ingesta?

**No por defecto.** La existencia de datos descargados y un `MANIFEST.json` cambia la estrategia: el POC debe comenzar con auditoría, validación y procesamiento, no con una nueva ingesta general.

Seguí esta política:

### Reutilizar
- Reutilizá archivos locales que tengan fuente, fecha, unidad, cobertura y metadatos identificables.
- Reutilizá los scripts existentes si son reproducibles.
- Conservá el manifiesto, checksums, sidecars y procedencia.

### Reprocesar
Reprocesá cuando sea necesario:
- transformar el DEM en heightmaps optimizados;
- calcular pendiente y rugosidad;
- normalizar rutas y waypoints;
- limpiar y resumir series RAD/REMS;
- generar miniaturas o seleccionar fotografías;
- construir un paquete estático de datos para el frontend.

### Volver a descargar
Solo descargá algo si:
- falta un archivo imprescindible;
- está corrupto o no coincide con su checksum;
- la fuente o licencia no es verificable;
- la cobertura no alcanza el escenario;
- una variable crítica no existe en los datos actuales;
- necesitás una actualización temporal y podés justificar que aporta valor al POC.

Antes de descargar, presentá: dato faltante, por qué importa, fuente oficial, tamaño estimado, tiempo, riesgo y alternativa.

### No ampliar datos por acumulación
No agregues datos simplemente para poder decir que se usan más fuentes. El POC debe priorizar coherencia, calidad y trazabilidad.

---

# PARTE III — DEFINICIÓN DEL POC

## 6. Diferencia entre POC, MVP y producto final

Este trabajo es una **prueba de concepto (POC)**.

El POC debe demostrar que es técnicamente viable:
1. integrar distintas fuentes NASA;
2. representar un terreno marciano real en 3D;
3. derivar indicadores de movilidad;
4. generar y comparar rutas;
5. construir un resumen de seguridad con radiación y contexto ambiental;
6. conectar objetivos científicos y fotografías a la ruta;
7. presentar todo en una interfaz comprensible.

No es necesario construir:
- autenticación;
- usuarios y permisos;
- backend distribuido;
- streaming en tiempo real;
- infraestructura cloud compleja;
- base de datos geoespacial server-side;
- optimización global para todo Marte;
- HUD de casco;
- gemelo digital físico completo;
- modelos predictivos de radiación o clima sin datos suficientes;
- soporte operacional certificado para una misión real.

El resultado debe ser una demo reproducible con datos estáticos y un escenario controlado.

## 7. Propuesta de valor diferencial

La diferenciación no debe ser “tenemos un mapa 3D”. Debe ser:

> **A route-aware Marswalk planning interface that turns heterogeneous NASA surface data into explainable mobility, science and EVA safety decisions.**

La interfaz debe explicar por qué recomienda una ruta y qué trade-off existe entre rapidez, seguridad y valor científico.

---

# PARTE IV — DECISIONES DE PRODUCTO Y EXPERIENCIA

## 8. ¿Mapa 2D, 3D o ambos?

Recomendación: **3D como vista principal + 2D cenital como vista de orientación**.

No hace falta elegir entre 2D y 3D:
- El 3D permite comprender desniveles, pendientes y relieve.
- El 2D permite comparar recorridos, distancias y posiciones sin distorsión de perspectiva.
- Una vista 3D inclinada puede exagerar visualmente pendientes; por eso debe existir un modo cenital y una escala vertical explícita.

### Requisitos de la escena 3D
- Terreno construido desde el DEM real.
- Textura HiRISE alineada con el DEM.
- Exageración vertical configurable, con valor por defecto documentado y etiqueta visible.
- Escala horizontal y vertical comprensibles.
- Norte, escala gráfica, coordenadas y elevación.
- Cámara orbit/pan/zoom, botón de volver a vista general y presets de cámara.
- Ruta representada sobre la superficie, no flotando arbitrariamente.
- Waypoints y objetivos científicos seleccionables.
- Capas activables/desactivables.
- Leyenda visible y unidades.
- Control para cambiar entre perspectiva y vista cenital.
- Selección de una ruta que actualice los paneles y métricas.
- No llenar la escena con marcadores, etiquetas y colores simultáneos.

## 9. Diseño de interfaz recomendado

Diseñá una interfaz de tipo **Mission Planning Console**, sobria, técnica y legible. Evitá una estética de dashboard SaaS genérico.

Estructura sugerida:

### Barra superior
- Nombre del sitio y escenario.
- Estado del paquete de datos: `STATIC DATASET`, fecha de referencia.
- Selector de sitio (Gale principal; boxwork solo si está listo).
- Selector de escenario / duración de EVA.
- Estado de validación y calidad de datos.

### Panel izquierdo — Mapa y capas
- Vista 3D principal.
- Selector de capas: Terrain, Slope, Roughness, HiRISE, THEMIS, Geology, Curiosity Traverse.
- Selector de vista: 3D / Top-down.
- Leyenda contextual que cambia con la capa seleccionada.

### Panel derecho — Decisión
- Ruta seleccionada: Fastest / Safer / Science-priority.
- Distancia total.
- Tiempo estimado.
- Desnivel acumulado positivo y negativo.
- Pendiente máxima y porcentaje de ruta por bandas de pendiente.
- Presupuesto estimado de dosis de EVA, con fecha y advertencia de incertidumbre.
- Estado de datos ambientales: histórico / representativo / no disponible.
- Recomendación explicable en 2–3 frases.

### Panel inferior o drawer — Itinerario
- Lista ordenada de waypoints.
- Objetivo científico de cada parada.
- Fotografía Navcam asociada.
- Sol/fecha e instrumento cuando estén disponibles.
- Distancia acumulada y tramo siguiente.
- Riesgos o notas del tramo.

### Panel de detalles
Al seleccionar una celda, punto o waypoint, mostrar solo información pertinente:
- elevación;
- pendiente;
- rugosidad;
- unidad geológica si está disponible;
- fotografía cercana si existe;
- fuente, resolución y limitación de cada dato.

No mostrar todos los campos de todos los datasets en la pantalla inicial. Los detalles técnicos deben estar disponibles bajo demanda.

---

# PARTE V — MÉTRICAS Y KPIs

## 10. Elegir métricas por objetivo, no por disponibilidad

No agregues oxígeno, presión, temperatura o radiación como KPIs solo porque sean variables conocidas de una misión espacial.

Cada KPI debe responder a una pregunta operativa.

### 10.1 KPIs principales del recorrido

| KPI | Pregunta que responde | Cómo se obtiene | Prioridad |
|---|---|---|---|
| Distancia de ruta (km) | ¿Cuánto debe caminar? | Geometría de la ruta sobre coordenadas locales | P0 |
| Tiempo estimado (min/h) | ¿Cuánto duraría el recorrido? | Distancia + modelo de velocidad ajustado por pendiente y supuestos | P0 |
| Pendiente máxima (%) o (°) | ¿Cuál es el tramo más exigente? | Derivada espacial del DEM suavizado | P0 |
| Desnivel acumulado (+/- m) | ¿Cuánto sube y baja? | Diferencias de elevación a lo largo de la ruta | P0 |
| Porcentaje de ruta por bandas de pendiente | ¿Cuánto del recorrido es fácil/moderado/exigente? | Muestreo del DEM sobre la ruta | P0 |
| Índice de rugosidad | ¿Dónde podría haber terreno irregular? | Métrica local derivada del DEM | P1 |
| Dosis estimada de EVA | ¿Qué presupuesto de exposición representa la salida? | Tasa RAD de referencia × duración, con conversión solo si está validada | P0 |
| Valor científico de las paradas | ¿Qué objetivos justifica visitar? | Waypoints y objetivos etiquetados, con criterio explícito | P1 |

### 10.2 Radiación: tratarla correctamente

RAD mide radiación en superficie en el lugar del rover. No genera por sí solo un mapa de radiación por píxel del terreno.

Para el POC:
- Mostrar una serie histórica y el último registro válido con fecha.
- Diferenciar dosis absorbida y dosis equivalente.
- No convertir µGy a mSv sin una referencia científica y una justificación explícita del factor de calidad.
- Mostrar la ventana temporal utilizada y el hueco de datos conocido.
- Estimar el presupuesto de dosis de la EVA como tasa de referencia por duración, con la unidad correcta.
- Si se usa una aproximación de blindaje topográfico por fracción de cielo visible, presentarla como **estimación exploratoria**, no como medición RAD local.
- No presentar la dosis estimada como un límite médico ni como una garantía de seguridad.

### 10.3 Clima: tratarlo correctamente

REMS proporciona observaciones históricas del rover y no un pronóstico futuro para el astronauta.

Para el POC:
- Usar REMS como contexto ambiental histórico.
- Resumir rangos o ciclos representativos de temperatura, viento y UV solo si las columnas y unidades se interpretaron correctamente.
- Mostrar cuántos soles y qué fechas cubre.
- Indicar explícitamente “historical rover observations”, no “current weather”.
- No interpolar ocho soles como si fueran un pronóstico continuo.

### 10.4 ¿Oxígeno?

No usar oxígeno como KPI ambiental del terreno: no es una variable que los datos existentes midan para esta caminata y no es un indicador espacial del mapa.

Si el equipo quiere representar soporte vital, podría añadirse más adelante un **parámetro de escenario** (por ejemplo, autonomía de soporte vital disponible), claramente separado de los datos planetarios. No simular consumo de oxígeno sin un modelo de soporte vital y supuestos validados.

### 10.5 Semáforos

Usá estados como `LOW / MODERATE / HIGH` solo si:
- los umbrales están definidos;
- existe una fuente o justificación;
- las unidades y el alcance son claros;
- el usuario puede consultar el valor numérico subyacente.

No inventar umbrales de seguridad humana. Si no hay umbral validado, mostrar valor y contexto sin semáforo de riesgo.

---

# PARTE VI — RUTAS Y MODELO DE MOVILIDAD

## 11. Tres rutas comparables

Para el POC, implementar rutas precalculadas y comparables:

1. **Fastest:** minimiza distancia/tiempo estimado, respetando restricciones básicas.
2. **Safer:** penaliza con mayor intensidad pendientes altas y rugosidad.
3. **Science-priority:** visita waypoints científicos seleccionados y minimiza el costo de conectar las paradas.

No afirmar que una ruta es “segura” en términos absolutos. Nombrarla `Safer / lower modeled terrain cost` o equivalente, e informar el criterio.

### 11.1 Función de costo

Proponer una función transparente. Como punto de partida:

`cost(cell) = w_slope * slope_penalty + w_roughness * roughness_penalty + w_distance * distance_cost + w_science * science_penalty`

No copiar esta fórmula sin analizar si corresponde. El modelo debe:
- documentar cada término;
- normalizar variables para que las escalas sean comparables;
- definir restricciones duras por separado de penalizaciones;
- explicar pesos y umbrales;
- permitir reproducir cada ruta;
- realizar un análisis de sensibilidad de pesos;
- no tratar rugosidad como detección confirmada de rocas.

Si se usa A*:
- definir vecindad (4 u 8 vecinos);
- evitar diagonales que corten esquinas o atraviesen celdas no transitables;
- considerar la resolución espacial real;
- calcular distancia con unidades métricas;
- validar que inicio y destino estén dentro del DEM;
- detectar y reportar si no existe camino;
- guardar el costo y los parámetros utilizados.

No es obligatorio hacer optimización en vivo en el navegador. Para el POC, es preferible calcular las rutas en Python y entregar geometrías estáticas al visor.

## 12. Validación de rutas

Usar el recorrido histórico de Curiosity como referencia, pero no como “verdad de seguridad humana”.

Métricas sugeridas:
- porcentaje de la ruta calculada dentro de un corredor de 50 m respecto del recorrido de Curiosity, si los puntos comparados representan el mismo origen/destino;
- desviación lateral media;
- diferencia de distancia;
- comparación del costo modelado de la ruta histórica frente a las alternativas calculadas.

Advertencias:
- Curiosity es un rover, no un astronauta;
- su ruta depende de restricciones, objetivos y capacidades distintas;
- la coincidencia espacial no prueba transitabilidad humana;
- una discrepancia no implica automáticamente que el algoritmo esté mal.

Si no se pueden comparar segmentos equivalentes, no fuerces la métrica. Documentá la limitación y usá validaciones internas del algoritmo.

---

# PARTE VII — ARQUITECTURA TÉCNICA RECOMENDADA

## 13. Arquitectura general

Para el POC, preferir una arquitectura simple, local-first y reproducible:

```text
NASA / USGS source data
        |
        v
Existing data/raw + MANIFEST
        |
        v
Python processing pipeline
  - audit / validation
  - terrain derivatives
  - route computation
  - RAD / REMS summaries
  - waypoint & photo matching
        |
        v
Static site package (JSON + optimized raster/texture assets)
        |
        v
Frontend (React + TypeScript + Vite)
        |
        +--> 3D terrain scene
        +--> 2D top-down view
        +--> route & waypoint interaction
        +--> KPI / safety panels
        +--> provenance & assumptions
```

El frontend no debe consultar directamente servicios externos de NASA durante la demo. Debe funcionar con el paquete estático local para que sea reproducible y no dependa de CORS, disponibilidad de APIs o conexión de terceros.

## 14. Stack recomendado

### Procesamiento geoespacial y datos
- Python.
- NumPy.
- SciPy cuando sea necesario.
- Rasterio para lectura/escritura geoespacial si está disponible y es compatible con el entorno.
- Pillow para imágenes/heightmaps.
- PyYAML para configuración.
- GeoJSON para rutas, waypoints y features.
- Pandas para series RAD/REMS si aporta claridad.
- Pytest para pruebas.

No sumar librerías pesadas sin necesidad. Verificá primero el `requirements.txt` y el entorno existente.

### Frontend
Recomendación base:
- React.
- TypeScript.
- Vite.
- Three.js para la escena 3D.
- React Three Fiber (`@react-three/fiber`) si el equipo quiere componer la escena con componentes React.
- Drei (`@react-three/drei`) solo para helpers concretos que reduzcan trabajo.
- Zustand o estado React simple para estado compartido, según complejidad.
- CSS Modules, Tailwind o el sistema que ya tenga el repositorio; no instalar varios sistemas de estilos.
- Recharts o una alternativa liviana para series y gráficos, solo si realmente se necesitan.

**Elección entre Three.js directo y React Three Fiber:**
- Si el frontend es React y el mapa tendrá controles, capas, paneles y selección sincronizada, React Three Fiber es una buena opción.
- Si ya existe una implementación Three.js funcional, no migrarla sin una razón medible.
- La geometría del terreno debe construirse con `BufferGeometry`/atributos de vértices o una técnica equivalente, no como miles de meshes independientes.
- No usar Cesium como primera opción: este caso es un recorte local de Marte, no un globo terrestre con servicios geoespaciales globales. Solo reconsiderarlo si aparece una necesidad real que Three.js no resuelva.
- No usar deck.gl como renderizador principal del terreno 3D: puede ser útil para capas geoespaciales, pero la malla local del DEM y la interacción de cámara se resuelven más directamente con Three.js.
- MapLibre puede ser útil para mapas 2D con tiles/proyecciones, pero no es necesario para el primer POC.

### Despliegue
- Desarrollo local primero.
- GitHub Pages u hosting estático equivalente para la demo.
- Paquetes de datos versionados o publicados como assets estáticos, con tamaño controlado.
- No introducir backend salvo que una prueba concreta lo requiera.

## 15. Sistema de coordenadas marciano

Este punto es crítico. No mezclar coordenadas terrestres WGS84, grados marcianos y metros como si fueran intercambiables.

El repositorio documenta coordenadas de longitud Este y latitud sobre una esfera marciana de radio aproximado 3389,5 km.

Implementá una transformación local consistente para el recorte:
- elegir un origen local (lon0, lat0);
- convertir diferencias de longitud/latitud a metros usando el radio marciano y la latitud de referencia;
- definir ejes locales Este/Norte y elevación;
- documentar el sentido de filas/columnas del ráster (el catálogo indica que la fila 0 es el borde norte);
- asegurar que DEM, textura, pendiente, ruta y waypoints compartan la misma transformación;
- validar puntos conocidos y límites del bounding box.

No usar directamente `longitude * factor` y `latitude * factor` sin documentar la aproximación y su rango de validez.

## 16. Contrato de datos

Antes de desarrollar el visor, fijar un contrato versionado para cada sitio, por ejemplo `site.json`.

Debe incluir:
- `schema_version`;
- `site_id`, nombre y cuerpo planetario;
- fuente, fecha de descarga y referencia de procedencia;
- bounding box;
- CRS / convención de coordenadas;
- origen y transformación local;
- dimensiones de cada raster;
- resolución espacial por archivo;
- orientación de filas/columnas;
- tipo de dato y nodata;
- offset/scale de heightmap, si se cuantiza;
- rango de elevación por archivo;
- unidades de cada variable;
- archivos asociados;
- rutas y waypoints;
- fecha de referencia de RAD/REMS;
- limitaciones y advertencias;
- parámetros usados para derivados y rutas.

No asumir que un único offset/scale sirve para todos los DEM: el contexto y el detalle tienen rangos de elevación distintos.

El paquete debe poder validarse automáticamente antes de abrir el frontend.

---

# PARTE VIII — DISEÑO VISUAL Y LEGIBILIDAD

## 17. Reglas UX para no sobrecargar

El principal riesgo del proyecto es mostrar demasiadas capas y perder interpretabilidad.

Aplicá estas reglas:

1. La pantalla inicial muestra una sola ruta seleccionada y entre 4 y 6 KPIs principales.
2. Las capas no esenciales empiezan apagadas.
3. Cada capa tiene una pregunta que responde y una leyenda.
4. La información histórica siempre lleva fecha o ventana temporal.
5. Cada indicador tiene unidad.
6. Las incertidumbres y limitaciones se ven sin abrir documentación externa.
7. Los detalles técnicos aparecen al seleccionar un punto o abrir un panel.
8. No usar un color diferente para cada dataset sin una semántica común.
9. Evitar texto encima del terreno cuando dificulte leer el relieve.
10. La cámara 3D no debe impedir comparar rutas.
11. El usuario debe poder volver a un estado inicial claro.
12. La interfaz debe funcionar en una pantalla de notebook estándar.

### Jerarquía de capas
- **Base siempre disponible:** terreno + textura óptica.
- **Movilidad:** pendiente, rugosidad y rutas.
- **Ciencia:** waypoints, fotos y contexto geológico/térmico.
- **Seguridad:** radiación y contexto ambiental.
- **Técnico:** procedencia, resolución, unidades y supuestos.

No superponer todas a la vez. La capa seleccionada debe tener prioridad visual.

## 18. Dirección visual

Buscá una estética:
- científica;
- sobria;
- de exploración planetaria;
- de consola de planificación;
- alto contraste;
- tipografía técnica legible;
- paneles densos pero ordenados;
- microinteracciones discretas.

Evitá:
- estética gamer;
- gradientes decorativos sin función;
- tarjetas repetidas para todo;
- glassmorphism excesivo;
- exceso de bordes y sombras;
- indicadores circulares decorativos;
- animaciones que no aporten comprensión;
- texto diminuto;
- mapas que parezcan una imagen estática con controles falsos.

Usá el skill Impeccable para la dirección visual y crítica de UX, pero no permitas que el pulido visual desplace la validación de datos.

---

# PARTE IX — AGENTES Y USO DE MODELOS

## 19. Estrategia de Claude

Usá el modelo más capaz disponible para las tareas de arquitectura, razonamiento científico, decisiones ambiguas y revisión crítica. Usá el modelo rápido/especializado disponible para tareas acotadas de frontend, componentes, estilos y documentación. No des por hecho que los nombres o versiones de modelos mencionados por el equipo están disponibles: verificá el selector y las capacidades reales de la cuenta.

La estrategia no es “muchos agentes para todo”. Es **pocos agentes con contratos claros y un integrador responsable**.

## 20. Agentes propuestos

### Agente 0 — Orquestador / Tech Lead
Responsable de:
- mantener el objetivo y alcance;
- leer el plan;
- dividir tareas;
- fijar contratos;
- revisar dependencias;
- evitar cambios incompatibles;
- integrar ramas;
- decidir qué queda fuera.

No delegar decisiones de arquitectura contradictorias a varios agentes en paralelo.

### Agente 1 — Data & Scientific Audit
Responsable de:
- auditar archivos y manifiesto;
- validar metadatos, CRS, unidades y cobertura;
- detectar datos faltantes;
- preparar un catálogo de capas;
- producir un informe de calidad y limitaciones.

Entregable: `docs/data-audit.md`.

### Agente 2 — Terrain & Geospatial
Responsable de:
- DEM;
- transformación local de coordenadas;
- heightmap;
- pendiente y rugosidad;
- alineación de texturas;
- pruebas de georreferenciación.

Entregable: módulos de terreno + tests + documentación.

### Agente 3 — Route Optimization
Responsable de:
- función de costo;
- A* u otro algoritmo justificado;
- rutas rápida, conservadora y científica;
- sensibilidad de pesos;
- métricas de validación.

Entregable: rutas GeoJSON/JSON + `docs/route-methodology.md`.

### Agente 4 — Environment & Radiation
Responsable de:
- limpieza y resumen RAD;
- análisis REMS;
- dosis estimada con unidades correctas;
- calidad temporal;
- advertencias y limitaciones.

Entregable: JSON de indicadores + `docs/environment-methodology.md`.

### Agente 5 — Frontend / 3D
Responsable de:
- shell de aplicación;
- visor 3D;
- vista cenital;
- carga de paquetes estáticos;
- capas, rutas, waypoints;
- sincronización con paneles.

Entregable: frontend funcional con datos reales.

### Agente 6 — UX / Visual QA
Responsable de:
- jerarquía de información;
- consistencia visual;
- accesibilidad;
- responsive;
- crítica con Impeccable;
- revisión de legibilidad de métricas.

Entregable: `docs/ux-review.md` y correcciones priorizadas.

### Agente 7 — Independent Reviewer
Responsable de revisar desde contexto separado:
- errores científicos;
- supuestos no declarados;
- fallas de unidades;
- inconsistencias de contrato;
- datos presentados como actuales sin serlo;
- rutas no reproducibles;
- errores de UI que comprometan interpretación.

No debe reescribir todo. Debe entregar hallazgos priorizados P0/P1/P2.

## 21. Qué paralelizar y qué no

**Se puede paralelizar:**
- auditoría de RAD/REMS;
- auditoría del DEM y sus sidecars;
- investigación de librerías;
- exploración de fotos y waypoints;
- diseño de componentes UI aislados;
- tests de funciones independientes.

**No paralelizar inicialmente:**
- definición del contrato `site.json`;
- transformación de coordenadas;
- semántica de unidades;
- estructura central de la escena 3D;
- función de costo compartida;
- integración final.

Primero fijar interfaces; después delegar. Cada agente debe declarar:
- archivos que puede modificar;
- archivos que no debe tocar;
- formato de entrada;
- formato de salida;
- pruebas que debe ejecutar;
- supuestos;
- definición de terminado.

No permitir que dos agentes modifiquen simultáneamente el mismo archivo crítico.

---

# PARTE X — SKILLS Y HERRAMIENTAS

## 22. Skills recomendados

### Impeccable
Repositorio: https://github.com/pbakaus/impeccable

Usarlo para:
- dirección visual;
- arquitectura de información;
- crítica de interfaz;
- reducción de carga cognitiva;
- consistencia de componentes;
- accesibilidad;
- responsive;
- auditoría visual final.

No usarlo como sustituto de diseño de producto ni como autoridad científica.

### Everything Claude Code (ECC)
Repositorio: https://github.com/affaan-m/ECC

Evaluar su uso para:
- planificación antes de implementar;
- TDD;
- revisión independiente;
- debugging;
- seguridad;
- documentación;
- hooks y automatizaciones;
- agentes especializados;
- gestión del contexto.

Instalar desde el repositorio oficial y revisar las instrucciones/versiones actuales. No copiar toda la configuración ni habilitar todos los hooks automáticamente. Elegir un perfil mínimo, comprobar compatibilidad con la versión instalada de Claude Code y evitar instalar ECC dos veces por mecanismos distintos.

### Skills adicionales a considerar
Seleccionar solo las que aporten a una tarea real:
- frontend design / frontend engineering;
- TypeScript;
- React;
- Three.js / React Three Fiber;
- Python;
- geospatial / GIS / raster processing;
- data analysis;
- testing / TDD;
- code review;
- documentation;
- performance profiling.

Antes de instalar una skill:
1. revisar autor y repositorio;
2. leer el `SKILL.md`;
3. comprobar licencia y permisos;
4. inspeccionar scripts/hooks/MCP;
5. instalar solo si es necesaria;
6. evitar duplicar instrucciones entre skills.

## 23. MCP y herramientas externas

No agregar MCPs por moda. El POC ya tiene datos locales.

Considerar:
- GitHub MCP si el flujo de issues/PRs realmente lo necesita;
- documentación oficial consultable para Three.js, React Three Fiber y Python;
- herramientas de inspección de imágenes/raster;
- browser automation para QA visual si está disponible.

No habilitar acceso amplio a filesystem, shell o repositorios sin revisar permisos. Nunca exponer secretos, tokens ni credenciales en prompts, logs o commits.

---

# PARTE XI — PLAN DE EJECUCIÓN END-TO-END

## 24. Fase 0 — Kickoff y definición (5–10% del esfuerzo)

Entregables:
- problema y usuario;
- escenario de EVA;
- sitio principal;
- objetivo científico;
- definición de éxito del POC;
- alcance y exclusiones;
- decisiones abiertas.

Decisiones por defecto recomendadas:
- sitio: Gale, Pahrump Hills → Hematite Hotspot;
- segundo sitio boxwork: opcional, solo después del flujo principal;
- usuario: astronauta planificador individual;
- vista: 3D principal + 2D cenital;
- rutas: rápida, conservadora, científica;
- datos: paquetes estáticos;
- objetivo científico: conectar paradas/waypoints de interés dentro del tramo elegido;
- no construir HUD ni tiempo real.

No inventar la duración de la EVA ni velocidad humana marciana. Proponer parámetros editables y etiquetarlos como supuestos de escenario hasta que el equipo los defina.

## 25. Fase 1 — Auditoría de datos

Tareas:
1. inventariar archivos;
2. validar manifiesto y checksums;
3. abrir los DEM y revisar dimensiones/rangos;
4. comprobar alineación de DEM y mosaicos;
5. inspeccionar GeoJSON y waypoints;
6. leer etiquetas XML de REMS;
7. inspeccionar CSV RAD y fill values;
8. revisar `photos/index.json` y seleccionar imágenes;
9. registrar cobertura espacial y temporal;
10. clasificar cada variable por calidad y utilidad.

Entregables:
- `docs/data-audit.md`;
- tabla de fuentes y unidades;
- matriz de calidad;
- lista de brechas;
- decisión justificada sobre si hace falta nueva descarga.

**Gate 1:** no pasar a construir el paquete hasta conocer CRS, resolución, orientación, unidades y cobertura de cada archivo que se vaya a usar.

## 26. Fase 2 — Contrato de datos y arquitectura

Tareas:
1. definir `site.json`;
2. definir estructura de `data/processed/<site>/`;
3. fijar nombres y unidades;
4. definir rutas, waypoints y metadatos;
5. acordar transformación local de coordenadas;
6. definir validadores de paquete.

Estructura sugerida (adaptar al repositorio existente):

```text
data/
  raw/
  processed/
    gale/
      site.json
      terrain/
        heightmap_detail.png
        heightmap_context.png
        slope.png
        roughness.png
      textures/
        hirise_detail.png
        ctx_context.png
        themis_day.png
        themis_night.png
      routes/
        fastest.geojson
        safer.geojson
        science.geojson
      science/
        waypoints.geojson
        photos-index.json
      environment/
        radiation-summary.json
        rems-summary.json
      validation/
        route-validation.json
```

No duplicar archivos si ya existe una estructura equivalente. Mantener una única fuente de verdad.

**Gate 2:** un paquete mínimo de prueba debe poder cargarse en el frontend y mostrar correctamente coordenadas, elevación y textura.

## 27. Fase 3 — Procesamiento geoespacial

Tareas:
- leer DEM;
- preservar metadata;
- derivar heightmap con offset/scale por archivo;
- suavizar DEM con criterio documentado antes de calcular pendiente;
- calcular pendiente en grados o porcentaje y declarar cuál;
- calcular rugosidad con una métrica explícita;
- alinear texturas;
- transformar ruta y waypoints al sistema local;
- muestrear elevación a lo largo de las rutas;
- exportar assets optimizados.

Pruebas obligatorias:
- orientación norte/sur correcta;
- esquinas del bbox correctas;
- puntos de control en posiciones esperadas;
- elevaciones plausibles;
- no hay desplazamiento entre textura y DEM;
- no hay `NaN`/nodata no tratados;
- unidades consistentes.

**Gate 3:** el terreno real se ve correctamente en una escena mínima sin rutas ni paneles.

## 28. Fase 4 — Motor de rutas y KPIs

Tareas:
1. definir celdas transitables y restricciones;
2. implementar costos;
3. generar rutas;
4. extraer métricas;
5. calcular sensibilidad;
6. validar geometría y conectividad;
7. comparar con recorrido histórico cuando sea válido;
8. documentar limitaciones.

Entregables:
- tres rutas;
- métricas por ruta;
- gráfico o resumen comparativo;
- parámetros y pesos;
- tests del algoritmo;
- metodología documentada.

**Gate 4:** todas las rutas son reproducibles y sus KPIs pueden recalcularse desde los datos fuente.

## 29. Fase 5 — Radiación y contexto ambiental

Tareas:
- limpiar RAD y respetar flags/fill values;
- resumir tasas con ventanas temporales declaradas;
- elegir un valor de referencia justificable;
- calcular presupuesto de dosis según duración configurable;
- mantener separados dosis absorbida y equivalente;
- analizar REMS y sus flags/unidades;
- resumir variables ambientales relevantes;
- etiquetar el período de observación;
- generar avisos de limitación.

**Gate 5:** ningún dato histórico se presenta como condición actual o pronóstico. Ninguna conversión de unidades queda sin fuente.

## 30. Fase 6 — Frontend funcional

Construir en este orden:

1. App shell y layout.
2. Carga y validación del `site.json`.
3. Terreno 3D real.
4. Textura HiRISE.
5. Controles de cámara y vista cenital.
6. Capa de pendiente.
7. Rutas y selector de alternativas.
8. Waypoints y paradas.
9. Fotos de superficie.
10. Panel de KPIs.
11. Panel de radiación y contexto ambiental.
12. Panel de supuestos, fuentes y calidad.
13. Segundo sitio opcional.

No construir primero una interfaz completa con datos mock para luego descubrir que el contrato real no sirve. Se puede usar un paquete de prueba mínimo, pero el flujo debe migrar temprano a datos reales.

## 31. Fase 7 — UX, visual QA y rendimiento

Probar:
- notebook estándar;
- resolución 1366×768 o similar;
- pantallas más pequeñas;
- carga inicial;
- cambio de capas;
- cambio de rutas;
- selección de waypoints;
- cámara;
- lectura de KPIs;
- leyendas;
- errores de assets;
- modo sin WebGL si corresponde.

Medir:
- tiempo de carga inicial;
- tamaño total de assets;
- FPS aproximados durante interacción;
- tiempo de cambio de ruta/capa;
- uso de memoria si es posible;
- errores de consola.

Optimizar antes de agregar efectos:
- reducir resolución de malla si hace falta;
- usar texturas comprimidas cuando corresponda;
- evitar meshes/draw calls innecesarios;
- cargar fotos bajo demanda;
- no recalcular A* en cada render;
- memoizar geometrías y datos derivados.

## 32. Fase 8 — Validación integral

Ejecutar una revisión independiente que intente refutar la demo.

Checklist:
- ¿La elevación corresponde al DEM?
- ¿El norte está orientado correctamente?
- ¿Las rutas están en el mismo CRS que el terreno?
- ¿La distancia se calcula en metros/km y no en grados?
- ¿La pendiente está expresada en la unidad declarada?
- ¿La exageración vertical está informada?
- ¿La dosis tiene unidad, período y fuente?
- ¿REMS aparece como histórico?
- ¿Las fotos corresponden al waypoint indicado?
- ¿La geología no se presenta como detalle local si su escala no lo permite?
- ¿Las rutas no se venden como certificadas para humanos?
- ¿Se distinguen mediciones, derivados y supuestos?
- ¿El usuario entiende qué ruta está viendo y por qué?

Corregir primero P0 (error científico, geoespacial o de interpretación), después P1 (usabilidad), luego P2 (estética).

## 33. Fase 9 — Demo y documentación

Entregar:
- POC funcional;
- README con setup y ejecución;
- arquitectura;
- catálogo de datos;
- metodología de rutas;
- metodología RAD/REMS;
- supuestos y limitaciones;
- instrucciones para reproducir el paquete;
- demo breve con escenario completo;
- lista de mejoras futuras.

La demo debe contar una historia:
1. objetivo científico;
2. sitio y terreno;
3. alternativas de ruta;
4. trade-offs;
5. condiciones y presupuesto de exposición;
6. waypoint/fotografía;
7. decisión final y limitaciones.

---

# PARTE XII — CRITERIOS DE ÉXITO

## 34. Definition of Done del POC

El POC se considera logrado cuando:

### Datos
- [ ] El sistema usa datos reales ya disponibles del repositorio.
- [ ] Las fuentes y fechas están documentadas.
- [ ] Las unidades y resoluciones están disponibles.
- [ ] Los supuestos se distinguen de las mediciones.
- [ ] El paquete de datos se valida automáticamente.

### Terreno y mapa
- [ ] El terreno 3D se construye desde el DEM real.
- [ ] La textura coincide espacialmente.
- [ ] Existe vista cenital.
- [ ] Las capas tienen leyenda y unidades.
- [ ] Las rutas y waypoints están correctamente posicionados.

### Decisiones
- [ ] Se muestran al menos dos rutas comparables; idealmente tres.
- [ ] Se explican sus criterios.
- [ ] Se muestran distancia, tiempo estimado, pendiente y desnivel.
- [ ] Se informa el presupuesto de dosis con advertencias.
- [ ] Se muestran objetivos científicos y fotografías disponibles.

### UX
- [ ] La pantalla inicial no está sobrecargada.
- [ ] Los KPIs principales se entienden sin leer documentación.
- [ ] Los detalles se consultan bajo demanda.
- [ ] El usuario puede comparar rutas y entender el trade-off.

### Calidad
- [ ] Hay tests de transformaciones, métricas y paquete.
- [ ] No hay errores críticos de consola.
- [ ] La demo funciona sin depender de servicios externos en vivo.
- [ ] Existe documentación reproducible.

---

# PARTE XIII — INSTRUCCIONES DE EJECUCIÓN PARA CLAUDE

## 35. Protocolo de trabajo obligatorio

Trabajá por fases y no intentes resolver todo en una sola respuesta o commit.

### Primera respuesta: solo diagnóstico y plan
Después de leer el repositorio, entregá:
1. resumen del estado actual;
2. mapa de arquitectura existente;
3. inventario de datos confirmados;
4. riesgos científicos/geoespaciales;
5. brechas reales;
6. stack recomendado con justificación;
7. plan de implementación por fases;
8. tareas que se pueden paralelizar;
9. decisiones que necesitan confirmación humana.

No modifiques código durante esta primera etapa.

### Segunda etapa: contrato y pruebas
Una vez aprobado el diagnóstico:
- proponer el contrato;
- crear fixtures mínimos;
- escribir tests de coordenadas y metadatos;
- validar un paquete real pequeño.

### Tercera etapa: pipeline
Implementar módulos pequeños y testeables. No crear un `build.py` monolítico.

### Cuarta etapa: frontend
Integrar primero terreno y textura reales; después rutas, paneles y capas.

### Quinta etapa: revisión
Usar un agente independiente para auditar datos, metodología y UI.

### Sexta etapa: cierre
Entregar un informe de qué funciona, qué no, qué es una aproximación y qué queda fuera.

## 36. Reglas de implementación

- No reescribir archivos completos si un cambio localizado alcanza.
- No borrar código ni datos sin explicar por qué.
- No instalar dependencias sin justificar.
- No usar datos mock en la demo final salvo que estén claramente identificados como mock.
- No ocultar errores de parsing o de georreferenciación.
- No convertir unidades de forma implícita.
- No afirmar que una métrica es científica si es una heurística.
- No afirmar “real-time”, “live”, “safe” o “AI-powered” si la implementación no lo respalda.
- Mantener funciones pequeñas y nombres descriptivos.
- Agregar tests junto con cada transformación crítica.
- Registrar parámetros y versiones.
- Mantener compatibilidad con la estructura actual del repo.
- Antes de ejecutar procesos pesados, explicar costo, duración y archivos afectados.
- No modificar el manifiesto fuente para hacer desaparecer discrepancias.
- No subir a Git datos pesados, secretos ni artefactos temporales.
- No copiar código de repositorios de otros equipos. Se pueden estudiar patrones, no reutilizar implementaciones sin revisar licencias y atribución.

## 37. Formato de cada entrega de un agente

Cada agente debe responder con:

```text
OBJETIVO
Qué problema resuelve.

ARCHIVOS INSPECCIONADOS
Lista concreta.

ARCHIVOS MODIFICADOS
Lista concreta.

DECISIONES
Qué eligió y por qué.

SUPUESTOS
Qué no pudo confirmar.

VALIDACIONES
Comandos/tests ejecutados y resultados.

RIESGOS / PENDIENTES
Qué necesita del integrador.

DEFINICIÓN DE TERMINADO
Qué queda funcionando.
```

## 38. Primera instrucción para iniciar

**Comenzá ahora con Fase 0 y Fase 1. No programes todavía.**

Inspeccioná el repositorio `Hackaton_NASA` completo, priorizando los documentos y archivos indicados. Validá los datos existentes en lugar de asumir que el inventario documental es exacto. Entregá un diagnóstico técnico y científico que permita decidir qué reutilizar, qué procesar y qué falta.

Después proponé:
- la arquitectura final del POC;
- el stack exacto y las versiones compatibles;
- el contrato de datos;
- los agentes que conviene activar;
- las tareas que pueden correr en paralelo;
- el orden de implementación;
- los criterios de aceptación de cada fase.

**Esperá aprobación antes de modificar código, descargar nuevos datos o instalar dependencias.**

---

# ANEXO A — DECISIONES RECOMENDADAS EN UNA PÁGINA

| Pregunta | Recomendación |
|---|---|
| ¿Mapa 3D obligatorio? | Sí para la experiencia principal, con vista cenital 2D complementaria |
| ¿Librería 3D? | Three.js; React Three Fiber si el frontend es React y la integración declarativa aporta valor |
| ¿Cesium? | No para el primer POC: es un recorte local de Marte, no un globo planetario completo |
| ¿Usar todos los datos? | No. Usar solo los que respondan preguntas operativas y respetar resolución/cobertura |
| ¿Volver a ingerir? | No. Auditar primero; reprocesar lo necesario; descargar solo ante una brecha demostrada |
| ¿Frontend? | React + TypeScript + Vite + Three.js / React Three Fiber |
| ¿Backend? | No inicialmente. Pipeline Python offline y paquete estático |
| ¿Una o dos personas? | Diseñar el caso de uso como planificación de EVA; parametrizar tripulación 1/2 sin modelar logística compleja |
| ¿Qué KPIs? | Distancia, tiempo estimado, pendiente, desnivel, rugosidad, presupuesto de dosis y valor/paradas científicas |
| ¿Oxígeno? | No como KPI del mapa con los datos actuales. Solo como parámetro futuro de soporte vital |
| ¿Radiación por píxel? | No. RAD es una referencia de sitio/tiempo; no interpolar espacialmente sin evidencia |
| ¿Clima actual? | No. REMS se presenta como observación histórica |
| ¿A* en el frontend? | No necesario. Calcular rutas en Python y servir geometrías estáticas |
| ¿Agentes? | Sí, pocos y especializados; un integrador mantiene contratos y decisiones |
| ¿ECC? | Sí, selectivamente para workflows de ingeniería, testing y review |
| ¿Impeccable? | Sí, para diseño, crítica UX y auditoría visual |
| ¿Qué hace distinto al POC? | Explica trade-offs entre movilidad, ciencia y exposición, no solo visualiza capas |

# ANEXO B — REFERENCIAS TÉCNICAS

Consultar documentación oficial y versiones vigentes antes de fijar dependencias:

- Three.js — documentación: https://threejs.org/docs/
- Three.js BufferGeometry: https://threejs.org/docs/pages/BufferGeometry.html
- Three.js custom BufferGeometry: https://threejs.org/manual/en/custom-buffergeometry.html
- React Three Fiber — introducción: https://r3f.docs.pmnd.rs/getting-started/introduction
- React Three Fiber — Canvas: https://r3f.docs.pmnd.rs/api/canvas
- deck.gl — coordinate systems (referencia conceptual): https://deck.gl/docs/developer-guide/coordinate-systems
- NASA MSL RAD Level 2: https://data.nasa.gov/dataset/mars-science-laboratory-msl-radiation-assessment-detector-rad-level-2-observation-dosimetr
- NASA PDS REMS bundle: https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn%3Anasa%3Apds%3Amsl_rems&version=1.0
- ECC: https://github.com/affaan-m/ECC
- Impeccable: https://github.com/pbakaus/impeccable

Las referencias de librerías son una guía inicial, no una orden de instalar todo. Verificar compatibilidad, estabilidad, licencia y mantenimiento antes de elegir versiones.

---

# ANEXO C — PRINCIPIO FINAL

**La calidad del POC no se mide por la cantidad de capas, agentes, KPIs o tecnologías utilizadas. Se mide por si una persona puede tomar una decisión mejor informada y entender por qué el sistema se la recomienda.**

Prioridad absoluta:

1. datos confiables;
2. geometría correcta;
3. métricas explicables;
4. rutas reproducibles;
5. interfaz interpretable;
6. estética y funcionalidades adicionales.

Si una funcionalidad no mejora una decisión, no es prioritaria para este POC.
