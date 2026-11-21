// Capa de voz independiente de las pantallas.
// - En Android usa el TTS nativo a través del plugin @capacitor-community/text-to-speech.
// - En navegador usa speechSynthesis (solo para desarrollo y pruebas).
// - Un solo mensaje a la vez. Un mensaje "alta" interrumpe al actual y vacía la cola.
//   Un mensaje "normal" se encola (máximo 3); si la cola está llena, se descarta.
// No confundir con TalkBack: TalkBack lee los controles de la pantalla; esta capa reproduce descripciones.
import { load } from "./store.js";

const MAX_QUEUE = 3;
const queue = [];
let playing = null; // { texto, prioridad }
let lastMessage = null;        // último mensaje, para "Repetir"
const listeners = new Set();

function plugin() {
  return window.Capacitor?.Plugins?.TextToSpeech ?? null;
}

function synthesizer() {
  return window.speechSynthesis ?? null;
}

export function hasVoice() {
  return Boolean(plugin() || synthesizer());
}

export function state() {
  return { speaking: Boolean(playing), text: playing?.text ?? null, pending: queue.length };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  const e = state();
  listeners.forEach((fn) => fn(e));
}

function finish() {
  playing = null;
  if (queue.length > 0) {
    play(queue.shift());
  } else {
    notify();
  }
}

function play(message) {
  playing = message;
  notify();
  const speed = load().voiceSpeed ?? 1;
  const native = plugin();
  if (native) {
    native
      .speak({ text: message.text, lang: "es-ES", rate: speed, pitch: 1, volume: 1, category: "ambient" })
      .then(finish, finish);
    return;
  }
  const synth = synthesizer();
  if (!synth) {
    finish();
    return;
  }
  const u = new SpeechSynthesisUtterance(message.text);
  u.lang = "es-ES";
  u.rate = speed;
  u.onend = finish;
  u.onerror = finish;
  synth.speak(u);
}

export function say(text, { priority = "normal" } = {}) {
  if (!text || !hasVoice()) return false;
  const message = { text, priority };
  lastMessage = message;
  if (priority === "high") {
    stop();
    play(message);
    return true;
  }
  if (playing) {
    if (queue.length >= MAX_QUEUE) return false;
    queue.push(message);
    notify();
    return true;
  }
  play(message);
  return true;
}

export function repeat() {
  if (!lastMessage) return false;
  return say(lastMessage.text, { priority: "high" });
}

export function stop() {
  queue.length = 0;
  try {
    plugin()?.stop();
  } catch {
    // El plugin nativo puede no estar disponible: no es un error de la app.
  }
  synthesizer()?.cancel();
  playing = null;
  notify();
}
