/* Tienda: categorías, subcategorías, filtros con casillas, orden y paginación. */
(() => {
  const {P, vendido, sinPrecio, enOferta, precioActivo, JP, CATS, slug, card, openSheet, closeSheets} = window.RINBO;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const POR_PAGINA = 12;
  const FILTROS = [
    {grupo: 'Disponibilidad', items: [
      {k: 'disp', t: 'Disponibles', test: p => !vendido(p)},
      {k: 'chile', t: 'En Chile', test: p => p.stock === 'En Chile'}]},
    {grupo: 'Estado', items: [
      {k: 'nuevo', t: 'Nuevos', test: p => p.estado === 'Nuevo'},
      {k: 'usado', t: 'Segunda mano', test: p => p.estado === 'Usado'}]},
    {grupo: 'Precio', items: [
      {k: 'oferta', t: 'En oferta', test: p => enOferta(p) && !vendido(p)}]}
  ];
  const TODOS = FILTROS.flatMap(g => g.items.map(i => ({...i, grupo: g.grupo})));
  const st = {cat: 'todos', sub: 'todas', f: new Set(), orden: 'rel', pag: 1};

  const leerHash = () => { const h = location.hash.slice(1); const c = CATS.find(c => slug(c) === h); st.cat = c || 'todos'; st.sub = 'todas'; st.pag = 1; };

  // Dentro de un mismo grupo las casillas suman (O); entre grupos se combinan (Y).
  function pasa(p, f = st.f) {
    return FILTROS.every(g => { const act = g.items.filter(i => f.has(i.k)); return !act.length || act.some(i => i.test(p)); });
  }
  const base = () => P.filter(p => (st.cat === 'todos' || p.cat === st.cat) && (st.sub === 'todas' || p.sub === st.sub));
  function lista() {
    let r = base().filter(p => pasa(p));
    const v = p => vendido(p) || sinPrecio(p) ? null : precioActivo(p);
    if (st.orden === 'rel') r.sort((a, b) => vendido(a) - vendido(b) || b.destacado - a.destacado);
    if (st.orden === 'low') r.sort((a, b) => (v(a) ?? 1e12) - (v(b) ?? 1e12));
    if (st.orden === 'high') r.sort((a, b) => (v(b) ?? -1) - (v(a) ?? -1));
    return r;
  }

  function render() {
    // Categorías
    $('#catNav').innerHTML = [['todos', 'Todos', '全']].concat(CATS.map(c => [c, c, JP[c]])).map(([k, t, jp]) => {
      const n = k === 'todos' ? P.length : P.filter(p => p.cat === k).length;
      return `<a class="cat-link" href="#${k === 'todos' ? 'tienda' : slug(k)}" data-cat="${k}" aria-current="${st.cat === k}"><span class="jp">${jp}</span>${t}<span class="n num">${n}</span></a>`;
    }).join('');
    // Subcategorías
    const subs = st.cat === 'todos' ? [] : [...new Set(P.filter(p => p.cat === st.cat).map(p => p.sub).filter(Boolean))];
    $('#subNav').hidden = subs.length < 1;
    $('#subNav').innerHTML = ['todas', ...subs].map(s => `<button class="chip sm" type="button" data-sub="${s}" aria-pressed="${st.sub === s}">${s === 'todas' ? 'Todas' : s}</button>`).join('');
    // Casillas con cantidades
    const b = base();
    $('#filtGroups').innerHTML = FILTROS.map(g => `<fieldset class="fgroup"><legend>${g.grupo}</legend>${g.items.map(i => {
      const f2 = new Set(st.f); f2.add(i.k);
      const n = b.filter(p => pasa(p, f2)).length;
      return `<label class="check${!n && !st.f.has(i.k) ? ' off' : ''}"><input type="checkbox" data-f="${i.k}" ${st.f.has(i.k) ? 'checked' : ''}><span class="box"><svg class="i"><use href="#i-check"/></svg></span><span class="t">${i.t}</span><span class="n num">${n}</span></label>`;
    }).join('')}</fieldset>`).join('');
    // Pastillas activas
    const act = [...st.f].map(k => TODOS.find(i => i.k === k));
    if (st.sub !== 'todas') act.unshift({k: '__sub', t: st.sub});
    $('#active').hidden = !act.length;
    $('#active').innerHTML = act.map(i => `<button class="pill" type="button" data-rmf="${i.k}">${i.t}<svg class="i"><use href="#i-close"/></svg></button>`).join('') + (act.length > 1 ? '<button class="clear" type="button" data-clear>Limpiar todo</button>' : '');
    $$('.fcount').forEach(el => { el.textContent = st.f.size || ''; el.hidden = !st.f.size; });
    // Resultados
    const r = lista(), pags = Math.max(1, Math.ceil(r.length / POR_PAGINA));
    st.pag = Math.min(st.pag, pags);
    const vis = r.slice((st.pag - 1) * POR_PAGINA, st.pag * POR_PAGINA);
    $('#count-txt').innerHTML = `<b class="num">${r.length}</b> ${r.length === 1 ? 'producto' : 'productos'}`;
    $('#seeN').textContent = r.length;
    $('#pageTitle').textContent = st.cat === 'todos' ? 'Tienda' : st.cat;
    if (!r.length) {
      $('#grid').innerHTML = `<div class="empty"><span class="jp">無</span><b>No hay productos con estos filtros.</b><p>¿Buscas algo que no está en el catálogo?</p><div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center;align-items:center"><button class="btn btn-ink btn-plain" type="button" data-clear>Limpiar filtros</button><a class="link" href="#" data-open-encargo2>Agregar a mi cotización</a></div></div>`;
    } else {
      const cells = vis.map(card);
      if (st.pag === 1) cells.splice(Math.min(6, cells.length), 0, `<aside class="promo"><span class="big-jp" aria-hidden="true">代行</span><span class="mono" style="position:relative;opacity:.8">Servicio de encargos</span><h2 class="display">¿Buscas algo que no está en el catálogo?</h2><p>Si se consigue en Japón, lo encontramos: cámaras, figuras, instrumentos, ediciones limitadas, lo que sea.</p><a class="btn" href="#" data-open-encargo2>Agregar a mi cotización <span class="ico"><svg class="i"><use href="#i-plus"/></svg></span></a></aside>`);
      $('#grid').innerHTML = cells.join('');
    }
    $('#pager').innerHTML = pags > 1 ? `<button type="button" data-pag="${st.pag - 1}" ${st.pag === 1 ? 'disabled' : ''} aria-label="Página anterior"><svg class="i" style="transform:rotate(-135deg)"><use href="#i-arrow"/></svg></button>${Array.from({length: pags}, (_, i) => `<button type="button" data-pag="${i + 1}" aria-current="${st.pag === i + 1}">${i + 1}</button>`).join('')}<button type="button" data-pag="${st.pag + 1}" ${st.pag === pags ? 'disabled' : ''} aria-label="Página siguiente"><svg class="i" style="transform:rotate(45deg)"><use href="#i-arrow"/></svg></button>` : '';
  }

  const top = () => { const y = $('#shopTop').getBoundingClientRect().top + scrollY - 70; if (scrollY > y) window.scrollTo({top: y, behavior: 'smooth'}); };
  document.addEventListener('click', e => {
    const t = e.target;
    const c = t.closest('[data-cat]'); if (c) { e.preventDefault(); st.cat = c.dataset.cat; st.sub = 'todas'; st.pag = 1; history.replaceState(null, '', '#' + (st.cat === 'todos' ? 'tienda' : slug(st.cat))); render(); return; }
    const s = t.closest('[data-sub]'); if (s) { st.sub = s.dataset.sub; st.pag = 1; render(); return; }
    const r = t.closest('[data-rmf]'); if (r) { r.dataset.rmf === '__sub' ? st.sub = 'todas' : st.f.delete(r.dataset.rmf); st.pag = 1; render(); return; }
    if (t.closest('[data-clear]')) { st.f.clear(); st.sub = 'todas'; st.pag = 1; render(); return; }
    const pg = t.closest('[data-pag]'); if (pg && !pg.disabled) { st.pag = +pg.dataset.pag; render(); top(); return; }
    if (t.closest('[data-open-encargo2]')) { e.preventDefault(); openSheet($('#sheet')); setTimeout(() => $('#encInput').focus(), 350); }
  });
  $('#filtGroups').addEventListener('change', e => { const k = e.target.dataset.f; if (!k) return; e.target.checked ? st.f.add(k) : st.f.delete(k); st.pag = 1; render(); });
  $('#orden').addEventListener('change', e => { st.orden = e.target.value; render(); });
  $('#openFilters').addEventListener('click', () => openSheet($('#filters')));
  $('#seeResults').addEventListener('click', () => { closeSheets(); top(); });
  window.addEventListener('hashchange', () => { leerHash(); render(); });

  leerHash(); render();
})();
