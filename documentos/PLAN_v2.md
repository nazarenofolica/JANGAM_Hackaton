# Plan de trabajo — v2 (revisado)

Equipo: 6 personas + Claude. Hackathon NASA Space Apps 2026, challenge "Interplanetary Survival Guide: Martian Map". Hoy sábado 14/11. Entrega cierra domingo 15/11 a las 23:59, hora del evento local. **Meta interna de envío: domingo 20:00.**
Archivos de contexto: `enunciado_oficial.md`, `Resumen_1_Entrega.md`, `Resumen_2_Proyecto.md`.

Esta versión incorpora la revisión del subagente (Opus 5.5) y dos verificaciones nuevas sobre los datos de Curiosity.

## 0. Cambios respecto al borrador v1
- **Un solo sitio secundario**, no 2 o 3. El respaldo global de MOLA queda solo como vista de contexto, no para rutas (a 200 m/px una caminata de 5 km son 25 píxeles).
- **Contrato de datos en la primera hora** (`site.json` con esquema y unidades).
- **El DEM de 36×40 km a 1 m no se carga entero** (~1.400 millones de píxeles, ~5,8 GB en float32): recorte de detalle de 4–6 km a 1–2 m, más contexto de toda la zona a 20–30 m.
- **La radiación no es costo por celda.** RAD es un valor del sitio: se usa como presupuesto de la EVA (tasa × duración).
- **Todo se baja y va al repo.** El visor no depende de servicios en vivo (los jueces evalúan después del fin de semana).
- **Validación de la ruta contra el recorrido real de Curiosity.**
- **Interfaz, README y repo en inglés.**
- **Las fotos de punto de vista salen de Curiosity**, no de Perseverance (la pregunta del borrador estaba mal planteada).
- **La geología global SIM3292 sale como capa central** (mapa global a escala gruesa; en 5 km caben una o dos unidades). Para mineralogía local se prioriza CRISM si existe a resolución dirigida (a verificar).

## 1. Hallazgo nuevo que obliga a decidir el objetivo científico
Verificado hoy contra el servicio de Mars Trek:
- `curiosity_path` es **una sola línea de 19.188 puntos** que va desde **Bradbury Landing (137.4416 E, -4.5895)** hasta **Hematite Hotspot (137.3799 E, -4.7247)**, en Vera Rubin Ridge. Son unos 8 km de recorrido real de los primeros años de la misión.
- `curiosity_waypoints` son 14 puntos con nombre: Bradbury Landing, Rocknest, Glenelg, Darwin Outcrop, The Kimberly, Pahrump Hills, Marias Pass, Bagnold Dunes (×3), Murray Buttes, Vera Rubin Ridge (×2) y Hematite Hotspot. Solo traen nombre y una plantilla de página, sin fecha ni sol.
- **Los boxwork se observaron por primera vez desde cerca en mayo de 2025 (sol 4536)**, en las laderas bajas de Mount Sharp. La ruta de Trek **no llega ahí**.
- **No tengo las coordenadas de los boxwork.** Está sin resolver si caen dentro del DEM (`Gale_DEM_SMG_1m` cubre hasta lat -4.925) o más al sur, fuera de cobertura.

**Decisión necesaria (afecta todo el plan):**
- **Opción 1 — Objetivo en la zona recorrida (recomendada si no se confirma el boxwork hoy):** por ejemplo *Pahrump Hills → Vera Rubin Ridge / Hematite Hotspot*. Hay DEM, ruta real y waypoints con nombre. Permite **validar el costo de la ruta contra el recorrido real de Curiosity** (8 km), que es la prueba de Validity más barata. Se pierde el ejemplo literal del enunciado (boxwork).
- **Opción 2 — Objetivo en el boxwork:** coincide con el ejemplo del enunciado y es más novedoso, pero depende de conseguir las coordenadas, de que estén dentro del DEM y de una ruta real que Trek no tiene. Se valida solo contra el tramo viejo.
- **Híbrido:** el costo se calibra y valida en la zona recorrida (opción 1) y el boxwork queda como segundo sitio, con la misma configuración, si hay coordenadas y cobertura. Muestra la escalabilidad con un caso real.

