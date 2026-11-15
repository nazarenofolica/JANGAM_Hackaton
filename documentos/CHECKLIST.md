# Checklist de avance — Marswalk Radar (plan 2D, branch `plan2d`)

**Para toda sesión de Claude o Fable:** leer este archivo y [`PLAN.md`](PLAN.md) antes de tocar nada. Trabajar el primer ítem sin tildar del primer bloque incompleto. Al terminar un ítem, tildarlo y anotar al lado la fecha, la hora y cómo se verificó. No tildar nada sin verificar. Todo desvío del plan va a [`BITACORA.md`](BITACORA.md). **No hacer commit ni push sin autorización explícita.**

**Última actualización:** dom 15/11 02:00 — bloques 0, A y B completos (interfaz generada con Fable); del bloque C quedan hechos *Overview*, panel ⓘ y flechas de borde. Se agregó el **bloque C3D** (tercera vista *3D*, pedida por el equipo; desvío anotado en BITACORA), completo. Sigue el resto del bloque C.

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
- [x] `web/index.html` + `web/main.js` + `web/style.css` (módulos ES, import map a `web/vendor/`), carga de `site.json` con mensaje de error legible (15/11 00:25). Verificado: Chrome headless a 1366×768 desde la raíz; sirviendo desde `web/` aparece la pantalla de error con el 404 y las instrucciones.
- [x] Plano del terreno con relieve teñido oscuro + capa roja (un solo shader) (15/11 00:25). Verificado por captura a 250 m, 500 m y 1 km.
- [x] Ruta verde (líneas gruesas, tramo recorrido más tenue) y huella de Curiosity blanca punteada, con casilla para apagarla (15/11 00:25). Verificado por captura.
- [x] Marcadores de las 9 paradas (cian, violeta, recogida en blanco, fuera de ruta en gris) con etiqueta de distancia en línea recta y Δz (15/11 00:25). Verificado por captura en radar y *Overview*.
- [x] Reloj de simulación: la posición avanza por `t_min`; rumbo hacia arriba; flecha de norte (15/11 00:25). Verificado en tiempo real por DevTools: ×60 avanza 3 min en 3 s, ×300 avanza 15 min en 3 s, la pausa congela el reloj y la N gira con el rumbo.
- [x] Máscara circular, anillos de distancia con etiqueta, alcance 250 m / 500 m / 1 km (15/11 00:25). Verificado por captura en los tres alcances.

## Bloque B — Las 3 preguntas
Condición de salida: las 3 preguntas se responden en pantalla.
- [x] Anillo ámbar de retorno (shader sobre `return_time`) que se achica con el tiempo (15/11 00:25). Verificado: en *Overview* el punto más cercano pasa de 2,44 km (t = 262) a 2,26 km (t = 270) y 2,02 km (t = 282). **Con el escenario actual nunca entra en el alcance del radar (≤ 1 km) y no existe antes de t ≈ 200 min; ver BITACORA.** El dibujo en el radar se probó con un nivel forzado.
- [x] Tarjeta *Terrain*: pendiente actual, máxima en los próximos 200 m, elevación (15/11 00:25). Verificado: en t = 0 muestra 4,5° y −4.462 m, igual que `route.json`.
- [x] Tarjeta *Window & safety*: tiempo transcurrido y restante, margen de retorno, mini gráfico REMS con la ventana de la EVA y selector de sol, indicador RAD con sus tres rótulos (15/11 00:25). Verificado: el margen al final coincide con `min_return_margin_min` (77,5 min) y el selector de sol cambia la curva.
- [x] *Replay 2024-05-20*: la serie horaria sobre el reloj de la EVA y un banner de alerta ilustrativa (15/11 00:25). Verificado: en t = 120 la tasa es 8.025 µGy/día y aparece el banner; sin replay, 185,6 y sin banner.
- [x] Tarjeta *Next stop*: distancia por la ruta, ETA, Δz, foto (se agranda con sol, fecha y crédito; recorre las 4), objetivo científico o "pending" (15/11 00:25). Verificado por DevTools: abre la foto de 768 px con crédito NASA/JPL-Caltech; durante la parada muestra *At stop* y los minutos para salir.
- [x] Barra inferior: reproducir, pausar, velocidad (×30, ×60, ×300) y línea de tiempo con marcas de parada (15/11 00:25). Verificado por DevTools: salto en la línea de tiempo y reinicio al reproducir desde el final.

