# Plan de trabajo — FINAL (v3)

Equipo: 6 personas + Claude. NASA Space Apps 2026, challenge "Interplanetary Survival Guide: Martian Map". Sábado 14/11 → entrega cierra **domingo 15/11 a las 23:59** (hora del evento local). **Meta interna de envío: domingo 20:00.**
Contexto: `enunciado_oficial.md`, `Resumen_1_Entrega.md`, `Resumen_2_Proyecto.md`. Este documento reemplaza a `PLAN_borrador.md` y `PLAN_v2.md`. Fue revisado en dos rondas por un subagente Opus 5.5.

**Convención de horas:** el sábado se cuenta desde **H0 = la hora en que arrancan a trabajar** (completarla en la sección 9). El domingo va en hora reloj.

## 1. Producto
Un **generador de mapas para caminatas marcianas (Marswalk)**: dado un sitio, arma una vista 3D por capas, con ruta de astronauta y presupuesto de seguridad (radiación y clima). Se muestra con un sitio principal pulido y un segundo sitio generado solo cambiando un archivo de configuración.

## 2. Decisión de sitio: híbrido con corte duro
- **Sitio principal: Gale, tramo Pahrump Hills → Vera Rubin Ridge / Hematite Hotspot.** Hay DEM de 1 m, ruta real y waypoints con nombre. Permite validar la ruta contra lo que hizo Curiosity.
- **Segundo sitio: boxwork** (objetivo del enunciado, "la próxima EVA"), con la misma configuración y sin validación. **✅ Resuelto (14/11):** los waypoints oficiales de JPL ubican a Curiosity en el boxwork entre los soles 4500 y 4800 en **lon 137.379–137.390, lat -4.809 a -4.793** (elevación -3691 a -3605 m), **dentro del DEM**. Terreno, imagen HiRISE y fotos ya descargados (caja `boxwork`, ver `data/README.md`).

**Datos verificados hoy del recorrido (`curiosity_path`, Mars Trek):**
- Una sola línea de 19.188 puntos, de Bradbury Landing (137.4416 E, -4.5895) a Hematite Hotspot (137.3799 E, -4.7247).
- **Recorrido real: 18,8 km** (recta inicio–fin: 8,8 km). Caja de la ruta completa: 5,7 × 8,3 km.
- **Tramo Pahrump Hills → Hematite Hotspot: 9,6 km recorridos, en una caja de ~1,7 × 4 km** (lon 137.352–137.382, lat -4.730 a -4.662). Cabe holgadamente en un recorte de detalle.
- Los 14 waypoints tienen nombre pero no fecha ni sol.
- Los boxwork se vieron de cerca desde mayo de 2025 (sol 4536); la ruta de Trek no llega hasta ahí y no tenemos sus coordenadas.

## 3. Datos (todos NASA / gobierno de EE. UU.)
| Capa | Fuente | Estado |
|---|---|---|
| Terreno 3D | HiRISE DEM 1 m, `Gale_DEM_SMG_1m` (Mars Trek ImageServer) | **Probado.** `exportImage` → TIFF float32 en metros, en grilla geográfica (~1,0 m = 0,0000169°). Cobertura lon 137.12–137.73, lat -4.93 a -4.25. Máx. 15000×4100 px por pedido |
| Imagen | Mosaicos HiRISE/CTX de Gale (Mars Trek WMTS) | Existen. Hay que bajar los tiles al repo |
| Ruta y waypoints | `curiosity_path`, `curiosity_waypoints` | **Probado** |
| Radiación | CDAWeb `MSL_RAD_OBS-L2` | **Probado.** 2011-11 a hace 3 días, ~17 min, ~152 KB/mes. Dosis absorbida en µGy/día |
| Clima | PDS REMS (bundle PDS4) | Formato verificado. ~60 MB por sol, `-999` = sin dato. Sol 1–4843. Opcional: 4–8 soles representativos |
| Geología / térmico / espectral | Capas globales de Mars Trek | Existen, resolución gruesa. Se usan solo si aportan a esta escala (a verificar) |
| Fotos de punto de vista | Imágenes de Curiosity (MSL) | Pendiente elegir y bajar. **Son de Curiosity, no de Perseverance** |

