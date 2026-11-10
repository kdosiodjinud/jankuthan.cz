#!/usr/bin/env python3
"""Vygeneruje statické stránky produktů produkt-<id>.html z eshop.json a šablony eshop-detail.html.

Každá stránka má vlastní titulek, popisek, canonical a Open Graph značky (sociální sítě nespouštějí
JavaScript). Chybějící náhledový obrázek assets/eshop/<id>/og-<první fotka>.jpg (1200×630) vytvoří z první fotky
produktu pomocí ImageMagick. Stránky produktů, které už v katalogu nejsou, smaže.

Spouštěj z kořene repozitáře: python3 scripts/build-eshop-pages.py
"""
import html
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE_URL = 'https://jankuthan.cz/'
GENERIC_DESC = 'Detail produktu z e-shopu Jana Kuthana. Platba převodem předem, doprava Zásilkovnou za 40 Kč.'


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise SystemExit(f'Šablona eshop-detail.html neobsahuje přesně jednou: {old!r}')
    return text.replace(old, new)


def build_og_image(product):
    # Název podle první fotky: assets mají neměnnou cache, nová fotka tak dostane nový soubor.
    og = ROOT / 'assets' / 'eshop' / product['id'] / f"og-{pathlib.Path(product['images'][0]).stem}.jpg"
    if not og.exists():
        source = ROOT / product['images'][0]
        subprocess.run(['magick', str(source), '-resize', '1200x630^', '-gravity', 'center',
                        '-extent', '1200x630', '-strip', '-quality', '85', str(og)], check=True)
    return og.relative_to(ROOT).as_posix()


def build_page(template, product):
    attr = lambda value: html.escape(value, quote=True)
    url = f"{BASE_URL}produkt-{product['id']}.html"
    og_image = BASE_URL + build_og_image(product)
    page = template
    page = replace_once(page, '<!DOCTYPE html>\n',
                        '<!DOCTYPE html>\n<!-- Vygenerováno skriptem scripts/build-eshop-pages.py – neupravovat ručně, uprav eshop-detail.html nebo eshop.json. -->\n')
    page = replace_once(page, '<title>E-shop – Jan Kuthan</title>', f"<title>{html.escape(product['name'])} – Jan Kuthan</title>")
    page = replace_once(page, f'<meta name="description" content="{GENERIC_DESC}">', f'<meta name="description" content="{attr(product["summary"])}">')
    page = replace_once(page, '  <meta name="robots" content="max-image-preview:large">\n',
                        '  <meta name="robots" content="max-image-preview:large">\n'
                        f'  <link rel="canonical" href="{url}">\n'
                        f'  <meta property="og:url" content="{url}">\n')
    page = replace_once(page, '<meta property="og:title" content="E-shop – Jan Kuthan">', f'<meta property="og:title" content="{attr(product["name"])}">')
    page = replace_once(page, f'<meta property="og:description" content="{GENERIC_DESC}">', f'<meta property="og:description" content="{attr(product["summary"])}">')
    page = replace_once(page, '<meta property="og:image" content="https://jankuthan.cz/assets/og-image.png">',
                        f'<meta property="og:image" content="{og_image}">\n  <meta property="og:image:alt" content="{attr(product["name"])}">')
    page = replace_once(page, '<article id="eshop-detail" class="eshop-detail">',
                        f'<article id="eshop-detail" class="eshop-detail" data-product-id="{attr(product["id"])}">')
    return page


def main():
    template = (ROOT / 'eshop-detail.html').read_text(encoding='utf-8')
    products = json.loads((ROOT / 'eshop.json').read_text(encoding='utf-8'))['products']
    expected = set()
    for product in products:
        if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', product['id']):
            raise SystemExit(f"Neplatné id produktu: {product['id']!r}")
        target = ROOT / f"produkt-{product['id']}.html"
        target.write_text(build_page(template, product), encoding='utf-8')
        expected.add(target.name)
        print(f'OK {target.name}')
    for stale in ROOT.glob('produkt-*.html'):
        if stale.name not in expected:
            stale.unlink()
            print(f'Smazáno {stale.name}')


if __name__ == '__main__':
    main()
