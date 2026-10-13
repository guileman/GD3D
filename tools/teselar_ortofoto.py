"""Corta una GeoTIFF en teselas XYZ WebP (EPSG:3857) para visores web."""
import json, math, os, sys
import numpy as np
import rasterio
from rasterio.vrt import WarpedVRT
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
from rasterio.warp import transform_bounds, reproject
from rasterio.transform import from_origin
from PIL import Image

src_path, out_dir = sys.argv[1], sys.argv[2]
ZMIN, ZMAX = int(sys.argv[3]), int(sys.argv[4])
R = 6378137.0
ORIG = math.pi * R


def tile_bounds(z, x, y):
    size = 2 * ORIG / (2 ** z)
    minx = -ORIG + x * size
    maxy = ORIG - y * size
    return minx, maxy - size, minx + size, maxy


def lonlat_to_tile(lon, lat, z):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    lr = math.radians(lat)
    y = int((1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n)
    return x, y


os.makedirs(out_dir, exist_ok=True)
with rasterio.open(src_path) as src:
    w, s, e, n = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
    count = 0
    total_bytes = 0
    with WarpedVRT(src, crs="EPSG:3857", resampling=Resampling.bilinear) as vrt:
        for z in range(ZMIN, ZMAX + 1):
            x0, y0 = lonlat_to_tile(w, n, z)
            x1, y1 = lonlat_to_tile(e, s, z)
            for x in range(x0, x1 + 1):
                for y in range(y0, y1 + 1):
                    b = tile_bounds(z, x, y)
                    data = np.zeros((src.count, 256, 256), dtype=np.uint8)
                    reproject(rasterio.band(src, list(range(1, src.count + 1))), data,
                              dst_transform=from_origin(b[0], b[3], (b[2]-b[0]) / 256, (b[3]-b[1]) / 256),
                              dst_crs="EPSG:3857", dst_nodata=0, src_nodata=None,
                              resampling=Resampling.lanczos if z < ZMAX else Resampling.bilinear)
                    alpha = data[3] if vrt.count >= 4 else None
                    if alpha is not None and alpha.max() == 0:
                        continue
                    img = np.moveaxis(data[:4] if vrt.count >= 4 else data[:3], 0, -1)
                    im = Image.fromarray(img, "RGBA" if vrt.count >= 4 else "RGB")
                    p = os.path.join(out_dir, str(z), str(x))
                    os.makedirs(p, exist_ok=True)
                    fp = os.path.join(p, f"{y}.webp")
                    im.save(fp, "WEBP", quality=80, method=4)
                    count += 1
                    total_bytes += os.path.getsize(fp)
            print("z", z, "tiles so far", count, round(total_bytes / 1e6, 1), "MB", flush=True)

    meta = {
        "bounds": [w, s, e, n],
        "center": [(w + e) / 2, (s + n) / 2],
        "minzoom": ZMIN,
        "maxzoom": ZMAX,
        "resolucion_m": round(abs(src.res[0]), 4),
        "crs_original": str(src.crs),
        "ancho_px": src.width,
        "alto_px": src.height,
        "teselas": count,
    }
    json.dump(meta, open(os.path.join(out_dir, "meta.json"), "w"), indent=2)
    print(meta)
