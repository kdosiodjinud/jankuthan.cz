(function () {
  'use strict';

  const EMAIL = 'jankuthan@email.cz';
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
      link.href = 'eshop-detail.html?id=' + encodeURIComponent(p.id);
      link.append(img(p.images[0], p.name), el('h2', 'eshop-card__name', p.name), el('p', 'eshop-card__summary', p.summary), el('p', 'eshop-card__price', formatPrice(p.price)));
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

  function renderDetail(products) {
    const id = new URLSearchParams(location.search).get('id');
    const p = products.find(function (product) { return product.id === id; });
    if (!p) {
      showMessage('Produkt nebyl nalezen.');
      return;
    }
    document.title = p.name + ' – Jan Kuthan';

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
    gallery.append(main, thumbs);

    const info = el('div', 'eshop-detail__info');
    info.append(el('h1', 'eshop-detail__name', p.name), el('p', 'eshop-detail__price', formatPrice(p.price)));
    p.description.forEach(function (text) { info.append(el('p', '', text)); });
    if (p.features.length) {
      const ul = el('ul', 'eshop-detail__features');
      p.features.forEach(function (text) { ul.append(el('li', '', text)); });
      info.append(el('h2', 'eshop-detail__subheading', 'Klíčové vlastnosti'), ul);
    }
    const contact = el('a', 'page-cta__button', 'Mám zájem – napsat e-mail');
    contact.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Zájem o: ' + p.name);
    const cta = el('p', 'page-cta');
    cta.append(contact);
    info.append(cta);

    detail.append(gallery, info);
  }

  fetch('eshop.json')
    .then(function (response) {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .then(function (data) {
      if (list) renderList(data.products);
      if (detail) renderDetail(data.products);
    })
    .catch(function () {
      showMessage('Produkty se nepodařilo načíst.');
    });
})();
