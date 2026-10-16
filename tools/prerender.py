"""Genera versiones fijas (HTML ya armado) de las páginas, para buscadores y vistas previas.

Uso:  python3 tools/prerender.py
Requiere: playwright (con Chromium) y beautifulsoup4.

- casos/<id>/index.html     → una página por caso (desde proyecto.html)
- equipos/<id>/index.html   → una página por equipo con ficha propia (desde equipo.html)
- index.html                → deja escritas las secciones Casos, Servicios, Equipos y Contacto
- sitemap.xml               → se regenera con las direcciones limpias

El JavaScript del sitio sigue funcionando igual: al cargar, vuelve a armar el mismo contenido.
Correrlo cada vez que se cambie models/models.json.
"""
import asyncio, datetime, functools, http.server, json, os, re, threading
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://e4d.com.ar/'
PUERTO = 8799


def servidor():
    class Silencioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    h = functools.partial(Silencioso, directory=RAIZ)
    s = http.server.ThreadingHTTPServer(('127.0.0.1', PUERTO), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def limpiar(html, ident, base='../../'):
    soup = BeautifulSoup(html, 'html.parser')
    for sel in ('#lightbox', '#wa-float'):
        for el in soup.select(sel):
            el.decompose()
    # <base> para que las rutas relativas sigan funcionando desde la subcarpeta
    if not soup.head.find('base'):
        b = soup.new_tag('base', href=base)
        soup.head.find('meta').insert_after(b)
    soup.body['data-id'] = ident
    # quitar el parámetro anti-caché que agrega loadData y estilos inline del navegador
    return '<!doctype html>\n' + str(soup.html) + '\n'


async def capturar(pg, url):
    await pg.goto(url)
    await pg.wait_for_function("!document.querySelector('#pj .empty')", timeout=15000)
    await pg.wait_for_timeout(400)
    return await pg.content()


async def main():
    srv = servidor()
    d = json.load(open(os.path.join(RAIZ, 'models/models.json'), encoding='utf-8'))
    L = f'http://127.0.0.1:{PUERTO}/'
    hechos = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1360, 'height': 900})
        for m in d['modelos']:
            if not m.get('practico'):
                continue
            html = await capturar(pg, f"{L}proyecto.html?m={m['id']}&prerender=1")
            out = os.path.join(RAIZ, 'casos', m['id'])
            os.makedirs(out, exist_ok=True)
            open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(limpiar(html, m['id']))
            hechos.append(f"casos/{m['id']}/")
        for e in d.get('equipos', []):
            if not (e.get('pagina') and e.get('id')):
                continue
            html = await capturar(pg, f"{L}equipo.html?e={e['id']}&prerender=1")
            out = os.path.join(RAIZ, 'equipos', e['id'])
            os.makedirs(out, exist_ok=True)
            open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(limpiar(html, e['id']))
            hechos.append(f"equipos/{e['id']}/")

        # Portada: dejar escritas las secciones que arma el JavaScript
        await pg.goto(L)
        await pg.wait_for_function("document.querySelectorAll('#grid .card').length > 0", timeout=15000)
        await pg.wait_for_timeout(400)
        vivo = BeautifulSoup(await pg.content(), 'html.parser')
        await b.close()
    srv.shutdown()

    ruta = os.path.join(RAIZ, 'index.html')
    fuente = open(ruta, encoding='utf-8').read()
    soup = BeautifulSoup(fuente, 'html.parser')
    for ident in ('grid', 'sv-grid', 'eq-grid', 'ct-btns', 'ct-nombre', 'stat-count', 'stat-photos', 'stat-last'):
        dst, src = soup.find(id=ident), vivo.find(id=ident)
        if dst is not None and src is not None:
            dst.clear()
            for ch in list(src.contents):
                dst.append(ch)
    for ident in ('servicios', 'equipos', 'contacto'):
        el = soup.find(id=ident)
        if el is not None and el.has_attr('hidden'):
            del el['hidden']
    lead = soup.select_one('[data-site="bienvenida"]')
    if lead is not None and not lead.get_text(strip=True):
        lead.string = d['sitio'].get('bienvenida', '')
    open(ruta, 'w', encoding='utf-8').write('<!doctype html>\n' + str(soup.html) + '\n')
    hechos.append('index.html (secciones)')

    # Sitemap con direcciones limpias
    hoy = datetime.date.today().isoformat()
    urls = [(BASE, '1.0')] + [(BASE + h, '0.8') for h in hechos if h.endswith('/')]
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    xml += [f'  <url><loc>{u}</loc><lastmod>{hoy}</lastmod><priority>{pr}</priority></url>' for u, pr in urls]
    xml.append('</urlset>')
    open(os.path.join(RAIZ, 'sitemap.xml'), 'w').write('\n'.join(xml) + '\n')
    print('Generado:', ', '.join(hechos), f'· sitemap con {len(urls)} URLs')


asyncio.run(main())
