/* Visor de ortofoto con mediciones (OpenLayers).
   Usa los campos "ortofoto" y "gcp" de cada modelo en models/models.json. */

proj4.defs('EPSG:32720', '+proj=utm +zone=20 +south +datum=WGS84 +units=m +no_defs');

const nf = (v, d = 2) => { const r = Number(Number(v).toFixed(d)); return (Object.is(r, -0) ? 0 : r).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }); };

function fmtLen(m) {
  return m >= 1000 ? `${nf(m / 1000, 3)} km` : `${nf(m, 2)} m`;
}
function fmtArea(m2) {
  return m2 >= 10000 ? `${nf(m2, 1)} m² (${nf(m2 / 10000, 4)} ha)` : `${nf(m2, 2)} m²`;
}
/* Proyección transversa local (k=1) centrada en el sitio: distancias, áreas y
   ángulos en metros reales con error despreciable a escala de obra. */
let LOCAL = null;
function setLocal(lon, lat) {
  proj4.defs('LOCAL', `+proj=tmerc +lat_0=${lat} +lon_0=${lon} +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs`);
  LOCAL = (c3857) => proj4('EPSG:4326', 'LOCAL', ol.proj.toLonLat(c3857));
}
function lenLocal(coords) {
  let L = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = LOCAL(coords[i - 1]), b = LOCAL(coords[i]);
    L += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return L;
}
function areaLocal(ring) {
  const p = ring.map(LOCAL); let A = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) A += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(A / 2);
}
function toUTM(coord3857) {
  const ll = ol.proj.toLonLat(coord3857);
  return { ll, utm: proj4('EPSG:4326', 'EPSG:32720', ll) };
}
function azimut(a, b) {
  const A = LOCAL(a), B = LOCAL(b);
  let az = Math.atan2(B[0] - A[0], B[1] - A[1]) * 180 / Math.PI;
  return (az + 360) % 360;
}
function anguloEnVertice(p0, p1, p2) {
  const a = LOCAL(p0), v = LOCAL(p1), c = LOCAL(p2);
  const u = [a[0] - v[0], a[1] - v[1]], w = [c[0] - v[0], c[1] - v[1]];
  const cos = (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w));
  return Math.acos(Math.min(1, Math.max(-1, cos))) * 180 / Math.PI;
}
const fmtDeg = (g) => `${nf(g, 2)}°`;

