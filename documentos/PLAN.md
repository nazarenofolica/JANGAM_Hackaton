# Plan de trabajo — Marswalk Radar (plan 2D)

> **Branch `plan2d`.** Este plan reemplaza, solo en esta branch, al plan 3D ("Marswalk — Decision Support"), que sigue vigente en `develop`. El porqué del cambio está en [`BITACORA.md`](BITACORA.md); el avance, en [`CHECKLIST.md`](CHECKLIST.md).

Equipo: 6 personas + Claude. NASA Space Apps 2026, challenge "Interplanetary Survival Guide: Martian Map". Entrega: cierra **domingo 15/11 a las 23:59**. **Meta interna de envío: domingo 20:00.**

## 1. Producto

**Marswalk Radar**: la pantalla de una **tablet táctica** que el astronauta lleva durante la caminata (EVA) por el cráter Gale. Es un **radar centrado en el astronauta**, orientado hacia donde mira, que responde de un vistazo tres preguntas:

| # | Pregunta del astronauta | Qué muestra el radar |
|---|---|---|
| 1 | **¿Por dónde camino sin atascarme ni caerme?** | Relieve oscuro de fondo, zonas rojas (pendiente > 20°), la ruta modelada en verde y el recorrido real de Curiosity como referencia |
| 2 | **¿Cuánto tiempo me queda y cuándo tengo que volver?** | Reloj de la EVA, anillo ámbar de retorno (hasta dónde puedo llegar y todavía volver a tiempo al rover), clima histórico del momento del día y radiación medida por Curiosity, con un escenario de tormenta solar |
| 3 | **¿Hacia dónde voy a investigar y qué voy a encontrar?** | Paradas científicas en cian, con distancia, desnivel (Δz) y la foto real que sacó Curiosity en ese lugar |

**Es una simulación.** La posición del astronauta avanza sobre la ruta modelada con un reloj que se puede reproducir, pausar y adelantar. En una misión real vendría de odometría inercial y visual, y eso se aclara en pantalla. **No hay datos en vivo.**

El diferencial: una interfaz simple y linda, donde **cada elemento sale de un dato real de la NASA o de un cálculo explicado**, y donde lo que no se puede saber se dice.

## 2. Sitio y escenario

- **Sitio:** Gale, de Pahrump Hills a Hematite Hotspot. Recorte lon 137.342–137.392, lat −4.740 a −4.652: **2,95 × 5,21 km a 2 m por píxel**. Es terreno que Curiosity recorrió: sirve para validar.
- **Escenario por defecto** (editable en `configs/packages/gale_radar.yaml`, todos son supuestos):
  - 2 astronautas a pie, **solo ida**; los recoge un rover presurizado en **Hematite Hotspot**.
  - Paradas en orden: Pahrump Hills (inicio) → Marias Pass → Bagnold Dunes → Murray Buttes → Bagnold Dunes South → Vera Rubin Ridge → Top of Vera Rubin Ridge → Hematite Hotspot (recogida).
  - Velocidad base 2,5 km/h en llano, 20 min por parada, **EVA de 6 h**, salida a las 10:00 hora solar local.
- **Resultado de la ruta modelada** (calculado, `route/route.json`):

| KPI | Valor |
|---|---|
| Distancia | **5,34 km** (3,69 km en línea recta) |
| Tiempo estimado caminando | 162 min |
| Tiempo en paradas | 120 min (6 × 20) |
| EVA total / presupuesto | **282 / 360 min** (margen mínimo de retorno: 77 min) |
| Desnivel | +346 m / −31 m |
| Pendiente máxima en la ruta | 19,1° (límite: 20°) |
| Coincidencia con Curiosity | 57 % del recorrido a menos de 50 m de su huella (Curiosity manejó 9,3 km entre los mismos puntos) |

## 3. Cómo se responde cada pregunta (dato → cálculo → pantalla)

### 3.1 Terreno y obstáculos
- **Datos:** DEM HiRISE `dem_detail.tif` (altura en metros, 2 m/px) y el mosaico HiRISE alineado.
- **Cálculo:**
  - Pendiente en grados con un gradiente 2D sobre el DEM suavizado (σ = 1 px, base efectiva ~4–6 m).
  - **Rojo = pendiente > 20°**: un 2,4 % del área.
  - Ruta: grilla de 4 m (bloques 2×2, **máximo** de pendiente para no esconder obstáculos), grafo de 8 vecinos, celdas > 20° prohibidas, sin cortar esquinas, costo = tiempo de caminata según la pendiente (curva tipo Tobler). Camino mínimo (Dijkstra) parada por parada.
