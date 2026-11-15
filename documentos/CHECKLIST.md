# Checklist de avance — Marswalk Radar (plan 2D, branch `plan2d`)

**Para toda sesión de Claude o Fable:** leer este archivo y [`PLAN.md`](PLAN.md) antes de tocar nada. Trabajar el primer ítem sin tildar del primer bloque incompleto. Al terminar un ítem, tildarlo y anotar al lado la fecha, la hora y cómo se verificó. No tildar nada sin verificar. Todo desvío del plan va a [`BITACORA.md`](BITACORA.md). **No hacer commit ni push sin autorización explícita.**

**Última actualización:** dom 15/11 00:20 — bloque 0 completo; bloque A sin empezar (la interfaz la genera Fable).

## Hecho (bloque 0)
- [x] Datos descargados, catalogados y auditados (14/11). Detalle en `data/README.md` y `MANIFEST.json`.
- [x] Plan 2D, checklist y bitácora (15/11 00:20).
- [x] `configs/packages/gale_radar.yaml` con escenario y supuestos (15/11 00:00).
- [x] Pipeline `src/marswalk/` (`geo`, `terrain`, `route`, `stops`, `environment`, `package`, `build`) (15/11 00:00). Verificado: el build corre en ~15 s y el validador da 0 problemas.
- [x] Paquete `data/processed/gale_radar/` generado (15/11 00:00). Verificado:
  - `validate()` sin errores.
  - Ruta de 5,34 km que no pisa celdas > 20° (`path_check.ok = true`).
  - EVA de 282/360 min y 57 % dentro de 50 m de Curiosity.
  - `preview.png` revisada a ojo: ruta, rojo, huella y paradas alineados.
- [x] Isócrona de retorno (`return_time_4m.png`) (15/11 00:00). Verificado: el margen mínimo sobre la ruta es de 77 min, positivo en todo el recorrido.
- [x] Resúmenes RAD y REMS con flags de confianza (15/11 00:00). Verificado: referencia de 185,6 µGy/día; pico del 20/05/2024 de 8.378 µGy/día; 8 soles con ciclos horarios.
- [x] 36 fotos reducidas (4 por parada, 9 paradas) con crédito (15/11 00:00).
- [x] Tests: `python -m pytest -q` → 9 pasan (coordenadas, rodea una pared, no corta esquinas, informa "sin camino", paquete válido) (15/11 00:00).
- [x] three.js r187 copiado en `web/vendor/` con addons (controles, CSS2D, líneas gruesas) (15/11 00:00).
- [x] `requirements.txt` con scipy, pandas y pytest (15/11 00:00).

## Bloque A — Radar mínimo
Condición de salida: se ve el radar con datos reales y la posición avanza.
- [ ] `web/index.html` + `web/main.js` (módulos ES, import map a `web/vendor/`), carga de `site.json` con mensaje de error legible.
- [ ] Plano del terreno con relieve teñido oscuro + capa roja (un solo shader).
- [ ] Ruta verde (líneas gruesas) y huella de Curiosity blanca punteada.
- [ ] Marcadores de las 9 paradas (cian, violeta, recogida) con etiqueta.
- [ ] Reloj de simulación: la posición avanza por `t_min`; rumbo hacia arriba; flecha de norte.
- [ ] Máscara circular, anillos de distancia con etiqueta, alcance 250 m / 500 m / 1 km.

## Bloque B — Las 3 preguntas
Condición de salida: las 3 preguntas se responden en pantalla.
- [ ] Anillo ámbar de retorno (shader sobre `return_time`) que se achica con el tiempo.
- [ ] Tarjeta *Terrain*: pendiente actual, máxima en los próximos 200 m, elevación.
- [ ] Tarjeta *Window & safety*: tiempo transcurrido y restante, margen de retorno, mini gráfico REMS con la ventana de la EVA, indicador RAD.
- [ ] *Replay 2024-05-20*: la serie horaria sobre el reloj de la EVA y un banner de alerta ilustrativa.
- [ ] Tarjeta *Next stop*: distancia por la ruta, ETA, Δz, foto (se agranda con crédito), objetivo científico o "pending".
- [ ] Barra inferior: reproducir, pausar, velocidad y línea de tiempo con marcas de parada.

## Bloque C — Pulido · **congelar funcionalidades dom 11:00**
- [ ] Vista *Overview* (cenital, norte arriba, todo el recorrido).
- [ ] Panel ⓘ *Assumptions & sources*: supuestos, advertencias, fuentes y validación contra Curiosity.
- [ ] Paradas fuera de alcance como flechas en el borde del radar.
- [ ] Pasada visual y prueba a 1366×768, sin errores de consola y sin pedidos de red fuera del repo.
- [ ] `index.html` en la raíz que redirige a `web/`; GitHub Pages activo.

## Bloque D — Cierre · **congelar código dom 17:00**
- [ ] Revisión final de `PLAN.md` §10, pregunta por pregunta.
- [ ] Revisión de terminología de toda la interfaz (`PLAN.md` §7).
- [ ] README en inglés actualizado (cómo correr, metodología, supuestos, limitaciones, uso de IA).
- [ ] `python -m pytest -q` en verde.
- [ ] Etiqueta `v1.0` (con autorización).

## Tareas del equipo (no las hace la IA)
- [ ] Confirmar o cambiar los supuestos de `configs/packages/gale_radar.yaml` (velocidad, 20°, paradas, 6 h, salida 10:00) y reconstruir con `python scripts/build_package.py configs/packages/gale_radar.yaml`.
- [ ] Texto del objetivo científico por parada, con fuente, en `science_notes` de `configs/packages/gale_radar.yaml`. Después, reconstruir el paquete.
- [ ] Elegir 1–2 fotos por parada; descartar las que muestran el rover.
- [ ] Verificar la cita de la detección orbital de hematita en Vera Rubin Ridge (CRISM).
- [ ] Verificar una referencia de velocidad de caminata (Apollo) para justificar la velocidad base.
- [ ] Activar GitHub Pages y probar el link en una ventana privada.
- [ ] Guion, demo y formulario; lista de cumplimiento de `PLAN.md` §12.