## Bloque C — Pulido · **congelar funcionalidades dom 11:00**
- [x] Vista *Overview* (cenital, norte arriba, todo el recorrido) (15/11 00:25). Adelantada: es la única vista donde se ve el anillo ámbar. Verificado por captura.
- [x] Panel ⓘ *Assumptions & sources*: supuestos, advertencias, fuentes y validación contra Curiosity (15/11 00:25). Verificado por captura. Pendiente del equipo: una advertencia de `site.json` contiene la palabra "live" (ver BITACORA).
- [x] Paradas fuera de alcance como flechas en el borde del radar (15/11 00:25). Solo se rotula la próxima; las demás quedan como flecha. Verificado por captura.
- [ ] Pasada visual y prueba a 1366×768, sin errores de consola y sin pedidos de red fuera del repo. *(Parcial 15/11 00:25: en Chrome headless a 1366×768 hay 0 mensajes de consola y 23 pedidos, todos dentro del repo. Parcial 15/11 02:00: lo mismo con la vista 3D, hasta 29 pedidos (según las fotos que se abran), todos dentro del repo. Falta la pasada visual de una persona en una tablet o un navegador real, **incluida la vista 3D**: fluidez, arrastre y zoom táctil.)*
- [ ] `index.html` en la raíz que redirige a `web/`; GitHub Pages activo.

## Bloque C3D — Vista 3D inmersiva (pedido del equipo, fuera del plan original; ver BITACORA 15/11 01:20)
Condición de salida: se camina la ruta en 3D con un HUD que respeta §7 y las otras dos vistas no cambian.
- [x] `web/view3d.js` + botón **3D** junto a *Radar* y *Overview*; se construye recién al entrar (carga `elevation_4m.u16` y `hirise.png`) (15/11 02:00). Verificado por CDP en Chrome headless a 1366×768: 0 mensajes de consola, 23–29 pedidos, todos dentro del repo; `?view=3d` también entra directo.
- [x] Relieve 3D a escala vertical 1:1 con rojo (> 20°), curvas de nivel cada 10 m, grilla de 10 m, ruta, huella de Curiosity, balizas en las 9 paradas y límite ámbar de retorno (15/11 02:00). Verificado por captura con las cámaras *Close*, *Follow* y *High* y con la cámara alejada a mano (t = 268: se ve la línea ámbar sobre el bloque completo).
- [x] HUD: dial de radiación (escala logarítmica, marcas de referencia y de alerta, los tres rótulos de RAD), dial de temperatura de suelo y aire con selector de sol, UV, presión, humedad, viento "not available", dial de tiempo de EVA, margen de retorno, pendiente y elevación (15/11 02:00). Verificado: en t = 118 con *Replay* muestra 7.826 µGy/día, alerta ilustrativa y "replay so far 244 µGy"; al cambiar el sol desde el HUD cambia también la tarjeta del radar (sol 1440: aire −18 °C).
- [x] Registro de eventos que aparece al caminar (paradas, tramos empinados, cruces con la huella de Curiosity, cada 100 m de subida, cada hora de REMS, mitad del presupuesto, aparición del límite de retorno, cruces y pico del *Replay*) (15/11 02:00). Verificado recorriendo toda la EVA cada 1,5 min: 44 entradas distintas (19 de paradas, 10 de terreno, 5 de Curiosity, 4 de REMS, 3 de EVA, 3 de RAD), sin "safe", "live" ni "real-time".
- [x] Ficha de parada: barra de aproximación en los últimos 150 m y, al llegar, foto Navcam con crédito y objetivo; la foto se agranda con el visor existente (15/11 02:00). Verificado por captura en Murray Buttes, Vera Rubin Ridge y Hematite Hotspot.
- [x] Mini radar en la esquina, cinta de brújula, leyenda de capas con la aclaración del tinte y de la escala, velocidad ×10 (15/11 02:00). Verificado por captura; *Radar* y *Overview* se ven igual que antes al volver.
- [x] Rendimiento y accesibilidad: niveles de detalle del relieve por distancia, HUD a ~10 Hz, `prefers-reduced-motion` (15/11 02:00). Verificado: GPU integrada Intel UHD, 1366×768, 45–50 cuadros por segundo (antes de optimizar, ~31 reproduciendo). Con movimiento reducido emulado (1024×768) carga sin errores y el pulso no se dibuja; la entrada de cámara y la caminata se apagan con la misma condición en el código, pero no se miraron en movimiento. Probado también a 1920×1080.

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
- [ ] Decidir si `PLAN.md` §6 y §8 se actualizan para incluir la vista 3D (hoy §8 dice que el 3D no entra) y si la demo abre en *Radar* o en *3D*.
