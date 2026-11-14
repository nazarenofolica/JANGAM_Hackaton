# Plan de trabajo

Equipo: 6 personas + Claude. NASA Space Apps 2026, challenge "Interplanetary Survival Guide: Martian Map". Entrega: cierra **domingo 15/11 a las 23:59**. **Meta interna de envío: domingo 20:00.**
**Este es el plan vigente.** El avance se lleva en [`CHECKLIST.md`](CHECKLIST.md); el porqué de cada cambio, en [`BITACORA.md`](BITACORA.md). Contexto: [`Consigna.md`](Consigna.md) (el challenge) y [`Entrega.md`](Entrega.md) (reglas de entrega).

## 1. Producto

**Marswalk — Decision Support.** Un entorno 3D que permite explorar, comparar y justificar recorridos de una caminata marciana, generado por sitio a partir de un archivo de configuración.

La historia que se presenta es esta cadena, y cada eslabón tiene que poder mostrarse:

1. **Datos científicos reales** — DEM, HiRISE, RAD, REMS, waypoints.
2. **Procesamiento geoespacial** — coordenadas, pendiente, rugosidad, calidad.
3. **Optimización de recorridos** — tiempo, dificultad del terreno, ciencia.
4. **Marswalk — Decision Support** — explorar, comparar y justificar.

El diferencial no es el mapa 3D: es que la interfaz explica por qué una ruta modelada difiere de otra y con qué supuestos.

## 2. Sitios y escenario

- **Sitio principal: Gale, Pahrump Hills → Hematite Hotspot.** Recorte de detalle lon 137.342–137.392, lat -4.740 a -4.652: **2,95 × 5,21 km a 2 m/px**. Curiosity recorrió 9,6 km ahí; 3,7 km en línea recta.
- **Segundo sitio: boxwork** (lon 137.369–137.400, lat -4.819 a -4.783). Diferencial "generador" y **caso de estrés**: 25,7 % del terreno supera los 20°. Si no existe camino bajo el umbral, el motor lo informa y la interfaz lo muestra. No compromete el recorrido principal.
- **Escenario por defecto (decidido 14/11, editable en YAML):** travesía **solo de ida**, **2 astronautas a pie**, recogida con rover presurizado en Hematite Hotspot. Nueve paradas con nombre disponibles dentro del recorte: Pahrump Hills, Marias Pass, Bagnold Dunes, Bagnold Dunes West End, Murray Buttes, Bagnold Dunes South, Vera Rubin Ridge, Top of Vera Rubin Ridge, Hematite Hotspot (~5,3 km uniéndolas en línea recta).
- **Usuario:** un astronauta que planifica desde una consola en el hábitat. No hay HUD ni multiusuario.

## 3. Datos — descargados y auditados el 14/11

Catálogo en `data/README.md`; fuente y checksum de cada archivo en `data/raw/MANIFEST.json`. **No se descargan datos nuevos.**

| Capa | Fuente | Estado tras la auditoría |
|---|---|---|
| Terreno | HiRISE DEM `Gale_DEM_SMG_1m` (Mars Trek) | 4 recortes float32, sin huecos, dimensiones = sidecars. Grilla equiangular: **px_x = 1,993 m, px_y = 2,000 m** |
| Imagen | Mosaico HiRISE + CTX | HiRISE con las mismas dimensiones en píxeles que cada DEM. Falta el chequeo visual de alineación |
| Térmico | THEMIS IR día y noche | 81 m/px: ~36 × 64 px sobre el detalle. **Solo contexto regional**, imagen renderizada, no calibrada |
| Geología | USGS SIM 3292 | 3 colores en toda la imagen. **Se saca de la interfaz**; queda citada como fuente consultada |
| Ruta y waypoints | Mars Trek + mapa oficial JPL | 1389 waypoints con sol y elevación; 587 dentro del detalle (soles 671–2929), 151 dentro del boxwork (soles 4384–4936) |
| Radiación | CDAWeb `MSL_RAD_OBS-L2` | 407.817 filas, 17/08/2012 → 10/11/2026. **Relleno `-1e31` en ~4,3 % de las filas.** Huecos: 18/08/2012 → 22/03/2013 y 19/09 → 18/10/2018 |
| Clima | PDS REMS (MODRDR) | 8 soles (1200–1760, dic 2015 → 2017). Aire, suelo, presión y humedad ≈100 % válidos; UV 60–94 %. **Viento ≈0 % válido: no se muestra** |
| Fotos | Navcam de Curiosity | 56 fotos 1024², 4 por parada × 14 paradas, error de asociación ≤ 12 m. El índice no guarda el azimut |

