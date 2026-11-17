// ADAPTADORES: todo lo que la app muestra y que NO viene de un endpoint real.
// Cada función indica si es simulada. Nunca se presenta una simulación como dato real.
import { actualizar, cargar } from "./store.js";

// ── Modo demostración: descripciones SIMULADAS ─────────────────────────────
// No hay modelo de visión conectado a la app. Las descripciones son fijas y se
// etiquetan como simuladas en la interfaz y en la voz.
const DESCRIPCIONES_SIMULADAS = [
  { descripcion: "Hay una puerta delante y una persona a tu derecha.", elementos: ["puerta", "persona"] },
  { descripcion: "Hay una mesa con varios objetos al frente.", elementos: ["mesa", "objetos"] },
  { descripcion: "Hay una silla cerca de la pared de la izquierda.", elementos: ["silla", "pared"] },
];

export const AVISO_SIMULADO =
  "Demostración: esta descripción es simulada. No analiza tu fotografía.";

export const AVISO_SIN_ALERTAS =
  "No se han detectado alertas en esta demostración. Eso no significa que el camino esté libre.";

function identificador() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function guardarCaptura(captura) {
  const estado = cargar();
  const lista = [captura, ...estado.capturas.filter((c) => c.id !== captura.id)];
  actualizar({ capturas: lista });
}

export function crearCapturaPrueba(nombreArchivo) {
  const captura = {
    id: identificador(),
    origen: "prueba",          // "prueba" = fotografía seleccionada; "dispositivo" = bastón real
    simulado: true,
    estado: "RECIBIDA",
    nombre: nombreArchivo || "fotografía de prueba",
    creadaEn: new Date().toISOString(),
    descripcion: null,
    elementos: [],
    alertas: [],
    confianza: null,           // sin modelo real no hay confianza que mostrar
  };
  guardarCaptura(captura);
  return captura;
}

// Recorre los estados visibles y termina en DESCRITA con una descripción simulada.
export function analizarSimulado(id, { alCambiar } = {}) {
  const pasos = [
    { estado: "EN_PROCESO", espera: 900 },
    { estado: "DESCRITA", espera: 1400 },
  ];
  let indice = 0;
  const siguiente = () => {
    const capturaActual = cargar().capturas.find((c) => c.id === id);
    if (!capturaActual) return;
    if (indice >= pasos.length) return;
    const paso = pasos[indice];
    let cambios = { estado: paso.estado };
    if (paso.estado === "DESCRITA") {
      const elegida = DESCRIPCIONES_SIMULADAS[Math.abs(hash(id)) % DESCRIPCIONES_SIMULADAS.length];
      cambios = { ...cambios, descripcion: elegida.descripcion, elementos: elegida.elementos };
    }
    const actualizada = { ...capturaActual, ...cambios };
    guardarCaptura(actualizada);
    alCambiar?.(actualizada);
    indice += 1;
    if (indice < pasos.length) setTimeout(siguiente, pasos[indice - 1].espera);
  };
  setTimeout(siguiente, 300);
}

function hash(texto) {
  let h = 0;
  for (const ch of texto) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

// Imágenes solo en memoria de la sesión: nunca se escriben en el almacenamiento local.
export const imagenesEnMemoria = new Map();

// ── Bastón ──────────────────────────────────────────────────────────────────
// El backend NO expone todavía el estado del bastón ni su última comunicación.
// La app no simula una conexión: muestra que no hay datos reales.
export function estadoBaston(modo) {
  if (modo === "demo") {
    return {
      conectado: false,
      origen: "demo",
      mensaje: "Modo demostración: no hay ningún bastón conectado.",
    };
  }
  return {
    conectado: false,
    origen: "pendiente",
    mensaje:
      "Todavía no se puede consultar el estado del bastón. El backend aún no ofrece este dato.",
  };
}

// ── Auxiliar ───────────────────────────────────────────────────────────────
// La vinculación con auxiliares (invitación, aceptación, revocación) no existe en el backend.
export const MENSAJE_AUXILIAR_PENDIENTE =
  "La vinculación con una persona auxiliar todavía no está disponible. El backend aún no la implementa.";
