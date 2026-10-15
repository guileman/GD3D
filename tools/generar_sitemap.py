"""Genera sitemap.xml a partir de models/models.json. Uso: python3 tools/generar_sitemap.py"""
import json, datetime, os
B = 'https://e4d.com.ar/'
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(raiz, 'models/models.json'), encoding='utf-8'))
hoy = datetime.date.today().isoformat()
urls = [(B, hoy, '1.0')]
for m in d['modelos']:
    i = m['id']
    if m.get('practico'): urls.append((f'{B}proyecto.html?m={i}', hoy, '0.8'))
    urls.append((f'{B}viewer.html?m={i}', hoy, '0.6'))
    if m.get('ortofoto'): urls.append((f'{B}mapa.html?m={i}', hoy, '0.5'))
    if m.get('calidad'): urls.append((f'{B}calidad.html?m={i}', hoy, '0.4'))
for e in d.get('equipos', []):
    if e.get('pagina') and e.get('id'): urls.append((f'{B}equipo.html?e={e["id"]}', hoy, '0.6'))
xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
xml += [f'  <url><loc>{u.replace("&", "&amp;")}</loc><lastmod>{f}</lastmod><priority>{p}</priority></url>' for u, f, p in urls]
xml.append('</urlset>')
open(os.path.join(raiz, 'sitemap.xml'), 'w').write('\n'.join(xml) + '\n')
print(len(urls), 'URLs')