**Verificaciones hechas:** 104/104 archivos pasan SHA-256. Norte arriba confirmado: elevación DEM − elevación JPL en 587 waypoints = +4,0 m (σ 6,2 m); con filas invertidas, σ = 246 m. Ruta Trek = 18,77 km.
**Las capas de contexto tienen bbox ajustados a tiles, distintos del DEM de contexto:** se remuestrean a la grilla del paquete.
**Descartadas:** minerales hidratados CRISM/OMEGA (0 detecciones en Gale) e inercia térmica TES (~83 km/px).
**No van a Git:** fotos, radiación y clima crudos. Se regeneran con `python data/generacion/generar_todo.py`.

## 4. Arquitectura

```
data/raw + MANIFEST  →  src/marswalk (Python)  →  data/processed/<sitio>/  →  web/ (three.js)
```

**Configuración.** `configs/sites/gale.yaml` no se toca (lo usan los scripts de descarga). Un YAML por paquete en `configs/packages/` (`pahrump_hematite.yaml`, `boxwork.yaml`): recorte, inicio, destino, paradas y supuestos del escenario. El segundo sitio sale de cambiar ese archivo.

**Pipeline — `src/marswalk/`**, módulos chicos; `build.py` solo orquesta.

| Módulo | Qué hace |
|---|---|
| `geo.py` | lon/lat ↔ metros locales Este/Norte ↔ fila/columna. Esfera r = 3389,5 km, origen en la esquina SO del recorte. Única fuente de la transformación |
| `terrain.py` | Heightmap, pendiente, rugosidad y agregación a la grilla de ruteo |
| `layers.py` | Remuestrea HiRISE, THEMIS y CTX a la grilla del paquete |
| `route.py` | Grafo dirigido y camino mínimo |
| `metrics.py` | Distancia, tiempo estimado, desnivel ±, pendiente máxima, bandas de pendiente, perfil |
| `validation.py` | Comparación con Curiosity, sensibilidad, verificación de restricciones |
| `radiation.py` | Serie RAD, tasa de referencia, presupuesto ilustrativo, escenario histórico |
| `weather.py` | Ciclos diurnos REMS por sol |
| `photos.py` | Copia y reduce las fotos elegidas |
| `package.py` | Escribe y valida `site.json` |
| `build.py` | `python -m marswalk.build configs/packages/<x>.yaml` |

Se reutiliza de `scripts/common.py`: `ROOT`, `load_config`, `sha256`. Los sidecars `data/raw/gale/**/*.json` son la fuente de bbox y dimensiones.

**Paquete — `data/processed/<sitio>/`** (va a Git, menos de 100 MB por archivo):
`site.json` · `terrain/` · `textures/` · `routes/routes.geojson` · `science/stops.json` + `photos/` · `environment/radiation.json`, `rems.json` · `validation/validation.json`.

`site.json` declara: `schema_version`, bbox, CRS, origen y transformación local, dimensiones, tamaño de píxel en metros **por eje**, orientación de filas, **offset, escala, rango, tipo y orden de bytes de cada ráster**, unidades, fuentes con fecha, `derivation` (cómo se obtuvo cada derivado), supuestos y advertencias.

