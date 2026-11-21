// Arranque y enrutador. Rutas por hash: funcionan igual en navegador y dentro de Capacitor.
import { load, update, logOut } from "./store.js";
import { auth, ApiError } from "./api.js";
import { announce, announceTitle, focusTitle, connectionStatus } from "./a11y.js";
import { renderLogin, renderRegister } from "./screens/access.js";
import { renderHome } from "./screens/home.js";
import { renderResult } from "./screens/result.js";
import { renderHistory } from "./screens/history.js";
import { renderCane } from "./screens/cane.js";
import { renderAssistant } from "./screens/assistant.js";
import { renderSettings } from "./screens/settings.js";

const PUBLIC_ROUTES = new Set(["login", "register"]);

const ROUTES = {
  login: { title: "Iniciar sesión", render: renderLogin },
  register: { title: "Crear cuenta", render: renderRegister },
  home: { title: "Inicio", render: renderHome },
  result: { title: "Resultado", render: renderResult },
  history: { title: "Historial", render: renderHistory },
  cane: { title: "Bastón", render: renderCane },
  assistant: { title: "Auxiliar", render: renderAssistant },
  settings: { title: "Configuración", render: renderSettings },
};

const root = document.getElementById("content");
const navBar = document.getElementById("navbar");
let cleanups = [];
let generation = 0; // evita pintar una pantalla antigua si el usuario navega deprisa

function readRoute() {
  const parts = (location.hash || "#/").replace(/^#\/?/, "").split("/");
  return { name: parts[0] || "home", arg: parts.slice(1).join("/") };
}

function go(hash) {
  if (location.hash === hash) {
    navigate();
  } else {
    location.hash = hash;
  }
}

function onLeave(fn) {
  cleanups.push(fn);
}

function clearScreen() {
  cleanups.forEach((fn) => {
    try {
      fn();
    } catch {
      // Una limpieza fallida no debe impedir cambiar de pantalla.
    }
  });
  cleanups = [];
}

function updateNavigation(state, name) {
  const visible = state.mode !== "none";
  navBar.hidden = !visible;
  navBar.querySelectorAll("a").forEach((a) => {
    if (a.dataset.route === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function connectionText(state) {
  if (state.mode === "connected") return "Conectado";
  if (state.mode === "demo") return "Demostración";
  return "Sin sesión";
}

async function navigate() {
  const mine = ++generation;
  clearScreen();
  let state = load();
  const { name, arg } = readRoute();

  if (state.mode === "none" && !PUBLIC_ROUTES.has(name)) {
    location.hash = "#/login";
    return;
  }
  if (state.mode !== "none" && (name === "login" || name === "register")) {
    location.hash = "#/home";
    return;
  }

  const route = ROUTES[name] ?? ROUTES.home;
  document.title = `${route.title} · ORBIS`;
  updateNavigation(state, name);
  connectionStatus(connectionText(state));

  const context = { go, onLeave, state };
  route.render(root, context, arg);
  if (mine !== generation) return;
  focusTitle(root);
  announceTitle(route.title);
}

// Al arrancar, un modo "conectado" se verifica contra el backend. Una sesión caducada vuelve al acceso.
async function restoreSession() {
  const state = load();
  if (state.mode !== "connected") return;
  try {
    const me = await auth.me();
    update({ email: me?.email ?? state.email });
  } catch (e) {
    if (e instanceof ApiError && e.code === "SESSION_EXPIRED") {
      logOut();
      announce("Tu sesión ha caducado. Inicia sesión de nuevo.", { urgent: true });
    }
    // Sin red no se cierra la sesión: la app puede mostrar datos locales.
  }
}

window.addEventListener("hashchange", navigate);

restoreSession().finally(() => {
  if (!location.hash) location.hash = "#/home";
  navigate();
});
