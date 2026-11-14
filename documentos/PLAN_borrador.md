# Plan de trabajo — BORRADOR v1 (para revisión)

Equipo: 6 personas + Claude. Hackathon NASA Space Apps 2026, challenge "Interplanetary Survival Guide: Martian Map". Hoy es sábado 14/11. La entrega cierra el domingo 15/11 a las 23:59, hora del evento local. Leer también: `enunciado_oficial.md`, `Resumen_1_Entrega.md` y `Resumen_2_Proyecto.md` en esta carpeta.

## 1. Decisiones ya tomadas
- **Producto:** un **generador de mapas de caminata marciana (Marswalk)**. El usuario elige un sitio y el sistema arma una vista 3D por capas, con ruta y datos de seguridad para un astronauta.
- **Sitio principal:** **cráter Gale / laderas bajas de Mount Sharp** (objetivo científico: formaciones *boxwork*, que es el ejemplo del enunciado). Un sitio pulido a fondo, más 2 o 3 sitios secundarios para demostrar que el sistema es general, y cualquier punto de Marte con DEM global de MOLA (~200 m/px) como respaldo.
- **Todo NASA o del gobierno de EE. UU.** como núcleo. Datos externos solo opcionales y siempre declarados.
- **Reglas del evento local:** prohibido usar modelos de IA chinos.

## 2. Datos verificados (todos de NASA)
| Capa | Fuente | Acceso | Estado |
|---|---|---|---|
| Terreno 3D, Gale | HiRISE DEM 1 m, servicio `Gale_DEM_SMG_1m` (Mars Trek, ArcGIS ImageServer) | `exportImage` devuelve TIFF float32 en metros. Cubre ~36×40 km (lon 137.12–137.73, lat -4.93 a -4.25). Máx. 15000×4100 px por pedido | Probado: recorte de 256×256 devolvió -4514 a -4490 m |
| Terreno, otros sitios | DEM 1 m de Columbia Hills, Endeavour, Victoria, InSight (Mars Trek) | Igual que arriba | Existen, sin probar |
| Terreno global (respaldo) | MOLA+HRSC 200 m/px (Mars Trek ImageServer) | Igual | Existe, sin probar |
| Imagen | Mosaicos HiRISE y CTX de Gale (Mars Trek, WMTS) | Tiles | Existen |
| Ruta y waypoints | `curiosity_path` (1 línea) y `curiosity_waypoints` (14 puntos), zona ~10 km (Mars Trek MapServer) | `query` | Existen. **Atributos sin ver** |
| Geología | `SIM3292_Global_Geology` (USGS, Mars Trek MapServer) | Tiles/query | Existe, sin probar |
| Térmico | THEMIS-IR día/noche, inercia térmica TES (Mars Trek) | Tiles | Existen, sin probar |
| Mineralogía | CRISM, OMEGA hidratados (Mars Trek) | Tiles | Existen, sin probar |
| **Radiación** | **CDAWeb `MSL_RAD_OBS-L2`**, variable de dosis total | API REST por rango de fechas, CSV | **Probado.** 2011-11 a hace 3 días, ~1 medición cada 17 min, **~152 KB por mes**. Dosis absorbida en µGy/día: ~205 µGy/día (silicio) en enero 2014. Es dosis absorbida, no equivalente en mSv |
| **Clima** | **PDS Atmospheres, bundle REMS** (viento, presión, humedad, temperatura aire y suelo, UV) | Carpetas por sol, tablas de texto sin encabezado, `-999` = sin dato | Verificado el formato. **~60 MB por sol.** Cubre sol 1–4843 (ago 2012 – mar 2025). Solo conviene bajar soles representativos |

Acceso desde la terminal (curl) funciona para CDAWeb, PDS y Mars Trek. Chrome ya no es necesario.

## 3. Arquitectura propuesta
- **Pipeline en Python** que, dada la **configuración de un sitio** (archivo YAML con bbox, servicios y capas), descarga los datos, los procesa y exporta un paquete estático por sitio: heightmap, texturas/tiles, rutas en JSON, series ambientales en JSON.
- **Visor web estático** (sin backend), publicado en GitHub Pages para tener el link público que exige la entrega. Vista 3D del terreno, capas que se prenden y apagan, ruta, paneles de radiación y clima, y fotos de punto de vista en las paradas.
- **Planificador de ruta** (A* o similar) sobre el heightmap con **costo para astronauta con traje**: pendiente máxima caminable, esfuerzo por pendiente, radio máximo de retorno al hábitat/rover, y evitar obstáculos (pendientes extremas o rocas grandes).
- Agregar un sitio nuevo = agregar un archivo de configuración. Eso es la escalabilidad.

## 4. Roles propuestos (6 personas)
1. **Datos de terreno**: descarga y procesa DEM, pendientes, recortes por sitio.
2. **Datos de capas**: geología, térmico, mineralogía (tiles y recortes).
3. **Datos ambientales**: radiación (RAD) y clima (REMS), series y promedios por estación.
4. **Visor 3D**: la interfaz web.
5. **Ruta**: planificador con costo para astronauta y ruta para los objetivos de boxwork.
6. **Entrega y presentación**: formulario en inglés, demo (≤7 slides o ≤30 s de video), presentación local en español (2–3 min), declaración de IA y de datos, y coordinación.

## 5. Cronograma tentativo
- **Sáb tarde:** decidir zona exacta de boxwork. Repo con estructura y formato de configuración de sitio. Descargas de terreno de Gale. Boceto del visor.
- **Sáb noche:** capas y datos ambientales listos y exportados. Visor con terreno y una capa.
- **Dom mañana:** ruta y visor integrados con todas las capas. Segundo sitio.
- **Dom tarde:** pulido, demo y presentaciones. **Congelar el código a las 17:00.**
- **Dom noche:** cargar el formulario y enviar **antes de las 21:00**, para tener margen hasta las 23:59.

## 6. Qué se recorta si falta tiempo
Primero se recortan los sitios secundarios (queda solo Gale), después el respaldo global de MOLA, después el clima REMS. **Nunca se recorta:** terreno 3D de Gale, ruta, radiación, demo y entrega.

## 7. Riesgos conocidos
- Atributos de la ruta de Curiosity sin ver. La ruta de Trek cubre solo ~10 km.
- REMS es pesado y requiere parseo de columnas.
- No hay lista oficial de qué rocas o obstáculos evitar: habrá que definirlo con el DEM (pendiente) y documentarlo.
- Falta la *2026 Judging and Awards Guide* (criterios detallados).
- Posible contradicción sobre el formato de la presentación global (archivo vs. link público). Hay que preguntarle a un tutor.

## 8. Preguntas abiertas
- Stack del visor 3D (three.js, deck.gl, CesiumJS u otro): qué es más rápido de armar con 6 personas.
- Cómo cargar el heightmap a una resolución usable sin tirar el navegador.
- Cómo mostrar fotos de punto de vista (Perseverance/Curiosity raw images) para Gale.