**Visor — `web/`**: three.js copiado a `web/vendor/`, módulos ES, sin paso de build. GitHub Pages sirve la raíz del repo y un `index.html` raíz redirige a `web/`. Local: `python -m http.server` desde la raíz. **Solo lee `data/processed/`**: ningún pedido a servicios externos. Interfaz, README y repo **en inglés**.

**Dependencias:** `scipy` y `pytest` se suman a `requirements.txt` (ya están instalados); three.js se copia una vez. Nada más.

## 5. Reglas científicas (obligatorias)

### 5.1 Terreno y resolución
- **Heightmap:** binario crudo **uint16 little-endian (`<u2`), por filas, fila 0 = norte**; `elevación_m = offset + escala × valor`, con offset y escala **por archivo**. No es PNG: el navegador decodifica los PNG a 8 bits.
- **Continuidad entre archivos:** las elevaciones se decodifican a metros antes de combinarse. Nunca se comparan ni se mezclan valores uint16 de archivos distintos. Tests: error de cuantización ≤ escala/2 y diferencia acotada en el solape detalle/contexto.
- **Pendiente:** en grados, a 2 m nativos, sobre el DEM suavizado con un σ documentado (base efectiva ~4–6 m, porque el ruido de HiRISE la infla).
- **Rugosidad:** desvío estándar local del residuo DEM − DEM suavizado. Es un indicador de terreno irregular, **nunca "rocas detectadas"**.
- **Agregación 2 m → 4 m (grilla de ruteo), en bloques 2×2:** **máximo** para la pendiente de restricción y la rugosidad, para no ocultar obstáculos locales; **media** para la elevación. Dimensiones impares: se replica el borde. Todo queda escrito en `site.json › derivation`.

### 5.2 Motor de rutas
- **Una sola restricción dura de pendiente, común a las tres estrategias** y definida en el YAML. Una celda es intransitable si su pendiente agregada supera el umbral.
- **Las estrategias difieren solo en el costo**, nunca en la restricción.
- **Grafo dirigido de 8 vecinos:** ascenso y descenso tienen costo distinto según la pendiente con signo del tramo. Distancias en metros reales por eje.
- **Sin corte de esquinas:** una diagonal solo se permite si las dos celdas ortogonales adyacentes son transitables.
- **Verificación posterior:** la polilínea final se remuestrea sobre el ráster de restricción y se comprueba que no pisa celdas bloqueadas. El resultado va a `validation.json`.
- **Sin camino:** si inicio y destino no se conectan bajo el umbral, el motor lo informa con el umbral usado. No falla y no relaja la restricción en silencio.
- **Tres rutas modeladas:**
  - *Fastest* — mínimo tiempo estimado.
  - *Lower terrain difficulty* — el costo penaliza pendiente y rugosidad.
  - *Science-priority* — pasa por las paradas elegidas y suma el tiempo de parada.
- Las rutas se calculan en Python y se sirven como geometría estática. No hay A* en el navegador.

### 5.3 Velocidad
- La relación velocidad–pendiente (curva de tipo senderismo terrestre a 1 g, escalada a una velocidad base) es un **supuesto exploratorio, no un modelo validado para astronautas con traje en Marte**. Se dice así en la interfaz y en el README.
- **Sensibilidad obligatoria** sobre velocidad base y pendiente máxima, precalculada y mostrada en tabla.
- Valores iniciales propuestos, a confirmar por el equipo: velocidad base 2,5 km/h (se barre 1,5 / 2,5 / 3,5), pendiente máxima 20° (se barre 15 / 20 / 25), 20 min por parada.

### 5.4 Radiación (RAD)
Tres niveles, separados en los datos y en la interfaz:

| Nivel | Qué es | Cómo se rotula |
|---|---|---|
| Medido | Tasa de dosis absorbida de Curiosity RAD, µGy/día, detector E (plástico tejido-equivalente). Referencia: mediana de los últimos 30 días con dato, 185,5 µGy/día al 10/11/2026 | *Measured by Curiosity RAD*, con fecha y ventana |
| Presupuesto ilustrativo | Tasa de referencia × duración fija del escenario | *Illustrative EVA budget* — no es una dosis humana estimada: sin traje, sin autoblindaje del cuerpo, sin factor de calidad |
| Exposición real | No se calcula | *Actual astronaut exposure: not modelled* |

