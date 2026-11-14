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
