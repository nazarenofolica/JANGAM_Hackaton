# Plan de trabajo

Equipo: 6 personas + Claude. NASA Space Apps 2026, challenge "Interplanetary Survival Guide: Martian Map". Sábado 14/11 → entrega cierra **domingo 15/11 a las 23:59** (hora del evento local). **Meta interna de envío: domingo 20:00.**
Contexto: [`enunciado_oficial.md`](enunciado_oficial.md), [`Resumen_1_Entrega.md`](Resumen_1_Entrega.md), [`Resumen_2_Proyecto.md`](Resumen_2_Proyecto.md).
**Este es el plan vigente.** Cómo se llegó hasta acá y todo cambio respecto del plan se anota en [`BITACORA.md`](BITACORA.md).

**Convención de horas:** el sábado se cuenta desde **H0 = la hora en que arrancan a trabajar** (completarla en la sección 9). El domingo va en hora reloj.

## 1. Producto
Un **generador de mapas para caminatas marcianas (Marswalk)**: dado un sitio, arma una vista 3D por capas, con ruta de astronauta y presupuesto de seguridad (radiación y clima). Se muestra con un sitio principal pulido y un segundo sitio generado solo cambiando un archivo de configuración.

## 2. Sitios
- **Sitio principal: Gale, tramo Pahrump Hills → Vera Rubin Ridge / Hematite Hotspot.** Hay terreno (DEM HiRISE, usado a 2 m), ruta real y waypoints con nombre. Permite validar la ruta contra lo que hizo Curiosity.
  - Caja del tramo: lon 137.352–137.382, lat -4.730 a -4.662 (~1,7 × 4 km). **Curiosity recorrió 9,6 km ahí.**
  - Recorrido completo Bradbury Landing → Hematite Hotspot: 18,8 km manejados (8,8 km en línea recta), caja de 5,7 × 8,3 km.
- **Segundo sitio: boxwork** (el ejemplo del enunciado, "la próxima EVA"), generado con la misma configuración. Curiosity estuvo ahí entre los soles 4500 y 4800 (2025): **lon 137.379–137.390, lat -4.809 a -4.793**, elevación -3691 a -3605 m, **dentro del DEM**.
  - Como el recorrido oficial de JPL cubre esos soles, **el boxwork también se puede validar contra la ruta real** (opcional, si sobra tiempo).

Las cajas exactas de recorte están en `configs/sites/gale.yaml` y el detalle de cada archivo en `data/README.md`.

## 3. Datos (todos NASA / gobierno de EE. UU.) — ✅ descargados el 14/11
Catálogo completo en `data/README.md`; fuente, tamaño y checksum de cada archivo en `data/raw/MANIFEST.json`.

| Capa | Fuente | Qué hay |
|---|---|---|
| Terreno 3D | HiRISE DEM `Gale_DEM_SMG_1m` (Mars Trek) | 4 recortes en metros, sin huecos: detalle 2 m, ruta completa 3 m, boxwork 2 m, contexto 25 m |
| Imagen | Mosaico HiRISE (gris) + CTX (Mars Trek) | HiRISE alineado píxel a píxel con cada recorte de terreno; CTX ~10 m en el contexto |
| Térmico | THEMIS IR día y noche (Mars Trek) | ~81 m/px en el contexto. Son imágenes de visualización, no valores calibrados |
| Geología | USGS SIM 3292 (Mars Trek) | Escala 1:20M: muy gruesa, solo 1–2 unidades en la zona |
| Ruta y waypoints | Mars Trek + **mapa oficial de JPL** | JPL cubre toda la misión (hasta el sol 5073), con sol, lat/lon y elevación de 1389 paradas |
| Radiación | CDAWeb `MSL_RAD_OBS-L2` | 2012–2026, ~31.000 mediciones/año, dosis absorbida en µGy/día. **Hueco: sep 2012 – feb 2013** |
| Clima | PDS REMS (MODRDR) | 8 soles repartidos en un año marciano. Tablas a 1 Hz sin encabezado, `-999` = sin dato |
| Fotos de punto de vista | Navcam de Curiosity | 56 fotos mirando al horizonte: 11 waypoints + 3 paradas de boxwork. Hay que elegir las mejores |

**Descartadas:** minerales hidratados CRISM/OMEGA (0 detecciones en Gale) e inercia térmica TES (~83 km/px).
**No van a Git** (pesados): fotos, radiación y clima. Se generan con `python data/generacion/generar_todo.py`.

