# Bitácora del proyecto

Registro de decisiones y de todo lo que se apartó del plan. **El plan vigente está en [`PLAN.md`](PLAN.md)**; acá queda el *porqué* de cada cambio.
Las entradas van de la más vieja a la más nueva. Para agregar una, usar el formato del final.

---

## Sábado 14/11 — Elección del proyecto

**Challenge elegido:** "Interplanetary Survival Guide: Martian Map" (enunciado textual en [`Consigna.md`](Consigna.md)).

**Opciones de producto evaluadas:**
| Opción | Por qué no / por qué sí |
|---|---|
| A. Mapa 2D con ruta en Jezero | Descartada: al menos 3 equipos publicaron exactamente eso. Poca originalidad |
| B. Visor 3D con capas | Se incorpora, pero solo no alcanza: Mars Trek ya tiene vista 3D |
| C. Vista del astronauta con fotos reales | Se incorpora: el enunciado sugiere fotos de punto de vista |
| **D. Generador de mapas para cualquier sitio** | **Elegida.** El enunciado permite "un sistema que genere mapas" y los organizadores piden escalabilidad. Con 6 personas es viable |

**Sitio:** Gale y no Jezero. Gale tiene terreno de 1 m listo por API (Jezero no), detector de radiación (Curiosity RAD; Perseverance no tiene uno equivalente) y es el ejemplo del propio enunciado. Además, menos equipos lo eligen.

**Regla de datos:** el núcleo tiene que ser NASA (lo pide el enunciado; para el premio global hace falta al menos un dato NASA). Datos de otras agencias se pueden sumar, siempre declarados. Hasta ahora no se usó ninguno externo.

---

## Sábado 14/11 — Cómo se armó el plan (3 versiones)

El plan pasó por 3 versiones, revisadas por un subagente (Claude Opus) en dos rondas. Las versiones viejas se borraron del repo; siguen en el historial de Git (commit `829018c`).

**v1 → v2 (primera revisión):**
- Se bajó de 2–3 sitios secundarios a **uno solo**.
- El terreno global de MOLA (200 m/px) quedó solo como contexto, no para rutas: una caminata de 5 km serían 25 píxeles.
- **No cargar el DEM entero** (36 × 40 km a 1 m ≈ 5,8 GB): recortes de detalle y contexto.
- La radiación pasó de "costo por celda" a **presupuesto de dosis de la EVA** (es un valor del sitio, no del píxel).
- Validar la ruta contra el recorrido real de Curiosity, y hacer interfaz y README en inglés.
- Las fotos de Gale tienen que ser de Curiosity, no de Perseverance.
- Visor elegido: **three.js** (CesiumJS y deck.gl tienen fricción con Marte).

**v2 → final (segunda revisión + verificación de datos):**
- Se descubrió que la ruta de Curiosity en Mars Trek **termina en Vera Rubin Ridge** y no llega al boxwork (2025). Por eso el sitio principal pasó a ser **Pahrump Hills → Hematite Hotspot** (hay ruta real para validar) y el boxwork quedó como segundo sitio.
- Se corrigió el largo del recorrido: **18,8 km manejados**, no "unos 8 km" (eso era la línea recta).
- Rutas **precalculadas** con tabla de sensibilidad, en vez de deslizadores en vivo (no pueden cambiar una ruta ya calculada).
- RAD se muestra como **foto con fecha**, no como "condiciones actuales" en vivo.
- Hitos con hora reloj, la validación adelantada a las 11:00 del domingo y la demo después del congelamiento de código.

---

## Sábado 14/11 — Descarga de datos: desvíos del plan

| Qué decía el plan | Qué pasó | Decisión |
|---|---|---|
| Terreno de detalle a 1–2 m/px | A 1 m el servidor de Mars Trek corta a los 60 s, incluso con pedidos de 512 × 512 px | **Detalle a 2 m.** No se pierde nada: la pendiente igual se calcula sobre 3–5 m por el ruido de HiRISE |
| Coordenadas del boxwork: buscarlas en 2 h | Se encontró el **mapa oficial de la misión (JPL)** con las 1389 paradas de Curiosity, con sol y coordenadas | Boxwork ubicado en lon 137.379–137.390, lat -4.809 a -4.793, dentro del terreno. **Tarea resuelta** |
| El boxwork se iba a mostrar sin validar | El recorrido de JPL cubre los soles del boxwork | El boxwork **también se puede validar** (opcional) |
| Una capa espectral (CRISM) | La capa de minerales hidratados tiene **0 detecciones en Gale** | Descartada. La capa científica es la térmica (THEMIS) |
| Inercia térmica TES como capa | El servicio solo llega a ~83 km por píxel | Descartada |
| Radiación completa desde el aterrizaje | CDAWeb no tiene datos de **sep 2012 a feb 2013** (verificado con y sin filtro de calidad) | Se documenta; no afecta el uso (tasa típica de dosis) |
| Bajar la radiación por año | CDAWeb rechaza pedidos de un año (error 503) | Pedidos mensuales, partidos a la mitad si el servidor los rechaza |
| Fotos de punto de vista | La primera selección automática trajo tomas del brazo robótico y fotos con viñeteo | Filtro por elevación de la cámara (-25° a +10°, mirando al horizonte) y Navcam primero. Quedaron 56 fotos; **sin fotos válidas** para Bradbury, Rocknest y Glenelg (fuera del sitio principal) |
| "Todo se baja y va al repo" | Fotos + radiación + clima suman ~145 MB | **No van a Git.** Se regeneran con `data/generacion/generar_todo.py`. Al repo van terreno, imágenes, capas y rutas (~65 MB) |
| Clima REMS: ~60 MB por sol | Ese es el peso con todos los productos; solo hace falta el ambiental (MODRDR) | Se baja solo el MODRDR: ~12 MB por sol, 8 soles |

