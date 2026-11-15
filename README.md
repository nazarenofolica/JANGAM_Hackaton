# Marswalk Radar — NASA Space Apps Challenge 2026

**Challenge:** [Interplanetary Survival Guide: Martian Map](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/)

A tactical tablet for astronauts on a Marswalk. An astronaut-centred, heading-up **radar** answers three questions
at a glance, using NASA mission data for Gale Crater:

1. **Where can I walk without getting stuck or falling?** Terrain relief, slopes above 20° in red, a modelled route
   and Curiosity's historical track as reference.
2. **How much time do I have, and when must I head back?** EVA clock, an amber **return ring** (how far I can go and
   still reach the pickup rover in time), historical weather for the time of day and the radiation measured by
   Curiosity, including a replay of the May 2024 solar storm.
3. **Where do I go next, and what will I find?** Science stops with distance, elevation change and the real photo
   Curiosity took there.

The EVA is **simulated**: the astronaut's position moves along the modelled route on a playable clock. All
environmental data are **historical observations**, not live data.

> Branch `plan2d` (2D radar). The 3D version of the project lives in `develop`.
> Status: data package ready; viewer in progress (Nov 14–15, 2026).

## Quick start

```bash
pip install -r requirements.txt
python scripts/build_package.py configs/packages/gale_radar.yaml   # data/raw -> data/processed/gale_radar (~15 s)
python -m pytest -q
python -m http.server 8000                                          # from the repo root; open http://localhost:8000/web/
```

`data/processed/gale_radar/` is committed, so the viewer runs without rebuilding. Rebuild only after changing the
scenario in `configs/packages/gale_radar.yaml`. Raw photos, radiation and weather (not in Git) are regenerated with
`python data/generacion/generar_todo.py`.

## Default scenario (assumptions, editable)

Two astronauts walk from **Pahrump Hills** to **Hematite Hotspot**, where a pressurized rover picks them up, with 6
science stops and a 6 h EVA budget. Modelled route: **5.34 km**, ~2 h 42 min of walking + 2 h at stops, max slope
19.1°, +346 m of climb. 57 % of it runs within 50 m of Curiosity's real track.

## Repository layout

```
configs/packages/   Scenario + assumptions of each package (gale_radar.yaml)
configs/sites/      Site configuration used by the download scripts
scripts/            Data download scripts + build_package.py
data/raw/           Downloaded NASA data + MANIFEST.json (source, size, checksum of every file)
data/processed/     Static package read by the viewer (gale_radar/)
src/marswalk/       Processing pipeline: coordinates, slope, route engine, return isochrone, RAD/REMS summaries
tests/              pytest
web/                three.js viewer (three.js vendored in web/vendor/); data contract in web/README.md
documentos/         Team documents (Spanish): plan, checklist, decision log, challenge text, submission rules
```

## Method (short)

- **Slope:** 2D gradient of the HiRISE DEM (2 m/px), smoothed with σ = 1 px. Cells above 20° are hazards.
- **Route:** 4 m grid (2×2 blocks, max slope), 8-neighbour directed graph, 20° hard limit, no corner cutting. Cost =
  walking time from a Tobler-type hiking curve scaled to 2.5 km/h on flat ground (an exploratory assumption, not a
  validated model for suited astronauts). Shortest path stop by stop (Dijkstra).
- **Return ring:** walking time from every cell to the pickup point (Dijkstra on the reverse graph). The ring is
  drawn where that time equals the remaining EVA time.
- **Radiation (MSL RAD):** absorbed dose rate in tissue-equivalent plastic. Reference = median of the last 30 days
  (185.6 µGy/day). The EVA budget is illustrative; human exposure is not modelled; no mSv conversion.
- **Weather (MSL REMS):** hourly medians of 8 historical sols, with confidence flags applied.
- **Validation:** route vs. Curiosity's track (share within 50 m, mean distance); the route never touches a blocked cell.

## NASA data used

| Data | Mission / instrument | Source |
|---|---|---|
| Digital terrain model, 1 m (used at 2 m) | MRO HiRISE | JPL Mars Trek |
| Orbital image mosaic | MRO HiRISE | JPL Mars Trek |
| Rover traverse and named waypoints | MSL Curiosity | JPL Mars Trek; JPL MSL mission map |
| Surface radiation dose rate | MSL RAD | NASA SPDF / CDAWeb |
| Surface weather | MSL REMS | NASA PDS Atmospheres Node |
| Point-of-view images | MSL Navcam | NASA raw images |

Image credits: NASA/JPL-Caltech (Navcam), NASA/JPL/University of Arizona (HiRISE).

## Use of AI

Claude (Anthropic) is used as a coding and research assistant: data discovery, download scripts, the processing
pipeline and documentation drafts. Claude Fable is used to generate the first version of the three.js interface.
All AI-assisted work is reviewed by the team and declared in the submission.
