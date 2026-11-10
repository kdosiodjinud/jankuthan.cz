---
name: eshop
description: Správa skrytého e-shopu na jankuthan.cz (/eshop) – přidání, úprava a odebrání produktu. Použij, když uživatel chce přidat produkt do e-shopu (i z odkazu na Aukro nebo jiný portál), změnit cenu, popis nebo fotky, nebo produkt odebrat.
---

# E-shop na jankuthan.cz

## Jak to funguje

- `eshop.html` (URL `/eshop`) – přehled produktů s textovým vyhledáváním.
- `eshop-detail.html?id=<id>` – detail produktu, galerie a tlačítko „Mám zájem“ (mailto s názvem produktu v předmětu).
- `eshop.json` – **jediný zdroj dat**. Obě stránky ho načítají skriptem `js/eshop.js` a vykreslují přes `textContent` (žádné `innerHTML`).
- `assets/eshop/<id>/` – fotky produktu (WebP).
- `css/eshop.css` – styly jen pro e-shop.

E-shop je **skrytý**: v menu ani nikde na webu na něj nevede odkaz, stránky mají `noindex, nofollow` a NESMÍ se objevit v `sitemap.xml`, `llms.txt`, `robots.txt` ani strukturovaných datech. Tohle při žádné úpravě neporušuj.

Produkty jsou statické kopie – nejsou svázané s žádným portálem. Na zdrojový inzerát (Aukro apod.) se z webu neodkazuje.

## Přidání produktu

1. **Podklady.** Pokud uživatel dá odkaz na inzerát, stáhni stránku (`curl` do vlastního adresáře ve scratchpadu) a vytáhni název, cenu, celý popis, klíčové vlastnosti a URL fotek v plné velikosti. Chybějící údaje si od uživatele vyžádej, nic nedomýšlej.
2. **ID** = slug z názvu: malá písmena, bez diakritiky, slova oddělená `-` (např. `velux-025116-t-g2`). Musí být unikátní v `eshop.json`.
3. **Fotky** ulož do `assets/eshop/<id>/1.webp`, `2.webp`, … První fotka je náhled v přehledu.
   ```
   magick <vstup> -auto-orient -strip -resize 1200x -quality 80 assets/eshop/<id>/<n>.webp
   ```
   `-strip` je povinný (odstraní EXIF včetně GPS). Fotky si před použitím prohlédni.
4. **Záznam** přidej do pole `products` v `eshop.json`:
   ```json
   {
     "id": "slug",
     "name": "Název produktu",
     "price": 300,
     "summary": "Jedna až dvě věty do přehledu.",
     "description": ["Odstavec 1", "Odstavec 2"],
     "features": ["vlastnost 1", "vlastnost 2"],
     "images": ["assets/eshop/slug/1.webp", "assets/eshop/slug/2.webp"]
   }
   ```
   Cena je celé číslo v Kč. `features` může být prázdné pole. Texty piš česky se správnou diakritikou, bez HTML.
5. **Ověření** (povinné): spusť lokální server (`python3 -m http.server`) a v prohlížeči zkontroluj přehled, vyhledání produktu a jeho detail včetně galerie. Konzole musí být bez chyb. Validitu JSON ověř `python3 -m json.tool eshop.json`.

## Úprava a odebrání

- Úprava textu nebo ceny = úprava záznamu v `eshop.json`.
- **Fotky nikdy nepřepisuj pod stejným názvem.** Vše v `/assets/` má na CDN roční neměnnou cache, takže by se nová fotka nezobrazila. Novou fotku ulož pod novým číslem a uprav `images`. Nepoužívané soubory smaž.
- Odebrání = smazat záznam z `eshop.json` a adresář `assets/eshop/<id>/`.
- Při změně `css/eshop.css` nebo `js/eshop.js` zvyš parametr `?v=` v obou HTML stránkách e-shopu (stejný důvod – cache).

## Nasazení

Řiď se globálními pravidly uživatele pro commit (GPG odemknutí, pouze subject, push dělá uživatel). Po pushi počkej na build GitHub Pages a invaliduj cache CloudFrontu (`/*`), jinak se změna na webu neprojeví. Nakonec ověř produkt na https://jankuthan.cz/eshop.