Acceso: `curl` funciona para Mars Trek, CDAWeb y PDS Atmospheres. Chrome no hace falta.

## 4. Arquitectura
- **Pipeline Python (`build.py`)**: `site.yaml` (bbox, servicios, capas) → paquete estático por sitio, menor a 100 MB por archivo (límite de GitHub).
- **Contrato (`site.json`)**, fijado en la primera hora: nombre, bbox, CRS (grilla geográfica), tamaño de píxel en metros, rango de elevación **por archivo**, rutas de archivos y **unidades de cada campo**. Se acompaña de un paquete de prueba mínimo.
- **Terreno:** recorte de **detalle de 1–2 m/px** para el tramo Pahrump→Hematite (~1,7×4 km más margen) y **contexto a 20–30 m/px** de toda la zona. Si se quiere validar sobre los 18,8 km completos, el detalle sube a 2–5 m/px sobre una caja de 5,7×8,3 km. Heightmap en PNG uint16, **con offset y escala guardados por archivo** (el contexto incluye laderas y su rango es mucho mayor que el del detalle).
- **Pendiente:** calculada sobre una base de 3–5 m (a 1 m el ruido de HiRISE la infla). Rugosidad como indicador de bloques, sin llamarlo "rocas detectadas". Rellenar nodata y costuras del mosaico.
- **Visor: three.js**, estático, en GitHub Pages. Malla con desplazamiento (hasta ~1024² vértices), capas como texturas sobre la misma malla, ruta como línea con altura muestreada.
- **Rutas:** **3 rutas precalculadas** (rápida, segura, científica) con distancia, tiempo, pendiente máxima y dosis de la EVA. Los supuestos se muestran en una **tabla de sensibilidad precalculada**, no como deslizadores en vivo. **A* en el navegador es opcional**, solo si sobra tiempo (grilla de ~1000² es viable).
- **Radiación:**
  - **Base:** presupuesto de dosis de la EVA = tasa × duración.
  - **Diferencial (debe hacerse, con corte):** blindaje por fracción de cielo visible calculada desde el DEM. Es una aproximación (la atmósfera también atenúa) y se declara como supuesto. **Si no está lista el domingo a las 11:00, se muestra solo el presupuesto**, sin ese diferencial, y se dice.
  - **"Condiciones actuales":** se etiquetan como **foto con fecha** (datos hasta el día de la descarga). Un fetch en vivo a CDAWeb queda como mejora opcional con respaldo, solo si CORS lo permite (a verificar).
- **Todo se baja y va al repo**, el visor no depende de servicios externos.
- Interfaz, README y repo **en inglés**.

## 5. Validación y supuestos
**Métrica de validación (propuesta, a confirmar):** comparar cada ruta calculada con el recorrido real de Curiosity entre los mismos puntos de partida y llegada, con **(a) % de la ruta dentro de un corredor de 50 m** y **(b) desvío lateral medio**, y como secundaria **(c) el costo de la ruta real frente al de la ruta óptima**. Se muestra un gráfico simple.

**Supuestos a declarar (no son datos):** pendiente máxima caminable con traje, curva de esfuerzo según pendiente (las fórmulas conocidas son terrestres a 1 g), corrección por gravedad 0,38 g y por el traje, velocidad, radio de retorno y pesos del costo.

**Dosis:** RAD da dosis absorbida (µGy/día). Convertir a dosis equivalente (mSv) exige un factor de calidad de la literatura, del orden de 3 según Hassler et al. 2014 (**a verificar**). No comparar µGy con límites en mSv sin explicar la conversión.

**Otro dato a verificar:** que Hematite Hotspot fuera señalado desde órbita por CRISM, para validar una capa espectral (no verificado).

