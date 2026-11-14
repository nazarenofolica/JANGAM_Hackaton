# Marswalk Map Generator — NASA Space Apps Challenge 2026

**Challenge:** [Interplanetary Survival Guide: Martian Map](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/)

A generator of layered, hyperlocal maps for planning a human *Marswalk*: given a site, it builds a 3D terrain view with
imagery, science stops, an astronaut route and a safety budget (radiation and weather), using NASA mission data.

- **Main site:** Gale Crater, from Pahrump Hills to Vera Rubin Ridge / Hematite Hotspot. This is terrain Curiosity
  actually drove, so the generated routes can be validated against the rover's real traverse.
- **Second site:** the *boxwork* formations on Mount Sharp (Curiosity, 2025), generated from the same configuration.

> Status: work in progress during the hackathon (Nov 14–15, 2026).

## Repository layout

```
configs/sites/      Site configuration (bounding boxes, data services, layers)
scripts/            Data download scripts (run from the repo root)
data/generacion/    Generators for the heavy data kept out of Git (photos, radiation, weather)
data/raw/           Downloaded NASA data + MANIFEST.json (source, size, checksum, date of every file)
data/processed/     Packages generated for the viewer (pipeline output)
src/marswalk/       Processing pipeline (terrain, slope, routes, radiation budget)
web/                Static 3D viewer (three.js), published on GitHub Pages
notebooks/          Exploration and validation notebooks
documentos/         Team documents (Spanish): challenge text, plan, submission rules
```

## Getting the data

Terrain, imagery, layers and rover traverse are already in the repo (`data/raw/gale/`, ~60 MB).
Heavy data (radiation, weather, photos, ~145 MB) is **not in Git** — generate it after cloning:

```bash
pip install -r requirements.txt
python data/generacion/generar_todo.py   # radiation + photos + weather (~10-15 min)
python scripts/download_all.py           # everything from scratch, including the above (~15-25 min)
```

See [data/README.md](data/README.md) for the full data catalog.

## NASA data used

| Data | Mission / instrument | Source |
|---|---|---|
| Digital terrain model, 1 m (served at 2–25 m) | MRO HiRISE | JPL Mars Trek |
| Orbital imagery | MRO HiRISE, MRO CTX | JPL Mars Trek |
| Thermal infrared (day / night) | Mars Odyssey THEMIS | JPL Mars Trek |
| Global geologic map (SIM 3292) | USGS / NASA | JPL Mars Trek |
| Rover traverse and waypoints | MSL Curiosity | JPL Mars Trek; JPL MSL mission map |
| Surface radiation dose | MSL RAD | NASA SPDF / CDAWeb |
| Surface weather | MSL REMS | NASA PDS Atmospheres Node |
| Point-of-view images | MSL Mastcam / Navcam | NASA raw images |

Image credits: NASA/JPL-Caltech/MSSS (Mastcam), NASA/JPL-Caltech (Navcam), NASA/JPL/University of Arizona (HiRISE).

## Use of AI

This project uses Claude (Anthropic) as a coding and research assistant: data discovery, download scripts and
documentation drafts. All AI-assisted code is reviewed by the team. Details will be listed in the project submission.
