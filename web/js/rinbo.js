/* ============================================================
   RINBŌ Ichiba — sitio público (diseño 2026)
   CONFIGURACIÓN: edita solo este bloque.
   Después de editar este archivo, corre `python3 web-plantillas/armar.py`
   para que los navegadores descarguen la versión nueva.
   ============================================================ */
const CONFIG = {
  // Número de WhatsApp Business SIN el "+" (código país incluido). Ej Japón: "819012345678"
  whatsapp: "819039343820",
  // Carrusel de portada: imagen en img/ (armar.py convierte cada .jpg a .webp), título, texto y kanji que se ve mientras carga la foto
  heroSlides: [
    { img: "/img/portada.webp", titulo: "Lo mejor de Japón, directo a tu puerta", texto: "Comprado en persona · enviado desde Japón", jp: "輪宝" },
    { img: "/img/slide-2.webp", titulo: "Drops UT de Uniqlo", texto: "Colaboraciones de Anime que no salen de Japón", jp: "服" },
    { img: "/img/slide-3.webp", titulo: "Relojes japoneses", texto: "Seiko · Citizen · Orient · Casio", jp: "時計" },
    { img: "/img/slide-4.webp", titulo: "Cartas TCG", texto: "Pokemón · OnePiece · Magic · Entre Otras", jp: "カード" },
    { img: "/img/slide-5.webp", titulo: "SkinCare Perfecto", texto: "Los mejores productos para tu piel", jp: "美容" }
  ],
  // CSV publicado de la pestaña Catálogo (planilla RINBO_Publica)
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkxRbV34pHdMGFF99GL125xelh2PdbdmX_JF_mtIkKgU45xsVYf3C1620CiQrwqSBljbbiYWbkfqLK/pub?gid=344349355&single=true&output=csv",
  // CSV publicado de la pestaña de seguimiento (SegPublica), mismo documento
  seguimientoCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkxRbV34pHdMGFF99GL125xelh2PdbdmX_JF_mtIkKgU45xsVYf3C1620CiQrwqSBljbbiYWbkfqLK/pub?gid=308139092&single=true&output=csv",
  instagram: "https://www.instagram.com/rinbo.store/",
  // ID de medición de Google Analytics 4 (ej. "G-ABC123XYZ"). Vacío = sin Analytics y sin aviso de cookies.
  ga4: "G-S9EZ38B7C9",
  // Kanji decorativo de cada categoría principal (una categoría nueva usa 品)
  kanjiCategorias: { "Vestuario": "服", "Ropa": "服", "Cartas TCG": "カード", "Segunda mano": "中古", "Relojes": "時計", "Accesorios": "小物", "Coleccionables": "収集", "Tecnología": "技術", "Belleza": "美容" }
};