---

## Sábado 14/11 17:45 — Auditoría de datos, superprompt y plan final

**Quién:** integrador + Claude
**Qué pasó:** se evaluó un superprompt generado por GPT para dirigir el desarrollo y se auditaron los datos reales. El superprompt se adopta como lista de control de calidad, no como proceso: sus 9 fases, 8 agentes y documentos de metodología no entran en el plazo. `PLAN.md` se reescribió como plan final y se creó `CHECKLIST.md`.

| Qué decía el plan | Qué pasó | Decisión |
|---|---|---|
| Heightmap en PNG uint16 | El navegador decodifica los PNG a 8 bits | Binario crudo uint16 little-endian, con offset y escala por archivo |
| Dosis de la EVA como métrica de cada ruta | Con ~0,2 mGy/día, 30 min de diferencia son ~4 µGy: no discrimina rutas | La radiación sale de la comparación de rutas y pasa a un panel de contexto |
| Convertir a mSv con un factor de calidad | Presentaría una medición del rover como dosis humana | No se convierte. Tres niveles: medido, presupuesto ilustrativo, exposición no modelada |
| Blindaje por cielo visible como diferencial | Contradice que la radiación no influya en las rutas | Se elimina |
| "Condiciones actuales" de RAD | — | Tasa de referencia con fecha; el evento del 20/05/2024 como escenario histórico |
| Clima REMS opcional, con viento | Viento ≈0 % válido en los 8 soles | REMS entra como contexto histórico, sin viento |
| Capa de geología | La imagen tiene 3 colores en toda la zona | Fuera de la interfaz |
| Ruta "segura" | Ningún dato respalda transitabilidad humana | *Lower terrain difficulty*; restricción de pendiente común a las tres estrategias |
| Pendiente sobre base de 3–5 m | La grilla de ruteo es de 4 m | Pendiente a 2 m y agregación por máximo, para no ocultar obstáculos |
| Roles 1–5 programan | — | Claude implementa de punta a punta; los roles revisan |
| Un hueco en RAD (2012–2013) | Hay un segundo hueco: 19/09 → 18/10/2018 | Se documentan los dos. Además, relleno `-1e31` en ~4,3 % de las filas |
| Escenario sin definir | — | Pahrump Hills → Hematite Hotspot, solo ida, 2 astronautas, recogida con rover |

**Impacto:** los roles 2 y 3 ya no calculan, revisan. El rol 5 tiene que entregar la selección de fotos antes del bloque 3.

---

## Pendientes de verificar
- Si Hematite Hotspot fue detectado desde órbita por CRISM (serviría para validar).
- Una referencia de velocidad de caminata de Apollo, para justificar la velocidad base del modelo.
- Formato de la presentación global (¿archivo, link o ambos?): preguntarle al tutor.

---

## Formato para nuevas entradas

```
## <Día dd/mm hh:mm> — <tema corto>
**Quién:** <nombre o rol>
**Qué decía el plan:** ...
**Qué pasó:** ...
**Decisión:** ...
**Impacto:** <qué cambia para otros roles, si algo>
```

---

## Domingo 15/11 00:20 — Branch `plan2d`: del visor 3D al radar 2D

**Quién:** Agus (idea) + Claude (ajustes, pipeline y documentación)
**Qué decía el plan:** visor 3D en three.js para planificar desde una consola en el hábitat, comparando 3 rutas ("Marswalk — Decision Support"). Ese plan sigue vigente en `develop`.
**Qué pasó:** se propuso una interfaz más simple y útil para el momento de la caminata: un **radar táctico en tablet**, centrado en el astronauta, que responde 3 preguntas (por dónde camino, cuánto tiempo me queda, adónde voy a investigar). Se revisó la idea contra los datos y las reglas del plan, y se ajustó antes de implementarla.

