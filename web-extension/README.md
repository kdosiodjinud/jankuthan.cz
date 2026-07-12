# web-extension – demo integrace chatbota

Statická ukázka, jak se AI chatbot vysokeskoly.cz vkládá do libovolné webové stránky
jediným snippetem. Widget je připojený na živý n8n endpoint (RAG nad naembedovanými
články + jazykový model).

## Soubory
- `index.html` – demo stránka s integrovaným snippetem.
- `widget.js` – samostatný chat widget (bez závislostí): plovoucí tlačítko + panel.

## Spuštění lokálně
Widget používá `fetch` na vzdálený endpoint, takže stačí jakýkoli statický server
(otevření přes `file://` také funguje, ale server je čistší):

```bash
python3 -m http.server 8123 --directory web-extension
# → http://localhost:8123
```

Otevři `http://localhost:8123`, klikni na 💬 vpravo dole a zeptej se např.
*„Kolik stojí život vysokoškoláka?“*.

## Integrace do cizí stránky
```html
<script src="widget.js"
        data-endpoint="https://n8n.reddwarf.cloud/webhook/chat"
        data-title="Poradce VŠ"
        data-tenant="cz"
        defer></script>
```

Atributy: `data-endpoint` (URL webhooku), `data-title`, `data-tenant` (lokalita, výchozí `cz`),
`data-welcome`, `data-allowed-host` (doména povolená pro odkazy v kartách; výchozí `vysokeskoly.cz`).

## Ovládání panelu
V hlavičce panelu jsou tři tlačítka:
- **Kopírovat ID konverzace** (ikona kopírování, SVG – vykreslí se nezávisle na fontu) –
  zkopíruje aktuální `sessionId` do schránky (pro dohledání konverzace v admin API historie).
  Respektuje reset (po restartu chatu kopíruje nové ID). Používá `navigator.clipboard`
  s fallbackem pro nezabezpečený kontext; po zkopírování krátce ukáže ✓.
- **↻ Začít znovu** – vygeneruje nové `sessionId` (backendová paměť i historie začnou od nuly).
- **× Zavřít.**

## Backend (n8n)
- **Produkční chat** workflow **`vysokeskoly`** (`WEUrgimn48MCbqtj`), webhook `POST /chat`.
- Kontrakt: request `{ "message": "...", "sessionId": "...", "tenant": "cz" }` →
  response `{ reply, type, cards[], suggestions[], apiVersion }`. Tenant se produkčně bere
  z `Origin`/`Referer`; `tenant` v těle je fallback pro embed mimo doménu.
- Karty nesou složené `url` (jen doména lokality), `title`, `snippet`, `label`.
- **Historie konverzací** se loguje do Postgres (`vysokeskoly_cz.vs_chat_messages`).
  Čtení přes samostatný admin workflow **`vysokeskoly – historie chatu`** (`RxLBqBpMyrMaBm9D`),
  webhook `GET /chat-history?sessionId=…` s **Basic Auth** (viz `chat-workflow.md`).
- ⚠️ Endpoint je aktivní a bez rate-limitu; každý dotaz spouští placené LLM volání. Pro veřejné
  nasazení patří před n8n gateway (rate limit) + reálný streaming.

## Bezpečnost widgetu
- Text odpovědí se vkládá přes `textContent` (žádné `innerHTML` → ochrana proti XSS).
- Odkazy v kartách se propouštějí jen na doménu `vysokeskoly.cz` a otevírají s
  `rel="noopener noreferrer"`.
