(function () {
  'use strict';

  const list = document.getElementById('eshop-list');
  const detail = document.getElementById('eshop-detail');
  const message = document.getElementById('eshop-message');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function img(src, alt) {
    const node = el('img');
    node.src = src;
    node.alt = alt;
    node.loading = 'lazy';
    return node;
  }

  // Fotka se štítkem (např. „Nové“) v levém horním rohu, pokud ho produkt má.
  function media(image, product) {
    const box = el('div', 'eshop-media');
    box.append(image);
    if (product.badge) box.append(el('span', 'eshop-badge', product.badge));
    return box;
  }

  function formatPrice(price) {
    return price.toLocaleString('cs-CZ') + ' Kč';
  }

  function normalize(text) {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  function renderList(products) {
    const search = document.getElementById('eshop-search');
    const items = products.map(function (p) {
      const link = el('a', 'eshop-card');
      link.href = 'eshop/' + encodeURIComponent(p.id) + '.html';
      link.append(media(img(p.images[0], p.name), p), el('h2', 'eshop-card__name', p.name), el('p', 'eshop-card__summary', p.summary), el('p', 'eshop-card__price', formatPrice(p.price)));
      const li = el('li');
      li.append(link);
      list.append(li);
      return { node: li, text: normalize([p.name, p.summary].concat(p.description, p.features).join(' ')) };
    });

    search.addEventListener('input', function () {
      const query = normalize(search.value.trim());
      let visible = 0;
      items.forEach(function (item) {
        item.node.hidden = !item.text.includes(query);
        if (!item.node.hidden) visible++;
      });
      message.hidden = visible > 0;
      if (!visible) showMessage('Žádný produkt neodpovídá hledání.');
    });
  }

  function renderDetail(products, shipping) {
    const id = detail.dataset.productId || new URLSearchParams(location.search).get('id');
    const p = products.find(function (product) { return product.id === id; });
    if (!p) {
      showMessage('Produkt nebyl nalezen.');
      return;
    }
    // Stará adresa eshop-detail.html?id=… → statická stránka produktu.
    if (!detail.dataset.productId) {
      location.replace('eshop/' + encodeURIComponent(p.id) + '.html');
      return;
    }

    const main = img(p.images[0], p.name);
    main.className = 'eshop-gallery__main';
    main.loading = 'eager';
    const thumbs = el('div', 'eshop-gallery__thumbs');
    p.images.forEach(function (src, i) {
      const button = el('button', 'eshop-gallery__thumb');
      button.type = 'button';
      button.setAttribute('aria-label', 'Fotka ' + (i + 1));
      button.append(img(src, ''));
      button.addEventListener('click', function () { main.src = src; });
      thumbs.append(button);
    });
    const gallery = el('div', 'eshop-gallery');
    gallery.append(media(main, p));
    if (p.images.length > 1) gallery.append(thumbs);

    const info = el('div', 'eshop-detail__info');
    info.append(el('h1', 'eshop-detail__name', p.name), el('p', 'eshop-detail__price', formatPrice(p.price)));
    p.description.forEach(function (text) { info.append(el('p', '', text)); });
    if (p.features.length) {
      const ul = el('ul', 'eshop-detail__features');
      p.features.forEach(function (text) { ul.append(el('li', '', text)); });
      info.append(el('h2', 'eshop-detail__subheading', 'Klíčové vlastnosti'), ul);
    }
    detail.append(gallery, info);
    initOrderForm(document.getElementById('eshop-order'), p, shipping);
  }

  function loadPacketa() {
    if (window.Packeta) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      const script = el('script');
      script.src = 'https://widget.packeta.com/v6/www/js/library.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  function initOrderForm(form, product, shipping) {
    const status = document.getElementById('eshop-order-status');
    const pointName = document.getElementById('eshop-point');
    const total = document.getElementById('eshop-total');
    const submit = form.querySelector('[type="submit"]');
    let point = null;

    function setStatus(text, isError) {
      status.textContent = text;
      status.classList.toggle('eshop-order__status--error', isError);
      status.hidden = false;
    }

    function updateTotal() {
      const quantity = Number(form.elements.quantity.value);
      total.textContent = Number.isInteger(quantity) && quantity >= 1 && quantity <= 20
        ? 'Celkem ' + formatPrice(product.price * quantity + shipping) + ' (zboží ' + formatPrice(product.price * quantity) + ' + doprava ' + formatPrice(shipping) + ')'
        : '';
    }

    form.elements.quantity.addEventListener('input', updateTotal);
    updateTotal();

    document.getElementById('eshop-point-pick').addEventListener('click', function () {
      loadPacketa()
        .then(function () {
          window.Packeta.Widget.pick(form.dataset.packetaKey, function (selected) {
            if (!selected) return;
            point = { id: String(selected.id), name: [selected.place, selected.name].filter(Boolean).join(', ') };
            pointName.textContent = point.name;
          }, { language: 'cs', country: 'cz' });
        })
        .catch(function () {
          setStatus('Mapu výdejních míst se nepodařilo načíst. Zkuste to prosím znovu.', true);
        });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (!point) {
        setStatus('Vyberte prosím výdejní místo Zásilkovny.', true);
        return;
      }
      submit.disabled = true;
      setStatus('Odesílám…', false);
      fetch(form.dataset.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          quantity: Number(form.elements.quantity.value),
          name: form.elements.name.value,
          email: form.elements.email.value,
          phone: form.elements.phone.value,
          pickupPoint: point,
          note: form.elements.note.value,
          terms: form.elements.terms.checked,
          website: form.elements.website.value,
        }),
      })
        .then(function (response) {
          return response.json().catch(function () { return {}; });
        })
        .then(function (result) {
          if (!result.ok) throw new Error(result.error || 'Objednávku se nepodařilo odeslat.');
          form.reset();
          point = null;
          pointName.textContent = 'Zatím nevybráno';
          updateTotal();
          setStatus('Děkuji, objednávka ' + (result.orderNo || '') + ' je odeslaná. Brzy se vám ozvu e-mailem s platebními údaji.', false);
        })
        .catch(function (error) {
          setStatus(error instanceof TypeError ? 'Objednávku se nepodařilo odeslat. Zkuste to prosím později.' : error.message, true);
        })
        .finally(function () {
          submit.disabled = false;
        });
    });

    form.hidden = false;
  }

  // no-cache: katalog se vždy ověří u serveru (ETag), aby byl nový produkt vidět hned po nasazení.
  fetch('eshop.json', { cache: 'no-cache' })
    .then(function (response) {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .then(function (data) {
      if (list) renderList(data.products);
      if (detail) renderDetail(data.products, data.shipping);
    })
    .catch(function () {
      showMessage('Produkty se nepodařilo načíst.');
    });
})();
