# GD3D — galería de relevamientos por fotogrametría

Sitio estático para publicar modelos 3D hechos con fotogrametría. Tiene una portada de bienvenida, una galería con buscador y un visor 3D para cada modelo. No necesita compilar nada y funciona directo en **GitHub Pages**.

El visor usa [model-viewer](https://modelviewer.dev/), que permite girar, acercar y desplazar la cámara. En celulares compatibles también se puede ver el modelo en realidad aumentada.

## Estructura

```
index.html            Portada + galería
viewer.html           Visor 3D (viewer.html?m=<id>)
assets/styles.css     Estilos
assets/app.js         Lógica de la galería y del visor
models/models.json    ← lista de modelos y textos del sitio
models/<id>/          Un modelo por carpeta (modelo.glb + portada.jpg)
```

## Publicar un modelo nuevo

1. **Exportá el modelo a GLB** (glTF binario, con las texturas incluidas). Se puede exportar desde Metashape, RealityCapture, Meshroom o Blender: *File → Export → glTF 2.0 → formato .glb*.
2. **Optimizalo** para que pese poco y cargue rápido (ver más abajo).
3. **Creá una carpeta** `models/mi-modelo/` y copiá ahí el `modelo.glb`.
4. **Agregá la entrada** en `models/models.json`:

```json
{
  "id": "mi-modelo",
  "titulo": "Frigorífico — fachada norte",
  "descripcion": "Relevamiento con drone, vuelo circular a 40 m.",
  "archivo": "models/mi-modelo/modelo.glb",
  "portada": "models/mi-modelo/portada.jpg",
  "fecha": "2026-10-12",
  "ubicacion": "Buenos Aires",
  "fotos": 320,
  "software": "Metashape 2.1",
  "etiquetas": ["edificio", "drone"],
  "camara": "45deg 65deg auto",
  "orientacion": "0deg -90deg 0deg"
}
```

`portada`, `camara` y `orientacion` son opcionales. Usá `"orientacion": "0deg -90deg 0deg"` para modelos exportados con Z hacia arriba (WebODM, Metashape): si no, se ven "acostados". En `camara`, el tercer valor puede ser `auto` o un porcentaje de la distancia por defecto (ej. `75%` para acercar). La **portada** se genera fácil: abrí el modelo en el visor, encuadralo como te guste y tocá el botón de la cámara 📷. Se descarga un JPG; guardalo en la carpeta del modelo como `portada.jpg`.

### Reporte de calidad (opcional)

Si el modelo tiene reporte, agregá `"reporte": "models/mi-modelo/reporte.pdf"` y un bloque `"calidad"` con `veredicto`, `resumen`, `datos`, `indicadores` y `conclusiones` (ver el frigorífico en `models.json` como ejemplo). Se genera automáticamente la página `calidad.html?m=<id>`, con enlaces desde el visor y una etiqueta en la galería.

### Ortofoto y puntos de control (opcional)

```json
"ortofoto": {
  "teselas": "models/mi-modelo/ortofoto/{z}/{x}/{y}.webp",
  "meta": "models/mi-modelo/ortofoto/meta.json",
  "descarga": "models/mi-modelo/ortofoto.tif"
},
"gcp": { "geojson": "...", "csv": "...", "kml": "..." }
```

Se abre en `mapa.html?m=<id>`, con herramientas para medir distancia (con azimut), superficie (con perímetro), ángulo y coordenadas de un punto. Las mediciones se calculan en una proyección transversa local centrada en el sitio, así que coinciden con el cálculo geodésico sobre WGS84 con diferencias de milímetros. Los GCP se muestran como capa, con ficha y tabla.

Las teselas se generan desde la GeoTIFF con `tools/teselar_ortofoto.py` (Python + rasterio): `python3 tools/teselar_ortofoto.py ortofoto.tif models/mi-modelo/ortofoto 14 22`. Corta niveles de zoom de 14 a 22 en WebP y descarta las teselas vacías.

Los textos de la portada (título, bienvenida, autor) se editan en el bloque `"sitio"` del mismo `models.json`.

## Optimizar modelos pesados

La fotogrametría suele generar mallas de millones de triángulos y texturas de 8K. Antes de subir el modelo conviene comprimirlo:

```bash
npx @gltf-transform/cli optimize entrada.glb models/mi-modelo/modelo.glb \
  --simplify-ratio 0.25 --texture-compress webp --texture-size 4096
```

- `--simplify-ratio` reduce la cantidad de triángulos (0.25 deja el 25 %).
- `--texture-compress webp` y `--texture-size` achican las texturas.
- Por defecto también aplica compresión de geometría (meshopt), que el visor soporta.

Lo ideal es que cada modelo pese **menos de 50 MB**, y mejor si queda por debajo de 20 MB.

> ⚠️ **Límite de GitHub:** no acepta archivos de más de **100 MB**, y GitHub Pages no sirve archivos de Git LFS. Si un modelo no baja de ese tamaño, se puede alojar en otro lado (Cloudflare R2, Backblaze, etc.) y poner la URL completa en `"archivo"`.

## Probar en tu computadora

El sitio lee `models.json` con `fetch`, así que no funciona abriendo el HTML con doble clic. Hay que servirlo con un servidor local:

```bash
python3 -m http.server 8000
# y abrir http://localhost:8000
```

## Publicar en GitHub Pages

1. Subí el contenido de esta carpeta a la raíz del repositorio.
2. En el repo, andá a **Settings → Pages → Source: Deploy from a branch**, elegí `main` y la carpeta `/ (root)`.
3. Unos minutos después la web queda en **https://guileman.github.io/GD3D/**.