## 6. Alcance
**MVP (entra):** Gale (tramo Pahrump→Hematite) con detalle y contexto; textura HiRISE/CTX; pendiente y rugosidad; una capa térmica o espectral que aporte; 3 rutas precalculadas; presupuesto de dosis y panel RAD con serie y último valor (con fecha); fotos de Curiosity en las paradas; tabla de supuestos y de sensibilidad; gráfico de validación; **un** segundo sitio generado por YAML.
**No entra:** respaldo MOLA para rutas, más de un sitio secundario, HUD.
**Opcional:** blindaje por cielo visible (ver arriba), clima REMS (4–8 soles), A* en el navegador, fetch en vivo de RAD.

## 7. Roles e hitos
| # | Rol | Sábado (desde H0) | Domingo (hora reloj) |
|---|---|---|---|
| 1 | Terreno + `build.py` + contrato (integrador) | H0+1: esquema commiteado. H0+4: recortes de detalle y contexto en el repo | 11:00: segundo sitio generado por YAML |
| 2 | Ruta, costo y validación | H0+4: A* sobre el paquete de prueba. H0+8: rutas sobre Gale real | **11:00: gráfico de validación** |
| 3 | RAD + (REMS) + dosis + cielo visible | H0+6: JSON de RAD y conversión documentada | 11:00: cielo visible o se recorta |
| 4 | Visor 3D núcleo | H0+1: "hola mundo" en Pages, abierto en ventana privada. H0+4: terreno con paquete de prueba. H0+8: Gale real en Pages | 11:00: capas, ruta y paneles integrados |
| 5 | Visor: interfaz, tiles WMTS, fotos de Curiosity | H0+2: tiles WMTS de Gale bajados. H0+6: fotos elegidas con su sol y fecha | 11:00: interfaz completa en inglés |
| 6 | Entrega + narrativa científica | **H0+0: define el bbox de detalle** (Pahrump→Hematite) y las 3–5 paradas. Busca al tutor | 17:00: guion; 17:00–19:00: graba/arma la demo; **20:00: enviado** |

**Hitos globales (domingo):** **11:00** congelar funcionalidades con el flujo completo en Pages, incluida la validación. **14:00** segundo sitio listo y pulido. **17:00** congelar código y etiquetar `v1.0`. **17:00–19:00** grabar la demo. **20:00** enviar el formulario y la entrega local. Desde las 14:00, los roles 1 y 3 ayudan al 6. **Turnos de sueño:** definirlos, que no trabajen todos de corrido.

## 8. Cumplimiento (checklist)
- [ ] Todo en inglés (formulario, interfaz, README).
- [ ] Uso de Claude declarado en el campo SI, el README y los metadatos. Imágenes generadas con IA: marca de agua.
- [ ] Sin logos ni insignias de misión de NASA.
- [ ] Demo: máx. 7 slides o 30 s. Slides con nombre del equipo, integrantes y challenge.
- [ ] Links probados en ventana privada por alguien ajeno al equipo.
- [ ] Confirmar hoy que los 6 están en el mismo Local Event.
- [ ] `v1.0` al enviar; no tocar `main` después de las 23:59.
- [ ] No copiar código de los repos de otros equipos ("Confirm All Work is Original").
- [ ] Sin imagen, video o audio de menores de 18 años.
- [ ] Sin modelos de IA chinos (regla del evento local).
- [ ] Un responsable del Lock del formulario.
- [ ] Preguntar al tutor por el formato de la presentación global (¿archivo, link o ambos?) y confirmar cuándo es la presentación local.

## 9. Decisiones que tiene que tomar el equipo ahora (en orden de urgencia)
1. **Confirmar el híbrido** (sitio principal Pahrump→Hematite, boxwork como segundo sitio). Las coordenadas del boxwork ya están resueltas.
2. **Hora de arranque H0** y turnos de sueño.
3. **Escenario** (sin esto los roles 2 y 3 no pueden calcular nada): punto de partida y llegada, duración de la EVA, tripulación de 1 o 2, con rover de apoyo o sin él, y la fecha o estación y hora del día.
4. **Dispositivo del usuario** (hábitat, tablet o HUD): elegir uno.
5. **Métrica de validación** (la propuesta de la sección 5 o una alternativa).
6. **Quién consulta al tutor** el formato de la presentación global y **quién confirma** que los 6 están en el mismo Local Event.
7. **Frase diferencial** del proyecto frente a los planificadores de Jezero que ya existen.
