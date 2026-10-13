/* Galería de modelos 3D — lógica compartida por index.html y viewer.html.
   Los datos salen de models/models.json: para publicar un modelo nuevo
   solo hay que agregar su entrada ahí (ver README). */

const DATA_URL = 'models/models.json';

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
    hm.src = ultimo.archivo;
    if (ultimo.portada) hm.poster = ultimo.portada;
    document.getElementById('hero-tag').textContent = ultimo.titulo;
    heroOpen.href = 'viewer.html?m=' + encodeURIComponent(ultimo.id);
  } else {
    heroOpen.hidden = true;
  }

  const render = (lista) => {
    if (!lista.length) {
      grid.innerHTML = '<div class="empty">No hay modelos que coincidan.</div>';
      return;
    }
    grid.innerHTML = lista.map((m) => `
      <a class="card" href="viewer.html?m=${encodeURIComponent(m.id)}">
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
      </a>`).join('');
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

  if (m.portada) mv.poster = m.portada;
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