- **Pantalla:** relieve gris oscuro, rojo, línea verde (ruta modelada) y línea blanca punteada (Curiosity, referencia).
- **Descartado:** "píxeles oscuros de HiRISE = arena blanda". Se probó el 14/11: en las paradas que el rover llamó *Bagnold Dunes* el brillo queda en los percentiles 48 y 96, así que no separa arena de roca. Ver BITACORA.

### 3.2 Ventana operativa y seguridad
- **Anillo ámbar de retorno (isócrona):**
  - Con el mismo grafo de rutas se calcula, para cada celda, cuántos minutos se tarda en caminar hasta el rover de recogida (`return_time_4m.png`).
  - El anillo es la curva donde ese tiempo es igual al tiempo de EVA que queda. No es un círculo: se deforma alrededor de las pendientes.
  - Reemplaza la idea original de un anillo por batería, temperatura y radiación: no hay datos que conecten esas variables con la distancia.
- **Clima (REMS):** ciclo diario por hora (aire, suelo, presión, UV) de 8 soles históricos, con flags de confianza aplicados. Se muestra la curva con la ventana de la EVA (10:00–16:00) marcada y el "ahora" simulado. El suelo llega a su máximo cerca de las 13–14 h. Rótulo obligatorio: *Historical REMS observations at Gale Crater*. Sin viento: no hay datos válidos.
- **Radiación (RAD), tres niveles:**
  - **Medido:** tasa de referencia **185,6 µGy/día**, mediana del 11/10 al 10/11/2026.
  - **Ilustrativo:** presupuesto de la EVA = tasa × 6 h = **46 µGy**. No es una dosis humana.
  - **Exposición real:** *not modelled*.
  - **Escenario histórico 20/05/2024:** la tasa pasó de ~160 a un pico de **8.378 µGy/día**. La peor ventana de 6 h midió **1.076 µGy**, 23 veces el presupuesto normal. Botón "Replay" y alerta ilustrativa cuando la tasa supera 3 × la referencia (supuesto declarado).

### 3.3 Objetivos científicos
- **Datos:** 9 paradas con nombre de Mars Trek (`curiosity_waypoints.geojson`), fotos Navcam de Curiosity (`index.json`, 4 por parada).
- **Cálculo:** lon/lat → metros locales; distancia por la ruta, ETA y Δz respecto de la posición actual.
- **Pantalla:** marcadores cian (próximas), violeta (ya visitadas), ámbar o blanco para la recogida. Tarjeta con nombre, distancia, ETA, Δz, foto con crédito y objetivo científico (**texto a cargo del equipo, con fuente**).

## 4. Datos

Catálogo en [`data/README.md`](../data/README.md); fuente y checksum de cada archivo en `data/raw/MANIFEST.json`. **No se descargan datos nuevos.** Se usan: DEM HiRISE (recorte `detail`), mosaico HiRISE, recorrido y paradas de Curiosity (Mars Trek + mapa JPL), RAD (15 CSV), REMS (8 soles) y fotos Navcam.
**No se usan en esta versión:** THEMIS (81 m/px, demasiado grueso para un radar de cientos de metros), geología SIM 3292, CTX, los recortes `route_full`, `boxwork` y `context`.

## 5. Arquitectura

```
data/raw  →  src/marswalk (Python)  →  data/processed/gale_radar/  →  web/ (three.js, estático)
```

- **Configuración:** `configs/packages/gale_radar.yaml` (escenario y supuestos). `configs/sites/gale.yaml` no se toca (lo usan los scripts de descarga).
- **Pipeline (`src/marswalk/`, ya implementado):**

| Módulo | Qué hace |
|---|---|
| `geo.py` | lon/lat ↔ metros locales ↔ fila/columna. Única fuente de la transformación |
| `terrain.py` | Pendiente, sombreado del relieve, agregación a 4 m |
| `route.py` | Grafo, ruta por paradas, isócrona de retorno, verificación |
| `stops.py` | Paradas, huella de Curiosity, fotos reducidas |
| `environment.py` | Resúmenes de RAD y REMS |
| `package.py` | Escritura y validación del paquete |
| `build.py` | Orquesta todo |

- **Comando:** `python scripts/build_package.py configs/packages/gale_radar.yaml` (~15 s).
- **Paquete (va a Git, 13 MB):** `site.json`, `terrain/` (relieve, HiRISE, pendiente, máscara roja, elevación uint16, tiempo de retorno), `route/` (ruta y huella de Curiosity), `science/stops.json` + `photos/`, `environment/` (radiación y clima), `preview.png`. El contrato completo, para quien programa el visor, está en [`web/README.md`](../web/README.md).
- **Visor (`web/`):** three.js r187 copiado en `web/vendor/` (import map, sin build, sin CDN). Lee solo `data/processed/`. Se sirve con `python -m http.server` desde la raíz y en GitHub Pages.
- **Tests:** `python -m pytest -q` (coordenadas, motor de rutas, validez del paquete).

