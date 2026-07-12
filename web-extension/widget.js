/*
 * vysokeskoly.cz – embeddable chat widget (DEMO)
 * -------------------------------------------------
 * Samostatný, závislostmi nezatížený widget. Vloží na stránku plovoucí
 * tlačítko + chat panel a komunikuje s n8n webhookem (RAG + LLM).
 *
 * Použití (snippet v HTML):
 *   <script src="widget.js"
 *           data-endpoint="https://n8n.reddwarf.cloud/webhook/chat"
 *           data-title="Poradce VŠ"
 *           defer></script>
 *
 * Bezpečnost:
 *  - text odpovědí se vkládá přes textContent (žádné innerHTML → žádný XSS),
 *  - odkazy v kartách se propouštějí jen na doménu vysokeskoly.cz,
 *  - odkazy se otevírají s rel="noopener noreferrer".
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var CFG = {
    endpoint: (script && script.getAttribute("data-endpoint")) ||
              "https://n8n.reddwarf.cloud/webhook/chat",
    title: (script && script.getAttribute("data-title")) || "Poradce VŠ",
    // Tenant/lokalita – produkčně se bere z Origin/Referer, tady jako fallback pro embed mimo doménu.
    tenant: (script && script.getAttribute("data-tenant")) || "cz",
    // Povolené hostitele pro odkazy v kartách (doménové omezení jako guardrail).
    allowedHostSuffix: (script && script.getAttribute("data-allowed-host")) || "vysokeskoly.cz",
    welcome: (script && script.getAttribute("data-welcome")) ||
             "Ahoj! 👋 Poradím ti s výběrem vysoké školy i se studiem. Na co se chceš zeptat?"
  };
  // Feedback endpoint – odvozen z chat endpointu (/chat → /chat-feedback), lze přepsat atributem.
  CFG.feedbackEndpoint = (script && script.getAttribute("data-feedback-endpoint")) ||
                         CFG.endpoint.replace(/\/chat\/?$/, "/chat-feedback");
  // Režim zobrazení: "inline" = chat vložený přímo do stránky (otevřený, bez plovoucího tlačítka,
  // větší prostor; křížek místo zavření resetuje). Jinak "float" = plovoucí bublina (výchozí).
  // data-target = CSS selektor kontejneru, do kterého se inline chat vloží.
  CFG.target = (script && script.getAttribute("data-target")) || null;
  CFG.mode = (script && script.getAttribute("data-mode")) || (CFG.target ? "inline" : "float");

  // Session ID pro tuto konverzaci (paměť se klíčuje tenant:session).
  // Reset chatu vygeneruje nové → backendová paměť začne od nuly.
  function newSessionId() {
    return "w-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  var SESSION_ID = newSessionId();

  var SUGGESTIONS = [
    "Kolik stojí život vysokoškoláka?",
    "Jak si vybrat vysokou školu?",
    "Jak využít léto pro osobní rozvoj?"
  ];

  /* ---------- styly (barvy dle brandu vysokeskoly.cz) ----------
     primary teal #008888 · tmavší teal (hover) #007b7b · odkazy #00a0c0
     tmavý text navy #2d4156 · font Open Sans */
  var CSS = "\
  .vs-launcher{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border:none;border-radius:50%;\
    background:linear-gradient(135deg,#008888,#007b7b);color:#fff;font-size:26px;cursor:pointer;z-index:2147483000;\
    box-shadow:0 6px 20px rgba(0,136,136,.4);transition:transform .15s ease}\
  .vs-launcher:hover{transform:scale(1.06)}\
  .vs-panel{position:fixed;right:20px;bottom:92px;width:370px;max-width:calc(100vw - 40px);height:560px;\
    max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.22);\
    display:none;flex-direction:column;overflow:hidden;z-index:2147483000;font-family:'Open Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}\
  .vs-panel.vs-open{display:flex}\
  .vs-panel.vs-inline{position:static;right:auto;bottom:auto;width:100%;max-width:100%;height:100%;max-height:none;border-radius:12px;box-shadow:0 2px 14px rgba(0,0,0,.07)}\
  .vs-panel.vs-inline .vs-msgs{padding:22px 24px;gap:12px}\
  .vs-panel.vs-inline .vs-msg{max-width:74%;font-size:15px;padding:11px 15px}\
  .vs-panel.vs-inline .vs-cards{max-width:74%}\
  .vs-panel.vs-inline .vs-input{padding:14px 16px}\
  .vs-panel.vs-inline .vs-input textarea{max-height:160px;font-size:15px;padding:11px 13px}\
  .vs-panel.vs-inline .vs-sugs{padding:0 16px 12px}\
  .vs-header{background:#008888;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}\
  .vs-header b{font-size:15px;font-weight:700}\
  .vs-header small{display:block;font-size:11px;opacity:.85;font-weight:400}\
  .vs-actions{display:flex;align-items:center;gap:2px}\
  .vs-iconbtn{background:none;border:none;color:#fff;line-height:1;cursor:pointer;opacity:.9;padding:4px 6px;border-radius:8px;transition:background .1s,opacity .1s}\
  .vs-iconbtn:hover{opacity:1;background:rgba(255,255,255,.15)}\
  .vs-copy svg{display:block}\
  .vs-copy.vs-copied svg{display:none}\
  .vs-copy.vs-copied::after{content:'✓';font-size:15px;line-height:1}\
  .vs-reset{font-size:18px}\
  .vs-close{font-size:22px}\
  .vs-msgs{flex:1;overflow-y:auto;padding:16px;background:#f2f6f6;display:flex;flex-direction:column;gap:10px}\
  .vs-msg{max-width:85%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}\
  .vs-bot{align-self:flex-start;background:#fff;color:#2d4156;border:1px solid #e0e8ea;border-bottom-left-radius:4px}\
  .vs-user{align-self:flex-end;background:#008888;color:#fff;border-bottom-right-radius:4px}\
  .vs-cards{align-self:flex-start;display:flex;flex-direction:column;gap:6px;max-width:85%}\
  .vs-card{display:block;padding:9px 12px;background:#fff;border:1px solid #d8e0e6;border-left:3px solid #008888;border-radius:10px;\
    text-decoration:none;color:#00a0c0;font-size:13px;font-weight:600;transition:background .1s}\
  .vs-card:hover{background:#e9f4f4}\
  .vs-card span{display:block;color:#667481;font-size:11px;font-weight:400;margin-top:2px}\
  .vs-sugs{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;background:#f2f6f6}\
  .vs-sug{border:1px solid #b3dede;background:#fff;color:#008888;border-radius:16px;padding:6px 11px;font-size:12.5px;font-weight:600;cursor:pointer}\
  .vs-sug:hover{background:#e9f4f4}\
  .vs-input{display:flex;gap:8px;padding:12px;border-top:1px solid #e0e8ea;background:#fff}\
  .vs-input textarea{flex:1;resize:none;border:1px solid #d8e0e6;border-radius:10px;padding:9px 11px;font-size:14px;\
    font-family:inherit;max-height:90px;outline:none}\
  .vs-input textarea:focus{border-color:#008888}\
  .vs-send{border:none;background:#008888;color:#fff;border-radius:10px;padding:0 15px;font-size:15px;cursor:pointer;transition:background .1s}\
  .vs-send:hover:not(:disabled){background:#007b7b}\
  .vs-send:disabled{opacity:.5;cursor:default}\
  .vs-typing{align-self:flex-start;color:#667481;font-size:13px;font-style:italic;padding:4px 4px}\
  .vs-foot{font-size:10.5px;color:#919ea6;text-align:center;padding:6px;background:#fff}\
  .vs-fb{position:absolute;inset:0;background:rgba(255,255,255,.97);display:none;flex-direction:column;align-items:center;justify-content:center;padding:24px;z-index:5;text-align:center}\
  .vs-fb.vs-fb-open{display:flex}\
  .vs-fb-title{font-size:16px;font-weight:700;color:#2d4156;margin-bottom:4px}\
  .vs-fb-sub{font-size:12.5px;color:#667481;margin-bottom:16px}\
  .vs-fb-stars{display:flex;gap:6px;margin-bottom:16px}\
  .vs-fb-star{background:none;border:none;font-size:34px;line-height:1;cursor:pointer;color:#d8e0e6;transition:color .1s,transform .1s;padding:0}\
  .vs-fb-star:hover{transform:scale(1.12)}\
  .vs-fb-star.on{color:#f80}\
  .vs-fb-comment{width:100%;max-width:280px;resize:none;border:1px solid #d8e0e6;border-radius:10px;padding:9px 11px;font-size:13px;font-family:inherit;height:64px;outline:none;margin-bottom:14px}\
  .vs-fb-comment:focus{border-color:#008888}\
  .vs-fb-actions{display:flex;gap:8px;align-items:center}\
  .vs-fb-skip{background:none;border:none;color:#667481;font-size:13px;cursor:pointer;padding:9px 14px}\
  .vs-fb-skip:hover{color:#2d4156}\
  .vs-fb-send{background:#008888;color:#fff;border:none;border-radius:10px;padding:9px 18px;font-size:14px;font-weight:600;cursor:pointer;transition:background .1s}\
  .vs-fb-send:disabled{opacity:.5;cursor:default}\
  .vs-fb-send:hover:not(:disabled){background:#007b7b}\
  .vs-fb-done{font-size:15px;color:#008888;font-weight:700}";

  /* ---------- utils ---------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt; // textContent = bezpečné proti XSS
    return e;
  }

  // SVG element přes DOM (žádné innerHTML) – statická autorská ikona, nezávislá na fontu.
  function svgEl(tag, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function copyIcon() {
    var svg = svgEl("svg", { viewBox: "0 0 24 24", width: "15", height: "15", fill: "none",
      stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
    svg.appendChild(svgEl("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2" }));
    svg.appendChild(svgEl("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }));
    return svg;
  }

  function safeUrl(raw) {
    try {
      var u = new URL(raw, "https://" + CFG.allowedHostSuffix);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      var host = u.hostname.toLowerCase();
      if (host === CFG.allowedHostSuffix || host.endsWith("." + CFG.allowedHostSuffix)) {
        // vynucení https na výsledném odkazu
        u.protocol = "https:";
        return u.href;
      }
      return null;
    } catch (e) { return null; }
  }

  /* ---------- build DOM ---------- */
  // CSS vkládáme jen jednou i při více instancích (float + inline na téže stránce).
  if (!document.getElementById("vs-widget-css")) {
    var style = el("style"); style.id = "vs-widget-css"; style.textContent = CSS;
    document.head.appendChild(style);
  }

  var launcher = el("button", "vs-launcher"); launcher.textContent = "💬";
  launcher.setAttribute("aria-label", "Otevřít chat s poradcem");

  var panel = el("div", "vs-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", CFG.title);

  var header = el("div", "vs-header");
  var hTitle = el("div");
  hTitle.appendChild(el("b", null, CFG.title));
  hTitle.appendChild(el("small", null, "vysokeskoly.cz · AI asistent"));
  var copyBtn = el("button", "vs-iconbtn vs-copy");
  copyBtn.appendChild(copyIcon());
  copyBtn.setAttribute("aria-label", "Zkopírovat ID konverzace");
  copyBtn.setAttribute("title", "Kopírovat ID konverzace");
  var resetBtn = el("button", "vs-iconbtn vs-reset"); resetBtn.textContent = "↻";
  resetBtn.setAttribute("aria-label", "Začít konverzaci znovu");
  resetBtn.setAttribute("title", "Začít znovu");
  var closeBtn = el("button", "vs-iconbtn vs-close"); closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Zavřít chat");
  var actions = el("div", "vs-actions");
  actions.appendChild(copyBtn); actions.appendChild(resetBtn); actions.appendChild(closeBtn);
  header.appendChild(hTitle); header.appendChild(actions);

  var msgs = el("div", "vs-msgs");
  msgs.setAttribute("aria-live", "polite");

  var sugs = el("div", "vs-sugs");

  var inputRow = el("div", "vs-input");
  var textarea = el("textarea");
  textarea.rows = 1;
  textarea.placeholder = "Napiš dotaz…";
  textarea.setAttribute("aria-label", "Text dotazu");
  var sendBtn = el("button", "vs-send"); sendBtn.textContent = "➤";
  sendBtn.setAttribute("aria-label", "Odeslat");
  inputRow.appendChild(textarea); inputRow.appendChild(sendBtn);

  var foot = el("div", "vs-foot", "Odpovídá AI · může se mýlit · ověř si důležité údaje");

  // Feedback popup (overlay přes panel) – zobrazí se při zavření po proběhlé konverzaci.
  var fbBox = el("div", "vs-fb");
  fbBox.setAttribute("role", "dialog");
  fbBox.setAttribute("aria-label", "Hodnocení konverzace");
  var fbTitle = el("div", "vs-fb-title", "Jak jsi byl(a) spokojen(á)?");
  var fbSub = el("div", "vs-fb-sub", "Ohodnoť konverzaci s poradcem.");
  var fbStars = el("div", "vs-fb-stars");
  fbStars.setAttribute("role", "radiogroup");
  fbStars.setAttribute("aria-label", "Počet hvězdiček");
  var starEls = [];
  for (var si = 1; si <= 5; si++) {
    var st = el("button", "vs-fb-star"); st.textContent = "★";
    st.setAttribute("aria-label", si + " z 5");
    st.setAttribute("data-val", String(si));
    fbStars.appendChild(st); starEls.push(st);
  }
  var fbComment = el("textarea", "vs-fb-comment");
  fbComment.placeholder = "Co bychom mohli zlepšit? (nepovinné)";
  fbComment.setAttribute("aria-label", "Komentář k hodnocení");
  var fbActions = el("div", "vs-fb-actions");
  var fbSkip = el("button", "vs-fb-skip", "Přeskočit");
  var fbSend = el("button", "vs-fb-send", "Odeslat"); fbSend.disabled = true;
  fbActions.appendChild(fbSkip); fbActions.appendChild(fbSend);
  fbBox.appendChild(fbTitle); fbBox.appendChild(fbSub); fbBox.appendChild(fbStars);
  fbBox.appendChild(fbComment); fbBox.appendChild(fbActions);

  panel.appendChild(header);
  panel.appendChild(msgs);
  panel.appendChild(sugs);
  panel.appendChild(inputRow);
  panel.appendChild(foot);
  panel.appendChild(fbBox);

  if (CFG.mode === "inline") {
    var mount = CFG.target ? document.querySelector(CFG.target) : null;
    if (!mount) {
      mount = document.body;
      if (window.console) console.warn("[vs-widget] inline cíl '" + CFG.target + "' nenalezen, vkládám do body");
    }
    panel.classList.add("vs-inline");
    mount.appendChild(panel);
    // v inline režimu není plovoucí tlačítko
  } else {
    document.body.appendChild(launcher);
    document.body.appendChild(panel);
  }

  /* ---------- chování ---------- */
  var busy = false;
  var started = false;
  var convGen = 0; // generace konverzace – reset ji zvýší, aby doběhlý starý fetch nespadl do nového chatu
  var userMsgCount = 0;    // počet dotazů uživatele (feedback nabídneme jen po reálné konverzaci)
  var feedbackGiven = false; // v této session už byl feedback odeslán/přeskočen → neptat se znovu
  var fbRating = 0;        // aktuálně vybraný počet hvězdiček ve feedback popupu
  var fbAfter = null;      // akce provedená po feedbacku (zavřít panel / resetovat chat)

  function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }

  function addMsg(text, who) {
    var m = el("div", "vs-msg " + (who === "user" ? "vs-user" : "vs-bot"), text);
    msgs.appendChild(m); scrollDown(); return m;
  }

  function addCards(cards) {
    if (!cards || !cards.length) return;
    var wrap = el("div", "vs-cards");
    var seen = {}; // dedup jen v rámci JEDNÉ odpovědi (napříč konverzací se odkaz může zopakovat)
    cards.forEach(function (c) {
      var href = safeUrl(c.url || "");
      if (!href || seen[href]) return;
      seen[href] = true;
      var a = el("a", "vs-card");
      a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.appendChild(document.createTextNode("📄 " + (c.title || "Článek")));
      a.appendChild(el("span", null, href.replace(/^https?:\/\//, "")));
      wrap.appendChild(a);
    });
    if (wrap.childNodes.length) { msgs.appendChild(wrap); scrollDown(); }
  }

  function renderSuggestions() {
    sugs.textContent = "";
    SUGGESTIONS.forEach(function (s) {
      var b = el("button", "vs-sug", s);
      b.addEventListener("click", function () { textarea.value = s; send(); });
      sugs.appendChild(b);
    });
  }

  function send() {
    var text = textarea.value.trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true;
    addMsg(text, "user");
    userMsgCount++;
    textarea.value = ""; textarea.style.height = "auto";
    sugs.textContent = "";

    var typing = el("div", "vs-typing", "Poradce píše…");
    msgs.appendChild(typing); scrollDown();

    var gen = convGen; // odpověď platí jen pro tuto generaci konverzace
    fetch(CFG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, sessionId: SESSION_ID, tenant: CFG.tenant })
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)); })
      .then(function (data) {
        if (gen !== convGen) return; // mezitím proběhl reset → odpověď zahodit
        typing.remove();
        addMsg((data && data.reply) ? data.reply : "Omlouvám se, teď se mi nepodařilo odpovědět.", "bot");
        addCards(data && data.cards);
      })
      .catch(function () {
        if (gen !== convGen) return;
        typing.remove();
        addMsg("Jejda, spojení se nezdařilo. Zkus to prosím za chvíli znovu.", "bot");
      })
      .finally(function () {
        if (gen !== convGen) return; // reset už stav uklidil za nás
        busy = false; sendBtn.disabled = false; textarea.focus();
      });
  }

  function resetChat() {
    convGen++;                 // zneplatní případný běžící fetch
    SESSION_ID = newSessionId(); // nová session → backendová paměť začne od nuly
    busy = false; sendBtn.disabled = false;
    userMsgCount = 0; feedbackGiven = false; // nová konverzace = nový feedback
    msgs.textContent = "";     // vymaž historii z okna
    started = false;
    textarea.value = ""; textarea.style.height = "auto";
    addMsg(CFG.welcome, "bot");
    renderSuggestions();
    started = true;
    textarea.focus();
  }

  function openPanel() {
    panel.classList.add("vs-open");
    if (!started) {
      started = true;
      addMsg(CFG.welcome, "bot");
      renderSuggestions();
    }
    textarea.focus();
  }
  function closePanel() { panel.classList.remove("vs-open"); }

  // Zkopíruje AKTUÁLNÍ session ID (čte proměnnou, takže respektuje reset) do schránky.
  // Slouží k dohledání konverzace v admin API /chat-history?sessionId=…
  function copySession() {
    var id = SESSION_ID;
    function feedback() {
      copyBtn.classList.add("vs-copied"); // CSS skryje ikonu a ukáže ✓ (viz .vs-copied)
      copyBtn.setAttribute("title", "Zkopírováno: " + id);
      setTimeout(function () {
        copyBtn.classList.remove("vs-copied");
        copyBtn.setAttribute("title", "Kopírovat ID konverzace");
      }, 1500);
    }
    function fallback() {
      try {
        var ta = el("textarea");
        ta.value = id;
        ta.style.position = "fixed"; ta.style.top = "-1000px"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        feedback();
      } catch (e) {
        window.prompt("ID konverzace (zkopíruj ručně):", id);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).then(feedback, fallback);
    } else {
      fallback();
    }
  }

  /* ---------- feedback při zavření ---------- */
  function paintStars(n) { for (var i = 0; i < starEls.length; i++) starEls[i].classList.toggle("on", i < n); }
  function setStars(n) { fbRating = n; paintStars(n); fbSend.disabled = n < 1; }
  function resetFbUi() {
    fbTitle.textContent = "Jak jsi byl(a) spokojen(á)?";
    fbSub.style.display = ""; fbStars.style.display = ""; fbComment.style.display = ""; fbActions.style.display = "";
    fbRating = 0; fbComment.value = ""; paintStars(0); fbSend.disabled = true;
  }
  function showFeedback(after) { fbAfter = after || closePanel; resetFbUi(); fbBox.classList.add("vs-fb-open"); starEls[0].focus(); }
  function hideFeedback() { fbBox.classList.remove("vs-fb-open"); }
  function finishFb() { hideFeedback(); var a = fbAfter; fbAfter = null; if (a) a(); }
  function showThanks() {
    fbTitle.textContent = "Děkujeme za zpětnou vazbu! 💚";
    fbSub.style.display = "none"; fbStars.style.display = "none"; fbComment.style.display = "none"; fbActions.style.display = "none";
  }
  function submitFeedback() {
    if (fbRating < 1) return;
    var payload = { sessionId: SESSION_ID, tenant: CFG.tenant, rating: fbRating, comment: fbComment.value.trim() };
    feedbackGiven = true;
    // fire-and-forget: navazující akce nečeká na server (keepalive přežije i zavření stránky)
    try {
      fetch(CFG.feedbackEndpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), keepalive: true
      }).catch(function () {});
    } catch (e) {}
    showThanks();
    setTimeout(finishFb, 1300);
  }
  function skipFeedback() { feedbackGiven = true; finishFb(); }
  // Po reálné konverzaci (a když feedback ještě nepadl) nabídni hodnocení, pak proveď akci (zavřít/reset).
  function withFeedback(after) {
    if (started && userMsgCount > 0 && !feedbackGiven) showFeedback(after);
    else after();
  }
  function requestClose() { withFeedback(closePanel); }
  function requestReset() { withFeedback(resetChat); }

  starEls.forEach(function (st) {
    var val = parseInt(st.getAttribute("data-val"), 10);
    st.addEventListener("click", function () { setStars(val); });
    st.addEventListener("mouseenter", function () { paintStars(val); });
    st.addEventListener("mouseleave", function () { paintStars(fbRating); });
  });
  fbSend.addEventListener("click", submitFeedback);
  fbSkip.addEventListener("click", skipFeedback);

  if (CFG.mode === "inline") {
    // v inline režimu křížek nezavírá (není kam), ale resetuje konverzaci
    closeBtn.setAttribute("aria-label", "Začít novou konverzaci");
    closeBtn.setAttribute("title", "Začít znovu");
    closeBtn.addEventListener("click", requestReset);
  } else {
    launcher.addEventListener("click", function () {
      panel.classList.contains("vs-open") ? requestClose() : openPanel();
    });
    closeBtn.addEventListener("click", requestClose);
  }
  copyBtn.addEventListener("click", copySession);
  resetBtn.addEventListener("click", requestReset);
  sendBtn.addEventListener("click", send);
  textarea.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  textarea.addEventListener("input", function () {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, CFG.mode === "inline" ? 160 : 90) + "px";
  });

  // Inline režim: chat je otevřený a připravený rovnou po načtení stránky.
  if (CFG.mode === "inline") openPanel();
})();
