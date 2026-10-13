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
  renderServicios(data.servicios);
  renderContacto(data.sitio?.contacto);
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
        <a class="card-link" href="${m.practico ? 'proyecto.html' : 'viewer.html'}?m=${encodeURIComponent(m.id)}">
          <div class="thumb">
            ${m.portada ? `<img src="${esc(m.portada)}" alt="" loading="lazy">` : PLACEHOLDER}
            <span class="badge">3D</span>
          </div>
          <div class="card-body">
            <h3>${esc(m.titulo)}</h3>
            ${m.resultado?.valores?.[0] ? `<div class="card-res"><b>${esc(m.resultado.valores[0].valor)}</b> ${esc(m.resultado.valores[0].label.toLowerCase())}</div>` : ''}
            ${m.descripcion ? `<p title="${esc(m.descripcion)}">${esc(m.descripcion)}</p>` : ''}
            ${m.etiquetas?.length ? `<div class="tags">${m.etiquetas.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
            <div class="meta">
              ${m.ubicacion && m.ubicacion !== '—' ? `<span>${esc(m.ubicacion)}</span>` : ''}
              ${m.fecha ? `<span>${esc(fmtFecha(m.fecha))}</span>` : ''}
              ${m.fotos ? `<span>${esc(m.fotos)} fotos</span>` : ''}
            </div>
          </div>
        </a>
        <div class="card-actions">
          ${m.practico ? `<a class="chip primary" href="proyecto.html?m=${encodeURIComponent(m.id)}">Ver proyecto</a>` : ''}
          <a class="chip${m.practico ? '' : ' primary'}" href="viewer.html?m=${encodeURIComponent(m.id)}">Ver en 3D</a>
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
  if (m.calidad || m.reporte || m.ortofoto || m.practico) {
    const q = document.getElementById('p-calidad');
    const kp = (m.calidad?.indicadores || []).slice(0, 4);
    q.innerHTML = `
      ${kp.length ? `<div class="p-kpis">${kp.map((k) => `<div><b>${esc(k.valor)}</b><span>${esc(k.label)}</span></div>`).join('')}</div>` : ''}
      ${m.practico ? `<a class="btn" href="proyecto.html?m=${encodeURIComponent(m.id)}">Para qué sirve</a>` : ''}
      ${m.calidad ? `<a class="btn ghost" href="calidad.html?m=${encodeURIComponent(m.id)}">Calidad</a>` : ''}
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
  renderContacto(data.sitio?.contacto);
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
        <h3>${esc(e.nombre)}${e.estado ? ` <span class="eq-badge">${esc(e.estado)}</span>` : ''}</h3>
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

/* ---------------- Contacto ---------------- */
const ICON_WA = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';
const ICON_MAIL = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';

function waLink(c, texto) {
  if (!c?.whatsapp) return '';
  return `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(texto || c.mensaje_whatsapp || '')}`;
}
function contactButtons(c, texto) {
  if (!c || typeof c !== 'object') return '';
  return `
    ${c.whatsapp ? `<a class="btn wa" href="${esc(waLink(c, texto))}" target="_blank" rel="noopener">${ICON_WA} WhatsApp ${esc(c.telefono || '')}</a>` : ''}
    ${c.email ? `<a class="btn ghost" href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Consulta por relevamiento')}">${ICON_MAIL} ${esc(c.email)}</a>` : ''}`;
}
function renderContacto(c) {
  if (!c || typeof c !== 'object') return;
  const sec = document.getElementById('contacto');
  if (sec) {
    document.getElementById('ct-nombre').textContent = c.nombre || '';
    document.getElementById('ct-btns').innerHTML = contactButtons(c);
    sec.hidden = false;
  }
  const fc = document.getElementById('footer-contact');
  if (fc) fc.innerHTML = [c.telefono && `Tel./WhatsApp ${esc(c.telefono)}`, c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`].filter(Boolean).join(' · ');
  if (c.whatsapp && !document.getElementById('wa-float')) {
    const a = document.createElement('a');
    a.id = 'wa-float'; a.className = 'wa-float'; a.href = waLink(c); a.target = '_blank'; a.rel = 'noopener';
    a.title = 'Escribime por WhatsApp'; a.setAttribute('aria-label', 'WhatsApp');
    a.innerHTML = ICON_WA.replace('width="20" height="20"', 'width="28" height="28"');
    document.body.appendChild(a);
  }
}

/* ---------------- Servicios ---------------- */
function renderServicios(s) {
  const sec = document.getElementById('servicios');
  if (!sec || !s?.length) return;
  document.getElementById('sv-grid').innerHTML = s.map((x, i) => `
    <article class="sv-card"><span class="sv-n mono">${String(i + 1).padStart(2, '0')}</span>
      <h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></article>`).join('');
  sec.hidden = false;
}

/* ---------------- Página de proyecto ---------------- */
async function initProyecto() {
  document.getElementById('year').textContent = new Date().getFullYear();
  const root = document.getElementById('pj');
  const id = new URLSearchParams(location.search).get('m');
  let data;
  try { data = await loadData(); } catch (e) { root.innerHTML = '<p class="empty">No se pudo cargar la información.</p>'; return; }
  applySite(data.sitio);
  const c = data.sitio?.contacto;
  renderContacto(c);
  const m = data.modelos.find((x) => x.id === id);
  if (!m) { root.innerHTML = '<p class="empty">Proyecto no encontrado.<br><br><a class="btn" href="./#galeria">Volver a la galería</a></p>'; return; }
  document.title = `${m.titulo} · ${data.sitio?.titulo || ''}`;
  const P = m.practico || {};
  const enc = encodeURIComponent(m.id);
  const card = (x) => `<article class="pj-card"><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></article>`;
  root.innerHTML = `
    <section class="pj-hero">
      <div>
        <div class="eyebrow">${esc(m.ubicacion || 'Proyecto')}${m.fecha ? ' · ' + esc(fmtFecha(m.fecha)) : ''}</div>
        <h1>${esc(m.titulo)}</h1>
        ${P.intro ? `<p class="pj-intro">${esc(P.intro)}</p>` : ''}
        <div class="hero-actions">
          ${m.archivo ? `<a class="btn" href="viewer.html?m=${enc}">Ver en 3D</a>` : ''}
          ${m.ortofoto ? `<a class="btn ghost" href="mapa.html?m=${enc}">Medir sobre la foto aérea</a>` : ''}
        </div>
      </div>
      ${m.portada ? `<a class="pj-cover" href="viewer.html?m=${enc}"><img src="${esc(m.portada)}" alt="Vista del modelo 3D de ${esc(m.titulo)}"></a>` : ''}
    </section>

    ${m.resultado ? `<section class="pj-sec pj-res"><div class="eyebrow">Resultado</div><h2>${esc(m.resultado.titulo || 'Resultado')}</h2>
      <div class="q-kpis">${(m.resultado.valores || []).map((k) => `<div class="q-kpi"><b>${esc(k.valor)}</b><span>${esc(k.label)}</span>${k.nota ? `<small>${esc(k.nota)}</small>` : ''}</div>`).join('')}</div>
      <div class="pj-res-body">
        <div>
          ${m.resultado.texto ? `<p>${esc(m.resultado.texto)}</p>` : ''}
          ${m.resultado.advertencias?.length ? `<ul class="pj-warn">${m.resultado.advertencias.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
          <div class="dl">
            ${m.ortofoto ? `<a class="chip" href="mapa.html?m=${enc}">Ver el contorno en el mapa</a>` : ''}
            ${m.resultado.geojson ? `<a class="chip" href="${esc(m.resultado.geojson)}" download>Contorno y volumen (GeoJSON)</a>` : ''}
          </div>
        </div>
        ${m.resultado.imagen ? `<figure class="pj-res-fig"><img src="${esc(m.resultado.imagen)}" alt="${esc(m.resultado.imagen_alt || '')}" loading="lazy"><figcaption>${esc(m.resultado.imagen_alt || '')}</figcaption></figure>` : ''}
      </div>
    </section>` : ''}

    ${P.usos?.length ? `<section class="pj-sec"><div class="eyebrow">Para qué sirve</div><h2>Qué se puede hacer con este relevamiento</h2>
      <div class="pj-grid">${P.usos.map(card).join('')}</div></section>` : ''}

    ${P.entregables?.length ? `<section class="pj-sec"><div class="eyebrow">Qué se entrega</div><h2>Lo que recibe el cliente</h2>
      <div class="pj-grid four">${P.entregables.map(card).join('')}</div></section>` : ''}

    ${P.pasos?.length ? `<section class="pj-sec"><div class="eyebrow">Cómo se hizo</div><h2>En ${P.pasos.length} pasos</h2>
      <ol class="pj-steps">${P.pasos.map((s) => `<li><h3>${esc(s.titulo)}</h3><p>${esc(s.texto)}</p></li>`).join('')}</ol></section>` : ''}

    ${P.confiabilidad ? `<section class="pj-sec pj-trust"><div><div class="eyebrow">Qué tan confiable es</div>
      <p>${esc(P.confiabilidad)}</p></div>
      ${m.calidad ? `<a class="btn ghost" href="calidad.html?m=${enc}">Ver el detalle técnico</a>` : ''}</section>` : ''}

    ${m.descripcion ? `<section class="pj-sec pj-tech"><div class="eyebrow">Descripción técnica</div><p>${esc(m.descripcion)}</p></section>` : ''}

    ${c && typeof c === 'object' ? `<section class="pj-sec pj-cta">
      <div><h2>¿Necesitás un relevamiento así?</h2><p>Escribime y lo vemos. ${esc(c.nombre || '')}</p></div>
      <div class="pj-cta-btns">${contactButtons(c, `Hola Guillermo, vi el relevamiento "${m.titulo}" en tu web y quería consultarte por un trabajo similar.`)}</div>
    </section>` : ''}`;
}