## 6. Interfaz — la pantalla de la tablet

Pantalla única, apaisada (diseñar para **1366 × 768**), tema oscuro de alto contraste.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ MARSWALK RADAR · Gale Crater · SIMULATED EVA        LMST 11:42  EVA 01:42/06:00 ⓘ │
├───────────────────────────────────────────────┬──────────────────────────────┤
│                                               │ 1 TERRAIN                    │
│            ╭───── N ─────╮                    │ slope here 6°  max ahead 14° │
│         ╭──┤   250 m     ├──╮                 │ elevation −4.391 m           │
│        │  red zones ▲ green route  │          ├──────────────────────────────┤
│        │   · cyan stops (dist, Δz) │          │ 2 WINDOW & SAFETY            │
│        │   ~ amber return ring     │          │ return margin 77 min         │
│         ╰──┤  white dashed: rover  ├──╯       │ REMS daily curve (historical)│
│            ╰─────────────╯                    │ RAD 185.6 µGy/day [Replay 24]│
│   [250 m | 500 m | 1 km]   [Radar | Overview] ├──────────────────────────────┤
│                                               │ 3 NEXT STOP                  │
│                                               │ Murray Buttes · 412 m · +18 m│
│                                               │ ETA 12 min  [Navcam photo]   │
├───────────────────────────────────────────────┴──────────────────────────────┤
│ ▶ ❚❚  ×60  ────●──────|─────|─────|─────|────  stop markers on the timeline    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Radar (izquierda, protagonista):**
- **Vista:** centrado en el astronauta y con el rumbo hacia arriba. Anillos de distancia con etiqueta y alcance de 250 m / 500 m / 1 km. Flecha de norte que gira.
- **Capas:** fondo = relieve (`hillshade`) teñido gris azulado oscuro; rojo = `hazard`; verde = ruta modelada (tramo recorrido más tenue); blanco punteado = Curiosity (se puede apagar); ámbar = anillo de retorno.
- **Paradas:** cian = próximas, violeta = visitadas. Etiqueta con distancia en metros y Δz. Las que quedan fuera del alcance aparecen como flechas en el borde del radar.
- **Botón *Overview*:** vista cenital con el norte arriba y todo el recorrido, para ubicarse (y para la demo).

**Panel derecho, una tarjeta por pregunta:**
1. **Terrain:** pendiente bajo el astronauta, pendiente máxima en los próximos 200 m, elevación actual.
2. **Window & safety:**
   - Tiempo transcurrido / restante y margen de retorno (minutos que sobran para llegar al rover).
   - Mini gráfico REMS del día (aire y suelo) con la ventana de la EVA y el "ahora"; selector de sol.
   - Indicador RAD con la tasa de referencia y el botón *Replay 2024-05-20*. Si la tasa supera el umbral, aparece un banner de alerta ilustrativa.
3. **Next stop:** nombre, distancia por la ruta, ETA, Δz, foto Navcam (al tocarla se agranda, con sol, fecha y crédito) y objetivo científico.

**Barra inferior:** reproducir y pausar, velocidad (×30, ×60, ×300), línea de tiempo con marcas en cada parada. **Botón ⓘ:** panel *Assumptions & sources* con `site.json › assumptions`, `warnings` y `sources`, más la validación contra Curiosity.

**Paleta:**

| Elemento | Color |
|---|---|
| Fondo | `#0B0F14` |
| Relieve | gris azulado |
| Peligro | `#FF3B30` al 70 % |
| Ruta | `#34C759` |
| Paradas próximas | `#00E5FF` |
| Paradas visitadas | `#B388FF` |
| Anillo de retorno | `#FFB300` |
| Curiosity | blanco al 60 %, punteado |

Tipografía del sistema; números en monoespaciada. Animaciones suaves y nada que distraiga del radar.

## 7. Reglas científicas y terminología (obligatorias)

