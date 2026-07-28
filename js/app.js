/* ============================================================
   RINBŌ Ichiba — v2
   CONFIGURACIÓN: edita solo este bloque.
   ============================================================ */
const CONFIG = {
  // Número de WhatsApp Business SIN el "+" (código país incluido). Ej Japón: "819012345678"
  whatsapp: "819039343820",
  // Slides del carrusel de portada (edita títulos, textos y nombres de imagen en img/)
  heroSlides: [
    { img: "img/portada.jpg",  titulo: "Lo mejor de Japón, directo a tu puerta", texto: "Comprado en persona · enviado desde Japón" },
    { img: "img/slide-2.jpg",  titulo: "Drops UT de Uniqlo", texto: "Colaboraciones de Anime que no salen de Japón" },
    { img: "img/slide-3.jpg",  titulo: "Relojes japoneses", texto: "Seiko · Citizen · Orient · Casio" },
    { img: "img/slide-4.jpg",  titulo: "Cartas TCG", texto: "Pokemón · OnePiece · Magic · Entre Otras" },
    { img: "img/slide-5.jpg",  titulo: "SkinCare Perfecto", texto: "Los mejores productos para tu piel"}
  ],
  // URL CSV de la planilla pública (pestaña Catálogo publicada en la web). Vacío = productos de muestra.
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkxRbV34pHdMGFF99GL125xelh2PdbdmX_JF_mtIkKgU45xsVYf3C1620CiQrwqSBljbbiYWbkfqLK/pub?gid=344349355&single=true&output=csv"
};

const PRODUCTOS_MUESTRA = [
  { id: "TCG-001", destacado: "SI", nombre: "Pikachu ex — Terastal Festival", categoria_principal: "Cartas TCG", categoria_secundaria: "Pokémon", detalle: "SAR · japonés", descripcion: "Single comprado en tienda oficial de Japón, con boleta. Se envía protegido en sleeve + toploader y embalaje rígido.", estado: "Nuevo", precio_clp: 0, stock: "En Japón", foto_1: "", foto_2: "", foto_3: "" },
  { id: "TCG-002", nombre: "Monkey.D.Luffy — OP-09 Leader", categoria_principal: "Cartas TCG", categoria_secundaria: "One Piece", detalle: "Paralela · japonés", descripcion: "Edición japonesa. Fotos reales de la carta exacta que recibes.", estado: "Nuevo", precio_clp: 32000, stock: "Vendido", foto_1: "", foto_2: "", foto_3: "" },
  { id: "ROP-001", destacado: "SI", nombre: "Polera UT One Piece × Uniqlo", categoria_principal: "Ropa", categoria_secundaria: "Uniqlo UT", detalle: "Drop exclusivo Japón 2026", opcion_1: "Talla: S | M | L | XL", opcion_2: "Color: Blanco | Negro", descripcion: "Drop exclusivo de Japón 2026. Comprada en Uniqlo Japón, nueva con etiquetas.", estado: "Nuevo", precio_clp: 28000, stock: "En Japón", foto_1: "", foto_2: "", foto_3: "" },
  { id: "ROP-002", nombre: "Polera UT Studio Ghibli", categoria_principal: "Ropa", categoria_secundaria: "Uniqlo UT", detalle: "Solo Japón", opcion_1: "Talla: M | L", descripcion: "Colección disponible solo en Japón. Nueva con etiquetas.", estado: "Nuevo", precio_clp: 29000, stock: "Por encargo", foto_1: "", foto_2: "", foto_3: "" },
  { id: "REL-001", destacado: "SI", nombre: "Seiko 5 Sports SBSA003", categoria_principal: "Relojes", categoria_secundaria: "Seiko", detalle: "Automático · 42.5mm", descripcion: "Comprado en Japón, revisado y funcionando perfecto. Fotos reales del estado, incluidas marcas de uso.", estado: "Usado — A", precio_clp: 185000, stock: "En Chile", foto_1: "", foto_2: "", foto_3: "" },
  { id: "REL-002", destacado: "SI", nombre: "Casio A158WA vintage", categoria_principal: "Relojes", categoria_secundaria: "Casio", detalle: "Digital · acero", descripcion: "Clásico japonés. Ideal como primer reloj de colección.", estado: "Nuevo", precio_clp: 35000, precio_oferta: 29000, stock: "En Chile", foto_1: "", foto_2: "", foto_3: "" }
,
  { id: "TCG-003", nombre: "Eevee — Prismatic Evolutions", categoria_principal: "Coleccionables", categoria_secundaria: "Pokémon", detalle: "Japonés · mint", descripcion: "Single comprado en tienda oficial, con boleta.", estado: "Nuevo", precio_clp: 18000, stock: "En Japón", foto_1: "", foto_2: "", foto_3: "" },
  { id: "TEC-001", nombre: "Cámara compacta japonesa", categoria_principal: "Tecnología", categoria_secundaria: "Cámaras", detalle: "Revisada · funcionando", descripcion: "Comprada en recycle shop japonés, revisada a fondo.", estado: "Usado — A", precio_clp: 95000, stock: "En Japón", foto_1: "", foto_2: "", foto_3: "" },
  { id: "ACC-001", nombre: "Correa NATO japonesa 20mm", categoria_principal: "Accesorios", categoria_secundaria: "Relojes", detalle: "Nylon · 20mm", descripcion: "Accesorio ideal para tu Seiko o Citizen.", estado: "Nuevo", precio_clp: 12000, stock: "En Chile", foto_1: "", foto_2: "", foto_3: "" },
  { id: "ROP-003", nombre: "Polera UT Nintendo", categoria_principal: "Vestuario", categoria_secundaria: "Uniqlo UT", detalle: "Solo Japón", opcion_1: "Talla: M | L | XL", descripcion: "Drop de Japón, nueva con etiquetas.", estado: "Nuevo", precio_clp: 27000, stock: "Por encargo", foto_1: "", foto_2: "", foto_3: "" }
];

