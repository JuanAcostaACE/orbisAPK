// Estado local de la app. Solo guarda metadatos: nunca bytes de imagen ni contraseñas.
// Todo acceso a localStorage va en try/catch: si el almacenamiento no está disponible, la app sigue.
import { LOCAL_CAPTURES_LIMIT } from "./config.js";

const STORAGE_KEY = "orbis.state.v1";

const DEFAULTS = Object.freeze({
  // "ninguno" | "conectado" | "demo"
  mode: "none",
  email: null,
  name: null,
  voiceSpeed: 1,
  autoRead: true,
  captures: [],
});

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function save(state) {
  const clean = { ...state, captures: (state.captures ?? []).slice(0, LOCAL_CAPTURES_LIMIT) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Sin almacenamiento: la sesión dura solo mientras la app está abierta.
  }
  return clean;
}

export function update(changes) {
  return save({ ...load(), ...changes });
}

export function logOut() {
  return update({ mode: "none", email: null, name: null });
}