## 4. Arquitectura
- **Pipeline Python (`build.py`)**: `site.yaml` (bbox, servicios, capas) → paquete estático por sitio, menor a 100 MB por archivo (límite de GitHub).
- **Contrato (`site.json`)**, fijado en la primera hora: nombre, bbox, CRS (grilla geográfica), tamaño de píxel en metros, rango de elevación **por archivo**, rutas de archivos y **unidades de cada campo**. Se acompaña de un paquete de prueba mínimo.
- **Terreno:** recorte de **detalle a 2 m/px** para el tramo Pahrump→Hematite, **ruta completa a 3 m/px** (para validar sobre los 18,8 km) y **contexto a 25 m/px** de toda la zona. Heightmap en PNG uint16, **con offset y escala guardados por archivo** (el contexto va de -4639 a +359 m; el detalle, de -4485 a -4029 m).
- **Pendiente:** calculada sobre una base de 3–5 m (a 1 m el ruido de HiRISE la infla). Rugosidad como indicador de bloques, sin llamarlo "rocas detectadas". Rellenar nodata y costuras del mosaico.
- **Visor: three.js**, estático, en GitHub Pages. Malla con desplazamiento (hasta ~1024² vértices), capas como texturas sobre la misma malla, ruta como línea con altura muestreada.
- **Rutas:** **3 rutas precalculadas** (rápida, segura, científica) con distancia, tiempo, pendiente máxima y dosis de la EVA. Los supuestos se muestran en una **tabla de sensibilidad precalculada**, no como deslizadores en vivo. **A* en el navegador es opcional**, solo si sobra tiempo (grilla de ~1000² es viable).
- **Radiación:**
  - **Base:** presupuesto de dosis de la EVA = tasa × duración.
  - **Diferencial (debe hacerse, con corte):** blindaje por fracción de cielo visible calculada desde el DEM. Es una aproximación (la atmósfera también atenúa) y se declara como supuesto. **Si no está lista el domingo a las 11:00, se muestra solo el presupuesto**, sin ese diferencial, y se dice.
  - **"Condiciones actuales":** se etiquetan como **foto con fecha** (datos hasta el día de la descarga). Un fetch en vivo a CDAWeb queda como mejora opcional con respaldo, solo si CORS lo permite (a verificar).
- **El visor solo lee los paquetes de `data/processed/`**, que sí van al repo: no depende de servicios externos mientras evalúan los jueces.
- Interfaz, README y repo **en inglés**.

## 5. Validación y supuestos
**Métrica de validación (propuesta, a confirmar):** comparar cada ruta calculada con el recorrido real de Curiosity entre los mismos puntos de partida y llegada, con **(a) % de la ruta dentro de un corredor de 50 m** y **(b) desvío lateral medio**, y como secundaria **(c) el costo de la ruta real frente al de la ruta óptima**. Se muestra un gráfico simple.

**Supuestos a declarar (no son datos):** pendiente máxima caminable con traje, curva de esfuerzo según pendiente (las fórmulas conocidas son terrestres a 1 g), corrección por gravedad 0,38 g y por el traje, velocidad, radio de retorno y pesos del costo.

**Dosis:** RAD da dosis absorbida (µGy/día). Convertir a dosis equivalente (mSv) exige un factor de calidad de la literatura, del orden de 3 según Hassler et al. 2014 (**a verificar**). No comparar µGy con límites en mSv sin explicar la conversión.

**Otro dato a verificar:** que Hematite Hotspot fuera señalado desde órbita por CRISM, para validar una capa espectral (no verificado).

## 6. Alcance
**MVP (entra):** Gale (tramo Pahrump→Hematite) con detalle y contexto; textura HiRISE/CTX; pendiente y rugosidad; capa térmica THEMIS (la espectral se descartó por falta de datos en Gale); 3 rutas precalculadas; presupuesto de dosis y panel RAD con serie y último valor (con fecha); fotos de Curiosity en las paradas; tabla de supuestos y de sensibilidad; gráfico de validación; **un** segundo sitio generado por YAML.
**No entra:** respaldo MOLA para rutas, más de un sitio secundario, HUD.
**Opcional:** blindaje por cielo visible (ver arriba), clima REMS (4–8 soles), A* en el navegador, fetch en vivo de RAD.

## 7. Roles e hitos
| # | Rol | Sábado (desde H0) | Domingo (hora reloj) |
|---|---|---|---|
| 1 | Terreno + `build.py` + contrato (integrador) | H0+1: esquema commiteado. ~~H0+4: recortes en el repo~~ ✅ ya están. H0+4: heightmaps uint16 y pendiente en `data/processed/` | 11:00: segundo sitio generado por YAML |
| 2 | Ruta, costo y validación | H0+4: A* sobre el paquete de prueba. H0+8: rutas sobre Gale real | **11:00: gráfico de validación** |
| 3 | RAD + (REMS) + dosis + cielo visible | H0+6: JSON de RAD y conversión documentada | 11:00: cielo visible o se recorta |
| 4 | Visor 3D núcleo | H0+1: "hola mundo" en Pages, abierto en ventana privada. H0+4: terreno con paquete de prueba. H0+8: Gale real en Pages | 11:00: capas, ruta y paneles integrados |
| 5 | Visor: interfaz, paneles, fotos de Curiosity | ~~Bajar tiles y fotos~~ ✅ ya están. H0+3: elegir 1–2 fotos por parada (descartar las que muestran el rover). H0+6: paneles de radiación y supuestos | 11:00: interfaz completa en inglés |
| 6 | Entrega + narrativa científica | ~~Definir el bbox de detalle~~ ✅ ya está. **H0+1: elegir las 3–5 paradas** entre los waypoints. Busca al tutor | 17:00: guion; 17:00–19:00: graba/arma la demo; **20:00: enviado** |

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
1. **Confirmar los sitios** (principal Pahrump→Hematite, boxwork como segundo). Datos de ambos ya descargados.
2. **Hora de arranque H0** y turnos de sueño.
3. **Escenario** (sin esto los roles 2 y 3 no pueden calcular nada): punto de partida y llegada, duración de la EVA, tripulación de 1 o 2, con rover de apoyo o sin él, y la fecha o estación y hora del día.
4. **Dispositivo del usuario** (hábitat, tablet o HUD): elegir uno.
5. **Métrica de validación** (la propuesta de la sección 5 o una alternativa).
6. **Quién consulta al tutor** el formato de la presentación global y **quién confirma** que los 6 están en el mismo Local Event.
7. **Frase diferencial** del proyecto frente a los planificadores de Jezero que ya existen.