| Idea original | Qué pasó | Decisión |
|---|---|---|
| Interfaz "en tiempo real" | No hay datos en vivo: todo es histórico | **EVA simulada**: la posición avanza sobre la ruta modelada con un reloj; rótulo *Simulated EVA* |
| Píxeles oscuros de HiRISE = arena blanda (rojo) | Probado: en las paradas *Bagnold Dunes* el brillo da percentil 48 y 96 (no oscuro); solo *Bagnold Dunes South* es oscura (p19) | **Descartado.** El rojo es solo pendiente > 20° |
| Línea verde = "ruta segura validada por Curiosity" | Que pase un rover no prueba que pueda pasar un humano; el plan prohíbe "safe". Curiosity hizo 9,3 km entre puntos separados por 3,7 km en línea recta | Verde = **ruta modelada**; Curiosity = línea punteada de referencia |
| Anillo ámbar por batería, temperatura y radiación | No hay datos de batería ni de su relación con la temperatura; la dosis de unas horas (~46 µGy en 6 h) no limita la distancia | **Isócrona de retorno**: minutos para caminar desde cada celda hasta el rover (mismo motor de rutas). El anillo = tiempo restante de EVA |
| Salir a la tarde para "ahorrar batería" | Sin modelo de traje | Curva REMS histórica con la ventana de la EVA marcada, sin promesas de batería |
| Alerta de retorno inmediato por RAD | No hay monitoreo en vivo; el umbral sería inventado | Escenario histórico 20/05/2024 (*Replay*) con alerta **ilustrativa** a 3 × la referencia (supuesto declarado) |
| Comparar 3 rutas (plan 3D) | Complica la pantalla de campo | Una ruta por las paradas; alternativas solo si sobra tiempo |

**Implementado en esta branch (Claude, 15/11 00:00):** pipeline `src/marswalk/` (coordenadas, pendiente, grafo de rutas, isócrona, RAD, REMS con flags de confianza, fotos), paquete `data/processed/gale_radar/` (13 MB), 9 tests en verde y three.js r187 en `web/vendor/`.
**Escenario por defecto:** Pahrump Hills → 6 paradas → Hematite Hotspot; 5,34 km; EVA de 282/360 min; pendiente máxima 19,1°.
**No se usan en el radar:** THEMIS (81 m/px), geología SIM 3292, CTX y los recortes `route_full`, `boxwork` y `context`.
**Pendiente:** la interfaz three.js la genera Fable a partir de `web/README.md` y `PLAN.md` §6.
**Detalle técnico:** la grilla de ruteo de 4 m conserva el bbox del DEM con borde replicado, así que sus celdas miden 3,98 × 4,00 m. El error de posición es menor a 2 m en el borde S/E.
**Impacto:** roles 2 y 3 revisan los supuestos del YAML y los paneles; rol 5 elige fotos; rol 6 escribe `science_notes` en el YAML.

---

## Domingo 15/11 00:25 — Visor del radar (bloques A y B) y tres ítems adelantados del bloque C

**Quién:** Agus (pedido) + Fable (interfaz)
**Qué decía el plan:** el anillo ámbar de retorno es una capa del radar (§6); la vista *Overview*, el panel ⓘ y las flechas de borde son del bloque C.
**Qué pasó:**
- **El anillo ámbar nunca entra en el radar con el escenario actual.** El tiempo de retorno más alto de toda el área es de 160 min, así que mientras queden más de 160 min de EVA (hasta t ≈ 200 min) no hay ninguna celda fuera del rango de retorno y el anillo no existe. Después aparece, pero siempre a más de 2 km del astronauta (2,44 km en t = 262; 2,02 km al final), porque el margen mínimo es de 77 min. El alcance máximo del radar es 1 km.
- `return_time_4m.png` guarda minutos pares (2 × valor). El contorno se dibuja en un nivel impar para que caiga entre dos valores de celda; por eso el anillo avanza en saltos de 2 min de simulación (unos 80 m).
- La advertencia de `site.json` "All environmental data are historical observations, not live or forecast values." contiene la palabra "live", que §7 prohíbe. El visor la muestra tal cual en el panel ⓘ porque `data/processed/` no se edita a mano.

