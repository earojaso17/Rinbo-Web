// Compresión de fotos en el navegador, antes de subirlas (el plan gratis tiene 1 GB y el bucket acepta hasta 1 MB por archivo).
// Genera dos tamaños: 1200 px de ancho (ficha del producto) y 600 px (tarjetas). WebP si el navegador sabe hacerlo; si no, JPEG.
const MAX_BYTES = 900 * 1024;

async function decodificar(archivo) {
  try {
    return await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    // Navegadores antiguos: vía <img>
    const url = URL.createObjectURL(archivo);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally { URL.revokeObjectURL(url); }
  }
}

const aBlob = (canvas, tipo, calidad) => new Promise(r => canvas.toBlob(r, tipo, calidad));

async function redimensionar(fuente, anchoMax) {
  const w0 = fuente.width, h0 = fuente.height;
  const escala = Math.min(1, anchoMax / w0);
  const ancho = Math.round(w0 * escala), alto = Math.round(h0 * escala);
  const canvas = document.createElement("canvas");
  canvas.width = ancho; canvas.height = alto;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fuente, 0, 0, ancho, alto);
  for (const calidad of [0.82, 0.72, 0.62, 0.5]) {
    let blob = await aBlob(canvas, "image/webp", calidad);
    if (!blob || blob.type !== "image/webp") {
      // Sin WebP (algunos iPhone): JPEG con fondo blanco (JPEG no tiene transparencia)
      const c2 = document.createElement("canvas");
      c2.width = ancho; c2.height = alto;
      const x = c2.getContext("2d");
      x.fillStyle = "#fff"; x.fillRect(0, 0, ancho, alto); x.drawImage(canvas, 0, 0);
      blob = await aBlob(c2, "image/jpeg", calidad);
    }
    if (blob.size <= MAX_BYTES || calidad === 0.5) return { blob, ancho, alto };
  }
}

export async function prepararFoto(archivo) {
  if (!archivo.type.startsWith("image/")) throw new Error("El archivo no es una imagen.");
  const fuente = await decodificar(archivo);
  const grande = await redimensionar(fuente, 1200);
  const chica = await redimensionar(fuente, 600);
  if (grande.blob.size > 1024 * 1024) throw new Error("La foto quedó muy pesada incluso comprimida.");
  const tipo = grande.blob.type;
  return { grande, chica, tipo, ext: tipo === "image/webp" ? "webp" : "jpg" };
}
