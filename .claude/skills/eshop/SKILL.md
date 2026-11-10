---
name: eshop
description: Správa e-shopu na jankuthan.cz (/eshop) – přidání, úprava a odebrání produktu. Použij, když uživatel chce přidat produkt do e-shopu (i z odkazu na Aukro nebo jiný portál), změnit cenu, popis nebo fotky, nebo produkt odebrat.
---

# E-shop na jankuthan.cz

## Jak to funguje

- `eshop.html` (URL `/eshop`) – přehled produktů s textovým vyhledáváním.
- `eshop/<id>.html` – statická stránka detailu produktu, **generovaná** skriptem `python3 scripts/build-eshop-pages.py` ze šablony `eshop-detail.html` a `eshop.json` (vlastní titulek, popisek, canonical a Open Graph s náhledem `assets/eshop/<id>/og-<první fotka>.jpg` 1200×630 z první fotky – sociální sítě nespouštějí JavaScript). Ručně ji neupravuj; změny dělej v šabloně nebo v datech a skript spusť znovu. Stará adresa `eshop-detail.html?id=<id>` přesměruje na novou. Na stránce je galerie a objednávkový formulář (počet kusů, kontakt, výdejní místo Zásilkovny přes oficiální widget `widget.packeta.com`, poznámka). Platba je převodem předem – platební údaje a cenu dopravy posílá majitel ručně.
- Objednávka se odesílá POSTem (JSON) na n8n webhook `https://n8n.reddwarf.cloud/webhook/eshop-order` (workflow „eshop-objednavka (jankuthan.cz)“). n8n si cenu dohledá v živém `eshop.json`, validuje vstup a pošle e-mail na `jankuthan@email.cz` (Reply-To = zákazník). Zákazníkovi se nic neposílá. Webhook povoluje CORS jen pro `https://jankuthan.cz`, proto odeslání lokálně neprojde.
- `obchodni-podminky.html` (vč. reklamací a vzorového formuláře pro odstoupení) a `ochrana-osobnich-udaju.html` – právní dokumenty e-shopu, odkazované z patičky e-shopu a ze souhlasu ve formuláři. Formulář vyžaduje zaškrtnutí souhlasu s obchodními podmínkami (kontroluje i n8n). Text odesílacího tlačítka „Objednávka zavazující k platbě“ je vyžadován zákonem – neměnit na „Odeslat“ apod.
- PDF obchodních podmínek je v `assets/eshop/obchodni-podminky-<datum účinnosti>.pdf` (přikládá se k e-mailu s fakturou). Při změně podmínek: změň datum účinnosti v textu, vygeneruj nové PDF s novým názvem (absolutní odkazy na https://jankuthan.cz/, tiskový styl skryje navigaci) a uprav odkaz na stránce; staré PDF nemaž, platí pro dřívější objednávky.
- CSP webu (v CloudFront funkci) povoluje widget Zásilkovny a n8n. Přidání dalšího externího zdroje vyžaduje úpravu CSP.
- `eshop.json` – **jediný zdroj dat**. Obě stránky ho načítají skriptem `js/eshop.js` a vykreslují přes `textContent` (žádné `innerHTML`). Pole `shipping` je cena dopravy v Kč za objednávku (používá ji formulář i n8n).
- `assets/eshop/<id>/` – fotky produktu (WebP).
- `css/eshop.css` – styly jen pro e-shop.

E-shop je veřejný: na homepage na něj vede tlačítko „Prodávám“ a je v `sitemap.xml`. Každý produkt má v `sitemap.xml` vlastní záznam `https://jankuthan.cz/eshop/<id>.html` – při přidání produktu ho doplň, při odebrání smaž, při změně uprav `lastmod`.

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
   Cena je celé číslo v Kč. `features` může být prázdné pole. Volitelné pole `"badge"` (např. `"Nové"`) zobrazí štítek v rohu fotky v přehledu i v detailu; bez něj se štítek nezobrazí. Texty piš česky se správnou diakritikou, bez HTML.
5. **Stránka produktu:** spusť `python3 scripts/build-eshop-pages.py` (vytvoří `eshop/<id>.html` a náhled `og-<první fotka>.jpg`, pokud chybí; při odebrání produktu jeho stránku smaže). Náhled si prohlédni; po výměně první fotky starý `og-*.jpg` smaž – ořez je na střed fotky. Doplň produkt do `sitemap.xml`.
6. **Ověření** (povinné): spusť lokální server (`python3 -m http.server`) a v prohlížeči zkontroluj přehled, vyhledání produktu a jeho detail včetně galerie. Konzole musí být bez chyb. Validitu JSON ověř `python3 -m json.tool eshop.json`.

## Úprava a odebrání

- Úprava textu nebo ceny = úprava záznamu v `eshop.json`.
- **Fotky nikdy nepřepisuj pod stejným názvem.** Vše v `/assets/` má na CDN roční neměnnou cache, takže by se nová fotka nezobrazila. Novou fotku ulož pod novým číslem a uprav `images`. Nepoužívané soubory smaž.
- Odebrání = smazat záznam z `eshop.json` a adresář `assets/eshop/<id>/`.
- Při změně `css/eshop.css` nebo `js/eshop.js` zvyš parametr `?v=` v obou HTML stránkách e-shopu (stejný důvod – cache).

## Nasazení

Řiď se globálními pravidly uživatele pro commit (GPG odemknutí, pouze subject, push dělá uživatel). Po pushi počkej na build GitHub Pages a invaliduj cache CloudFrontu (`/*`), jinak se změna na webu neprojeví.

**Cache – na co myslet:**
- CloudFront: HTML a `eshop.json` drží max. 10 min, `/assets/` a `/css/` rok (neměnné) → po pushi vždy invalidace `/*`.
- Prohlížeč: HTML a `eshop.json` mají `max-age=600`. `js/eshop.js` proto stahuje katalog s `cache: 'no-cache'` (vždy se ověří ETagem) – tuto volbu neodstraňuj, jinak návštěvník až 10 minut nevidí nové produkty v přehledu.
- CSS/JS se mění jen se zvýšením `?v=` v `eshop.html` a `eshop-detail.html` a následným spuštěním generátoru (přenese verzi do `eshop/<id>.html`).

**Ověření po nasazení (povinné, nestačí `curl`):**
1. `curl https://jankuthan.cz/eshop.json` obsahuje nový/změněný produkt.
2. V prohlížeči (Chrome DevTools) otevři **https://jankuthan.cz/eshop.html** a zkontroluj, že **přehled** produkt zobrazuje – ověř počet karet a názvy přes `document.querySelectorAll('.eshop-card h2')`. Pokud prohlížeč dříve stránku navštívil, načti ji s vynechanou cache.
3. Otevři detail `https://jankuthan.cz/eshop/<id>.html` (galerie, cena, formulář) a zkontroluj `og:image`.
4. Ověř, že n8n produkt zná, bez odeslání e-mailu: POST na webhook bez `terms` musí vrátit chybu o souhlasu s obchodními podmínkami (ne „Produkt neexistuje“).
5. Uživateli řekni, že pokud stránku měl otevřenou těsně před nasazením, může vidět starou verzi až 10 minut (Cmd+Shift+R).