- **No se convierte a mSv.**
- **20/05/2024:** escenario **histórico**. Se muestra la dosis que RAD midió en la ventana de mayor dosis de ese evento, de igual duración que el escenario. No es una predicción.
- **La radiación no entra en el costo ni en la comparación de rutas.** Vive en un panel de contexto aparte y se calcula con la duración del escenario, no por ruta.
- Se muestran el rango del ciclo solar (medianas anuales 156–312 µGy/día) y los dos huecos de datos.
- No hay mapa de radiación por píxel ni blindaje por cielo visible.

### 5.5 Clima (REMS)
- Se rotula **"Historical REMS observations at Gale Crater"**, con soles y fechas. Nunca "current weather" ni pronóstico.
- Ciclos diurnos por sol de temperatura de aire, de suelo, presión y UV, aplicando los flags de confianza. No se interpola entre soles.
- Viento: "not available in these sols".

### 5.6 Terminología
Se usa *modelled route*, *estimated traverse time*, *terrain difficulty*. **No se usa** *safe route*, *safe*, *real-time*, *live*, *AI-powered*, ni se afirma transitabilidad garantizada. Curiosity es una referencia histórica, no una prueba de transitabilidad humana.

### 5.7 Interfaz
- Pantalla inicial: una ruta seleccionada y 5–6 KPIs (distancia, tiempo estimado, desnivel +/−, pendiente máxima, bandas de pendiente, paradas).
- Capas secundarias apagadas por defecto; cada capa con leyenda y unidad.
- Vista 3D orbital y vista cenital ortográfica. Exageración vertical 1× por defecto, con etiqueta visible. Norte y escala gráfica.
- **Recomendación en 2–3 frases construida por reglas sobre las métricas reales. Sin LLM.**
- Cada dato distingue medido / derivado / supuesto, con fuente y resolución al seleccionarlo.
- Sin oxígeno como KPI y sin semáforos con umbrales inventados.

## 6. Validación
- **Contra Curiosity**, entre los mismos puntos de inicio y destino: % de la ruta dentro de un corredor de 50 m, desvío lateral medio y costo modelado del recorrido real frente al de la ruta óptima. Se espera poca coincidencia de *Fastest* (Curiosity recorrió 9,6 km para 3,7 km en línea recta) y más de *Science-priority*; se explica, no se oculta.
- **Interna:** `pytest` sobre coordenadas, cuantización, motor de rutas, relleno de RAD y validador del paquete. Reproducibilidad: dos corridas dan las mismas rutas.
- **Revisión final (antes de congelar el código):** responder sí a las 13 preguntas, corrigiendo primero lo que sea error científico, geoespacial o de interpretación, después usabilidad y por último estética.
  1. ¿La elevación mostrada corresponde al DEM?
  2. ¿El norte está orientado correctamente?
  3. ¿Las rutas están en el mismo sistema de coordenadas que el terreno?
  4. ¿Las distancias se calculan en metros o km y no en grados?
  5. ¿La pendiente está en la unidad declarada (grados)?
  6. ¿La exageración vertical está informada en pantalla?
  7. ¿Las tasas de RAD tienen unidad, período y fuente, y el presupuesto está rotulado como ilustrativo (§5.4)?
  8. ¿REMS aparece como observación histórica (§5.5)?
  9. ¿Las fotos corresponden al waypoint indicado?
  10. ¿Ningún dato de baja resolución (THEMIS, geología) se presenta como detalle local?
  11. ¿Ninguna ruta se presenta como segura o con transitabilidad garantizada (§5.6)?
  12. ¿Se distinguen mediciones, derivados y supuestos?
  13. ¿El usuario entiende qué ruta está viendo y por qué se recomienda?