- **Pendiente:** en grados, del DEM suavizado (σ documentado). Obstáculos de menos de ~4–6 m (rocas sueltas) no se resuelven, y se dice.
- **Ruta:** una sola restricción dura (20°); grafo dirigido; sin cortar esquinas; si no hay camino, se informa y no se relaja el límite. Verificación: la ruta no pisa celdas prohibidas (`validation.path_check`).
- **Velocidad:** curva tipo senderismo terrestre escalada a 2,5 km/h. **Es un supuesto exploratorio, no un modelo validado para astronautas con traje en Marte.** Se dice en la interfaz.
- **Radiación:** tres niveles (medido / presupuesto ilustrativo / exposición real no modelada). **No se convierte a mSv.** El 20/05/2024 es un escenario histórico, no una predicción.
- **Clima:** "Historical REMS observations", con sol y fecha. Nunca "current weather".
- **Simulación:** la posición es simulada; se rotula *Simulated EVA*.
- **Palabras permitidas:** *modelled route*, *estimated time*, *terrain difficulty*, *simulated*, *historical*.
- **Palabras prohibidas:** *safe route*, *safe*, *real-time*, *live*, *AI-powered*. Curiosity es una referencia histórica, no una prueba de que un humano pueda pasar.
- **Cada dato** dice si es medido, derivado o supuesto, con unidad y fuente.

## 8. Alcance

**Entra:** el radar, el panel de 3 tarjetas, la línea de tiempo, el escenario RAD 2024, las fotos, la vista *Overview*, el panel de supuestos y GitHub Pages.
**No entra:** datos en vivo, rutas alternativas en el visor, 3D, THEMIS, geología, boxwork, conversión a mSv, viento, backend, ML.
**Si sobra tiempo (en este orden):** selector de 2–3 rutas precalculadas (rápida / menor dificultad), tabla de sensibilidad (velocidad × pendiente máxima), capa HiRISE como fondo alternativo.

## 9. Bloques e hitos

| Bloque | Entregable | Condición para seguir |
|---|---|---|
| 0 ✓ | Plan 2D, pipeline, paquete `gale_radar`, tests, three.js copiado | Hecho el dom 15/11 (madrugada) |
| A | Radar mínimo: relieve, rojo, ruta, Curiosity, paradas, posición simulada, rumbo arriba, anillos de distancia | Se ve el radar con datos reales y la posición avanza |
| B | Anillo ámbar, panel de 3 tarjetas, línea de tiempo, foto, REMS y RAD con *Replay* | Las 3 preguntas se responden en pantalla |
| C | *Overview*, panel de supuestos, pulido visual, prueba a 1366×768, `index.html` raíz → `web/`, GitHub Pages | **Dom 11:00 — congelar funcionalidades** |
| D | Revisión final (§10), README, demo | **Dom 17:00 — congelar código**; 17–19 grabar demo; **20:00 enviar** |

## 10. Revisión final (antes de congelar el código)

1. ¿Las distancias están en metros y el norte bien orientado?
2. ¿La ruta y las paradas caen sobre el terreno correcto? Comparar con `preview.png`.
3. ¿El anillo ámbar se achica a medida que pasa el tiempo y la ruta queda adentro?
4. ¿Toda la información ambiental dice "historical" y RAD tiene sus tres rótulos?
5. ¿Las fotos corresponden a su parada y tienen crédito?
6. ¿Aparece en algún lado "safe", "real-time" o "live"?
7. ¿Se ve *Simulated EVA* y el panel de supuestos?
8. ¿Funciona sin internet y sin errores de consola?
9. ¿Alguien que no es del equipo entiende la pantalla en 10 segundos?

## 11. Roles

| # | Rol | Tarea |
|---|---|---|
| 1 | Terreno | Revisar `preview.png` y la alineación en el visor |
| 2 | Ruta | Confirmar o cambiar los supuestos del YAML (velocidad, 20°, paradas, 6 h) y reconstruir el paquete |
| 3 | Radiación y clima | Revisar que los paneles respeten §3.2 y §7 |
| 4 | Visor | Correr el visor, GitHub Pages, probar el link en una ventana privada |
| 5 | Interfaz y fotos | Elegir 1–2 fotos por parada (algunas muestran el rover) |
| 6 | Entrega y narrativa | Objetivo científico por parada con fuente; guion, demo y formulario |

## 12. Cumplimiento

Igual que en el plan 3D: todo en inglés; uso de IA declarado (Claude y Fable); sin logos de NASA; demo ≤ 7 slides o ≤ 30 s; links probados en una ventana privada; los 6 en el mismo Local Event; etiqueta `v1.0`; sin imágenes de menores; sin modelos de IA chinos (regla local). Detalle en [`Entrega.md`](Entrega.md).

## 13. Decisiones

- **Tomadas (15/11, branch `plan2d`):** radar 2D en tablet; simulación en lugar de tiempo real; isócrona de retorno en lugar de un anillo por batería; sin la detección de arena por brillo; Curiosity solo como referencia; escenario de 6 paradas científicas y 6 h; pipeline v0 implementado por Claude; interfaz inicial generada con Fable (three.js).
- **Abiertas:** confirmar los supuestos del escenario; textos científicos; selección de fotos; si el resultado final sale de esta branch o de `develop` (3D).