async function initMapa() {
  const id = new URLSearchParams(location.search).get('m');
  let data;
  try { data = await loadData(); } catch (e) { return fatal('No se pudo cargar la lista de modelos.'); }
  const m = data.modelos.find((x) => x.id === id);
  if (!m || !m.ortofoto) return fatal('Este modelo no tiene ortofoto publicada.');

  const meta = await fetch(m.ortofoto.meta).then((r) => r.json());
  document.title = `Ortofoto · ${m.titulo}`;
  document.getElementById('title').textContent = `Ortofoto · ${m.titulo}`;
  const to3d = document.getElementById('to3d');
  if (m.archivo) to3d.href = 'viewer.html?m=' + encodeURIComponent(m.id); else to3d.hidden = true;

  const extent = ol.proj.transformExtent(meta.bounds, 'EPSG:4326', 'EPSG:3857');
  setLocal(meta.center[0], meta.center[1]);

  // ---------- Capas ----------
  const sat = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19, crossOrigin: 'anonymous',
      attributions: 'Fondo © Esri, Maxar, Earthstar Geographics',
    }),
  });
  const orto = new ol.layer.Tile({
    extent,
    source: new ol.source.XYZ({
      url: m.ortofoto.teselas, minZoom: meta.minzoom, maxZoom: meta.maxzoom,
      attributions: 'Ortofoto © ' + (data.sitio?.autor || ''),
    }),
  });

  const gcpSource = new ol.source.Vector();
  const gcpLayer = new ol.layer.Vector({
    source: gcpSource, zIndex: 5,
    style: (f) => new ol.style.Style({
      image: new ol.style.RegularShape({
        points: 3, radius: 9, rotation: 0,
        fill: new ol.style.Fill({ color: '#e0a35c' }),
        stroke: new ol.style.Stroke({ color: '#1a1206', width: 1.5 }),
      }),
      text: new ol.style.Text({
        text: f.get('id'), offsetY: -18, font: '600 12px Inter Tight, system-ui, sans-serif',
        fill: new ol.style.Fill({ color: '#fff' }), stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,.85)', width: 3 }),
      }),
    }),
  });

  const measSource = new ol.source.Vector();
  const measStyle = (f) => {
    const g = f.getGeometry();
    const styles = [new ol.style.Style({
      stroke: new ol.style.Stroke({ color: '#ff4d6d', width: 2.5 }),
      fill: new ol.style.Fill({ color: 'rgba(255,77,109,.18)' }),
      image: new ol.style.Circle({ radius: 5, fill: new ol.style.Fill({ color: '#ff4d6d' }), stroke: new ol.style.Stroke({ color: '#fff', width: 1.5 }) }),
    })];
    // vértices
    if (g.getType() !== 'Point') {
      const coords = g.getType() === 'Polygon' ? g.getCoordinates()[0] : g.getCoordinates();
      styles.push(new ol.style.Style({
        geometry: new ol.geom.MultiPoint(coords),
        image: new ol.style.Circle({ radius: 3.5, fill: new ol.style.Fill({ color: '#fff' }), stroke: new ol.style.Stroke({ color: '#ff4d6d', width: 1.5 }) }),
      }));
    }
    const label = f.get('label');
    if (label) {
      let at;
      if (g.getType() === 'Polygon') at = g.getInteriorPoint();
      else if (g.getType() === 'LineString') at = f.get('tipo') === 'angulo' ? new ol.geom.Point(g.getCoordinates()[1]) : new ol.geom.Point(g.getLastCoordinate());
      else at = g;
      styles.push(new ol.style.Style({
        geometry: at,
        text: new ol.style.Text({
          text: label, offsetY: -16, font: '600 13px Inter Tight, system-ui, sans-serif',
          fill: new ol.style.Fill({ color: '#fff' }),
          backgroundFill: new ol.style.Fill({ color: 'rgba(20,20,22,.88)' }),
          padding: [3, 6, 3, 6],
        }),
      }));
    }
    return styles;
  };
  const measLayer = new ol.layer.Vector({ source: measSource, style: measStyle, zIndex: 10 });

  const map = new ol.Map({
    target: 'map',
    layers: [sat, orto, gcpLayer, measLayer],
    view: new ol.View({ center: ol.proj.fromLonLat(meta.center), zoom: 18, maxZoom: Math.max(24, meta.maxzoom + 3), constrainResolution: false }),
    controls: ol.control.defaults.defaults({ attributionOptions: { collapsible: true } }).extend([
      new ol.control.ScaleLine({ units: 'metric', bar: true, steps: 4, minWidth: 110 }),
    ]),
  });
  map.getView().fit(extent, { padding: [70, 40, 70, 40] });

  // ---------- Contorno de cómputo (si existe) ----------
  let resLayer = null;
  if (m.resultado?.geojson) {
    const rgj = await fetch(m.resultado.geojson).then((r) => r.json()).catch(() => null);
    if (rgj) {
      resLayer = new ol.layer.Vector({
        zIndex: 4,
        source: new ol.source.Vector({ features: new ol.format.GeoJSON().readFeatures(rgj, { featureProjection: 'EPSG:3857' }) }),
        style: (f) => new ol.style.Style({
          stroke: new ol.style.Stroke({ color: '#e0a35c', width: 2.5, lineDash: [8, 6] }),
          fill: new ol.style.Fill({ color: 'rgba(224,163,92,.14)' }),
          text: new ol.style.Text({
            text: m.resultado.etiqueta_mapa || '', font: '700 15px Inter Tight, system-ui, sans-serif',
            fill: new ol.style.Fill({ color: '#1a1206' }), backgroundFill: new ol.style.Fill({ color: '#e0a35c' }), padding: [4, 8, 4, 8],
          }),
        }),
      });
      map.addLayer(resLayer);
      const lbl = document.createElement('label'); lbl.className = 'chk';
      lbl.innerHTML = `<input type="checkbox" id="lyr-res" checked> ${esc(m.resultado.titulo || 'Cómputo')}`;
      document.getElementById('lyr-gcp').closest('label').after(lbl);
      lbl.querySelector('input').onchange = (e) => resLayer.setVisible(e.target.checked);
    }
  }

  // ---------- Panel, capas ----------
  const side = document.getElementById('side');
  const bSide = document.getElementById('btn-side');
  if (matchMedia('(max-width: 820px)').matches) { side.hidden = true; bSide.classList.remove('on'); }
  bSide.onclick = () => { side.hidden = !side.hidden; bSide.classList.toggle('on', !side.hidden); };
  const bind = (elId, layer) => { document.getElementById(elId).onchange = (e) => layer.setVisible(e.target.checked); };
  bind('lyr-orto', orto); bind('lyr-gcp', gcpLayer); bind('lyr-sat', sat);
  document.getElementById('orto-op').oninput = (e) => orto.setOpacity(e.target.value / 100);

  // ---------- Descargas ----------
  const dl = [];
  if (m.ortofoto.descarga) dl.push(`<a class="chip" href="${esc(m.ortofoto.descarga)}" download>Ortofoto GeoTIFF (UTM 20S)</a>`);
  if (m.reporte) dl.push(`<a class="chip" href="${esc(m.reporte)}" target="_blank" rel="noopener">Reporte de calidad PDF</a>`);
  if (dl.length) { document.getElementById('orto-dl').innerHTML = dl.join(''); document.getElementById('dl-sec').hidden = false; }

  // ---------- GCP ----------
  if (m.gcp?.geojson) {
    const gj = await fetch(m.gcp.geojson).then((r) => r.json());
    const feats = new ol.format.GeoJSON().readFeatures(gj, { featureProjection: 'EPSG:3857' });
    gcpSource.addFeatures(feats);
    const tbl = document.getElementById('gcp-tbl');
    tbl.innerHTML = `<thead><tr><th>ID</th><th>Este</th><th>Norte</th><th>Cota</th><th>Res.Z cm</th></tr></thead><tbody>${
      gj.features.map((f) => { const p = f.properties; return `<tr data-id="${esc(p.id)}">
        <td><b>${esc(p.id)}</b></td><td>${p.este_utm20s.toFixed(2).replace('.', ',')}</td><td>${p.norte_utm20s.toFixed(2).replace('.', ',')}</td>
        <td>${p.cota_m.toFixed(2).replace('.', ',')}</td><td class="${Math.abs(p.error_z_m) >= 0.07 ? 'warn' : ''}">${nf(p.error_z_m * 100, 1)}</td></tr>`; }).join('')
    }</tbody>`;
    tbl.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.onclick = () => {
        const f = feats.find((x) => x.get('id') === tr.dataset.id);
        map.getView().animate({ center: f.getGeometry().getCoordinates(), zoom: meta.maxzoom, duration: 500 });
        showGcpPopup(f);
      };
    });
    const d = m.gcp;
    document.getElementById('gcp-dl').innerHTML = [
      d.csv && `<a class="chip" href="${esc(d.csv)}" download>CSV</a>`,
      d.geojson && `<a class="chip" href="${esc(d.geojson)}" download>GeoJSON</a>`,
      d.kml && `<a class="chip" href="${esc(d.kml)}" download>KML (Google Earth)</a>`,
    ].filter(Boolean).join('');
    document.getElementById('gcp-sec').hidden = false;
  } else {
    document.getElementById('lyr-gcp').closest('label').hidden = true;
  }

  // ---------- Popup GCP ----------
  const popEl = document.getElementById('popup');
  const popup = new ol.Overlay({ element: popEl, positioning: 'bottom-center', offset: [0, -16], stopEvent: true });
  map.addOverlay(popup);
  function showGcpPopup(f) {
    const p = f.getProperties();
    popEl.innerHTML = `<button class="pop-x" aria-label="Cerrar">×</button>
      <div class="eyebrow">Punto de control</div><h3>${esc(p.id)}</h3>
      <dl>
        <dt>Latitud</dt><dd>${nf(p.lat, 7)}°</dd>
        <dt>Longitud</dt><dd>${nf(p.lon, 7)}°</dd>
        <dt>Este (UTM 20S)</dt><dd>${nf(p.este_utm20s, 3)} m</dd>
        <dt>Norte (UTM 20S)</dt><dd>${nf(p.norte_utm20s, 3)} m</dd>
        <dt>Cota</dt><dd>${nf(p.cota_m, 3)} m</dd>
        <dt>Residuo X / Y</dt><dd>${nf(p.error_x_m * 100, 1)} / ${nf(p.error_y_m * 100, 1)} cm</dd>
        <dt>Residuo Z</dt><dd>${nf(p.error_z_m * 100, 1)} cm</dd>
        <dt>Fotos</dt><dd>${p.fotos}</dd>
      </dl>`;
    popEl.querySelector('.pop-x').onclick = () => popup.setPosition(undefined);
    popup.setPosition(f.getGeometry().getCoordinates());
  }

  // ---------- Coordenadas bajo el cursor ----------
  const coordsEl = document.getElementById('coords');
  const showCoords = (c) => {
    const { ll, utm } = toUTM(c);
    coordsEl.innerHTML = `<span>${nf(ll[1], 6)}°, ${nf(ll[0], 6)}°</span><span>E ${nf(utm[0], 2)} · N ${nf(utm[1], 2)} <small>UTM 20S</small></span>`;
  };
  map.on('pointermove', (e) => { if (!e.dragging) showCoords(e.coordinate); });
  showCoords(map.getView().getCenter());

  // ---------- Herramientas ----------
  const hint = document.getElementById('tool-hint');
  const HINTS = {
    distancia: 'Clic para agregar puntos · doble clic para terminar',
    superficie: 'Clic para agregar vértices · doble clic para cerrar',
    angulo: 'Clic en el 1.º punto, luego en el vértice y luego en el 2.º punto',
    punto: 'Clic sobre el punto a consultar',
  };
  let draw = null, tool = 'nav', liveListener = null;
  const listEl = document.getElementById('meas');
  const emptyEl = document.getElementById('meas-empty');
  let n = 0;

  function describe(f) {
    const tipo = f.get('tipo'), g = f.getGeometry();
    if (tipo === 'distancia') {
      const L = lenLocal(g.getCoordinates());
      const c = g.getCoordinates();
      const extra = c.length === 2 ? ` · azimut ${fmtDeg(azimut(c[0], c[1]))}` : ` · ${c.length - 1} tramos`;
      return { label: fmtLen(L), detalle: `Distancia ${fmtLen(L)}${extra}` };
    }
    if (tipo === 'superficie') {
      const A = areaLocal(g.getCoordinates()[0]);
      const P = lenLocal(g.getCoordinates()[0]);
      return { label: fmtArea(A).split(' (')[0], detalle: `Superficie ${fmtArea(A)} · perímetro ${fmtLen(P)}` };
    }
    if (tipo === 'angulo') {
      const c = g.getCoordinates();
      if (c.length < 3) return { label: '', detalle: '' };
      const a = anguloEnVertice(c[0], c[1], c[2]);
      return { label: fmtDeg(a), detalle: `Ángulo ${fmtDeg(a)} (suplemento ${fmtDeg(180 - a)})` };
    }
    if (tipo === 'punto') {
      const { ll, utm } = toUTM(g.getCoordinates());
      return { label: `E ${nf(utm[0], 2)} · N ${nf(utm[1], 2)}`, detalle: `Lat ${nf(ll[1], 7)}°, Lon ${nf(ll[0], 7)}° · E ${nf(utm[0], 3)} N ${nf(utm[1], 3)} (UTM 20S)` };
    }
    return { label: '', detalle: '' };
  }

  function addToList(f) {
    n += 1;
    const d = describe(f);
    f.set('label', d.label);
    const li = document.createElement('li');
    const names = { distancia: 'Distancia', superficie: 'Superficie', angulo: 'Ángulo', punto: 'Punto' };
    li.innerHTML = `<div><span class="meas-k">${n}. ${names[f.get('tipo')]}</span><span class="meas-v">${esc(d.detalle.replace(/^\S+ /, ''))}</span></div>
      <button class="mini" title="Copiar" aria-label="Copiar">⧉</button><button class="mini" title="Eliminar" aria-label="Eliminar">×</button>`;
    const [bCopy, bDel] = li.querySelectorAll('button');
    bCopy.onclick = () => navigator.clipboard?.writeText(d.detalle);
    bDel.onclick = () => { measSource.removeFeature(f); li.remove(); emptyEl.hidden = listEl.children.length > 0; };
    li.querySelector('div').onclick = () => map.getView().fit(f.getGeometry().getExtent(), { padding: [120, 120, 120, 120], maxZoom: 22, duration: 400 });
    listEl.prepend(li);
    emptyEl.hidden = true;
    if (side.hidden && !matchMedia('(max-width: 820px)').matches) { side.hidden = false; bSide.classList.add('on'); }
  }

  function setTool(t) {
    tool = t;
    document.querySelectorAll('.tool[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    if (draw) { map.removeInteraction(draw); draw = null; }
    hint.hidden = t === 'nav';
    hint.textContent = HINTS[t] || '';
    if (t === 'nav') return;
    const type = { distancia: 'LineString', superficie: 'Polygon', angulo: 'LineString', punto: 'Point' }[t];
    draw = new ol.interaction.Draw({
      source: measSource, type,
      maxPoints: t === 'angulo' ? 3 : undefined,
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({ color: '#ff4d6d', width: 2, lineDash: [6, 5] }),
        fill: new ol.style.Fill({ color: 'rgba(255,77,109,.12)' }),
        image: new ol.style.Circle({ radius: 5, stroke: new ol.style.Stroke({ color: '#ff4d6d', width: 2 }), fill: new ol.style.Fill({ color: 'rgba(255,255,255,.7)' }) }),
      }),
    });
    draw.on('drawstart', (e) => {
      e.feature.set('tipo', t);
      const g = e.feature.getGeometry();
      liveListener = g.on('change', () => {
        const d = describe(e.feature);
        if (d.detalle) hint.textContent = d.detalle;
      });
    });
    draw.on('drawend', (e) => {
      e.feature.set('tipo', t);
      ol.Observable.unByKey(liveListener);
      // ángulo con menos de 3 puntos: descartar
      if (t === 'angulo' && e.feature.getGeometry().getCoordinates().length < 3) {
        setTimeout(() => measSource.removeFeature(e.feature)); return;
      }
      addToList(e.feature);
      hint.textContent = HINTS[t];
    });
    map.addInteraction(draw);
  }
  document.querySelectorAll('.tool[data-tool]').forEach((b) => { b.onclick = () => setTool(b.dataset.tool); });
  document.querySelector('[data-action="borrar"]').onclick = () => {
    measSource.clear(); listEl.innerHTML = ''; emptyEl.hidden = false; n = 0;
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (draw) draw.abortDrawing(); popup.setPosition(undefined); }
    if ((e.key === 'Backspace' || e.key === 'z') && draw && (e.key === 'Backspace' || e.ctrlKey)) draw.removeLastPoint();
  });

  // clic sobre GCP en modo navegar
  map.on('singleclick', (e) => {
    if (tool !== 'nav') return;
    const f = map.forEachFeatureAtPixel(e.pixel, (ft, ly) => (ly === gcpLayer ? ft : null), { hitTolerance: 6 });
    if (f) showGcpPopup(f); else popup.setPosition(undefined);
  });
  map.on('pointermove', (e) => {
    if (tool !== 'nav' || e.dragging) return;
    const hit = map.hasFeatureAtPixel(e.pixel, { layerFilter: (l) => l === gcpLayer, hitTolerance: 6 });
    map.getTargetElement().style.cursor = hit ? 'pointer' : '';
  });

  window.__mapa = { map, measSource, setTool, describe };
}

function fatal(msg) {
  document.body.innerHTML = `<div class="error-box"><div><h2>${esc(msg)}</h2><p></p><a class="btn" href="./#galeria">Volver a la galería</a></div></div>`;
}
