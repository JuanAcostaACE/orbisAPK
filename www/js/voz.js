// Capa de voz independiente de las pantallas.
// - En Android usa el TTS nativo a través del plugin @capacitor-community/text-to-speech.
// - En navegador usa speechSynthesis (solo para desarrollo y pruebas).
// - Un solo mensaje a la vez. Un mensaje "alta" interrumpe al actual y vacía la cola.
//   Un mensaje "normal" se encola (máximo 3); si la cola está llena, se descarta.
// No confundir con TalkBack: TalkBack lee los controles de la pantalla; esta capa reproduce descripciones.
import { cargar } from "./store.js";

const MAX_COLA = 3;
const cola = [];
let reproduciendo = null; // { texto, prioridad }
let ultimo = null;        // último mensaje, para "Repetir"
const oyentes = new Set();

function plugin() {
  return window.Capacitor?.Plugins?.TextToSpeech ?? null;
}

function sintetizador() {
  return window.speechSynthesis ?? null;
}

export function hayVoz() {
  return Boolean(plugin() || sintetizador());
}

export function estado() {
  return { hablando: Boolean(reproduciendo), texto: reproduciendo?.texto ?? null, pendientes: cola.length };
}

export function suscribir(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

function notificar() {
  const e = estado();
  oyentes.forEach((fn) => fn(e));
}

function terminar() {
  reproduciendo = null;
  if (cola.length > 0) {
    reproducir(cola.shift());
  } else {
    notificar();
  }
}

function reproducir(mensaje) {
  reproduciendo = mensaje;
  notificar();
  const velocidad = cargar().velocidadVoz ?? 1;
  const nativo = plugin();
  if (nativo) {
    nativo
      .speak({ text: mensaje.texto, lang: "es-ES", rate: velocidad, pitch: 1, volume: 1, category: "ambient" })
      .then(terminar, terminar);
    return;
  }
  const sint = sintetizador();
  if (!sint) {
    terminar();
    return;
  }
  const u = new SpeechSynthesisUtterance(mensaje.texto);
  u.lang = "es-ES";
  u.rate = velocidad;
  u.onend = terminar;
  u.onerror = terminar;
  sint.speak(u);
}

export function decir(texto, { prioridad = "normal" } = {}) {
  if (!texto || !hayVoz()) return false;
  const mensaje = { texto, prioridad };
  ultimo = mensaje;
  if (prioridad === "alta") {
    detener();
    reproducir(mensaje);
    return true;
  }
  if (reproduciendo) {
    if (cola.length >= MAX_COLA) return false;
    cola.push(mensaje);
    notificar();
    return true;
  }
  reproducir(mensaje);
  return true;
}

export function repetir() {
  if (!ultimo) return false;
  return decir(ultimo.texto, { prioridad: "alta" });
}

export function detener() {
  cola.length = 0;
  try {
    plugin()?.stop();
  } catch {
    // El plugin nativo puede no estar disponible: no es un error de la app.
  }
  sintetizador()?.cancel();
  reproduciendo = null;
  notificar();
}
