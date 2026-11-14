# Checklist de avance

**Para toda sesión de Claude:** leer este archivo antes de tocar nada. Trabajar el primer ítem sin tildar del primer bloque incompleto. Al terminar un ítem, tildarlo y anotar al lado la fecha, la hora y cómo se verificó. Si algo se aparta de [`PLAN.md`](PLAN.md), anotarlo en [`BITACORA.md`](BITACORA.md) antes de seguir. No tildar nada que no se haya verificado. **No hacer commit ni push sin autorización explícita.**

**Última actualización:** sáb 14/11 — bloque 0 escrito, bloque 1 sin empezar.

## Hecho
- [x] Datos descargados y catalogados (14/11) — `data/README.md`, `MANIFEST.json`
- [x] Auditoría de datos (14/11) — 104/104 checksums; DEM sin huecos; norte arriba confirmado contra 587 waypoints JPL; RAD y REMS inspeccionados. Resultados en `PLAN.md` §3
- [x] Decisiones de escenario, stack y alcance (14/11) — `PLAN.md` §11
- [x] Plan final, checklist y bitácora (14/11)

## Bloque 1 — Terreno y contrato
Condición de salida: terreno real visible, texturado y alineado en el navegador.
- [ ] `configs/packages/pahrump_hematite.yaml` con recorte, inicio, destino, paradas y supuestos
- [ ] `src/marswalk/geo.py` — transformación local, con tests de ida y vuelta y de esquinas del bbox
- [ ] Test de punto de control: el waypoint Pahrump Hills cae donde la elevación DEM coincide con la de JPL (tolerancia 20 m)
- [ ] `terrain.py` — heightmap `<u2` con offset y escala por archivo; test de cuantización ≤ escala/2
- [ ] `terrain.py` — pendiente a 2 m sobre DEM suavizado, rugosidad, σ documentado
- [ ] `terrain.py` — agregación 2×2 a 4 m: máximo para pendiente y rugosidad, media para elevación
- [ ] Test de continuidad de elevaciones en el solape detalle/contexto
- [ ] `layers.py` — HiRISE a la grilla del paquete; THEMIS remuestreado y rotulado como contexto
- [ ] `package.py` — `site.json` con `derivation`, orden de bytes y validador automático
- [ ] `build.py` genera `data/processed/gale_pahrump/`
- [ ] Chequeo visual: sombreado del DEM mezclado con el mosaico HiRISE, sin corrimiento
- [ ] `web/` mínimo: three.js en `web/vendor/`, malla desde el heightmap, textura HiRISE, cámara orbital
- [ ] `scipy` y `pytest` agregados a `requirements.txt`

## Bloque 2 — Rutas y contexto ambiental
Condición de salida: 3 rutas reproducibles que no violan la restricción, con KPIs en JSON.
- [ ] `route.py` — grafo dirigido de 8 vecinos, restricción dura común, costo asimétrico subida/bajada
- [ ] Tests en grilla sintética: rodea una pared, no corta esquinas, informa "sin camino"
- [ ] Tres rutas modeladas: *Fastest*, *Lower terrain difficulty*, *Science-priority*
- [ ] Verificación posterior: ninguna ruta pisa celdas bloqueadas; resultado en `validation.json`
- [ ] `metrics.py` — distancia, tiempo estimado, desnivel ±, pendiente máxima, bandas, perfil
- [ ] `validation.py` — corredor de 50 m, desvío lateral medio, costo del recorrido de Curiosity
- [ ] Tabla de sensibilidad: velocidad base × pendiente máxima
- [ ] Reproducibilidad: dos corridas dan las mismas rutas y KPIs
- [ ] `radiation.py` — filtro de `-1e31` con test; serie mensual; tasa de referencia con fecha; huecos
- [ ] `radiation.py` — presupuesto ilustrativo y escenario histórico 20/05/2024, con los tres rótulos de `PLAN.md` §5.4
- [ ] `weather.py` — ciclos diurnos por sol con flags de confianza; viento marcado como no disponible
- [ ] `photos.py` — fotos elegidas reducidas y copiadas al paquete

## Bloque 3 — Visor del recorrido principal
Condición de salida: flujo completo en local, sin errores de consola.
- [ ] Carga y validación de `site.json` con mensaje de error legible
- [ ] Rutas sobre la superficie y selector de ruta que actualiza los paneles
- [ ] Vista cenital ortográfica, norte, escala gráfica, etiqueta de exageración vertical
- [ ] Capas de pendiente y rugosidad con leyenda y unidad, apagadas por defecto
- [ ] Capa de referencia del recorrido de Curiosity
- [ ] Paradas seleccionables e itinerario con foto, sol, fecha y distancia acumulada
- [ ] Panel de decisión: 5–6 KPIs, bandas de pendiente, perfil de elevación
- [ ] Recomendación por reglas sobre las métricas
- [ ] Panel de contexto: RAD en tres niveles y REMS histórico
- [ ] Detalle al clic: elevación, pendiente, rugosidad, con fuente y resolución
- [ ] Revisión de terminología de toda la interfaz (`PLAN.md` §5.6)

## Bloque 4 — Segundo sitio y supuestos · **congelar funcionalidades dom 11:00**
- [ ] `configs/packages/boxwork.yaml` y paquete generado sin tocar código
- [ ] Si no hay camino bajo el umbral, el visor muestra esa condición
- [ ] Selector de sitio en el visor
- [ ] Panel *Assumptions & sources*: supuestos, sensibilidad, gráfico de validación, limitaciones
- [ ] `index.html` raíz que redirige a `web/`; visor funcionando en GitHub Pages

## Bloque 5 — Revisión y cierre · **congelar código dom 17:00**
- [ ] Las 13 preguntas de revisión final de `PLAN.md` §6, una por una
- [ ] Prueba a 1366×768: carga, cambio de ruta y de capa, cámara, sin pedidos de red fuera del repo
- [ ] Pasada de UX con el skill `impeccable`
- [ ] README en inglés: instalación, cómo regenerar el paquete, metodología, supuestos, limitaciones, uso de IA
- [ ] `pytest` completo en verde
- [ ] Etiqueta `v1.0` (con autorización)

## Tareas del equipo (no las hace Claude)
- [ ] Confirmar velocidad base, pendiente máxima, tiempo por parada y duración del escenario
- [ ] Elegir qué paradas visita *Science-priority*
- [ ] Elegir 1–2 fotos por parada
- [ ] Texto del objetivo científico por parada, con fuente
- [ ] Verificar la cita de la detección orbital de hematita en Vera Rubin Ridge (CRISM)
- [ ] Verificar una referencia de velocidad de caminata de Apollo para la velocidad base
- [ ] Activar GitHub Pages y probar el link en ventana privada
- [ ] Guion, demo y formulario; lista de cumplimiento de `PLAN.md` §10