**Decisión:**
- El anillo se implementó como dice `web/README.md` (shader sobre `return_time`, con un velo ámbar tenue fuera del rango). Se agregó en el radar el recuadro *Return limit*, que dice si el anillo todavía no existe o a qué distancia está.
- Se adelantaron del bloque C la vista *Overview* (única vista donde se ve el anillo), el panel ⓘ (§7 pide que el supuesto de velocidad se diga en la interfaz) y las flechas de borde (a 250 m casi todas las paradas quedan fuera del alcance).
- Etiquetas de parada en el radar: distancia en **línea recta**, que coincide con los anillos de distancia. La distancia **por la ruta** va en la tarjeta *Next stop*.
- *Replay 2024-05-20*: el pico horario del evento se ubica 2 h después del inicio de la EVA (supuesto del replay, dicho en el tooltip). Entre horas se interpola linealmente.
- Parámetros de URL para la demo y las pruebas: `t`, `play`, `speed`, `range`, `view`, `replay`, `sol`, `panel=info` (documentados en `web/README.md`).

**Impacto:**
- Roles 2 y 3: decidir si el anillo tiene que verse en el radar. Opciones: bajar el presupuesto de EVA en el YAML (con 6 h sobran 77 min), agregar un alcance mayor, o dejarlo como capa de *Overview*.
- Quien mantiene el pipeline: cambiar el texto de esa advertencia en el origen y reconstruir el paquete, o aceptar la negación "not live".
- No se corrió `python -m pytest -q` en esta sesión: el Python de esta máquina no tiene `pytest` instalado y no se tocó código Python.

---

## Domingo 15/11 01:20 — Tercera vista: mapa 3D inmersivo (*3D walk*)

**Quién:** Nazareno (pedido) + Fable (interfaz)
**Qué decía el plan:** §8 deja el 3D fuera del alcance de esta branch ("No entra: … 3D"); el visor tiene dos vistas, *Radar* y *Overview*.
**Qué pasó:** se pidió sumar, además del radar y del *Overview*, un mapa 3D con estética de visor futurista (referencia: el HUD de Subnautica), donde las métricas aparecen a medida que se camina y se priorizan las de más valor (radiación, temperatura).
**Decisión:**
- Se agrega una **tercera vista `3D`** al mismo visor. No se mezcla con `develop`: es código nuevo (`web/view3d.js`) que lee el mismo paquete `gale_radar`, sin datos ni librerías nuevas (three.js de `web/vendor/`).
- El relieve 3D sale de `terrain/elevation_4m.u16` (4 m, **escala vertical 1:1**), con `hirise` y `hillshade` como textura. El color es un **tinte estilizado** del HiRISE en grises, no color medido, y la luz no sigue la hora del día: se dice en la leyenda.
- **Datos espaciales anclados al terreno** (pendiente > 20°, curvas de nivel cada 10 m, ruta, huella de Curiosity, paradas, límite de retorno). **Datos temporales en el HUD** (RAD y REMS): no se clavan en el terreno porque no son mediciones de ese punto, sino series históricas por hora.
- Valen las mismas reglas de §7: RAD con sus tres rótulos, REMS como *historical* con sol y fecha, *Simulated EVA*, sin "safe", "live" ni "real-time".
- En la vista 3D el panel de 3 tarjetas se reemplaza por el HUD y el radar pasa a ser un mini radar en la esquina. *Radar* y *Overview* no cambian.
- Se agrega la velocidad **×10** (a ×60 el astronauta avanza ~40 m por segundo de pantalla, demasiado para una cámara de seguimiento).

**Impacto:** `PLAN.md` §8 queda desactualizado en ese punto ("3D" ya no está fuera de alcance en `plan2d`); lo decide el equipo. La pasada visual del bloque C ahora incluye la vista 3D. Rol 3: revisar los rótulos de RAD y REMS del HUD.

**Implementado (Fable, 15/11 02:00):**
- `web/view3d.js` (módulo nuevo), más cambios chicos en `main.js`, `index.html` y `style.css`. El módulo recibe los datos ya cargados por el radar y solo pide dos archivos más del paquete.
- **Lo que aparece al caminar:** un registro de eventos calculado una sola vez a partir del paquete y mostrado según el reloj de la EVA (por eso funciona al mover la línea de tiempo), dos carteles anclados al terreno (la celda > 20° más cercana y el punto más cercano de la huella de Curiosity, con su sol) y la ficha de la parada, que se abre al llegar.
- **Rendimiento:** con el relieve completo a 4 m (1,9 millones de triángulos) la GPU integrada daba ~31 cuadros por segundo reproduciendo. Se agregaron niveles de detalle por distancia (cada 1, 2, 4 u 8 celdas, con faldones para tapar las juntas) y el HUD pasó a actualizarse ~10 veces por segundo. Quedó en 45–50.
- **El pico del *Replay* en el registro** es el de la serie horaria (8.025 µGy/día), no el `peak_value` de 10 minutos (8.378): es la misma serie que ya usaba el radar.
- **No se hizo:** vista en primera persona (a 4 m por celda el suelo cercano se ve borroso), exageración vertical, y hora del día en la iluminación (haría falta la posición del Sol; se prefirió decir que la luz es fija).
- `python -m pytest -q`: 9 pasan (no se tocó código Python).