## 2. Datos verificados (todos NASA / gobierno de EE. UU.)
| Capa | Fuente | Estado |
|---|---|---|
| Terreno 3D Gale | HiRISE DEM 1 m, `Gale_DEM_SMG_1m` (Mars Trek ImageServer) | **Probado.** `exportImage` devuelve TIFF float32 en metros. Cobertura lon 137.12–137.73, lat -4.93 a -4.25. Máx. 15000×4100 px por pedido. Tamaño de píxel ~1,0 m (0,0000169°) |
| Imagen | Mosaicos HiRISE/CTX Gale (Mars Trek WMTS) | Existen. Hay que bajar los tiles al repo |
| Ruta y waypoints | `curiosity_path`, `curiosity_waypoints` | **Probado** (ver sección 1). Descargados en `scratchpad`, listos para pasar al repo |
| Radiación | CDAWeb `MSL_RAD_OBS-L2` | **Probado.** 2011-11 a hace 3 días, ~17 min, ~152 KB/mes. Dosis absorbida en µGy/día (~205 en silicio, enero 2014) |
| Clima | PDS REMS (bundle PDS4) | Formato verificado. ~60 MB por sol, sin encabezados, `-999` = sin dato. Cubre sol 1–4843. **Opcional:** bajar 4–8 soles representativos |
| Geología, térmico, mineralogía | Capas globales de Mars Trek | Existen. Resolución gruesa; a verificar utilidad a 5 km |
| Otros sitios 1 m | Columbia Hills, Endeavour, Victoria, InSight (Mars Trek) | Existen, sin probar. Candidatos a sitio secundario |

Acceso: `curl` funciona sin problemas de certificado para Mars Trek, CDAWeb y PDS Atmospheres. Chrome no hace falta.

## 3. Arquitectura
- **Pipeline Python (`build.py`)**: a partir de un `site.yaml` (bbox, servicios, capas), descarga y procesa, y exporta un **paquete estático por sitio** de menos de 100 MB (GitHub limita archivos a 100 MB).
- **Contrato del paquete** (`site.json`, definido en la primera hora): nombre, bbox, CRS y tamaño de píxel en metros, rango de elevación, rutas de archivos y **unidades de cada campo**. Con un paquete de prueba mínimo desde el principio.
- **Heightmap:** PNG uint16 con offset y escala guardados en el JSON (1 cm de precisión sobre un rango de 655 m); mallas de hasta ~1024² vértices; un nivel de contexto separado.
- **Visor: three.js**, estático, en GitHub Pages. Malla con desplazamiento, capas como texturas sobre la misma malla, ruta como línea con altura muestreada del DEM, coordenadas métricas locales. (CesiumJS y deck.gl se descartaron: fricción con Marte y con capas no geográficas.)
- **Rutas precalculadas** (no A* en vivo en el navegador): 3 variantes (rápida, segura, científica) con distancia, tiempo, pendiente máxima y dosis de la EVA. Los supuestos se muestran como deslizadores/tabla.
- **Pendiente** calculada sobre una base de 3–5 m (a 1 m el ruido de HiRISE la infla). Rugosidad como indicador de bloques, sin llamarlo "rocas detectadas". Rellenar nodata y costuras del mosaico.
- **Diferencial central (Creativity):** radiación y clima donde casi nadie los usa: presupuesto de dosis de la EVA, "condiciones actuales" con RAD de hace 3 días (responde a "updates on current conditions" del enunciado) y, opcional, blindaje por fracción de cielo visible calculada desde el DEM.

## 4. Supuestos que hay que declarar (no son datos)
Pendiente máxima caminable con traje, curva de esfuerzo según pendiente (las fórmulas conocidas son terrestres a 1 g), corrección por gravedad 0,38 g y por el traje, velocidad, radio de retorno y pesos del costo. **Dosis:** RAD da dosis absorbida (µGy/día); pasar a dosis equivalente (mSv) requiere un factor de calidad de la literatura (del orden de 3 según Hassler et al. 2014, a verificar). No comparar µGy con límites en mSv sin explicar la conversión.