(() => {
  /* ---------- Utilidades ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = n => "$" + Number(n).toLocaleString("es-CL");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const saltos = s => esc(s).replace(/\n/g, "<br>");
  const numero = s => parseInt(String(s ?? "").replace(/\D/g, ""), 10) || 0;
  const wa = msg => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
  const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const PAGE = ($("main") || {}).dataset?.page;

  /* ---------- Planillas (CSV publicado) ---------- */
  function parseCSV(text) {
    const filas = [];
    let fila = [], campo = "", enComillas = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (enComillas) {
        if (c === '"' && text[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') enComillas = false;
        else campo += c;
      } else if (c === '"') enComillas = true;
      else if (c === ",") { fila.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        fila.push(campo); filas.push(fila); fila = []; campo = "";
      } else campo += c;
    }
    if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
    return filas;
  }
  async function leerCSV(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const filas = parseCSV(await res.text());
    const cab = filas[0].map(h => h.trim().toLowerCase());
    return filas.slice(1).map(f => Object.fromEntries(cab.map((h, i) => [h, (f[i] || "").trim()])));
  }

  /* ---------- Catálogo ----------
     cargarCatalogo() es la única pieza que sabe de dónde vienen los productos.
     En la fase 4 se cambia para leer desde Supabase; el resto del sitio no cambia. */
  function opcion(s) {
    const i = String(s || "").indexOf(":");
    if (i < 0) return null;
    const valores = s.slice(i + 1).split("|").map(v => v.trim()).filter(Boolean);
    return valores.length ? { nombre: s.slice(0, i).trim(), valores } : null;
  }
  function normalizar(r) {
    return {
      id: r.id, nombre: r.nombre, cat: r.categoria_principal || "", sub: r.categoria_secundaria || "", detalle: r.detalle || "",
      ops: [opcion(r.opcion_1), opcion(r.opcion_2)].filter(Boolean), desc: r.descripcion || "", estado: r.estado || "",
      precio: numero(r.precio_clp), oferta: numero(r.precio_oferta), stock: r.stock || "",
      destacado: String(r.destacado).toUpperCase() === "SI", tabla: r.tabla_tallas || "", pie: r.detalle_pie || "",
      ig: /^https?:\/\//.test(r.instagram || "") ? r.instagram : "",
      fotos: Array.from({ length: 12 }, (_, i) => r["foto_" + (i + 1)]).filter(Boolean).map(u => ({ url: u }))
    };
  }
  async function cargarCatalogo() {
    // 1º el catálogo que prepara el robot (web/datos/catalogo.json: rápido y con fotos WebP); si no existe, la planilla directa
    try {
      const res = await fetch("/datos/catalogo.json", { cache: "no-cache" });
      if (res.ok) { const d = await res.json(); if (Array.isArray(d) && d.length) return d; }
    } catch (e) {}
    const filas = await leerCSV(CONFIG.sheetCsvUrl);
    return filas.filter(r => r.id && r.nombre && String(r.publicado).toUpperCase() === "SI").map(normalizar);
  }

  let P = [];
  let CATS = [];
  const vendido = p => String(p.stock).toLowerCase() === "vendido";
  const sinPrecio = p => !(p.precio > 0);
  const enOferta = p => p.precio > 0 && p.oferta > 0 && p.oferta < p.precio;
  const precioActivo = p => enOferta(p) ? p.oferta : p.precio;
  const usado = p => /usado|semi/i.test(p.estado);
  const kanji = cat => CONFIG.kanjiCategorias[cat] || "品";
  const url = p => p.slug ? `/producto/${p.slug}/` : `/producto.html?id=${encodeURIComponent(p.id)}`;
  const urlCat = c => P.some(p => p.slug) ? `/tienda/${slug(c)}/` : `/tienda.html?cat=${slug(c)}`;

  // Links de Google Drive → miniatura del ancho pedido
  function fotoUrl(u, ancho = 1000) {
    if (!u) return "";
    const m = u.match(/\/d\/([a-zA-Z0-9_-]+)/) || u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m && /google\./.test(u) ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w${ancho}` : u;
  }
  // Marco de foto; sin foto (o si falla) muestra el kanji de la categoría
  function ph(src, jp, alt, dentro = "", eager = false) {
    const img = src ? `<img src="${esc(src)}" alt="${esc(alt)}"${eager ? "" : ' loading="lazy"'} onerror="this.parentNode.classList.add('noimg')">` : "";
    return `<div class="ph${src ? "" : " noimg"}" data-jp="${esc(jp)}">${img}${dentro}</div>`;
  }
  // Cada foto es {m, g} (WebP 600 y 1200 del robot) o {url} (link directo de la planilla)
  const fotoSrc = (f, ancho = 600) => !f ? "" : f.url ? fotoUrl(f.url, ancho) : (ancho > 600 ? f.g : f.m);
  const fotoProd = (p, i = 0, ancho = 600, dentro = "") => ph(fotoSrc(p.fotos[i], ancho), kanji(p.cat), p.nombre, dentro);

  function card(p, eager = false) {
    const flags = [
      vendido(p) && '<span class="flag sold">Vendido</span>',
      !vendido(p) && enOferta(p) && '<span class="flag sale">Oferta</span>',
      usado(p) && '<span class="flag used">Segunda mano</span>',
      !vendido(p) && p.stock === "En Chile" && '<span class="flag cl">En Chile</span>'
    ].filter(Boolean).join("");
    let price;
    if (vendido(p)) price = '<span class="clp ask">Vendido</span>';
    else if (sinPrecio(p)) price = '<span class="clp ask">A consultar</span>';
    else if (enOferta(p)) price = `<span class="clp sale num">${fmt(p.oferta)}</span><s class="num">${fmt(p.precio)}</s>`;
    else price = `<span class="clp num">${fmt(p.precio)}</span><span class="yen mono">CLP</span>`;
    let btn;
    if (vendido(p)) btn = `<button class="btn btn-line" type="button" data-like="${esc(p.id)}">Encargar uno igual <span class="ico"><svg class="i"><use href="#i-arrow"/></svg></span></button>`;
    else if (p.ops.some(o => o.valores.length > 1)) btn = `<a class="btn btn-line" href="${url(p)}">Elegir opciones <span class="ico"><svg class="i"><use href="#i-list"/></svg></span></a>`;
    else btn = `<button class="btn btn-line" type="button" data-add="${esc(p.id)}">Agregar a cotización <span class="ico"><svg class="i"><use href="#i-plus"/></svg></span></button>`;
    return `<article class="card${vendido(p) ? " sold" : ""}">
      <a href="${url(p)}" tabindex="-1" aria-hidden="true" style="display:block">${ph(fotoSrc(p.fotos[0], 600), kanji(p.cat), p.nombre, `<div class="flags">${flags}</div>`, eager)}</a>
      <div class="meta mono"><span>${esc(p.sub || p.cat)}</span></div>
      <h3><a href="${url(p)}">${esc(p.nombre)}</a></h3>
      <p class="sub">${esc(p.detalle)}</p>
      <div class="price">${price}</div>
      ${btn}
    </article>`;
  }
  const esqueleto = n => Array.from({ length: n }, () => '<article class="card skel" aria-hidden="true"><div class="ph noimg" data-jp=""></div><div class="l w40"></div><div class="l"></div><div class="l w60"></div></article>').join("");
  const errorCatalogo = () => `<div class="empty"><span class="jp">無</span><b>No pudimos cargar el catálogo.</b><p>Revisa tu conexión e intenta de nuevo, o escríbenos por WhatsApp.</p><div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center;align-items:center"><button class="btn btn-ink btn-plain" type="button" onclick="location.reload()">Reintentar</button><a class="link" href="${wa("¡Hola! Quiero ver el catálogo")}" target="_blank" rel="noopener">Escribir por WhatsApp</a></div></div>`;

  /* ---------- Cotización (se guarda en el navegador) ---------- */
  const KEY = "rinbo_cotizacion_v3";
  const opsTexto = ops => Object.entries(ops || {}).map(([k, v]) => `${k}: ${v}`).join(" · ");
  const Cot = {
    leer() { try { const d = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(d) ? d : (this._mem || []); } catch (e) { return this._mem || []; } },
    guardar(items) { this._mem = items; try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} pintar(); },
    agregar(id, ops) {
      const it = this.leer(), firma = id + "::" + JSON.stringify(ops || {});
      if (!it.some(x => x.tipo === "prod" && (x.id + "::" + JSON.stringify(x.ops || {})) === firma)) it.push({ tipo: "prod", id, ops: ops || {} });
      this.guardar(it); bump(); toast("Agregado a tu cotización");
      const p = P.find(x => x.id === id);
      medir("agregar_cotizacion", { tipo: "producto", item_id: id, item_name: p ? p.nombre : id, value: p && !sinPrecio(p) ? precioActivo(p) : 0, currency: "CLP" });
    },
    encargo(texto) { const it = this.leer(); it.push({ tipo: "enc", texto }); this.guardar(it); bump(); medir("agregar_cotizacion", { tipo: "encargo" }); },
    quitar(i) { const it = this.leer(); it.splice(i, 1); this.guardar(it); },
    resueltos() { return this.leer().map(it => it.tipo === "enc" ? it : ({ ...it, p: P.find(x => x.id === it.id) })).filter(it => it.tipo === "enc" || it.p); },
    total() { return this.resueltos().reduce((s, it) => s + (it.tipo === "prod" && !sinPrecio(it.p) ? precioActivo(it.p) : 0), 0); },
    link() {
      const items = this.resueltos();
      const lineas = items.map(it => {
        if (it.tipo === "enc") return `• ENCARGO: ${it.texto} (a cotizar)`;
        const ops = opsTexto(it.ops);
        return `• ${it.p.nombre} (${it.p.id})${ops ? " — " + ops : (it.p.detalle ? " — " + it.p.detalle : "")}${sinPrecio(it.p) ? " (precio a consultar)" : ""}`;
      });
      const hay = items.some(it => it.tipo === "enc" || sinPrecio(it.p));
      return wa(`¡Hola! Vengo de rinbo.store y quiero cotizar:\n${lineas.join("\n")}\nTotal referencial: ${fmt(this.total())} CLP${hay ? " (+ ítems a consultar)" : ""}`);
    }
  };

  function pintar() {
    const items = Cot.resueltos();
    $$(".count").forEach(c => c.textContent = items.length);
    const ul = $("#items"); if (!ul) return;
    ul.innerHTML = items.length ? items.map((it, i) => it.tipo === "enc"
      ? `<li><span class="th">代</span><div><b>Encargo: ${esc(it.texto)}</b><small>A cotizar</small></div><button class="rm" type="button" data-rm="${i}">Quitar</button></li>`
      : `<li><span class="th">${kanji(it.p.cat)}</span><div><b>${esc(it.p.nombre)}</b><small class="num">${Object.values(it.ops || {}).length ? esc(Object.values(it.ops).join(" · ")) + " · " : ""}${sinPrecio(it.p) ? "A consultar" : fmt(precioActivo(it.p))}</small></div><button class="rm" type="button" data-rm="${i}">Quitar</button></li>`).join("")
      : '<li class="sheet-empty" style="display:grid;border:0"><span class="jp">空</span><span>Tu cotización está vacía.<br>Agrega productos del catálogo<br>o escribe un encargo.</span></li>';
    $("#sheetFoot").hidden = !items.length;
    $("#total").textContent = fmt(Cot.total());
    $("#sendQuote").href = items.length ? Cot.link() : "#";
  }

  /* ---------- Hojas, menú, avisos ---------- */
  let lastFocus;
  function openSheet(el) {
    lastFocus = document.activeElement;
    $$(".sheet.is-open").forEach(s => { s.classList.remove("is-open"); s.setAttribute("aria-hidden", "true"); });
    el.classList.add("is-open"); el.setAttribute("aria-hidden", "false");
    $("#backdrop").classList.add("is-open");
    const x = el.querySelector(".x"); x && x.focus();
  }
  function closeSheets() {
    $$(".sheet.is-open").forEach(s => { s.classList.remove("is-open"); s.setAttribute("aria-hidden", "true"); });
    $("#backdrop").classList.remove("is-open");
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
  let tt;
  function toast(msg) { const t = $("#toast"); if (!t) return; $("#toastTxt").textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2400); }
  function bump() { $$(".count").forEach(c => { c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); }); }
  function openQuote(focusEnc) { openSheet($("#sheet")); if (focusEnc) setTimeout(() => $("#encInput").focus(), 350); }

  // Vista ampliada de una foto
  function lightbox(src, jp) {
    const lb = document.createElement("div");
    lb.className = "lb"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-label", "Vista ampliada");
    lb.innerHTML = `<button class="x" type="button" aria-label="Cerrar"><svg class="i"><use href="#i-close"/></svg></button>${ph(src, jp, "Vista ampliada", "", true)}`;
    lb.addEventListener("click", ev => { if (ev.target === lb || ev.target.closest(".x")) lb.remove(); });
    document.body.appendChild(lb); lb.querySelector(".x").focus();
  }

  function montarComunes() {
    $("#openQuote").addEventListener("click", () => openQuote());
    $$("[data-open-encargo]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); openQuote(true); }));
    $$("[data-close]").forEach(b => b.addEventListener("click", closeSheets));
    $("#backdrop").addEventListener("click", closeSheets);
    $("#items").addEventListener("click", e => { const r = e.target.closest("[data-rm]"); if (r) Cot.quitar(+r.dataset.rm); });
    $("#encForm").addEventListener("submit", e => {
      e.preventDefault();
      const inp = $("#encInput"), t = inp.value.trim();
      if (!t) { inp.focus(); return; }
      Cot.encargo(t); inp.value = "";
    });
    const html = document.documentElement;
    $("#menuBtn").addEventListener("click", () => { const o = html.classList.toggle("menu-open"); $("#menuBtn").setAttribute("aria-expanded", o); });
    $$("#menu a").forEach(a => a.addEventListener("click", () => { if (html.classList.contains("menu-open")) $("#menuBtn").click(); }));
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      closeSheets(); $$(".lb").forEach(l => l.remove());
      if (html.classList.contains("menu-open")) $("#menuBtn").click();
    });
    $$("[data-wa]").forEach(a => a.href = wa(a.dataset.wa));
    // Botones de tarjeta (en cualquier página)
    document.addEventListener("click", e => {
      const a = e.target.closest("[data-add]"), l = e.target.closest("[data-like]");
      if (a) {
        e.preventDefault();
        const p = P.find(x => x.id === a.dataset.add); if (!p) return;
        const ops = {}; p.ops.forEach(o => ops[o.nombre] = o.valores[0]);
        Cot.agregar(p.id, ops);
        a.classList.add("added"); a.innerHTML = 'Agregado <span class="ico"><svg class="i"><use href="#i-check"/></svg></span>';
      }
      if (l) {
        e.preventDefault();
        const p = P.find(x => x.id === l.dataset.like); if (!p) return;
        Cot.encargo(`Uno igual a: ${p.nombre} (${p.id})`); toast("Encargo agregado a tu cotización");
      }
    });
  }

  /* ---------- Medición: Google Analytics 4 (solo con CONFIG.ga4 y si la persona acepta) ---------- */
  const COOKIES = "rinbo_cookies";
  const leerPref = () => { try { return localStorage.getItem(COOKIES); } catch (e) { return null; } };
  function cargarAnalytics() {
    if (window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag("consent", "default", { analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
    gtag("js", new Date());
    gtag("config", CONFIG.ga4);
    const s = document.createElement("script");
    s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CONFIG.ga4);
    document.head.appendChild(s);
  }
  function medir(evento, datos = {}) {
    if (window.gtag && CONFIG.ga4) gtag("event", evento, { pagina: PAGE || "", ...datos });
  }
  function avisoCookies() {
    if (!CONFIG.ga4) return;
    const pref = leerPref();
    if (pref === "si") { cargarAnalytics(); return; }
    if (pref === "no") return;
    document.body.insertAdjacentHTML("beforeend", `<div class="cookies" id="cookies" role="region" aria-label="Aviso de cookies"><p>Usamos cookies de Google Analytics para saber cómo se usa el sitio y mejorarlo.</p><div class="cookies-btns"><button class="btn btn-line btn-sm btn-plain" type="button" data-cookies="no">Rechazar</button><button class="btn btn-ai btn-sm btn-plain" type="button" data-cookies="si">Aceptar</button></div></div>`);
    $("#cookies").addEventListener("click", e => {
      const b = e.target.closest("[data-cookies]"); if (!b) return;
      try { localStorage.setItem(COOKIES, b.dataset.cookies); } catch (err) {}
      $("#cookies").remove();
      if (b.dataset.cookies === "si") cargarAnalytics();
    });
  }
  // Clics que se registran como eventos (en GA4 se marcan como "eventos clave" para Google Ads)
  document.addEventListener("click", e => {
    const a = e.target.closest("a"); if (!a) return;
    if (a.id === "sendQuote" && a.getAttribute("href") !== "#") medir("pedir_cotizacion_whatsapp", { value: Cot.total(), currency: "CLP", items: Cot.resueltos().length });
    else if (a.dataset.wa !== undefined) medir("contacto_whatsapp", { texto: a.textContent.trim() });
    else if (/instagram\.com/.test(a.href)) medir("clic_instagram", { destino: a.href });
  }, true);

  /* ---------- Páginas ---------- */
  const antes = {
    home() { if (!$("#rail").children.length) $("#rail").innerHTML = esqueleto(4); },
    tienda() { if (!$("#grid").children.length) $("#grid").innerHTML = esqueleto(8); },
    producto() { if ($("#producto").dataset.static) return; $("#producto").innerHTML = '<div class="gallery skel">' + ph("", "") + '</div><div class="pdp-info skel"><div class="l w40"></div><div class="l"></div><div class="l w60"></div></div>'; }
  };

  const paginas = {
    home() {
      // Carrusel de portada (CONFIG.heroSlides)
      const slides = CONFIG.heroSlides || [];
      const track = $("#slides"), dotsBox = $("#dots");
      if (!track.children.length) track.innerHTML = slides.map((s, k) => `<div class="slide" aria-label="${k + 1} de ${slides.length}">${ph(s.img, s.jp || "輪宝", "", "", k === 0)}<div class="cap"><b>${esc(s.titulo)}</b>${s.texto ? `<span>${esc(s.texto)}</span>` : ""}</div></div>`).join("");
      if (!dotsBox.children.length) dotsBox.innerHTML = slides.length > 1 ? slides.map((_, k) => `<button type="button" aria-label="Slide ${k + 1}"${k === 0 ? ' aria-current="true"' : ""}></button>`).join("") : "";
      const dots = $$("#dots button");
      let i = 0, timer;
      const go = n => { i = (n + dots.length) % dots.length; track.scrollTo({ left: track.clientWidth * i, behavior: "smooth" }); };
      const restart = () => { clearInterval(timer); if (dots.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) timer = setInterval(() => go(i + 1), 5200); };
      track.addEventListener("scroll", () => { const n = Math.round(track.scrollLeft / track.clientWidth); dots.forEach((d, k) => d.setAttribute("aria-current", k === n)); i = n; }, { passive: true });
      dots.forEach((d, k) => d.addEventListener("click", () => { go(k); restart(); }));
      track.addEventListener("pointerdown", () => clearInterval(timer));
      restart();
      $("#homeEnc").addEventListener("submit", e => { e.preventDefault(); const inp = $("#homeEncInput"), t = inp.value.trim(); if (!t) { inp.focus(); return; } Cot.encargo(t); inp.value = ""; openSheet($("#sheet")); });
    },
    homeDatos(error) {
      if (error) { $("#rail").innerHTML = errorCatalogo(); $("#deals").closest("section").hidden = true; return; }
      let dest = P.filter(p => p.destacado);
      if (!dest.length) dest = P.filter(p => !vendido(p)).slice(0, 4);
      $("#rail").innerHTML = dest.map(card).join("");
      // Instagram: primero productos con link a Instagram, luego los más recientes con foto (6 fotos, o 3 si hay pocas)
      const conFoto = P.filter(p => p.fotos.length).reverse();
      const ig = [...conFoto.filter(p => p.ig), ...conFoto.filter(p => !p.ig)];
      const n = ig.length >= 6 ? 6 : ig.length >= 3 ? 3 : 0;
      if (n) {
        $("#igGrid").innerHTML = ig.slice(0, n).map(p => `<a class="ig-tile" href="${esc(p.ig || CONFIG.instagram)}" target="_blank" rel="noopener" aria-label="Ver en Instagram: ${esc(p.nombre)}">${fotoProd(p, 0, 400)}<span class="ig-ov"><svg class="i"><use href="#i-ig"/></svg></span></a>`).join("");
        $("#igGrid").classList.toggle("ig-3", n === 3);
        $("#igGrid").hidden = false;
      }
      // Ofertas: mayor descuento primero
      const of = P.filter(p => enOferta(p) && !vendido(p)).sort((a, b) => (b.precio - b.oferta) / b.precio - (a.precio - a.oferta) / a.precio).slice(0, 6);
      if (!of.length) { $("#deals").closest("section").hidden = true; return; }
      $("#deals").innerHTML = of.map(p => `<li><a class="deal" href="${url(p)}">${fotoProd(p, 0, 200)}<div><b>${esc(p.nombre)}</b><small>${esc(p.detalle)}</small></div><div class="pr"><span class="num">${fmt(p.oferta)}</span><s class="num">${fmt(p.precio)}</s></div></a></li>`).join("");
    },

    productoDatos(error) {
      const cont = $("#producto");
      // Página de producto ya escrita por armar.py (/producto/<nombre>/): solo se activan galería, opciones y botón
      if (cont.dataset.static) { const id = $("main").dataset.id; paginas.activarFicha(cont, id, P.find(x => x.id === id)); return; }
      // Dirección antigua producto.html?id=…
      if (error) { cont.innerHTML = errorCatalogo(); $("#relTitle").closest("section").hidden = true; return; }
      const id = new URLSearchParams(location.search).get("id") || decodeURIComponent(location.hash.slice(1));
      const p = P.find(x => x.id === id);
      if (p && p.slug) { location.replace(url(p)); return; }
      if (!p) {
        cont.innerHTML = '<p class="seg-msg" style="grid-column:1/-1">Producto no encontrado. <a class="link" href="/tienda.html">Volver al catálogo</a></p>';
        $("#relTitle").closest("section").hidden = true;
        return;
      }
      document.title = `${p.nombre} — RINBŌ Ichiba`;
      $("#crumbCat").textContent = p.cat; $("#crumbCat").href = urlCat(p.cat);
      const fotos = p.fotos.length ? p.fotos.map((_, k) => k) : [0];
      const filas = String(p.tabla).split(/\n|;/).map(f => f.trim()).filter(Boolean).map(f => f.split("|").map(c => c.trim()));
      const tabla = filas.length > 1 ? `<div class="size-table"><table><thead><tr>${filas[0].map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${filas.slice(1).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "";
      let precio;
      if (vendido(p) && sinPrecio(p)) precio = `<div class="big">Vendido</div><p class="note">Se fue a su nuevo dueño — pero podemos buscar otro en Japón</p>`;
      else if (sinPrecio(p)) precio = `<div class="big">Precio a consultar</div><p class="note">El valor en Japón varía según demanda — se confirma en tu cotización</p>`;
      else if (vendido(p)) precio = `<div class="big"><s>${fmt(precioActivo(p))}</s> Vendido</div><p class="note">Se fue a su nuevo dueño — pero podemos buscar otro en Japón</p>`;
      else if (enOferta(p)) precio = `<div class="big sale num">${fmt(p.oferta)} <small>CLP</small> <s>${fmt(p.precio)}</s></div><p class="note">Precio final en oferta · impuestos incluidos</p>`;
      else precio = `<div class="big num">${fmt(p.precio)} <small>CLP</small></div><p class="note">Precio final · impuestos incluidos</p>`;
      const stock = p.stock === "En Chile" ? '<span class="badge cl"><span class="dot"></span>En Chile · despacho inmediato</span>' : vendido(p) || !p.stock ? "" : `<span class="badge jp-st"><span class="dot"></span>${esc(p.stock)} · 2-4 semanas est.</span>`;
      cont.innerHTML = `
        <div class="gallery">
          <div class="g-track" id="gTrack">${fotos.map(k => fotoProd(p, k, 1000)).join("")}</div>
          ${fotos.length > 1 ? `<div class="g-bar"><div class="thumbs" id="thumbs">${fotos.map(k => `<button type="button" aria-label="Foto ${k + 1}" aria-current="${k === 0}">${fotoProd(p, k, 200)}</button>`).join("")}</div><span class="g-count mono num" id="gCount">1 / ${fotos.length}</span></div>` : ""}
        </div>
        <div class="pdp-info">
          <span class="cat mono">${esc(p.cat)}${p.sub ? " · " + esc(p.sub) : ""}</span>
          <h1 class="display">${esc(p.nombre)}</h1>
          ${p.detalle ? `<p class="detail">${esc(p.detalle)}</p>` : ""}
          <div class="badges">${p.estado ? `<span class="badge">${esc(p.estado)}</span>` : ""}${stock}</div>
          <div class="pdp-price">${precio}</div>
          ${!vendido(p) && p.ops.length ? p.ops.map(o => `<div class="opt-group"><span>${esc(o.nombre)} <em data-sel="${esc(o.nombre)}">${esc(o.valores[0])}</em></span><div class="opt-btns" data-op="${esc(o.nombre)}">${o.valores.map((v, k) => `<button type="button" aria-pressed="${k === 0}" data-v="${esc(v)}">${esc(v)}</button>`).join("")}</div></div>`).join("") : ""}
          <div class="buy">${vendido(p)
            ? `<button class="btn btn-ink" type="button" data-like="${esc(p.id)}">Encargar uno igual <span class="ico"><svg class="i"><use href="#i-arrow"/></svg></span></button>`
            : `<button class="btn btn-ai" type="button" id="addPdp">Agregar a mi cotización <span class="ico"><svg class="i"><use href="#i-plus"/></svg></span></button>`}</div>
          ${p.ig ? `<a class="ig-post" href="${esc(p.ig)}" target="_blank" rel="noopener"><span class="ig-post-ic"><svg class="i"><use href="#i-ig"/></svg></span><span><b>Míralo en Instagram</b><small>@rinbo.store</small></span><svg class="i"><use href="#i-arrow"/></svg></a>` : ""}
          ${p.desc ? `<div class="desc"><p>${saltos(p.desc)}</p></div>` : ""}
          ${tabla}
          ${p.pie ? `<p class="detail" style="font-size:.9rem;color:var(--muted)">${saltos(p.pie)}</p>` : ""}
        </div>`;
      paginas.activarFicha(cont, p.id, p);
      const rel = P.filter(x => x.cat === p.cat && x.id !== p.id && !vendido(x));
      const relList = (rel.length ? rel : P.filter(x => x.id !== p.id && x.destacado)).slice(0, 4);
      if (!relList.length) { $("#relTitle").closest("section").hidden = true; return; }
      $("#relTitle").textContent = rel.length ? p.cat : "Destacados";
      $("#rel").innerHTML = relList.map(card).join("");
    },

    activarFicha(cont, id, p) {
      const sel = {};
      $$(".opt-btns", cont).forEach(g => { const b = g.querySelector('[aria-pressed="true"]') || g.querySelector("button"); if (b) sel[g.dataset.op] = b.dataset.v; });
      const track = $("#gTrack"), th = $$("#thumbs button");
      track.addEventListener("scroll", () => { const n = Math.round(track.scrollLeft / track.clientWidth); th.forEach((b, k) => b.setAttribute("aria-current", k === n)); if ($("#gCount")) $("#gCount").textContent = `${n + 1} / ${th.length}`; }, { passive: true });
      th.forEach((b, k) => b.addEventListener("click", () => track.scrollTo({ left: track.clientWidth * k, behavior: "smooth" })));
      track.addEventListener("click", e => {
        const f = e.target.closest(".ph"); if (!f || f.classList.contains("noimg")) return;
        const k = [...track.children].indexOf(f), img = f.querySelector("img");
        lightbox(p && p.fotos[k] ? fotoSrc(p.fotos[k], 1600) : img.src, f.dataset.jp);
      });
      cont.addEventListener("click", e => {
        const b = e.target.closest(".opt-btns button"); if (!b) return;
        const g = b.closest("[data-op]");
        $$("button", g).forEach(x => x.setAttribute("aria-pressed", x === b));
        sel[g.dataset.op] = b.dataset.v; cont.querySelector(`[data-sel="${CSS.escape(g.dataset.op)}"]`).textContent = b.dataset.v;
      });
      $("#addPdp") && $("#addPdp").addEventListener("click", () => { Cot.agregar(id, { ...sel }); openSheet($("#sheet")); });
    },

    tiendaDatos(error) {
      if (error) { $("#grid").innerHTML = errorCatalogo(); return; }
      const POR_PAGINA = 12;
      const FILTROS = [
        { grupo: "Disponibilidad", items: [
          { k: "disp", t: "Disponibles", test: p => !vendido(p) },
          { k: "chile", t: "En Chile", test: p => p.stock === "En Chile" }] },
        { grupo: "Estado", items: [
          { k: "nuevo", t: "Nuevos", test: p => !usado(p) },
          { k: "usado", t: "Segunda mano", test: p => usado(p) }] },
        { grupo: "Precio", items: [
          { k: "oferta", t: "En oferta", test: p => enOferta(p) && !vendido(p) }] }
      ];
      const TODOS = FILTROS.flatMap(g => g.items.map(i => ({ ...i, grupo: g.grupo })));
      const st = { cat: "todos", sub: "todas", f: new Set(), orden: "rel", pag: 1 };
      // Categoría: la página /tienda/<categoria>/ la trae en data-cat; también se acepta tienda.html?cat=<categoria>
      const leerCat = () => {
        const pedido = $("main").dataset.cat || new URLSearchParams(location.search).get("cat") || decodeURIComponent(location.hash.slice(1));
        st.cat = CATS.find(c => c === pedido || slug(c) === slug(pedido || "")) || "todos"; st.sub = "todas"; st.pag = 1;
      };
      // Dentro de un mismo grupo las casillas suman (O); entre grupos se combinan (Y).
      const pasa = (p, f = st.f) => FILTROS.every(g => { const act = g.items.filter(i => f.has(i.k)); return !act.length || act.some(i => i.test(p)); });
      const base = () => P.filter(p => (st.cat === "todos" || p.cat === st.cat) && (st.sub === "todas" || p.sub === st.sub));
      function lista() {
        const r = base().filter(p => pasa(p));
        const v = p => vendido(p) || sinPrecio(p) ? null : precioActivo(p);
        if (st.orden === "rel") r.sort((a, b) => vendido(a) - vendido(b) || b.destacado - a.destacado);
        if (st.orden === "low") r.sort((a, b) => (v(a) ?? 1e12) - (v(b) ?? 1e12));
        if (st.orden === "high") r.sort((a, b) => (v(b) ?? -1) - (v(a) ?? -1));
        return r;
      }
      function render() {
        $("#catNav").innerHTML = [["todos", "Todos", "全"]].concat(CATS.map(c => [c, c, kanji(c)])).map(([k, t, jp]) => {
          const n = k === "todos" ? P.length : P.filter(p => p.cat === k).length;
          return `<a class="cat-link" href="${k === "todos" ? "/tienda.html" : urlCat(k)}" data-cat="${esc(k)}" aria-current="${st.cat === k}"><span class="jp">${jp}</span>${esc(t)}<span class="n num">${n}</span></a>`;
        }).join("");
        const subs = st.cat === "todos" ? [] : [...new Set(P.filter(p => p.cat === st.cat).map(p => p.sub).filter(Boolean))];
        $("#subNav").hidden = subs.length < 1;
        $("#subNav").innerHTML = ["todas", ...subs].map(s => `<button class="chip sm" type="button" data-sub="${esc(s)}" aria-pressed="${st.sub === s}">${s === "todas" ? "Todas" : esc(s)}</button>`).join("");
        const b = base();
        $("#filtGroups").innerHTML = FILTROS.map(g => `<fieldset class="fgroup"><legend>${g.grupo}</legend>${g.items.map(i => {
          const f2 = new Set(st.f); f2.add(i.k);
          const n = b.filter(p => pasa(p, f2)).length;
          return `<label class="check${!n && !st.f.has(i.k) ? " off" : ""}"><input type="checkbox" data-f="${i.k}" ${st.f.has(i.k) ? "checked" : ""}><span class="box"><svg class="i"><use href="#i-check"/></svg></span><span class="t">${i.t}</span><span class="n num">${n}</span></label>`;
        }).join("")}</fieldset>`).join("");
        const act = [...st.f].map(k => TODOS.find(i => i.k === k));
        if (st.sub !== "todas") act.unshift({ k: "__sub", t: st.sub });
        $("#active").hidden = !act.length;
        $("#active").innerHTML = act.map(i => `<button class="pill" type="button" data-rmf="${esc(i.k)}">${esc(i.t)}<svg class="i"><use href="#i-close"/></svg></button>`).join("") + (act.length > 1 ? '<button class="clear" type="button" data-clear>Limpiar todo</button>' : "");
        $$(".fcount").forEach(el => { el.textContent = st.f.size || ""; el.hidden = !st.f.size; });
        const r = lista(), pags = Math.max(1, Math.ceil(r.length / POR_PAGINA));
        st.pag = Math.min(st.pag, pags);
        const vis = r.slice((st.pag - 1) * POR_PAGINA, st.pag * POR_PAGINA);
        $("#count-txt").innerHTML = `<b class="num">${r.length}</b> ${r.length === 1 ? "producto" : "productos"}`;
        $("#seeN").textContent = r.length;
        $("#pageTitle").textContent = st.cat === "todos" ? "Tienda" : st.cat;
        if (!r.length) {
          $("#grid").innerHTML = `<div class="empty"><span class="jp">無</span><b>No hay productos con estos filtros.</b><p>¿Buscas algo que no está en el catálogo?</p><div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center;align-items:center"><button class="btn btn-ink btn-plain" type="button" data-clear>Limpiar filtros</button><a class="link" href="#" data-open-encargo2>Agregar a mi cotización</a></div></div>`;
        } else {
          const cells = vis.map((p, i) => card(p, i < 4));
          if (st.pag === 1) cells.splice(Math.min(6, cells.length), 0, `<aside class="promo"><span class="big-jp" aria-hidden="true">代行</span><span class="mono" style="position:relative;opacity:.8">Servicio de encargos</span><h2 class="display">¿Buscas algo que no está en el catálogo?</h2><p>Si se consigue en Japón, lo encontramos: cámaras, figuras, instrumentos, ediciones limitadas, lo que sea.</p><a class="btn" href="#" data-open-encargo2>Agregar a mi cotización <span class="ico"><svg class="i"><use href="#i-plus"/></svg></span></a></aside>`);
          $("#grid").innerHTML = cells.join("");
        }
        $("#pager").innerHTML = pags > 1 ? `<button type="button" data-pag="${st.pag - 1}" ${st.pag === 1 ? "disabled" : ""} aria-label="Página anterior"><svg class="i" style="transform:rotate(-135deg)"><use href="#i-arrow"/></svg></button>${Array.from({ length: pags }, (_, i) => `<button type="button" data-pag="${i + 1}" aria-current="${st.pag === i + 1}">${i + 1}</button>`).join("")}<button type="button" data-pag="${st.pag + 1}" ${st.pag === pags ? "disabled" : ""} aria-label="Página siguiente"><svg class="i" style="transform:rotate(45deg)"><use href="#i-arrow"/></svg></button>` : "";
      }
      const top = () => { const y = $("#shopTop").getBoundingClientRect().top + scrollY - 70; if (scrollY > y) window.scrollTo({ top: y, behavior: "smooth" }); };
      document.addEventListener("click", e => {
        const t = e.target;
        const s = t.closest("[data-sub]"); if (s) { st.sub = s.dataset.sub; st.pag = 1; render(); return; }
        const r = t.closest("[data-rmf]"); if (r) { r.dataset.rmf === "__sub" ? st.sub = "todas" : st.f.delete(r.dataset.rmf); st.pag = 1; render(); return; }
        if (t.closest("[data-clear]")) { st.f.clear(); st.sub = "todas"; st.pag = 1; render(); return; }
        const pg = t.closest("[data-pag]"); if (pg && !pg.disabled) { st.pag = +pg.dataset.pag; render(); top(); return; }
        if (t.closest("[data-open-encargo2]")) { e.preventDefault(); openQuote(true); }
      });
      $("#filtGroups").addEventListener("change", e => { const k = e.target.dataset.f; if (!k) return; e.target.checked ? st.f.add(k) : st.f.delete(k); st.pag = 1; render(); });
      $("#orden").addEventListener("change", e => { st.orden = e.target.value; render(); });
      $("#openFilters").addEventListener("click", () => openSheet($("#filters")));
      $("#seeResults").addEventListener("click", () => { closeSheets(); top(); });
      leerCat(); render();
    },

    seguimiento() {
      const ETAPAS = ["Encargo Confirmado", "Comprado en Japón", "En Bodega Japón", "Enviado a Chile", "En Tránsito a Chile", "En Aduana", "En Bodega Chile", "Enviado", "Entregado"];
      const res = $("#segRes");
      const vacio = `<div class="panel seg-res"><span class="mono" style="color:var(--muted)">Etapas</span><ol class="stages">${ETAPAS.map(s => `<li><span class="d"></span><span>${s}</span><span></span></li>`).join("")}</ol></div>`;
      res.innerHTML = vacio;
      const buscar = async codigo => (await leerCSV(CONFIG.seguimientoCsvUrl)).find(p => (p.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === codigo);
      const resultado = p => {
        const k = ETAPAS.indexOf(p.etapa);
        const evid = [p.evidencia_1, p.evidencia_2, p.evidencia_3].filter(Boolean);
        const total = numero(p.total_clp), abonado = numero(p.abonado_clp), saldo = total - abonado;
        const cuenta = total ? `<div class="account"><b>Estado de cuenta</b><div><span>Valor del pedido</span><span>${fmt(total)}</span></div><div><span>Abonado</span><span>${fmt(abonado)}</span></div>${saldo > 0
          ? `<div class="due"><span>Saldo por pagar</span><span>${fmt(saldo)}</span></div><small>El saldo se paga de acuerdo a lo informado — te avisaremos por WhatsApp.</small>`
          : '<div class="paid"><svg class="i"><use href="#i-check"/></svg><span>Pedido pagado — ¡gracias!</span></div>'}</div>` : "";
        return `<div class="panel seg-res">
          <div class="seg-top"><span class="seg-code">${esc(p.codigo)}</span><span class="mono num">${k + 1} / ${ETAPAS.length}</span></div>
          <div class="seg-now">${esc(p.etapa)}</div>
          <div class="seg-bar"><span style="transform:scaleX(${(k + 1) / ETAPAS.length})"></span></div>
          <ol class="stages">${ETAPAS.map((s, n) => `<li class="${n < k ? "done" : n === k ? "now" : ""}"><span class="d">${n < k ? '<svg class="i" style="width:12px;height:12px"><use href="#i-check"/></svg>' : ""}</span><span>${s}</span>${n === k && p.fecha_etapa ? `<time class="num">${esc(p.fecha_etapa)}</time>` : "<span></span>"}</li>`).join("")}</ol>
          ${p.comentario ? `<p class="seg-note">${saltos(p.comentario)}</p>` : ""}
          ${evid.length ? `<div class="seg-photos">${evid.map(f => `<a href="${esc(f)}" target="_blank" rel="noopener" data-evid="${esc(fotoUrl(f, 1600))}" aria-label="Ver foto del pedido">${ph(fotoUrl(f, 400), "写", "Evidencia del pedido")}</a>`).join("")}</div>` : ""}
          ${cuenta}
          ${p.comentarios_generales ? `<div class="seg-info"><b>Información de tu pedido</b><p>${saltos(p.comentarios_generales)}</p></div>` : ""}
        </div>`;
      };
      res.addEventListener("click", e => { const a = e.target.closest("[data-evid]"); if (a) { e.preventDefault(); lightbox(a.dataset.evid, "写"); } });
      $("#segForm").addEventListener("submit", async e => {
        e.preventDefault();
        const c = $("#segCode").value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!c) { $("#segCode").focus(); return; }
        res.innerHTML = '<p class="seg-msg">Buscando…</p>';
        try {
          const p = await buscar(c);
          medir("consultar_pedido", { encontrado: !!(p && ETAPAS.includes(p.etapa)) });
          res.innerHTML = p && ETAPAS.includes(p.etapa) ? resultado(p) : '<p class="seg-msg">No encontramos ese código. Revísalo o escríbenos por WhatsApp.</p>';
        } catch (err) {
          res.innerHTML = '<p class="seg-msg">No pudimos consultar en este momento. Intenta de nuevo o escríbenos por WhatsApp.</p>';
        }
      });
    },

    faq() {
      const qs = $$(".qa"), inp = $("#faqQ"), empty = $("#faqEmpty");
      const orig = new Map(qs.map(q => [q, q.innerHTML]));
      inp.addEventListener("input", () => {
        const t = inp.value.trim().toLowerCase(); let n = 0;
        qs.forEach(q => {
          q.innerHTML = orig.get(q);
          const hit = !t || q.textContent.toLowerCase().includes(t);
          q.hidden = !hit; if (hit) n++;
          if (t && hit) $$("h3,p", q).forEach(el => el.innerHTML = el.innerHTML.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>"));
        });
        if (empty) empty.hidden = n > 0;
      });
    }
  };

  /* ---------- Inicio ---------- */
  async function init() {
    montarComunes();
    avisoCookies();
    pintar();
    if (antes[PAGE]) antes[PAGE]();
    if (paginas[PAGE]) paginas[PAGE]();
    let error = false;
    try {
      P = await cargarCatalogo();
      CATS = [...new Set(P.map(p => p.cat).filter(Boolean))];
    } catch (e) {
      console.error("No se pudo leer el catálogo.", e);
      error = true;
    }
    pintar();
    if (paginas[PAGE + "Datos"]) paginas[PAGE + "Datos"](error);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
