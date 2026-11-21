// ADAPTADORES: todo lo que la app muestra y que NO viene de un endpoint real.
// Cada función indica si es simulada. Nunca se presenta una simulación como dato real.
import { update, load } from "./store.js";

// ── Modo demostración: descripciones SIMULADAS ─────────────────────────────
// No hay modelo de visión conectado a la app. Las descripciones son fijas y se
// etiquetan como simuladas en la interfaz y en la voz.
const SIMULATED_DESCRIPTIONS = [
  { description: "Hay una puerta delante y una persona a tu derecha.", elements: ["puerta", "persona"] },
  { description: "Hay una mesa con varios objetos al frente.", elements: ["mesa", "objetos"] },
  { description: "Hay una silla cerca de la pared de la izquierda.", elements: ["silla", "pared"] },
];

export const SIMULATED_NOTICE =
  "Demostración: esta descripción es simulada. No analiza tu fotografía.";

export const NO_ALERTS_NOTICE =
  "No se han detectado alertas en esta demostración. Eso no significa que el camino esté libre.";

function makeId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function saveCapture(capture) {
  const state = load();
  const list = [capture, ...state.captures.filter((c) => c.id !== capture.id)];
  update({ captures: list });
}

export function createTestCapture(fileName) {
  const capture = {
    id: makeId(),
    source: "test",          // "prueba" = fotografía seleccionada; "dispositivo" = bastón real
    simulated: true,
    state: "RECEIVED",
    name: fileName || "fotografía de prueba",
    createdAt: new Date().toISOString(),
    description: null,
    elements: [],
    alerts: [],
    confidence: null,           // sin modelo real no hay confianza que mostrar
  };
  saveCapture(capture);
  return capture;
}

// Recorre los estados visibles y termina en DESCRIBED con una descripción simulada.
export function analyzeSimulated(id, { onChange } = {}) {
  const steps = [
    { state: "PROCESSING", delay: 900 },
    { state: "DESCRIBED", delay: 1400 },
  ];
  let index = 0;
  const next = () => {
    const currentCapture = load().captures.find((c) => c.id === id);
    if (!currentCapture) return;
    if (index >= steps.length) return;
    const step = steps[index];
    let changes = { state: step.state };
    if (step.state === "DESCRIBED") {
      const chosen = SIMULATED_DESCRIPTIONS[Math.abs(hash(id)) % SIMULATED_DESCRIPTIONS.length];
      changes = { ...changes, description: chosen.description, elements: chosen.elements };
    }
    const updated = { ...currentCapture, ...changes };
    saveCapture(updated);
    onChange?.(updated);
    index += 1;
    if (index < steps.length) setTimeout(next, steps[index - 1].delay);
  };
  setTimeout(next, 300);
}

function hash(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

// Imágenes solo en memoria de la sesión: nunca se escriben en el almacenamiento local.
export const imagesInMemory = new Map();

// ── Bastón ──────────────────────────────────────────────────────────────────
// El backend NO expone todavía el estado del bastón ni su última comunicación.
// La app no simula una conexión: muestra que no hay datos reales.
export function caneStatus(mode) {
  if (mode === "demo") {
    return {
      connected: false,
      source: "demo",
      message: "Modo demostración: no hay ningún bastón conectado.",
    };
  }
  return {
    connected: false,
    source: "pending",
    message:
      "Todavía no se puede consultar el estado del bastón. El backend aún no ofrece este dato.",
  };
}

// ── Auxiliar ───────────────────────────────────────────────────────────────
// La vinculación con auxiliares (invitación, aceptación, revocación) no existe en el backend.
export const ASSISTANT_PENDING_MESSAGE =
  "La vinculación con una persona auxiliar todavía no está disponible. El backend aún no la implementa.";
