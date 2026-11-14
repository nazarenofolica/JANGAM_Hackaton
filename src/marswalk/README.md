# src/marswalk — processing pipeline

Turns `data/raw/` into one static package per site in `data/processed/<site>/` for the viewer.
The package contract (`site.json`: fields, units, file paths) must be agreed first — see
`documentos/PLAN.md`, section 4.

Planned modules (owners per the plan):
- `terrain.py` — DEM crops → uint16 heightmaps (offset/scale per file), slope on a 3–5 m base, roughness (role 1)
- `route.py` — astronaut cost function, A* routes (fast / safe / science), validation vs. Curiosity traverse (role 2)
- `radiation.py` — RAD dose series → EVA dose budget, absorbed → equivalent conversion (role 3)
- `weather.py` — REMS sols → daily cycles (optional, role 3)
- `build.py` — reads `configs/sites/*.yaml`, runs everything, writes the package (role 1)
