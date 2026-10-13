/* Galería de modelos 3D — lógica compartida por index.html y viewer.html.
   Los datos salen de models/models.json: para publicar un modelo nuevo
   solo hay que agregar su entrada ahí (ver README). */

const DATA_URL = 'models/models.json?v=' + Date.now();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function fmtFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadData() {
  const res = await fetch(DATA_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error('No se pudo leer ' + DATA_URL);
  const data = await res.json();
  data.modelos = (data.modelos || []).slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  return data;
}

function applySite(sitio = {}) {
  document.querySelectorAll('[data-site]').forEach((el) => {
    const v = sitio[el.dataset.site];
    if (v) el.textContent = v;
  });
}

const PLACEHOLDER = `
  <svg viewBox="0 0 120 90" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g fill="none" stroke="#e0a35c" stroke-width="1.2" opacity=".75" transform="translate(60 47)">
      <path d="M0 -26 L26 -12 L26 16 L0 30 L-26 16 L-26 -12 Z"/>
      <path d="M-26 -12 L0 2 L26 -12 M0 2 L0 30"/>
    </g>
  </svg>`;

/* ---------------- Portada / galería ---------------- */
async function initGallery() {
  document.getElementById('year').textContent = new Date().getFullYear();
  const grid = document.getElementById('grid');
  let data;
  try {
    data = await loadData();
  } catch (e) {
    grid.innerHTML = `<div class="empty">No se pudo cargar la lista de modelos.<br>
      <span class="mono" style="font-size:12px">Si abriste el archivo con doble clic, serví la carpeta con un servidor local (ver README).</span></div>`;
    return;
  }
  applySite(data.sitio);
  renderEquipos(data.equipos);
  const modelos = data.modelos;

  // Stats
  document.getElementById('stat-count').textContent = modelos.length;
  const fotos = modelos.reduce((n, m) => n + (Number(m.fotos) || 0), 0);
  document.getElementById('stat-photos').textContent = fotos ? fotos.toLocaleString('es-AR') : '–';
  document.getElementById('stat-last').textContent = modelos[0]?.fecha
    ? fmtFecha(modelos[0].fecha).replace(/ de /g, ' ') : '–';

  // Hero: el modelo más reciente
  const ultimo = modelos[0];
  const heroOpen = document.getElementById('hero-open');
  if (ultimo) {
    const hm = document.getElementById('hero-model');
    if (ultimo.orientacion) hm.orientation = ultimo.orientacion;
    if (ultimo.camara) hm.cameraOrbit = ultimo.camara;
    hm.src = ultimo.archivo;
    if (ultimo.portada) hm.poster = ultimo.portada;
    document.getElementById('hero-tag').textContent = ultimo.titulo;
    heroOpen.href = 'viewer.html?m=' + encodeURIComponent(ultimo.id);
    const heroRep = document.getElementById('hero-report');
    if (heroRep && (ultimo.calidad || ultimo.reporte)) {
      heroRep.href = ultimo.calidad ? 'calidad.html?m=' + encodeURIComponent(ultimo.id) : ultimo.reporte;
      heroRep.hidden = false;
    }
  } else {
    heroOpen.hidden = true;
  }

  const render = (lista) => {
    if (!lista.length) {
      grid.innerHTML = '<div class="empty">No hay modelos que coincidan.</div>';
      return;
    }
    grid.innerHTML = lista.map((m) => `
      <article class="card">
        <a class="card-link" href="viewer.html?m=${encodeURIComponent(m.id)}">
          <div class="thumb">
            ${m.portada ? `<img src="${esc(m.portada)}" alt="" loading="lazy">` : PLACEHOLDER}
            <span class="badge">3D</span>
          </div>
          <div class="card-body">
            <h3>${esc(m.titulo)}</h3>
            ${m.descripcion ? `<p>${esc(m.descripcion)}</p>` : ''}
            ${m.etiquetas?.length ? `<div class="tags">${m.etiquetas.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
            <div class="meta">
              ${m.ubicacion && m.ubicacion !== '—' ? `<span>${esc(m.ubicacion)}</span>` : ''}
              ${m.fecha ? `<span>${esc(fmtFecha(m.fecha))}</span>` : ''}
              ${m.fotos ? `<span>${esc(m.fotos)} fotos</span>` : ''}
            </div>
          </div>
        </a>
        <div class="card-actions">
          <a class="chip primary" href="viewer.html?m=${encodeURIComponent(m.id)}">Ver en 3D</a>
          ${m.ortofoto ? `<a class="chip" href="mapa.html?m=${encodeURIComponent(m.id)}">Ortofoto y mediciones</a>` : ''}
          ${m.calidad ? `<a class="chip" href="calidad.html?m=${encodeURIComponent(m.id)}">Resumen de calidad</a>` : ''}
          ${m.reporte ? `<a class="chip" href="${esc(m.reporte)}" target="_blank" rel="noopener">Reporte PDF ↓</a>` : ''}
        </div>
      </article>`).join('');
  };
  render(modelos);

  document.getElementById('search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return render(modelos);
    render(modelos.filter((m) =>
      [m.titulo, m.descripcion, m.ubicacion, ...(m.etiquetas || [])].join(' ').toLowerCase().includes(q)));
  });
}

/* ---------------- Visor ---------------- */
async function initViewer() {
  const id = new URLSearchParams(location.search).get('m');
  const mv = document.getElementById('mv');
  const loading = document.getElementById('loading');
  const progress = document.getElementById('progress');

  const fail = (titulo, texto) => {
    document.body.innerHTML = `<div class="error-box"><div>
      <h2>${esc(titulo)}</h2><p>${esc(texto)}</p>
      <a class="btn" href="./#galeria">Volver a la galería</a></div></div>`;
  };

  let data;
  try { data = await loadData(); } catch (e) { return fail('No se pudo cargar la lista', e.message); }
  const m = data.modelos.find((x) => x.id === id);
  if (!m) return fail('Modelo no encontrado', 'El enlace puede estar mal escrito o el modelo fue retirado.');

  document.title = `${m.titulo} · ${data.sitio?.titulo || 'Modelos 3D'}`;
  document.getElementById('title').textContent = m.titulo;
  document.getElementById('p-ubicacion').textContent = m.ubicacion && m.ubicacion !== '—' ? m.ubicacion : 'Modelo 3D';
  document.getElementById('p-desc').textContent = m.descripcion || '';
  const meta = [
    ['Fecha', fmtFecha(m.fecha)],
    ['Fotos', m.fotos],
    ['Software', m.software],
    ['Etiquetas', (m.etiquetas || []).join(', ')],
  ].filter(([, v]) => v);
  document.getElementById('p-meta').innerHTML = meta.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  if (m.calidad || m.reporte || m.ortofoto) {
    const q = document.getElementById('p-calidad');
    const kp = (m.calidad?.indicadores || []).slice(0, 4);
    q.innerHTML = `
      ${kp.length ? `<div class="p-kpis">${kp.map((k) => `<div><b>${esc(k.valor)}</b><span>${esc(k.label)}</span></div>`).join('')}</div>` : ''}
      ${m.calidad ? `<a class="btn" href="calidad.html?m=${encodeURIComponent(m.id)}">Resumen de calidad</a>` : ''}
      ${m.ortofoto ? `<a class="btn ghost" href="mapa.html?m=${encodeURIComponent(m.id)}">Ortofoto</a>` : ''}
      ${m.reporte ? `<a class="btn ghost" href="${esc(m.reporte)}" target="_blank" rel="noopener">PDF</a>` : ''}`;
    q.hidden = false;
  }

  if (m.portada) mv.poster = m.portada;
  if (m.orientacion) mv.orientation = m.orientacion; // opcional, ej. "0deg -90deg 0deg" para modelos Z-arriba
  if (m.camara) mv.cameraOrbit = m.camara;   // opcional, ej. "45deg 70deg 30m"
  mv.alt = m.titulo;
  mv.src = m.archivo;

  mv.addEventListener('progress', (e) => {
    const p = e.detail.totalProgress;
    progress.style.width = (p * 100) + '%';
    loading.textContent = `Cargando modelo… ${Math.round(p * 100)}%`;
    if (p >= 1) setTimeout(() => { progress.style.opacity = 0; }, 300);
  });
  mv.addEventListener('load', () => loading.classList.add('hide'));
  mv.addEventListener('error', () => {
    loading.classList.remove('hide');
    loading.textContent = 'No se pudo abrir el archivo del modelo.';
  });

  // Ocultar la ayuda al primer movimiento
  const hint = document.getElementById('hint');
  mv.addEventListener('camera-change', (e) => {
    if (e.detail.source === 'user-interaction') hint.classList.add('hide');
  });
  setTimeout(() => hint.classList.add('hide'), 7000);

  // Botones
  const panel = document.getElementById('panel');
  const bInfo = document.getElementById('btn-info');
  if (matchMedia('(max-width: 820px)').matches) { panel.hidden = true; bInfo.classList.remove('on'); }
  bInfo.onclick = () => { panel.hidden = !panel.hidden; bInfo.classList.toggle('on', !panel.hidden); };

  const bRot = document.getElementById('btn-rotate');
  bRot.onclick = () => {
    mv.autoRotate = !mv.autoRotate;
    bRot.classList.toggle('on', mv.autoRotate);
  };

  document.getElementById('btn-reset').onclick = () => {
    mv.cameraOrbit = m.camara || 'auto auto auto';
    mv.cameraTarget = 'auto auto auto';
    mv.fieldOfView = 'auto';
  };

  document.getElementById('btn-shot').onclick = async () => {
    const blob = await mv.toBlob({ mimeType: 'image/jpeg', qualityArgument: 0.9, idealAspect: true });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${m.id}-portada.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  document.getElementById('btn-full').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };
}

/* ---------------- Reporte de calidad ---------------- */
async function initCalidad() {
  document.getElementById('year').textContent = new Date().getFullYear();
  const root = document.getElementById('q');
  const id = new URLSearchParams(location.search).get('m');
  let data;
  try { data = await loadData(); } catch (e) {
    root.innerHTML = '<p class="empty">No se pudo cargar la información.</p>'; return;
  }
  applySite(data.sitio);
  const m = data.modelos.find((x) => x.id === id);
  if (!m || !m.calidad) {
    root.innerHTML = '<p class="empty">Este modelo no tiene reporte de calidad.<br><br><a class="btn" href="./#galeria">Volver a la galería</a></p>';
    return;
  }
  const c = m.calidad;
  document.title = `Calidad · ${m.titulo}`;
  const icon = { ok: '✓', atencion: '!', info: 'i' };
  root.innerHTML = `
    <div class="q-head">
      <div>
        <div class="eyebrow">Reporte de calidad</div>
        <h1>${esc(m.titulo)}</h1>
        <p class="q-verdict">${esc(c.veredicto)}</p>
        <p class="q-lead">${esc(c.resumen)}</p>
      </div>
      <div class="q-actions">
        <a class="btn" href="viewer.html?m=${encodeURIComponent(m.id)}">Ver modelo 3D</a>
        ${m.ortofoto ? `<a class="btn ghost" href="mapa.html?m=${encodeURIComponent(m.id)}">Ortofoto y mediciones</a>` : ''}
        ${m.reporte ? `<a class="btn ghost" href="${esc(m.reporte)}" target="_blank" rel="noopener">Reporte completo (PDF)</a>` : ''}
      </div>
    </div>

    <div class="q-kpis">
      ${(c.indicadores || []).map((k) => `
        <div class="q-kpi"><b>${esc(k.valor)}</b><span>${esc(k.label)}</span>${k.nota ? `<small>${esc(k.nota)}</small>` : ''}</div>`).join('')}
    </div>

    <div class="q-grid">
      <section>
        <h2>Conclusiones</h2>
        <ul class="q-list">
          ${(c.conclusiones || []).map((x) => `
            <li class="q-item ${esc(x.tipo)}">
              <span class="q-ico">${icon[x.tipo] || 'i'}</span>
              <div><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></div>
            </li>`).join('')}
        </ul>
      </section>
      <aside>
        ${c.datos?.length ? `<h2>Datos del relevamiento</h2>
          <dl class="q-dl">${c.datos.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
        ${c.imagen_superposicion ? `<h2>Superposición de fotos</h2>
          <figure class="q-fig"><img src="${esc(c.imagen_superposicion)}" alt="Mapa de cantidad de fotos que ven cada punto del terreno">
          <figcaption>Cantidad de fotos que ven cada zona. Verde oscuro: 5 o más; rojo: solo 2.</figcaption></figure>` : ''}
      </aside>
    </div>
    <section class="q-gcp" id="q-gcp" hidden></section>`;
  if (m.gcp?.geojson) {
    const gj = await fetch(m.gcp.geojson).then((r) => r.json()).catch(() => null);
    if (gj) {
      const nf = (v, d = 2) => { const r = Number(Number(v).toFixed(d)); return (Object.is(r, -0) ? 0 : r).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }); };
      const sec = document.getElementById('q-gcp');
      sec.innerHTML = `
        <div class="q-gcp-head">
          <div><h2>Puntos de control terrestre</h2>
          <p class="q-lead">${gj.features.length} puntos medidos en campo y usados para georreferenciar el modelo. Coordenadas en UTM zona 20 Sur (EPSG:32720). El residuo es la diferencia entre la posición medida y la que resultó en el modelo.</p></div>
          <div class="q-actions">
            ${m.ortofoto ? `<a class="btn ghost" href="mapa.html?m=${encodeURIComponent(m.id)}">Ver en el mapa</a>` : ''}
            ${m.gcp.csv ? `<a class="chip" href="${esc(m.gcp.csv)}" download>CSV</a>` : ''}
            ${m.gcp.geojson ? `<a class="chip" href="${esc(m.gcp.geojson)}" download>GeoJSON</a>` : ''}
            ${m.gcp.kml ? `<a class="chip" href="${esc(m.gcp.kml)}" download>KML</a>` : ''}
          </div>
        </div>
        <div class="q-tbl-wrap"><table class="q-tbl">
          <thead><tr><th>ID</th><th>Este (m)</th><th>Norte (m)</th><th>Cota (m)</th><th>Res. X</th><th>Res. Y</th><th>Res. Z</th><th>Fotos</th></tr></thead>
          <tbody>${gj.features.map((f) => { const p = f.properties; const bad = Math.abs(p.error_z_m) >= 0.07;
            return `<tr><td><b>${esc(p.id)}</b></td><td>${nf(p.este_utm20s, 3)}</td><td>${nf(p.norte_utm20s, 3)}</td><td>${nf(p.cota_m, 3)}</td>
              <td>${nf(p.error_x_m * 100, 1)} cm</td><td>${nf(p.error_y_m * 100, 1)} cm</td><td class="${bad ? 'warn' : ''}">${nf(p.error_z_m * 100, 1)} cm</td><td>${p.fotos}</td></tr>`; }).join('')}</tbody>
        </table></div>
        <p class="q-note">Resaltados: residuos verticales de 7 cm o más.</p>`;
      sec.hidden = false;
    }
  }
}

/* ---------------- Equipos ---------------- */
function renderEquipos(equipos) {
  const sec = document.getElementById('equipos');
  if (!sec || !equipos?.length) return;
  const grid = document.getElementById('eq-grid');
  grid.innerHTML = equipos.map((e, i) => `
    <article class="eq-card${i === 0 || (e.fotos || []).length > 1 ? ' wide' : ''}">
      <div class="eq-photos n${Math.min((e.fotos || []).length, 2)}">
        ${(e.fotos || []).map((f) => `<button class="eq-ph" data-src="${esc(f.src)}" data-alt="${esc(f.alt || '')}"><img src="${esc(f.src)}" alt="${esc(f.alt || e.nombre)}" loading="lazy"></button>`).join('')}
      </div>
      <div class="eq-body">
        ${e.tipo ? `<div class="eyebrow">${esc(e.tipo)}</div>` : ''}
        <h3>${esc(e.nombre)}</h3>
        ${e.descripcion ? `<p>${esc(e.descripcion)}</p>` : ''}
        ${e.datos?.length ? `<dl>${e.datos.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
      </div>
    </article>`).join('');
  sec.hidden = false;

  // Ver foto ampliada
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox'; lb.className = 'lightbox'; lb.hidden = true;
    lb.innerHTML = '<button class="icon-btn lb-x" aria-label="Cerrar">×</button><img alt=""><p></p>';
    document.body.appendChild(lb);
    lb.onclick = (ev) => { if (ev.target !== lb.querySelector('img')) lb.hidden = true; };
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') lb.hidden = true; });
  }
  grid.querySelectorAll('.eq-ph').forEach((b) => {
    b.onclick = () => {
      lb.querySelector('img').src = b.dataset.src;
      lb.querySelector('img').alt = b.dataset.alt;
      lb.querySelector('p').textContent = b.dataset.alt;
      lb.hidden = false;
    };
  });
}
