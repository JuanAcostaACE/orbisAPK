// Historial: capturas locales (demostración y bastón) y, en modo conectado, eventos reales del backend.
import { load } from "../store.js";
import { el, badge, loading, errorMessage, empty } from "../components.js";
import { events, ApiError } from "../api.js";

const STATUS_LABELS = {
  RECEIVED: ["Recibida", "neutral"],
  PROCESSING: ["Analizando", "warning"],
  DESCRIBED: ["Descrita", "ok"],
  FAILED: ["No descrita", "error"],
};

function captureRow(c) {
  const [text, kind] = STATUS_LABELS[c.state] ?? [c.state, "neutral"];
  const date = new Date(c.createdAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
  return el("li", {}, [
    el("a", { href: `#/result/${c.id}`, "aria-label": `${date}. ${text}. ${c.description ?? "Sin descripción"}` }, [
      el("p", { className: "label", text: date }),
      el("p", {}, [badge(text, kind), " ", c.simulated ? badge("Simulada", "demo") : null]),
      el("p", { text: c.description ?? "Todavía sin descripción." }),
    ]),
  ]);
}

// Texto visible de cada modo (la API usa los valores en inglés)
const MODE_LABELS = { ACTIVE: "ACTIVO", PASSIVE: "PASIVO" };

function eventRow(e) {
  const date = e.createdAt ? new Date(e.createdAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "Sin fecha";
  const distance = e.distanceCm != null ? `${Math.round(e.distanceCm)} cm` : "distancia no disponible";
  return el("li", {}, [
    el("div", { className: "card" }, [
      el("p", { className: "label", text: date }),
      el("p", { text: `Evento ${MODE_LABELS[e.mode] ?? e.mode ?? ""}: ${distance}.` }),
      e.aiLabels ? el("p", { text: `Etiquetas de IA: ${e.aiLabels}` }) : null,
    ]),
  ]);
}

export function renderHistory(root) {
  const state = load();
  const localItems = state.captures;

  const localBlock = localItems.length
    ? el("ul", { className: "list", "aria-label": "Capturas guardadas" }, localItems.map(captureRow))
    : empty("Todavía no hay capturas", "Cuando describas el entorno, verás aquí cada resultado.", [
      el("a", { className: "button", href: "#/home", text: "Ir al inicio" }),
    ]);

  const remoteBlock = el("section", { "aria-labelledby": "t-events" }, [
    el("h2", { id: "t-events", text: "Eventos del bastón" }),
  ]);

  if (state.mode !== "connected") {
    remoteBlock.append(el("p", { text: "Los eventos del bastón solo se muestran con una cuenta conectada." }));
  } else {
    remoteBlock.append(loading("Cargando eventos…"));
    events.list(0, 20).then(
      (page) => {
        const list = page?.content ?? []; // Campo real de PaginaResponse en orbisBackend
        remoteBlock.querySelector(".loading")?.remove();
        remoteBlock.append(
          list.length
            ? el("ul", { className: "list" }, list.map(eventRow))
            : el("p", { text: "No hay eventos del bastón todavía." }),
        );
      },
      (e) => {
        remoteBlock.querySelector(".loading")?.remove();
        const message = e instanceof ApiError ? e.message : "No se pudieron cargar los eventos.";
        remoteBlock.append(errorMessage("Eventos no disponibles", message));
      },
    );
  }

  root.replaceChildren(
    el("h1", { text: "Historial" }),
    el("p", { text: "Tus capturas y resultados, del más reciente al más antiguo." }),
    el("section", { "aria-labelledby": "t-captures" }, [
      el("h2", { id: "t-captures", text: "Capturas" }),
      localBlock,
    ]),
    remoteBlock,
  );
}
