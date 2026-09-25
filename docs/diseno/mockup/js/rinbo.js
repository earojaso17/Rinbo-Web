/* RINBŌ Ichiba · mockup multipágina
   Misma lógica que app.js (catálogo desde planilla, cotización en localStorage, WhatsApp, seguimiento),
   con la nueva capa visual. Las fotos son de relleno. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = n => '$' + Number(n).toLocaleString('es-CL');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const saltos = s => esc(s).replace(/\n/g, '<br>');
  const WA = '819039343820';
  const wa = msg => `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  const PAGE = ($('main') || {}).dataset?.page;

  // ---------- Catálogo ----------
  const opcion = s => { if (!s) return null; const i = s.indexOf(':'); if (i < 0) return null; return {nombre: s.slice(0, i).trim(), valores: s.slice(i + 1).split('|').map(v => v.trim()).filter(Boolean)}; };
  const P = (window.RINBO_CATALOGO || []).map(r => ({
    id: r.id, nombre: r.nombre, cat: r.categoria_principal, sub: r.categoria_secundaria, detalle: r.detalle,
    ops: [opcion(r.opcion_1), opcion(r.opcion_2)].filter(Boolean), desc: r.descripcion, estado: r.estado,
    precio: +r.precio_clp || 0, oferta: +r.precio_oferta || 0, stock: r.stock, destacado: r.destacado === 'SI',
    tabla: r.tabla_tallas, pie: r.detalle_pie, ig: r.instagram || '', nfotos: Math.max(1, +r.nfotos || 1)
  }));
  const vendido = p => p.stock === 'Vendido';
  const sinPrecio = p => !p.precio;
  const enOferta = p => !!p.oferta && p.oferta < p.precio;
  const precioActivo = p => enOferta(p) ? p.oferta : p.precio;
  const JP = {'Vestuario':'服', 'Cartas TCG':'カード', 'Segunda mano':'中古', 'Relojes':'時計', 'Accesorios':'小物'};
  const CATS = ['Vestuario', 'Cartas TCG', 'Segunda mano', 'Relojes', 'Accesorios'];
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
  const foto = (p, i = 0, w = 600, h = 750) => `<div class="ph" data-jp="${JP[p.cat] || '品'}" data-label="Foto de relleno"><img src="https://picsum.photos/seed/${p.id}-${i}/${w}/${h}?grayscale" alt="Foto de relleno: ${esc(p.nombre)}" loading="lazy" onerror="this.parentNode.classList.add('noimg')">`;
  const url = p => `producto.html#${p.id}`;
  window.RINBO = {P, vendido, sinPrecio, enOferta, precioActivo, fmt, JP, CATS, slug};

  function card(p) {
    const flags = [
      vendido(p) && '<span class="flag sold">Vendido</span>',
      !vendido(p) && enOferta(p) && '<span class="flag sale">Oferta</span>',
      p.estado === 'Usado' && '<span class="flag used">Segunda mano</span>',
      !vendido(p) && p.stock === 'En Chile' && '<span class="flag cl">En Chile</span>'
    ].filter(Boolean).join('');
    let price;
    if (vendido(p)) price = '<span class="clp ask">Vendido</span>';
    else if (sinPrecio(p)) price = '<span class="clp ask">A consultar</span>';
    else if (enOferta(p)) price = `<span class="clp sale num">${fmt(p.oferta)}</span><s class="num">${fmt(p.precio)}</s>`;
    else price = `<span class="clp num">${fmt(p.precio)}</span><span class="yen mono">CLP</span>`;
    let btn;
    if (vendido(p)) btn = `<button class="btn btn-line" type="button" data-like="${p.id}">Encargar uno igual <span class="ico"><svg class="i"><use href="#i-arrow"/></svg></span></button>`;
    else if (p.ops.some(o => o.valores.length > 1)) btn = `<a class="btn btn-line" href="${url(p)}">Elegir opciones <span class="ico"><svg class="i"><use href="#i-list"/></svg></span></a>`;
    else btn = `<button class="btn btn-line" type="button" data-add="${p.id}">Agregar a cotización <span class="ico"><svg class="i"><use href="#i-plus"/></svg></span></button>`;
    return `<article class="card${vendido(p) ? ' sold' : ''}">
      <a href="${url(p)}" tabindex="-1" aria-hidden="true" style="display:block">${foto(p)}<div class="flags">${flags}</div></div></a>
      <div class="meta mono"><span>${esc(p.sub || p.cat)}</span></div>
      <h3><a href="${url(p)}">${esc(p.nombre)}</a></h3>
      <p class="sub">${esc(p.detalle)}</p>
      <div class="price">${price}</div>
      ${btn}
    </article>`;
  }
  window.RINBO.card = card;

  // ---------- Cotización (misma estructura que Carrito en app.js) ----------
  const KEY = 'rinbo-cotizacion';
  const Cot = {
    leer() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return this._mem || []; } },
    guardar(items) { this._mem = items; try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} pintar(); },
    agregar(id, ops) { const it = this.leer(); it.push({tipo: 'prod', id, ops: ops || {}}); this.guardar(it); bump(); toast('Agregado a tu cotización'); },
    encargo(texto) { const it = this.leer(); it.push({tipo: 'enc', texto}); this.guardar(it); bump(); },
    quitar(i) { const it = this.leer(); it.splice(i, 1); this.guardar(it); },
    resueltos() { return this.leer().map(it => it.tipo === 'enc' ? it : ({...it, p: P.find(x => x.id === it.id)})).filter(it => it.tipo === 'enc' || it.p); },
    total() { return this.resueltos().reduce((s, it) => s + (it.tipo === 'prod' && !sinPrecio(it.p) ? precioActivo(it.p) : 0), 0); },
    link() {
      const items = this.resueltos();
      const lineas = items.map(it => {
        if (it.tipo === 'enc') return `• ENCARGO: ${it.texto} (a cotizar)`;
        const ops = Object.entries(it.ops || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
        return `• ${it.p.nombre} (${it.p.id})${ops ? ' — ' + ops : (it.p.detalle ? ' — ' + it.p.detalle : '')}${sinPrecio(it.p) ? ' (precio a consultar)' : ''}`;
      });
      const hay = items.some(it => it.tipo === 'enc' || sinPrecio(it.p));
      return wa(`¡Hola! Vengo de rinbo.store y quiero cotizar:\n${lineas.join('\n')}\nTotal referencial: ${fmt(this.total())} CLP${hay ? ' (+ ítems a consultar)' : ''}`);
    }
  };
  window.RINBO.Cot = Cot;

  function pintar() {
    const items = Cot.resueltos();
    $$('.count').forEach(c => c.textContent = items.length);
    const ul = $('#items'); if (!ul) return;
    ul.innerHTML = items.length ? items.map((it, i) => it.tipo === 'enc'
      ? `<li><span class="th">代</span><div><b>Encargo: ${esc(it.texto)}</b><small>A cotizar</small></div><button class="rm" type="button" data-rm="${i}">Quitar</button></li>`
      : `<li><span class="th">${JP[it.p.cat] || '品'}</span><div><b>${esc(it.p.nombre)}</b><small class="num">${Object.values(it.ops || {}).join(' · ') ? esc(Object.values(it.ops).join(' · ')) + ' · ' : ''}${sinPrecio(it.p) ? 'A consultar' : fmt(precioActivo(it.p))}</small></div><button class="rm" type="button" data-rm="${i}">Quitar</button></li>`).join('')
      : '<li class="sheet-empty" style="display:grid;border:0"><span class="jp">空</span><span>Tu cotización está vacía.<br>Agrega productos del catálogo<br>o escribe un encargo.</span></li>';
    $('#sheetFoot').hidden = !items.length;
    $('#total').textContent = fmt(Cot.total());
    $('#sendQuote').href = Cot.link();
  }

  // ---------- Hojas, menú, toast ----------
  let lastFocus;
  function openSheet(el) {
    lastFocus = document.activeElement;
    $$('.sheet.is-open').forEach(s => { s.classList.remove('is-open'); s.setAttribute('aria-hidden', 'true'); });
    el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false');
    $('#backdrop').classList.add('is-open');
    const x = el.querySelector('.x'); x && x.focus();
  }
  function closeSheets() {
    $$('.sheet.is-open').forEach(s => { s.classList.remove('is-open'); s.setAttribute('aria-hidden', 'true'); });
    $('#backdrop').classList.remove('is-open');
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
  window.RINBO.openSheet = openSheet; window.RINBO.closeSheets = closeSheets;
  let tt;
  function toast(msg) { const t = $('#toast'); if (!t) return; $('#toastTxt').textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2400); }
  function bump() { $$('.count').forEach(c => { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }); }
  window.RINBO.toast = toast;

  function openQuote(focusEnc) { openSheet($('#sheet')); if (focusEnc) setTimeout(() => $('#encInput').focus(), 350); }
  $('#openQuote').addEventListener('click', () => openQuote());
  $$('[data-open-encargo]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openQuote(true); }));
  $$('[data-close]').forEach(b => b.addEventListener('click', closeSheets));
  $('#backdrop').addEventListener('click', closeSheets);
  $('#items').addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if (r) Cot.quitar(+r.dataset.rm); });
  $('#encForm').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('#encInput'), t = inp.value.trim();
    if (!t) { inp.focus(); return; }
    Cot.encargo(t); inp.value = '';
  });

  const html = document.documentElement;
  $('#menuBtn').addEventListener('click', () => { const o = html.classList.toggle('menu-open'); $('#menuBtn').setAttribute('aria-expanded', o); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeSheets(); if ($('.lb')) $('.lb').remove();
    if (html.classList.contains('menu-open')) $('#menuBtn').click();
  });
  $$('[data-wa]').forEach(a => a.href = wa(a.dataset.wa));
  $('#copyMail') && $('#copyMail').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText('hola@rinbo.store'); toast('Correo copiado'); }
    catch (err) { const r = document.createRange(); r.selectNodeContents($('.mail code')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  });

  // Botones de tarjeta (en cualquier página)
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-add]'), l = e.target.closest('[data-like]');
    if (a) { e.preventDefault(); Cot.agregar(a.dataset.add); a.classList.add('added'); a.innerHTML = 'Agregado <span class="ico"><svg class="i"><use href="#i-check"/></svg></span>'; }
    if (l) { e.preventDefault(); const p = P.find(x => x.id === l.dataset.like); Cot.encargo(`Uno igual a: ${p.nombre} (${p.id})`); toast('Encargo agregado a tu cotización'); }
  });

  // ---------- Páginas ----------
  const pages = {
    home() {
      const dest = P.filter(p => p.destacado);
      $('#rail').innerHTML = dest.map(card).join('');
      if ($('#cats')) $('#cats').innerHTML = CATS.map(c => {
        const n = P.filter(p => p.cat === c).length;
        return `<a class="cat-tile" href="tienda.html#${slug(c)}"><span class="jp">${JP[c]}</span><b>${c}</b><span class="mono num">${n}</span><svg class="i"><use href="#i-arrow"/></svg></a>`;
      }).join('');
      const of = P.filter(p => enOferta(p) && !vendido(p));
      $('#deals').innerHTML = of.map(p => `<li><a class="deal" href="${url(p)}">${foto(p, 0, 200, 200)}</div><div><b>${esc(p.nombre)}</b><small>${esc(p.detalle)}</small></div><div class="pr"><span class="num">${fmt(p.oferta)}</span><s class="num">${fmt(p.precio)}</s></div></a></li>`).join('');
      $('#homeEnc').addEventListener('submit', e => { e.preventDefault(); const i = $('#homeEncInput'), t = i.value.trim(); if (!t) { i.focus(); return; } Cot.encargo(t); i.value = ''; openSheet($('#sheet')); });
      // Carrusel de portada (mismos slides que CONFIG.heroSlides)
      const track = $('#slides'), dots = $$('#dots button');
      let i = 0, timer;
      const go = n => { i = (n + dots.length) % dots.length; track.scrollTo({left: track.clientWidth * i, behavior: 'smooth'}); };
      track.addEventListener('scroll', () => { const n = Math.round(track.scrollLeft / track.clientWidth); dots.forEach((d, k) => d.setAttribute('aria-current', k === n)); i = n; }, {passive: true});
      dots.forEach((d, k) => d.addEventListener('click', () => { go(k); restart(); }));
      const restart = () => { clearInterval(timer); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => go(i + 1), 5200); };
      track.addEventListener('pointerdown', () => clearInterval(timer));
      restart();
    },
    producto() {
      const id = decodeURIComponent(location.hash.slice(1));
      const p = P.find(x => x.id === id) || P.find(x => x.destacado);
      const cont = $('#producto');
      if (!p) { cont.innerHTML = '<p class="seg-msg">Producto no encontrado. <a class="link" href="tienda.html">Volver al catálogo</a></p>'; return; }
      document.title = `${p.nombre} — RINBŌ Ichiba`;
      $('#crumbCat').textContent = p.cat; $('#crumbCat').href = `tienda.html#${slug(p.cat)}`;
      const sel = {}; p.ops.forEach(o => sel[o.nombre] = o.valores[0]);
      const fotos = Array.from({length: p.nfotos}, (_, k) => k);
      const tabla = p.tabla ? (() => { const f = p.tabla.split(';').map(r => r.split('|').map(c => c.trim())).filter(r => r.length > 1); return `<div class="size-table"><table><thead><tr>${f[0].map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${f.slice(1).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; })() : '';
      let precio;
      if (vendido(p) && sinPrecio(p)) precio = `<div class="big">Vendido</div><p class="note">Se fue a su nuevo dueño — pero podemos buscar otro en Japón</p>`;
      else if (sinPrecio(p)) precio = `<div class="big">Precio a consultar</div><p class="note">El valor en Japón varía según demanda — se confirma en tu cotización</p>`;
      else if (vendido(p)) precio = `<div class="big"><s>${fmt(precioActivo(p))}</s> Vendido</div><p class="note">Se fue a su nuevo dueño — pero podemos buscar otro en Japón</p>`;
      else if (enOferta(p)) precio = `<div class="big sale num">${fmt(p.oferta)} <small>CLP</small> <s>${fmt(p.precio)}</s></div><p class="note">Precio final en oferta · impuestos incluidos</p>`;
      else precio = `<div class="big num">${fmt(p.precio)} <small>CLP</small></div><p class="note">Precio final · impuestos incluidos</p>`;
      const stock = p.stock === 'En Chile' ? '<span class="badge cl"><span class="dot"></span>En Chile · despacho inmediato</span>' : vendido(p) ? '' : `<span class="badge jp-st"><span class="dot"></span>${esc(p.stock)} · 2-4 semanas est.</span>`;
      cont.innerHTML = `
        <div class="gallery">
          <div class="g-track" id="gTrack">${fotos.map(k => foto(p, k, 900, 1125) + '</div>').join('')}</div>
          <div class="g-bar"><div class="thumbs" id="thumbs">${fotos.map(k => `<button type="button" aria-label="Foto ${k + 1}" aria-current="${k === 0}">${foto(p, k, 120, 120)}</div></button>`).join('')}</div><span class="g-count mono num" id="gCount">1 / ${fotos.length}</span></div>
        </div>
        <div class="pdp-info">
          <span class="cat mono">${esc(p.cat)}${p.sub ? ' · ' + esc(p.sub) : ''}</span>
          <h1 class="display">${esc(p.nombre)}</h1>
          ${p.detalle ? `<p class="detail">${esc(p.detalle)}</p>` : ''}
          <div class="badges"><span class="badge">${esc(p.estado)}</span>${stock}</div>
          <div class="pdp-price">${precio}</div>
          ${!vendido(p) && p.ops.length ? p.ops.map(o => `<div class="opt-group"><span>${esc(o.nombre)} <em data-sel="${esc(o.nombre)}">${esc(o.valores[0])}</em></span><div class="opt-btns" data-op="${esc(o.nombre)}">${o.valores.map((v, k) => `<button type="button" aria-pressed="${k === 0}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div></div>`).join('') : ''}
          <div class="buy">${vendido(p)
            ? `<button class="btn btn-ink" type="button" data-like="${p.id}">Encargar uno igual <span class="ico"><svg class="i"><use href="#i-arrow"/></svg></span></button>`
            : `<button class="btn btn-ai" type="button" id="addPdp">Agregar a mi cotización <span class="ico"><svg class="i"><use href="#i-plus"/></svg></span></button>`}</div>
          ${p.ig ? `<a class="ig-post" href="${esc(p.ig)}" target="_blank" rel="noopener"><span class="ig-post-ic"><svg class="i"><use href="#i-ig"/></svg></span><span><b>Míralo en Instagram</b><small>@rinbo.store</small></span><svg class="i"><use href="#i-arrow"/></svg></a>` : ''}
          ${p.desc ? `<div class="desc"><p>${saltos(p.desc)}</p></div>` : ''}
          ${tabla}
          ${p.pie ? `<p class="detail" style="font-size:.9rem;color:var(--muted)">${saltos(p.pie)}</p>` : ''}
        </div>`;
      const track = $('#gTrack'), th = $$('#thumbs button');
      track.addEventListener('scroll', () => { const n = Math.round(track.scrollLeft / track.clientWidth); th.forEach((b, k) => b.setAttribute('aria-current', k === n)); $('#gCount').textContent = `${n + 1} / ${th.length}`; }, {passive: true});
      th.forEach((b, k) => b.addEventListener('click', () => track.scrollTo({left: track.clientWidth * k, behavior: 'smooth'})));
      track.addEventListener('click', e => {
        const ph = e.target.closest('.ph'); if (!ph) return;
        const lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', 'Vista ampliada');
        lb.innerHTML = `<button class="x" type="button" aria-label="Cerrar"><svg class="i"><use href="#i-close"/></svg></button>${ph.outerHTML}`;
        lb.addEventListener('click', ev => { if (ev.target === lb || ev.target.closest('.x')) lb.remove(); });
        document.body.appendChild(lb); lb.querySelector('.x').focus();
      });
      cont.addEventListener('click', e => {
        const b = e.target.closest('.opt-btns button'); if (!b) return;
        const g = b.closest('[data-op]');
        $$('button', g).forEach(x => x.setAttribute('aria-pressed', x === b));
        sel[g.dataset.op] = b.dataset.v; cont.querySelector(`[data-sel="${CSS.escape(g.dataset.op)}"]`).textContent = b.dataset.v;
      });
      $('#addPdp') && $('#addPdp').addEventListener('click', () => { Cot.agregar(p.id, {...sel}); openSheet($('#sheet')); });
      const rel = P.filter(x => x.cat === p.cat && x.id !== p.id);
      const relList = (rel.length ? rel : P.filter(x => x.id !== p.id && x.destacado)).slice(0, 4);
      $('#relTitle').textContent = rel.length ? p.cat : 'Destacados';
      $('#rel').innerHTML = relList.map(card).join('');
      window.addEventListener('hashchange', () => location.reload());
    },
    seguimiento() {
      const ETAPAS = ['Encargo Confirmado', 'Comprado en Japón', 'En Bodega Japón', 'Enviado a Chile', 'En Tránsito a Chile', 'En Aduana', 'En Bodega Chile', 'Enviado', 'Entregado'];
      // Pedido de ejemplo (en el sitio real sale de la planilla de seguimiento)
      const DEMO = {codigo: 'R00127', etapa: 'En Aduana', fecha_etapa: '23-09-2026', total_clp: 389990, abonado_clp: 200000, evid: 3, prod: P.find(x => x.id === 'ROP-02607012')};
      const res = $('#segRes');
      res.innerHTML = `<div class="panel seg-res"><span class="mono" style="color:var(--muted)">Etapas</span><ol class="stages">${ETAPAS.map(s => `<li><span class="d"></span><span>${s}</span><span></span></li>`).join('')}</ol></div>`;
      $('#segDemo').addEventListener('click', () => { $('#segCode').value = DEMO.codigo; $('#segForm').requestSubmit(); });
      $('#segForm').addEventListener('submit', e => {
        e.preventDefault();
        const c = $('#segCode').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!c) { $('#segCode').focus(); return; }
        res.innerHTML = '<p class="seg-msg">Buscando…</p>';
        setTimeout(() => {
          if (c !== DEMO.codigo) { res.innerHTML = '<p class="seg-msg">No encontramos ese código. Revísalo o escríbenos por WhatsApp.</p>'; return; }
          const k = ETAPAS.indexOf(DEMO.etapa), saldo = DEMO.total_clp - DEMO.abonado_clp;
          res.innerHTML = `<div class="panel seg-res">
            <div class="seg-top"><span class="seg-code">${DEMO.codigo}</span><span class="mono num">${k + 1} / ${ETAPAS.length}</span></div>
            <div class="seg-now">${DEMO.etapa}</div>
            <div class="seg-bar"><span style="transform:scaleX(${(k + 1) / ETAPAS.length})"></span></div>
            <ol class="stages">${ETAPAS.map((s, n) => `<li class="${n < k ? 'done' : n === k ? 'now' : ''}"><span class="d">${n < k ? '<svg class="i" style="width:12px;height:12px"><use href="#i-check"/></svg>' : ''}</span><span>${s}</span>${n === k ? `<time class="num">${DEMO.fecha_etapa}</time>` : '<span></span>'}</li>`).join('')}</ol>
            <div class="seg-photos">${Array.from({length: DEMO.evid}, (_, n) => foto(DEMO.prod, n, 300, 300) + '</div>').join('')}</div>
            <div class="account"><b>Estado de cuenta</b><div><span>Valor del pedido</span><span>${fmt(DEMO.total_clp)}</span></div><div><span>Abonado</span><span>${fmt(DEMO.abonado_clp)}</span></div>${saldo > 0 ? `<div class="due"><span>Saldo por pagar</span><span>${fmt(saldo)}</span></div>` : ''}<small>El saldo se paga de acuerdo a lo informado — te avisaremos por WhatsApp.</small></div>
          </div>`;
        }, 500);
      });
    },
    faq() {
      const qs = $$('.qa'), inp = $('#faqQ'), empty = $('#faqEmpty');
      const orig = new Map(qs.map(q => [q, q.innerHTML]));
      inp.addEventListener('input', () => {
        const t = inp.value.trim().toLowerCase(); let n = 0;
        qs.forEach(q => {
          q.innerHTML = orig.get(q);
          const hit = !t || q.textContent.toLowerCase().includes(t);
          q.hidden = !hit; if (hit) n++;
          if (t && hit) $$('h3,p', q).forEach(el => el.innerHTML = el.innerHTML.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>'));
        });
        empty.hidden = n > 0;
      });
    }
  };
  pintar();
  if (pages[PAGE]) pages[PAGE]();
})();