/* ============================================================ */
const fmtCLP = new Intl.NumberFormat("es-CL");
function precioActivo(p) {
  const of = parseInt(p.precio_oferta, 10);
  return (of && of > 0 && of < p.precio_clp) ? of : p.precio_clp;
}
function enOferta(p) { return p.precio_clp > 0 && precioActivo(p) !== p.precio_clp; }
function sinPrecio(p) { return !(parseInt(p.precio_clp, 10) > 0); }
function vendido(p) { return String(p.stock).toLowerCase() === "vendido"; }
function precioHTML(p, claseBase) {
  if (vendido(p)) return `<span class="${claseBase}">Vendido</span>`;
  if (sinPrecio(p)) return `<span class="${claseBase} a-consultar">A consultar</span>`;
  if (enOferta(p)) return `<span class="${claseBase}"><span class="precio-antes">$${fmtCLP.format(p.precio_clp)}</span><span class="precio-oferta">$${fmtCLP.format(precioActivo(p))}</span><small>CLP</small></span>`;
  return `<span class="${claseBase}">$${fmtCLP.format(p.precio_clp)}<small>CLP</small></span>`;
}
let PRODUCTOS = PRODUCTOS_MUESTRA;

function fotoDrive(url) {
  if (!url) return "";
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000` : url;
}

/* ---------- Opciones de producto ---------- */
function opcionesDe(p) {
  return [p.opcion_1, p.opcion_2]
    .filter(Boolean)
    .map(s => {
      const [nombre, resto] = s.split(":");
      if (!resto) return null;
      const valores = resto.split("|").map(v => v.trim()).filter(Boolean);
      return valores.length ? { nombre: nombre.trim(), valores } : null;
    })
    .filter(Boolean);
}
function opsTexto(ops) {
  return Object.entries(ops || {}).map(([k, v]) => `${k}: ${v}`).join(" · ");
}

/* ---------- Carrito (persistente en el navegador) ---------- */
const Carrito = {
  KEY: "rinbo_cotizacion_v3",
  leer() {
    try {
      const d = JSON.parse(localStorage.getItem(this.KEY));
      return Array.isArray(d) ? d : [];
    } catch { return []; }
  },
  guardar(items) { localStorage.setItem(this.KEY, JSON.stringify(items)); this.pintar(); },
  agregar(id, ops) {
    const items = this.leer();
    const firma = id + "::" + JSON.stringify(ops || {});
    if (!items.some(it => it.tipo === "prod" && (it.id + "::" + JSON.stringify(it.ops || {})) === firma)) {
      items.push({ tipo: "prod", id, ops: ops || {} });
    }
    this.guardar(items);
    abrirDrawer();
  },
  agregarEncargo(texto) {
    const items = this.leer();
    items.push({ tipo: "enc", texto });
    this.guardar(items);
    abrirDrawer();
  },
  quitar(indice) {
    const items = this.leer();
    items.splice(indice, 1);
    this.guardar(items);
  },
  resueltos() {
    return this.leer().map(it => {
      if (it.tipo === "enc") return it;
      const p = PRODUCTOS.find(x => x.id === it.id);
      return p ? { ...it, p } : null;
    }).filter(Boolean);
  },
  total() {
    return this.resueltos().reduce((s, it) => s + (it.tipo === "prod" && !sinPrecio(it.p) ? (precioActivo(it.p) || 0) : 0), 0);
  },
  linkCotizacion() {
    const lineas = this.resueltos().map(it => {
      if (it.tipo === "enc") return `• ENCARGO: ${it.texto} (a cotizar)`;
      const ops = opsTexto(it.ops);
      const extra = sinPrecio(it.p) ? " (precio a consultar)" : "";
      return `• ${it.p.nombre} (${it.p.id})${ops ? " — " + ops : (it.p.detalle ? " — " + it.p.detalle : "")}${extra}`;
    });
    const items = this.resueltos();
    const hayConsulta = items.some(it => it.tipo === "enc" || sinPrecio(it.p));
    const msg = `¡Hola! Vengo de rinbo.store y quiero cotizar:\n${lineas.join("\n")}\nTotal referencial: $${fmtCLP.format(this.total())} CLP${hayConsulta ? " (+ ítems a consultar)" : ""}`;
    return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
  },
  pintar() {
    const items = this.resueltos();
    document.querySelectorAll(".carrito-count").forEach(el => {
      el.textContent = items.length;
      el.classList.toggle("vacio", items.length === 0);
    });
    const cont = document.getElementById("drawer-items");
    if (!cont) return;
    if (!items.length) {
      cont.innerHTML = '<p class="drawer-vacio">Tu cotización está vacía.<br>Agrega productos del catálogo<br>o escribe un encargo.</p>';
    } else {
      cont.innerHTML = items.map((it, i) => {
        if (it.tipo === "enc") {
          return `
          <div class="drawer-item">
            <div>
              <div class="drawer-item-enc">Encargo</div>
              <div class="drawer-item-nombre">${it.texto}</div>
            </div>
            <div class="drawer-item-precio">a cotizar</div>
            <button class="drawer-x" data-quitar="${i}" aria-label="Quitar de la cotización">×</button>
          </div>`;
        }
        const ops = opsTexto(it.ops);
        return `
        <div class="drawer-item">
          <div>
            <div class="drawer-item-nombre">${it.p.nombre}</div>
            <div class="drawer-item-meta">${it.p.id}${ops ? " · " + ops : ""}</div>
          </div>
          <div class="drawer-item-precio">${sinPrecio(it.p) ? "a consultar" : "$" + fmtCLP.format(precioActivo(it.p))}</div>
          <button class="drawer-x" data-quitar="${i}" aria-label="Quitar de la cotización">×</button>
        </div>`;
      }).join("");
    }
    const totalEl = document.getElementById("drawer-total");
    if (totalEl) totalEl.textContent = "$" + fmtCLP.format(this.total());
    const btn = document.getElementById("drawer-cotizar");
    if (btn) {
      btn.href = items.length ? this.linkCotizacion() : "#";
      btn.style.opacity = items.length ? "" : "0.4";
      btn.style.pointerEvents = items.length ? "" : "none";
    }
  }
};

/* ---------- Drawer ---------- */
function montarDrawer() {
  const html = `
  <div class="drawer-overlay" id="drawer-overlay"></div>
  <aside class="drawer" id="drawer" aria-label="Cotización">
    <div class="drawer-head">
      <h2>Tu cotización</h2>
      <button class="drawer-cerrar" id="drawer-cerrar" aria-label="Cerrar">×</button>
    </div>
    <div class="drawer-items" id="drawer-items"></div>
    <div class="drawer-pie">
      <div class="drawer-total"><span>Total referencial</span><span id="drawer-total">$0</span></div>
      <p class="drawer-total-nota">Precios finales, impuestos incluidos · cualquier excepción se informa antes de comprar</p>
      <a class="btn btn-rojo" id="drawer-cotizar" href="#" target="_blank" rel="noopener">Pedir cotización por WhatsApp</a>
    </div>
  </aside>`;
  document.body.insertAdjacentHTML("beforeend", html);
  document.getElementById("drawer-overlay").addEventListener("click", cerrarDrawer);
  document.getElementById("drawer-cerrar").addEventListener("click", cerrarDrawer);
  document.addEventListener("click", e => {
    const q = e.target.closest("[data-quitar]");
    if (q) Carrito.quitar(parseInt(q.dataset.quitar, 10));
    const ig = e.target.closest("[data-encargar-igual]");
    if (ig) {
      e.preventDefault();
      const p = PRODUCTOS.find(x => x.id === ig.dataset.encargarIgual);
      if (p) Carrito.agregarEncargo(`Uno igual a: ${p.nombre} (${p.id})`);
      return;
    }
    const a = e.target.closest("[data-agregar]");
    if (a) {
      e.preventDefault();
      const pid = a.dataset.agregar;
      const p = PRODUCTOS.find(x => x.id === pid);
      if (p && opcionesDe(p).length && !a.dataset.conops) {
        location.href = "producto.html?id=" + encodeURIComponent(pid);
      } else if (a.dataset.conops) {
        Carrito.agregar(pid, window.__opsSeleccionadas || {});
      } else {
        Carrito.agregar(pid, {});
      }
    }
    const abrir = e.target.closest(".btn-carrito");
    if (abrir) abrirDrawer();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarDrawer(); });
  const form = document.getElementById("encargo-form");
  if (form) form.addEventListener("submit", e => {
    e.preventDefault();
    const inp = document.getElementById("encargo-input");
    const t = inp.value.trim();
    if (!t) return;
    Carrito.agregarEncargo(t);
    inp.value = "";
  });
}
function abrirDrawer() {
  document.getElementById("drawer").classList.add("abierto");
  document.getElementById("drawer-overlay").classList.add("abierto");
}
function cerrarDrawer() {
  document.getElementById("drawer").classList.remove("abierto");
  document.getElementById("drawer-overlay").classList.remove("abierto");
}

/* ---------- Catálogo ---------- */
function cardHTML(p) {
  const foto = fotoDrive(p.foto_1);
  const tieneOps = opcionesDe(p).length > 0;
  const v = vendido(p);
  const botones = v
    ? `<button class="card-add encargar-igual" data-encargar-igual="${p.id}">Encargar uno igual</button>`
    : `<button class="card-add" data-agregar="${p.id}">${tieneOps ? "Elegir opciones" : "Agregar a cotización"}</button>`;
  return `
  <div class="card${v ? " vendida" : ""}">
    <a href="producto.html?id=${encodeURIComponent(p.id)}" style="text-decoration:none;color:inherit">
      <div class="card-foto">
        ${v ? '<span class="ribbon-vendido">Vendido</span>' : ""}
        ${!v && enOferta(p) ? '<span class="tag-oferta">Oferta</span>' : ""}
        ${!v && /usado|semi/i.test(p.estado || "") ? '<span class="tag-estado">Segunda Mano</span>' : ""}
        ${foto ? `<img src="${foto}" alt="${p.nombre}" loading="lazy">` : `<span class="placeholder">${p.id}</span>`}
      </div>
      <div class="card-body">
        <span class="card-cat">${p.categoria_secundaria || p.categoria_principal}</span>
        <span class="card-nombre">${p.nombre}</span>
        ${p.detalle ? `<span class="card-detalle">${p.detalle}</span>` : ""}
        ${precioHTML(p, "card-precio")}
      </div>
    </a>
    ${botones}
  </div>`;
}

const FILTRO = { cat: "Todos", sub: "Todas", estado: "Todo" };

function pasaEstado(p) {
  const usado = /usado|semi/i.test(String(p.estado || ""));
  switch (FILTRO.estado) {
    case "Nuevos": return !usado;
    case "Segunda mano": return usado;
    case "En oferta": return enOferta(p) && !vendido(p);
    case "Disponibles": return !vendido(p);
    default: return true;
  }
}

let PAGINA = 1;

function renderGrilla() {
  const grilla = document.getElementById("grilla");
  const pp = parseInt(grilla.dataset.pp, 10) || 12;
  const visibles = PRODUCTOS
    .filter(p => FILTRO.cat === "Todos" || p.categoria_principal === FILTRO.cat)
    .filter(p => FILTRO.sub === "Todas" || (p.categoria_secundaria || "") === FILTRO.sub)
    .filter(pasaEstado);
  const totalPag = Math.max(1, Math.ceil(visibles.length / pp));
  if (PAGINA > totalPag) PAGINA = totalPag;
  const pagina = visibles.slice((PAGINA - 1) * pp, PAGINA * pp);
  grilla.innerHTML = pagina.length
    ? pagina.map(cardHTML).join("")
    : '<p class="vacio">No hay productos con estos filtros por ahora — pídelo por WhatsApp y lo buscamos en Japón.</p>';
  renderPaginacion(totalPag);
}

function renderPaginacion(totalPag) {
  const cont = document.getElementById("paginacion");
  if (!cont) return;
  const nums = totalPag > 1
    ? `<div class="pag-nums">${Array.from({ length: totalPag }, (_, i) =>
        `<button class="pag-num${i + 1 === PAGINA ? " activo" : ""}" data-pag="${i + 1}" aria-label="Página ${i + 1}">${i + 1}</button>`).join("")}</div>`
    : "";
  const cta = cont.dataset.cta ? '<a class="btn btn-linea pag-cta" href="tienda.html">Ver toda la Tienda →</a>' : "";
  cont.innerHTML = nums + cta;
  if (!cont.dataset.listo) {
    cont.dataset.listo = "1";
    cont.addEventListener("click", e => {
      const b = e.target.closest("[data-pag]");
      if (!b) return;
      PAGINA = parseInt(b.dataset.pag, 10);
      renderGrilla();
      document.getElementById("grilla").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function montarFiltros(contId, valores, onPick) {
  const cont = document.getElementById(contId);
  if (!cont) return;
  cont.innerHTML = valores.map((v, i) =>
    `<button class="filtro${i === 0 ? " activo" : ""}" data-v="${v}">${v}</button>`
  ).join("");
  if (!cont.dataset.listo) {
    cont.dataset.listo = "1";
    cont.addEventListener("click", e => {
      const btn = e.target.closest(".filtro");
      if (!btn) return;
      cont.querySelectorAll(".filtro").forEach(b => b.classList.remove("activo"));
      btn.classList.add("activo");
      cont.__onPick(btn.dataset.v);
    });
  }
  cont.__onPick = onPick;
}

function renderSubcats() {
  const cont = document.getElementById("filtros-subcat");
  if (!cont) return;
  if (FILTRO.cat === "Todos") { cont.hidden = true; cont.innerHTML = ""; return; }
  const subs = [...new Set(
    PRODUCTOS.filter(p => p.categoria_principal === FILTRO.cat)
      .map(p => (p.categoria_secundaria || "").trim()).filter(Boolean)
  )];
  if (!subs.length) { cont.hidden = true; cont.innerHTML = ""; return; }
  cont.hidden = false;
  montarFiltros("filtros-subcat", ["Todas", ...subs], v => { FILTRO.sub = v; PAGINA = 1; renderGrilla(); });
}

function renderFiltros() {
  const cats = ["Todos", ...new Set(PRODUCTOS.map(p => p.categoria_principal))];
  montarFiltros("filtros", cats, v => {
    FILTRO.cat = v;
    FILTRO.sub = "Todas";
    PAGINA = 1;
    renderSubcats();
    renderGrilla();
  });
  montarFiltros("filtros-estado", ["Todo", "Nuevos", "Segunda mano", "En oferta", "Disponibles"], v => {
    FILTRO.estado = v;
    PAGINA = 1;
    renderGrilla();
  });
  renderSubcats();
}

/* ---------- Franja de ofertas ---------- */
function renderOfertas() {
  const banda = document.getElementById("banda-ofertas");
  const row = document.getElementById("ofertas-row");
  if (!banda || !row) return;
  const ofs = PRODUCTOS
    .filter(p => enOferta(p) && !vendido(p))
    .sort((a, b) => (1 - precioActivo(b) / b.precio_clp) - (1 - precioActivo(a) / a.precio_clp))
    .slice(0, 4);
  if (!ofs.length) return;
  banda.hidden = false;
  row.innerHTML = ofs.map(cardHTML).join("");
}

/* ---------- Página de producto ---------- */
function conSaltos(t) { return String(t).replace(/\n/g, "<br>"); }
function tablaHTML(txt) {
  const filas = String(txt).split(/\n|;/).map(f => f.trim()).filter(Boolean)
    .map(f => f.split("|").map(c => c.trim()));
  if (filas.length < 2) return "";
  const head = filas[0], body = filas.slice(1);
  return `<div class="tallas">
    <p class="tallas-nota">Te recomendamos revisar la tabla de tallas o medidas antes de encargar.</p>
    <div class="tabla-scroll"><table class="tabla-tallas">
      <thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>
  </div>`;
}
function renderProducto() {
  const cont = document.getElementById("producto");
  const id = new URLSearchParams(location.search).get("id");
  const p = PRODUCTOS.find(x => x.id === id);
  if (!p) {
    cont.innerHTML = '<p class="vacio" style="grid-column:1/-1">Producto no encontrado. <a href="index.html">Volver al catálogo</a></p>';
    return;
  }
  document.title = `${p.nombre} — RINBŌ Ichiba`;
  const fotos = Array.from({ length: 12 }, (_, i) => p["foto_" + (i + 1)]).filter(Boolean).map(fotoDrive);
  const opciones = opcionesDe(p);
  window.__opsSeleccionadas = {};
  opciones.forEach(o => { window.__opsSeleccionadas[o.nombre] = o.valores[0]; });
  const badgeStock = p.stock === "En Chile"
    ? '<span class="badge stock-chile">En Chile · despacho inmediato</span>'
    : `<span class="badge">${p.stock} · 2-4 semanas est.</span>`;
  cont.innerHTML = `
    <div class="producto-galeria">
      <div class="producto-foto-main" id="foto-main">
        ${vendido(p) ? '<span class="ribbon-vendido">Vendido</span>' : ""}
        ${!vendido(p) && enOferta(p) ? '<span class="tag-oferta">Oferta</span>' : ""}
        ${fotos.length ? `<img src="${fotos[0]}" alt="${p.nombre}">` : `<span class="placeholder">${p.id}</span>`}
      </div>
      ${fotos.length > 1 ? `<div class="producto-thumbs">${fotos.map((f, i) =>
        `<button data-foto="${f}" class="${i === 0 ? "activo" : ""}" aria-label="Foto ${i + 1}"><img src="${f}" alt=""></button>`).join("")}</div>` : ""}
    </div>
    <div class="producto-info">
      <span class="card-cat">${p.categoria_principal}${p.categoria_secundaria ? " · " + p.categoria_secundaria : ""}</span>
      <h1>${p.nombre}</h1>
      ${p.detalle ? `<p class="producto-detalle">${p.detalle}</p>` : ""}
      <div class="producto-badges">
        <span class="badge badge-estado">${p.estado}</span>
        ${badgeStock}
      </div>
      ${vendido(p) && sinPrecio(p)
        ? `<div class="producto-precio">Vendido</div>
           <p class="producto-precio-nota">Se fue a su nuevo dueño — pero podemos buscar otro en Japón</p>`
        : sinPrecio(p)
        ? `<div class="producto-precio">Precio a consultar</div>
           <p class="producto-precio-nota">El valor en Japón varía según demanda — se confirma en tu cotización</p>`
        : vendido(p)
        ? `<div class="producto-precio"><span class="precio-antes">$${fmtCLP.format(precioActivo(p))}</span> Vendido</div>
           <p class="producto-precio-nota">Se fue a su nuevo dueño — pero podemos buscar otro en Japón</p>`
        : enOferta(p)
        ? `<div class="producto-precio"><span class="precio-antes">$${fmtCLP.format(p.precio_clp)}</span><span class="precio-oferta">$${fmtCLP.format(precioActivo(p))} CLP</span></div>
           <p class="producto-precio-nota">Precio final en oferta · impuestos incluidos</p>`
        : `<div class="producto-precio">$${fmtCLP.format(p.precio_clp)} CLP</div>
           <p class="producto-precio-nota">Precio final · impuestos incluidos</p>`}
      ${p.descripcion ? `<p class="producto-desc">${conSaltos(p.descripcion)}</p>` : ""}
      ${p.tabla_tallas ? tablaHTML(p.tabla_tallas) : ""}
      ${p.detalle_pie ? `<p class="detalle-pie">${conSaltos(p.detalle_pie)}</p>` : ""}
      ${opciones.length ? `<div class="opciones">${opciones.map(o => `
        <div>
          <span class="opcion-nombre">${o.nombre}</span>
          <div class="opcion-valores" data-op="${o.nombre}">
            ${o.valores.map((v, i) => `<button type="button" class="opcion-btn${i === 0 ? " activo" : ""}" data-valor="${v}">${v}</button>`).join("")}
          </div>
        </div>`).join("")}</div>` : ""}
      <div class="producto-acciones">
        ${vendido(p)
          ? `<button class="btn btn-linea" data-encargar-igual="${p.id}">Encargar uno igual</button>`
          : `<button class="btn btn-rojo" data-agregar="${p.id}" data-conops="1">Agregar a mi cotización</button>`}
      </div>
    </div>`;
  cont.addEventListener("click", e => {
    const t = e.target.closest("[data-foto]");
    if (t) {
      document.getElementById("foto-main").innerHTML = `<img src="${t.dataset.foto}" alt="${p.nombre}">`;
      cont.querySelectorAll(".producto-thumbs button").forEach(b => b.classList.remove("activo"));
      t.classList.add("activo");
      return;
    }
    const ob = e.target.closest(".opcion-btn");
    if (ob) {
      const grupo = ob.closest("[data-op]");
      grupo.querySelectorAll(".opcion-btn").forEach(b => b.classList.remove("activo"));
      ob.classList.add("activo");
      window.__opsSeleccionadas[grupo.dataset.op] = ob.dataset.valor;
    }
  });
}

/* ---------- Planilla pública (CSV publicado) ---------- */
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

async function cargarPlanilla() {
  const res = await fetch(CONFIG.sheetCsvUrl);
  const filas = parseCSV(await res.text());
  const cab = filas[0].map(h => h.trim().toLowerCase());
  return filas.slice(1)
    .map(f => Object.fromEntries(cab.map((h, i) => [h, (f[i] || "").trim()])))
    .filter(p => p.id && p.nombre && String(p.publicado).toUpperCase() === "SI")
    .map(p => ({ ...p, precio_clp: parseInt(String(p.precio_clp).replace(/\D/g, ""), 10) || 0, precio_oferta: parseInt(String(p.precio_oferta || "").replace(/\D/g, ""), 10) || 0 }));
}

/* ---------- Carrusel de portada ---------- */
function montarCarrusel() {
  const cont = document.getElementById("hero-carrusel");
  if (!cont) return;
  const slides = CONFIG.heroSlides || [];
  if (!slides.length) return;
  cont.innerHTML = slides.map((s, i) => `
    <div class="hslide${i === 0 ? " activo" : ""}">
      <div class="hslide-ph"><span class="hanko hanko-grande">輪宝</span></div>
      <img src="${s.img}" alt="" onerror="this.remove()">
      <div class="hslide-cap">${s.link ? `<a href="${s.link}">` : ""}<strong>${s.titulo || ""}</strong>${s.texto ? `<span>${s.texto}</span>` : ""}${s.link ? "</a>" : ""}</div>
    </div>`).join("") +
    (slides.length > 1 ? `<div class="hdots">${slides.map((_, i) => `<button data-dot="${i}" class="${i === 0 ? "activo" : ""}" aria-label="Ir a la diapositiva ${i + 1}"></button>`).join("")}</div>` : "");
  let idx = 0, timer = null;
  const irA = n => {
    idx = (n + slides.length) % slides.length;
    cont.querySelectorAll(".hslide").forEach((s, i) => s.classList.toggle("activo", i === idx));
    cont.querySelectorAll("[data-dot]").forEach((d, i) => d.classList.toggle("activo", i === idx));
  };
  const auto = slides.length > 1;
  const reiniciar = () => { if (!auto) return; clearInterval(timer); timer = setInterval(() => irA(idx + 1), 3000); };
  cont.addEventListener("click", e => {
    const d = e.target.closest("[data-dot]");
    if (d) { irA(parseInt(d.dataset.dot, 10)); reiniciar(); }
  });
  cont.addEventListener("mouseenter", () => clearInterval(timer));
  cont.addEventListener("mouseleave", reiniciar);
  reiniciar();
}

/* ---------- Destacados ---------- */
function renderDestacados() {
  const cont = document.getElementById("destacados");
  if (!cont) return;
  let ds = PRODUCTOS.filter(p => String(p.destacado || "").toUpperCase() === "SI");
  if (!ds.length) ds = PRODUCTOS.slice(0, 4);
  cont.innerHTML = ds.slice(0, 4).map(cardHTML).join("");
}

/* ---------- Init ---------- */
async function init() {
  if (CONFIG.sheetCsvUrl) {
    try { PRODUCTOS = await cargarPlanilla(); }
    catch (e) { console.error("No se pudo leer la planilla; usando muestra.", e); }
  }
  montarDrawer();
  Carrito.pintar();
  const mb = document.querySelector(".menu-btn");
  const navP = document.getElementById("nav-principal");
  if (mb && navP) {
    mb.addEventListener("click", () => {
      const abierto = navP.classList.toggle("abierto");
      mb.classList.toggle("abierto", abierto);
      mb.setAttribute("aria-expanded", abierto);
    });
    navP.addEventListener("click", e => { if (e.target.closest("a")) { navP.classList.remove("abierto"); mb.classList.remove("abierto"); } });
  }
  montarCarrusel();
  renderDestacados();
  const cwa = document.getElementById("contacto-wa");
  if (cwa) cwa.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent("¡Hola! Tengo una consulta")}`;
  if (document.getElementById("grilla")) { renderFiltros(); renderGrilla(); }
  renderOfertas();
  if (document.getElementById("producto")) renderProducto();
  const segWa = document.getElementById("seg-wa");
  if (segWa) {
    const msg = "¡Hola! Quiero saber el estado de mi pedido (código RIN-____)";
    segWa.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
  }
}

document.addEventListener("DOMContentLoaded", init);
