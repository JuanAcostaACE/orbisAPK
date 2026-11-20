// Prepara una fotografía para subirla: la reduce en el teléfono porque el servidor rechaza más de 512 KB.
// Resultado: un Blob JPEG (empieza por FF D8, termina en FF D9, entre 5 KB y 480 KB). Nunca se guarda en disco.
export const LADO_MAX_PX = 800;
export const MAX_BYTES = 480 * 1024;
export const MIN_BYTES = 5 * 1024;
const CALIDADES = [0.8, 0.7, 0.6, 0.5];
const LADO_MIN_PX = 320;

export class ErrorImagen extends Error {}

async function cargarImagen(archivo) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(archivo);
      return { fuente: bitmap, ancho: bitmap.width, alto: bitmap.height, liberar: () => bitmap.close?.() };
    } catch {
      // Se prueba con el elemento img.
    }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, liberar: () => {} };
  } catch {
    throw new ErrorImagen("No pude leer la fotografía. Prueba con otra.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function aBlob(canvas, calidad) {
  return new Promise((resolver) => canvas.toBlob(resolver, "image/jpeg", calidad));
}

// Comprueba que los bytes son un JPEG completo (marcadores de inicio y fin).
export async function esJpegCompleto(blob) {
  if (!blob || blob.size < 4) return false;
  const ini = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  const fin = new Uint8Array(await blob.slice(blob.size - 2).arrayBuffer());
  return ini[0] === 0xff && ini[1] === 0xd8 && fin[0] === 0xff && fin[1] === 0xd9;
}

export async function prepararFotografia(archivo) {
  const { fuente, ancho, alto, liberar } = await cargarImagen(archivo);
  try {
    if (!ancho || !alto) throw new ErrorImagen("No pude leer la fotografía. Prueba con otra.");
    let lado = Math.min(LADO_MAX_PX, Math.max(ancho, alto)); // nunca se amplía
    const ladoMinimo = Math.min(LADO_MIN_PX, lado);
    let ultimo = null;
    while (lado >= ladoMinimo) {
      const escala = lado / Math.max(ancho, alto);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(ancho * escala));
      canvas.height = Math.max(1, Math.round(alto * escala));
      const g = canvas.getContext("2d");
      g.fillStyle = "#fff"; // evita fondo negro si la imagen tiene transparencia
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.drawImage(fuente, 0, 0, canvas.width, canvas.height);
      for (const calidad of CALIDADES) {
        const blob = await aBlob(canvas, calidad);
        if (!blob) throw new ErrorImagen("No pude preparar la fotografía. Prueba con otra.");
        ultimo = blob;
        if (blob.size <= MAX_BYTES) {
          if (blob.size < MIN_BYTES || !(await esJpegCompleto(blob))) {
            throw new ErrorImagen("La fotografía es demasiado pequeña o no es válida. Prueba con otra.");
          }
          return blob;
        }
      }
      if (lado === ladoMinimo) break;
      lado = Math.max(ladoMinimo, Math.floor(lado * 0.8));
    }
    throw new ErrorImagen(
      ultimo ? "No pude reducir la fotografía lo suficiente. Prueba con otra." : "No pude preparar la fotografía.",
    );
  } finally {
    liberar();
  }
}
