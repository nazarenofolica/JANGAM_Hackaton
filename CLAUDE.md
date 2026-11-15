# Marswalk Radar — instrucciones para Claude / Fable (branch `plan2d`)

Esta branch desarrolla la **versión 2D: un radar táctico en tablet** para una caminata simulada en Gale. La versión 3D vive en `develop`: **no tocar `develop` ni mezclar las branches.**

1. Antes de cualquier cambio, leer `documentos/CHECKLIST.md` y trabajar el primer ítem sin tildar del primer bloque incompleto.
2. `documentos/PLAN.md` es el plan vigente. Son obligatorias la §6 (interfaz) y la §7 (reglas científicas y terminología).
3. **El contrato de datos para el visor está en `web/README.md`.** El visor lee solo `data/processed/gale_radar/` y three.js desde `web/vendor/` (import map). Nada de CDN ni pedidos externos.
4. Al terminar un ítem: tildarlo en el checklist con fecha, hora y cómo se verificó. No tildar nada sin verificar.
5. Todo desvío del plan se anota en `documentos/BITACORA.md` antes de seguir.
6. **No hacer commit ni push sin autorización explícita.**
7. No descargar datos nuevos. No agregar dependencias de Python fuera de `requirements.txt`. No agregar librerías JS fuera de `web/vendor/`.
8. No modificar `data/raw/` ni `data/raw/MANIFEST.json`. Si cambia el escenario, editar `configs/packages/gale_radar.yaml` y reconstruir el paquete; no editar a mano `data/processed/`.
9. Código, interfaz y README en inglés; `documentos/` en español.
10. Hitos: congelar funcionalidades dom 15/11 11:00; congelar código 17:00; envío 20:00.

## Cómo correr

```bash
pip install -r requirements.txt
python scripts/build_package.py configs/packages/gale_radar.yaml   # regenera data/processed/gale_radar (~15 s)
python -m pytest -q                                                 # 9 tests
python -m http.server 8000                                          # desde la raíz → http://localhost:8000/web/
```

## Próxima tarea (bloque A del checklist)

Construir `web/index.html` + `web/main.js` (+ CSS) con three.js. Es el radar de `PLAN.md` §6: centrado en el astronauta simulado, con el rumbo hacia arriba, y con relieve oscuro, zonas rojas (> 20°), ruta verde, huella de Curiosity punteada, paradas cian/violeta, anillo ámbar de retorno, panel de 3 tarjetas y línea de tiempo. Todo lo que necesita (capas, coordenadas, codificaciones, modelo de simulación, reglas de texto) está en `web/README.md`.
