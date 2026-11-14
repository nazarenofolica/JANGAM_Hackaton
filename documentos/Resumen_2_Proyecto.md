# Resumen 2 — El challenge "Interplanetary Survival Guide: Martian Map"

> **Actualización (14/11, ya con la página oficial).** La sección 1 y la sección 2 abajo están **corregidas con el enunciado oficial**, que quedó textual en [enunciado_oficial.md](enunciado_oficial.md). El resto del documento (secciones 3 en adelante) sigue basado en README de otros equipos, así que tomalo como contexto y no como requisito.

## 1. De qué se trata (según el enunciado oficial)
- Dificultad **Intermediate**. Temas: Human Exploration, Mars, Planets & Moons, Software, Space Exploration.
- **Qué piden:** crear un **mapa, herramienta o interfaz que un astronauta en Marte pueda usar durante una exploración de superficie**, con datos y herramientas de la NASA. Tiene que ser una **vista por capas de un lugar *o una ruta*** que junte datos de **varias misiones de la NASA** para planificar y ejecutar una caminata marciana (*Marswalk*) mientras hace ciencia.
- **El problema que señalan:** Mars Trek y el mapeo geológico del USGS permiten superponer capas, pero están hechos para vistas regionales y globales, **no para las zonas hiperlocales** de una salida individual. Ahí está el hueco que quieren cubrir.
- **Cómo arrancar:** definir primero un **objetivo científico** y el lugar. Ejemplo del enunciado: formaciones *boxwork* que estudió Curiosity en 2025, en la zona de **Mount Sharp**. Se puede elegir un sitio muy explorado (más datos) o uno poco estudiado (más desafío).
- **Lo que "pueden considerar" (no es obligatorio, el enunciado lo dice así):**
  - **Al menos tres tipos de datos**: ópticos, térmicos, espectrales, topográficos, geofísicos, atmosféricos, radiación, químicos.
  - **Seguridad del astronauta** como prioridad: radiación (que en Marte es distinta que en la Tierra o la Luna), clima espacial.
  - **Movilidad con traje y equipo**, y de ser posible un **mapa de ruta** que lleve a los objetivos científicos **evitando obstáculos** como grandes formaciones rocosas.
- **Formato libre:** pantalla de la nave o hábitat, tablet de mano, HUD en el casco, u otro. Puede ser una imagen estática, un producto interactivo o **un sistema que genere mapas de distintos lugares**.
- **Otras ideas del enunciado:** elegir un período de tiempo pasado, una predicción futura o ninguno (si te enfocás en topografía y geología). Incluir **imágenes de punto de vista** de las misiones en superficie para que el astronauta sepa qué va a encontrar. Pensar si usan rovers o trabajan en pareja. Mirar mapas de misiones a la Luna, la Tierra y otros destinos para inspirarse.
- Dice que **pueden agregarse más recursos antes del hackathon**.

## 2. Datos: lista oficial y lo que usan otros equipos

### 2.1 Recursos oficiales (pestaña *Resources*)
Son solo cinco, y son **portales**, no archivos para bajar de un golpe:

| Recurso | Qué es | Utilidad para nosotros |
|---|---|---|
| [JPL Mars Trek](https://trek.nasa.gov/mars/) | Portal web con datos de varios sitios de aterrizaje | Capas ya procesadas, probablemente la base del proyecto |
| [USGS-NASA Planetary Geologic Mapping](https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars) | Mapa geológico estandarizado de Marte | Capa geológica |
| [Ruta propuesta de Curiosity en Mount Sharp](https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/) | Ejemplo de mapa de ruta anotado | Referencia visual del tipo de entregable |
| [NASA Worldview](https://worldview.earthdata.nasa.gov/) | Imágenes satelitales **de la Tierra** | Poco relevante para Marte. Puede servir solo como comparación |
| [Perseverance Raw Images](https://mars.nasa.gov/mars2020/multimedia/raw-images/) | Más de 1 millón de imágenes del rover | Imágenes de punto de vista para el mapa |

El enunciado aclara que el uso de sitios que no son del gobierno de EE. UU. debe respetar sus propios términos de uso de datos.

### 2.2 Datos que mencionan otros equipos (**no son la lista oficial**)

| Fuente | Para qué sirve (a verificar) |
|---|---|
| **MOLA / MEGDR** (Mars Global Surveyor) | Altimetría global: relieve y pendientes |
| **HiRISE** (Mars Reconnaissance Orbiter) | Imágenes de muy alta resolución y modelos de terreno locales |
| **CRISM** (MRO) | Espectrometría: mineralogía de la superficie |
| **THEMIS** (Mars Odyssey) | Imágenes térmicas |
| **MEDA** (Mars 2020 / Perseverance) | Clima: temperatura, viento, polvo |
| **MSL RAD y REMS** (Curiosity) | Radiación y clima en superficie |
| Instrumentos de Perseverance: Mastcam-Z, SuperCam, PIXL, SHERLOC, RIMFAX | Geología y química local |
| **USGS/IAU Planetary Nomenclature** | Nombres oficiales de cráteres, valles, etc. |
| **NASA Mars Trek** | Visor y capas de mapa ya procesadas, con servicios de tiles *(a verificar el endpoint)* |

Los archivos originales suelen estar en el **NASA PDS (Planetary Data System)** y en USGS Astrogeology *(a verificar las URLs exactas)*. Son pesados, así que casi todos los equipos usan **tiles ya procesados** (Mars Trek) en vez de bajar los rásters completos.

## 3. Qué hicieron otros equipos
Todos están en GitHub, así que sirven de referencia, **no para copiar**:
- Un **planificador de rutas** para el cráter Jezero: A* sobre un mapa de pendientes de HiRISE, paradas científicas reales y un radio de retorno de 5 km. [Repo](https://github.com/25243060-creator/martian-map-route-planner)
- Un **planificador de caminatas por Jezero** (equipo Protikriti). [Repo](https://github.com/AhsanulHoque22/Nasa-Space-Apps-Challenge-2026-Team-Protikriti)
- Un **mapa por capas con asistente offline** para estudiantes, investigadores y planificadores de misión (equipo UnknownX). [Repo](https://github.com/ahsanur-official/Interplanetary-Survival-Guide-Martian-Map)
- Otro mapa por capas en React/Vite, que arranca con terreno sintético y le agrega datos reales después. [Repo](https://github.com/pollob-kumar/nasa-space-apps-martian-map)

**Lo que se repite en todos:** el sitio candidato es **Jezero**, porque es donde hay más datos en tierra. Combinan **relieve y pendiente**, **ciencia** y **seguridad** (radiación, clima, distancia de retorno).

## 4. Cómo se mapea esto a los criterios de evaluación
Según la guía de entrega, se evalúa **Impact, Creativity, Validity, Relevance y Presentation**:
- **Validity**: tus notas dicen que esperan algo viable con algo de escalabilidad. Usar datos reales y poder explicar de dónde sale cada número pesa más que una interfaz vistosa.
- **Relevance**: que el producto responda a lo que pide el challenge, que es un mapa multicapa para planificar una caminata.
- **Creativity**: como muchos equipos van a hacer un "mapa de Jezero con pendientes", conviene decidir qué es lo distinto.

## 5. Decisiones que les tocan a ustedes
1. **Alcance de la zona.** Todo Marte con baja resolución, o un sitio concreto con más detalle. Un sitio concreto es más viable en dos días.
2. **Qué capas incluir.** Con 3 o 4 bien hechas alcanza: relieve/pendiente, imagen base, una capa científica (mineralogía) y una de riesgo (radiación o clima).
3. **Qué pregunta responde la herramienta.** Por ejemplo "¿qué ruta es segura y científicamente interesante?" o "¿qué sitios cumplen condiciones para una caminata?".
4. **Tiles ya procesados vs. datos crudos.** Los tiles ahorran horas, pero hay que declararlo y dar crédito en "NASA Data" y "Other References".
5. **Escalabilidad.** Dejar claro cómo se agregarían más sitios o capas, para respaldar lo que pidieron los tutores.
6. **Uso de IA.** Declararlo según las reglas del resumen 1. Y recordá que tu organización local **prohíbe modelos chinos**.

## 6. Riesgos
- Los archivos del PDS son enormes y los formatos (IMG, JP2, GeoTIFF) pueden consumir horas si no se tiene experiencia.
- Los servicios de tiles pueden estar caídos o limitar el uso durante el fin de semana. Conviene **descargar una copia local** de lo esencial.
- Los cinco recursos oficiales son portales, no datasets descargables. Hay que decidir el sitio antes de bajar nada.
- Worldview es de la Tierra: no cuenta como dato de Marte.

## 7. Próximo paso sugerido
1. Elegir **un objetivo científico y un sitio** (por ejemplo, boxwork en Mount Sharp, o Jezero).
2. Definir **al menos tres capas de datos** para ese sitio y de dónde sale cada una.
3. Recién ahí bajar un set mínimo y chico de datos de esa región, no del planeta entero.
