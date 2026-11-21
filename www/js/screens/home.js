// Pantalla principal: saludo, estado, última captura y la acción principal.
import { load } from "../store.js";
import { announce } from "../a11y.js";
import { el, badge, button, linkButton } from "../components.js";
import {
  createTestCapture, analyzeSimulated, caneStatus, imagesInMemory, SIMULATED_NOTICE,
} from "../adapters.js";

const STATUS_LABEL = {
  RECEIVED: ["Recibida", "neutral"],
  PROCESSING: ["Analizando", "warning"],
  DESCRIBED: ["Descrita", "ok"],
  FAILED: ["No se pudo describir", "error"],
};

export function renderHome(root, ctx) {
  const state = load();
  const greeting = state.name ? `Hola, ${state.name}` : "Hola";
  const cane = caneStatus(state.mode);
  const last = state.captures[0];

  const input = el("input", {
    type: "file",
    accept: "image/jpeg,image/*",
    hidden: true,
    "aria-hidden": "true",
    tabindex: "-1",
  });
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const capture = createTestCapture(file.name);
    imagesInMemory.set(capture.id, URL.createObjectURL(file));
    announce("Fotografía de prueba recibida. Analizando el entorno.");
    ctx.go(`#/result/${capture.id}`);
    analyzeSimulated(capture.id);
  });

  const action = button("Describir el entorno", {
    label: "Describir el entorno. Usa una fotografía de prueba seleccionada en el teléfono.",
    onclick: () => input.click(),
  });

  const connectionBlock = el("section", { className: "card", "aria-labelledby": "t-connection" }, [
    el("p", { className: "label", id: "t-connection", text: "Conexión" }),
    state.mode === "demo"
      ? el("p", {}, [badge("Modo demostración", "demo")])
      : state.mode === "connected"
        ? el("p", {}, [badge("Conectado a ORBIS", "ok")])
        : el("p", {}, [badge("Sin sesión", "neutral")]),
    el("p", { text: cane.message }),
  ]);

  const lastBlock = el("section", { className: "card", "aria-labelledby": "t-last" }, [
    el("p", { className: "label", id: "t-last", text: "Última captura" }),
    last
      ? el("div", {}, [
        el("p", {}, [badge(STATUS_LABEL[last.state]?.[0] ?? last.state, STATUS_LABEL[last.state]?.[1] ?? "neutral"),
          last.simulated ? " " : null,
          last.simulated ? badge("Simulada", "demo") : null]),
        el("p", { text: last.description ?? "Todavía sin descripción." }),
        linkButton("Ver resultado", `#/result/${last.id}`, "secondary"),
      ])
      : el("p", { text: "Aún no hay capturas. Describe el entorno para empezar." }),
  ]);

  const shortcuts = el("nav", { "aria-label": "Accesos rápidos" }, [
    linkButton("Historial", "#/history", "secondary"),
    linkButton("Bastón", "#/cane", "secondary"),
    linkButton("Auxiliar", "#/assistant", "secondary"),
    linkButton("Configuración", "#/settings", "secondary"),
  ]);

  root.replaceChildren(
    el("h1", { text: greeting }),
    connectionBlock,
    el("section", { "aria-labelledby": "t-action" }, [
      el("h2", { id: "t-action", text: "Describir el entorno" }),
      el("p", { text: state.mode === "demo" ? SIMULATED_NOTICE : "Se usa una fotografía de prueba hasta que el bastón esté conectado." }),
      action,
      input,
    ]),
    lastBlock,
    shortcuts,
  );
}