## 5. Alcance
**MVP (entra):** Gale con recorte de detalle y contexto; textura HiRISE/CTX; pendiente y rugosidad; una capa térmica o espectral; 3 rutas precalculadas con 3–5 paradas; panel de RAD con serie y último valor; fotos de Curiosity en las paradas; tabla de supuestos; gráfico de validación contra el recorrido real; **un** segundo sitio generado solo cambiando el YAML.
**No entra:** respaldo MOLA para rutas, más de un sitio secundario, A* en vivo, HUD.
**Opcional si sobra tiempo:** clima REMS (4–8 soles).

## 6. Roles y cronograma
| # | Rol | Hitos |
|---|---|---|
| 1 | Terreno + `build.py` + contrato (integrador) | Hora +1: esquema commiteado. Hora +4: recortes de detalle y contexto en el repo |
| 2 | Ruta, costo y validación | Hora +4: A* sobre el tile de prueba. Noche: GeoJSON sobre Gale real. Dom 14:00: gráfico de validación |
| 3 | RAD + REMS + dosis de la EVA | Sáb noche: JSON de RAD y conversión documentada. Dom 11:00: ventana horaria (o se recorta) |
| 4 | Visor 3D núcleo | Hora +1: "hola mundo" en GitHub Pages abierto en ventana privada. Hora +4: terreno con paquete de prueba. Noche: Gale real en Pages |
| 5 | Visor: interfaz, paneles, fotos y tiles | Dom 11:00: todas las capas, ruta y paneles integrados |
| 6 | Entrega + narrativa científica | Sáb: zona y paradas definidas. Dom 17:00: demo. **Dom 20:00: enviado** |

Hitos globales: **Dom 11:00** congelar funcionalidades con el flujo completo en Pages. **Dom 14:00** segundo sitio. **Dom 17:00** congelar código y etiquetar v1.0. **Dom 20:00** formulario enviado y entrega en el Drive local. Desde el domingo 14:00 los roles 1 y 3 ayudan al 6. Planificar turnos de sueño.

## 7. Cumplimiento (checklist)
- [ ] Interfaz, README y formulario en inglés.
- [ ] Declarar el uso de Claude en el campo SI, en el README y en los metadatos. Imágenes generadas con IA, con marca de agua.
- [ ] Sin logos ni insignias de misión de NASA en la interfaz.
- [ ] Slides con nombre del equipo, integrantes y challenge. Máx. 7 slides o 30 s de video.
- [ ] Links probados en ventana privada por alguien ajeno al equipo.
- [ ] Confirmar hoy que los 6 están en el mismo Local Event.
- [ ] Etiquetar `v1.0` al enviar y no tocar `main` después de las 23:59.
- [ ] No copiar código de los repos de otros equipos ("Confirm All Work is Original").
- [ ] Sin imagen, video o audio de menores de 18 años.
- [ ] Respetar la prohibición de modelos de IA chinos (regla del evento local).
- [ ] Un responsable del Lock del formulario.

## 8. Riesgos principales
1. **Falla el armado final.** Mitigación: contrato, paquete de prueba y despliegue en Pages desde el sábado.
2. **El navegador no aguanta el terreno.** Mitigación: recortes, uint16, probar en una notebook común.
3. **La ruta de Trek no llega al boxwork** (ya confirmado) y las coordenadas no están. Mitigación: decidir el objetivo hoy (sección 1).
4. **Cuestionan costos y dosis.** Mitigación: supuestos declarados, deslizadores, citas y validación.
5. **Descalificación por formato.** Mitigación: un responsable del checklist y enviar a las 20:00.

## 9. Preguntas que siguen abiertas
1. Opción 1, 2 o híbrido (sección 1)? Coordenadas del boxwork y si caen dentro del DEM.
2. Escenario: punto de partida/hábitat, cantidad de astronautas, rover de apoyo, duración de la EVA, estación y hora.
3. Usuario y dispositivo: hábitat, tablet o HUD (elegir uno).
4. Proyección real que devuelve `exportImage` y tamaño de píxel en metros exacto.
5. Presentación global: ¿archivo, link o ambos? ¿Cuándo es la presentación local? ¿Alguien consigue la *Judging and Awards Guide*?
6. Quién tiene el Lock del formulario y quién prueba los links.
7. Qué diferencial se cuenta en una frase, frente a los planificadores de Jezero que ya existen.
