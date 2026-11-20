// Análisis REAL de una fotografía en la nube (modo conectado): reducir -> subir -> sondear.
// En el teléfono solo se guardan metadatos (id, estado, descripción, etiquetas, fecha). Nunca bytes de imagen.
import { capturas, ErrorApi } from "./api.js";
import { actualizar, cargar } from "./store.js";
import { prepararFotografia } from "./imagen.js";
import { INTERVALO_SONDEO_MS, TIEMPO_MAX_ANALISIS_MS } from "./config.js";

export const MENSAJE_TARDANZA = "El análisis está tardando más de lo normal. Puedes volver a intentarlo.";
export const AVISO_REAL = "Detecta objetos de 80 categorías. No mide distancias ni garantiza que el camino esté libre.";
export const INSIGNIA_REAL = "Análisis real (YOLOX-Nano)";

// Imagen ya reducida, solo en memoria de la sesión (para reintentar sin volver a elegirla).
export const fotografiasEnMemoria = new Map();

export function uuidV4() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const esTerminal = (estado) => estado === "DESCRITA" || estado === "FALLIDA";

function guardar(id, cambios) {
  const estado = cargar();
  const actual = estado.capturas.find((c) => c.id === id);
  if (!actual) return null;
  const nueva = { ...actual, ...cambios };
  actualizar({ capturas: [nueva, ...estado.capturas.filter((c) => c.id !== id)] });
  return nueva;
}

// Solo metadatos de la respuesta del servidor.
function metadatos(r) {
  return {
    estado: r.estado,
    descripcion: r.descripcion ?? null,
    etiquetas: Array.isArray(r.etiquetas) ? r.etiquetas : [],
    motivoFallo: r.motivoFallo ?? null,
  };
}

function dormir(ms, senal) {
  return new Promise((resolver) => {
    const t = setTimeout(resolver, ms);
    senal?.addEventListener("abort", () => { clearTimeout(t); resolver(); }, { once: true });
  });
}

// Consulta el estado cada INTERVALO hasta DESCRITA/FALLIDA o hasta agotar TIEMPO_MAX.
// Devuelve { tiempoAgotado: false, captura } o { tiempoAgotado: true, captura } (la última conocida, sin inventar nada).
// Una sesión caducada (401) o un 404 detienen el sondeo lanzando el error. Fallos de red/5xx se reintentan.
export async function sondear(id, { alCambiar, senal, intervalo = INTERVALO_SONDEO_MS, maximo = TIEMPO_MAX_ANALISIS_MS } = {}) {
  const inicio = Date.now();
  let ultima = null;
  while (Date.now() - inicio < maximo) {
    await dormir(intervalo, senal);
    if (senal?.aborted) return { tiempoAgotado: false, cancelado: true, captura: ultima };
    try {
      const r = await capturas.estado(id);
      ultima = r;
      alCambiar?.(r);
      if (esTerminal(r.estado)) return { tiempoAgotado: false, captura: r };
    } catch (e) {
      if (e instanceof ErrorApi && (e.status === 401 || (e.status >= 400 && e.status < 500 && e.status !== 429))) throw e;
    }
  }
  return { tiempoAgotado: true, captura: ultima };
}

// Sondea una captura local y vuelca el progreso en el estado local.
export async function sondearLocal(id) {
  guardar(id, { tardando: false });
  try {
    const { tiempoAgotado, captura } = await sondear(id, {
      alCambiar: (r) => guardar(id, { ...metadatos(r), tardando: false, aviso: null }),
    });
    if (tiempoAgotado) guardar(id, { tardando: true, aviso: MENSAJE_TARDANZA });
    return captura;
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 401) return null; // api.js ya avisó de la sesión caducada
    guardar(id, { estado: "FALLIDA", motivoFallo: "ENVIO", aviso: e?.message ?? "No se pudo consultar el análisis." });
    return null;
  }
}

// Flujo completo. El resultado se ve en la pantalla de resultado, que lee el estado local.
export async function analizarReal(archivo, id, { blob } = {}) {
  const captura = {
    id,
    origen: "real",
    simulado: false,
    estado: "PREPARANDO",
    nombre: archivo?.name || "fotografía",
    creadaEn: new Date().toISOString(),
    descripcion: null,
    etiquetas: [],
    motivoFallo: null,
    aviso: null,
    tardando: false,
  };
  actualizar({ capturas: [captura, ...cargar().capturas.filter((c) => c.id !== id)] });
  try {
    const preparada = blob ?? (await prepararFotografia(archivo));
    fotografiasEnMemoria.set(id, preparada);
    await capturas.subir(preparada, id);
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 401) return;
    guardar(id, { estado: "FALLIDA", motivoFallo: "ENVIO", aviso: e?.message ?? "No se pudo enviar la fotografía." });
    return;
  }
  guardar(id, { estado: "RECIBIDA" });
  await sondearLocal(id);
}