## 7. Alcance
**Entra:** paquete y visor completos de Pahrump Hills → Hematite Hotspot; textura HiRISE; capas de pendiente y rugosidad; 3 rutas modeladas; panel de decisión; itinerario con fotos; panel de contexto (RAD en tres niveles, REMS histórico); tabla de supuestos y de sensibilidad; gráfico de validación; boxwork generado por YAML.
**No entra:** blindaje por cielo visible, conversión a mSv, viento, geología en la interfaz, A* en el navegador, fetch en vivo de RAD, HUD, backend, más de un sitio secundario.
**Prioridad:** el recorrido principal completo y funcional va antes que el boxwork.

## 8. Bloques e hitos
Claude implementa los bloques en orden; el detalle y el estado están en [`CHECKLIST.md`](CHECKLIST.md). No hay fases de aprobación entre bloques: se construye, se valida y se documenta de forma incremental.

| Bloque | Entregable | Condición para seguir |
|---|---|---|
| 0 | Documentación: este plan, checklist, bitácora | — |
| 1 | `geo`, `terrain`, `layers`, `package` y sus tests; paquete real de Gale; visor mínimo | Terreno real visible, texturado y alineado |
| 2 | `route`, `metrics`, `validation`, `radiation`, `weather` | 3 rutas reproducibles que no violan la restricción |
| 3 | Visor completo del recorrido principal | Flujo completo en local |
| 4 | Boxwork por YAML; panel de supuestos y validación | **Dom 11:00 — congelar funcionalidades** |
| 5 | Revisión, pasada de UX a 1366×768, README en inglés | **Dom 17:00 — congelar código y etiquetar `v1.0`** |

**Domingo:** 17:00–19:00 grabar la demo. **20:00 enviar** el formulario y la entrega local.

## 9. Roles
Claude implementa pipeline y visor. Cada rol revisa y valida su área y hace lo que Claude no puede.

| # | Rol | Tarea |
|---|---|---|
| 1 | Terreno y contrato | Revisar `site.json` y el chequeo de alineación |
| 2 | Ruta y validación | Confirmar velocidad base, pendiente máxima y tiempo por parada; revisar el gráfico de validación |
| 3 | Radiación y clima | Revisar que el panel respete la sección 5.4 y 5.5 |
| 4 | Visor | Activar GitHub Pages y probar el link en ventana privada |
| 5 | Interfaz y fotos | Elegir 1–2 fotos por parada, descartando las que muestran el rover |
| 6 | Entrega y narrativa | Texto del objetivo científico por parada con fuente; guion, demo y formulario; consultas al tutor |

## 10. Cumplimiento
- [ ] Todo en inglés (formulario, interfaz, README).
- [ ] Uso de Claude declarado en el campo SI, el README y los metadatos. Imágenes generadas con IA: marca de agua.
- [ ] Sin logos ni insignias de misión de NASA.
- [ ] Demo: máx. 7 slides o 30 s. Slides con nombre del equipo, integrantes y challenge.
- [ ] Links probados en ventana privada por alguien ajeno al equipo.
- [ ] Confirmar que los 6 están en el mismo Local Event.
- [ ] `v1.0` al enviar; no tocar `main` después de las 23:59.
- [ ] No copiar código de los repos de otros equipos.
- [ ] Sin imagen, video o audio de menores de 18 años.
- [ ] Sin modelos de IA chinos (regla del evento local).
- [ ] Un responsable del Lock del formulario.
- [ ] Preguntar al tutor por el formato de la presentación global y cuándo es la presentación local.

## 11. Decisiones
**Tomadas el 14/11:** sitios; escenario por defecto; visor three.js sin build; Claude implementa de punta a punta; métrica de validación de la sección 6; consola de planificación en el hábitat.
**Abiertas:** confirmar velocidad base, pendiente máxima, tiempo por parada y duración del escenario; qué paradas visita *Science-priority*; turnos de sueño; quién consulta al tutor; quién maneja el Lock del formulario.
