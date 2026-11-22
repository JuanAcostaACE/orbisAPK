// Resultado de un análisis: fotografía, descripción, estado, voz y alertas.
// Nunca presenta una predicción como certeza: las demostraciones se etiquetan como simuladas.
import { load } from "../store.js";
import { announce } from "../a11y.js";
import { say, stop, subscribe } from "../voice.js";
import { el, badge, button, empty, loading } from "../components.js";
import { imagesInMemory, SIMULATED_NOTICE, NO_ALERTS_NOTICE } from "../adapters.js";

const LABELS = {
  RECEIVED: ["Recibida", "neutral"],
  PROCESSING: ["Analizando el entorno", "warning"],
  DESCRIBED: ["Descripción lista", "ok"],
  FAILED: ["No se pudo interpretar la imagen", "error"],
};

export function renderResult(root, ctx, id) {
  const capture = load().captures.find((c) => c.id === id);
  if (!capture) {
    root.replaceChildren(
      empty("No encontramos ese resultado", "Puede que sea una demostración que ya no está guardada.", [
        el("a", { className: "button", href: "#/home", text: "Volver al inicio" }),
      ]),
    );
    return;
  }

  const statusContainer = el("div", { "aria-live": "polite" });
  const descriptionContainer = el("div");
  const voiceContainer = el("p", { className: "label", "aria-live": "polite", id: "voice-status" });
  const imageUrl = imagesInMemory.get(capture.id);

  const listen = button("Escuchar de nuevo", { label: "Escuchar la descripción de nuevo" });
  const stopBtn = button("Detener", { variant: "secondary", label: "Detener la lectura" });
  listen.addEventListener("click", () => {
    const text = current().description;
    if (!text) return;
    if (!say(text, { priority: "high" })) announce("La voz no está disponible en este dispositivo.", { urgent: true });
  });
  stopBtn.addEventListener("click", () => stop());

  function current() {
    return load().captures.find((c) => c.id === id) ?? capture;
  }

  function paint() {
    const c = current();
    const [text, kind] = LABELS[c.state] ?? [c.state, "neutral"];
    statusContainer.replaceChildren(
      el("p", {}, [badge(text, kind), " ", c.simulated ? badge("Simulada", "demo") : null]),
    );

    if (c.state !== "DESCRIBED" && c.state !== "FAILED") {
      descriptionContainer.replaceChildren(loading("Analizando la fotografía…"));
      return;
    }
    if (c.state === "FAILED") {
      descriptionContainer.replaceChildren(
        el("div", { className: "error-message", role: "alert" }, [
          el("strong", { text: "No pude interpretar correctamente la imagen." }),
          el("p", { text: "Inténtalo de nuevo con otra fotografía." }),
        ]),
      );
      return;
    }

    descriptionContainer.replaceChildren(
      el("section", { "aria-labelledby": "t-description" }, [
        el("h2", { id: "t-description", text: "Descripción del entorno" }),
        el("p", { className: "card", text: c.description }),
        c.elements?.length
          ? el("section", { "aria-labelledby": "t-elements" }, [
            el("h2", { id: "t-elements", text: "Elementos reconocidos" }),
            el("ul", { className: "list" }, c.elements.map((e) => el("li", { text: e }))),
          ])
          : null,
        el("section", { "aria-labelledby": "t-alerts" }, [
          el("h2", { id: "t-alerts", text: "Alertas" }),
          el("p", { text: NO_ALERTS_NOTICE }),
        ]),
        c.simulated ? el("p", { className: "card", role: "note", text: SIMULATED_NOTICE }) : null,
      ]),
    );
  }

  const image = imageUrl
    ? el("img", { className: "result-image", src: imageUrl, alt: "Fotografía de prueba seleccionada para este resultado" })
    : el("p", { className: "card", text: "La imagen ya no está disponible en esta sesión." });

  root.replaceChildren(
    el("h1", { text: "Resultado" }),
    statusContainer,
    image,
    descriptionContainer,
    el("div", { className: "card" }, [voiceContainer, listen, stopBtn]),
    el("p", {}, [el("a", { href: "#/home", text: "Volver al inicio" })]),
  );
  paint();

  // Actualiza mientras el análisis está en curso y lee el resultado al terminar.
  let read = false;
  const interval = setInterval(() => {
    const c = current();
    paint();
    if (c.state === "DESCRIBED" && !read) {
      read = true;
      if (load().autoRead) say(c.description);
      announce("Descripción lista.");
    }
    if (c.state === "DESCRIBED" || c.state === "FAILED") clearInterval(interval);
  }, 400);
  ctx.onLeave(() => clearInterval(interval));

  const unsubscribe = subscribe((e) => {
    voiceContainer.textContent = e.speaking ? "Reproduciendo la descripción…" : "Lectura detenida o terminada.";
  });
  ctx.onLeave(unsubscribe);
}
