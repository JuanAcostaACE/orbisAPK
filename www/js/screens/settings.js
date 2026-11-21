// Configuración y accesibilidad: velocidad de voz, lectura automática, prueba de voz y cierre de sesión.
import { load, update, logOut } from "../store.js";
import { announce } from "../a11y.js";
import { say, hasVoice } from "../voice.js";
import { el, button } from "../components.js";
import { auth } from "../api.js";

export function renderSettings(root, ctx) {
  const state = load();

  const speed = el("input", {
    id: "speed",
    type: "range",
    min: "0.5",
    max: "1.5",
    step: "0.1",
    value: String(state.voiceSpeed),
    "aria-label": "Velocidad de la voz",
  });
  const speedValue = el("span", { id: "speed-value", text: `${state.voiceSpeed}×` });
  speed.addEventListener("input", () => {
    const v = Number(speed.value);
    update({ voiceSpeed: v });
    speedValue.textContent = `${v}×`;
    speed.setAttribute("aria-valuetext", `${v} veces la velocidad normal`);
  });

  const autoReadInput = el("input", { type: "checkbox", id: "auto-read", checked: state.autoRead });
  autoReadInput.addEventListener("change", () => update({ autoRead: autoReadInput.checked }));

  const tryBtn = button("Probar la voz", { variant: "secondary" });
  tryBtn.addEventListener("click", () => {
    if (!say("Así suena ORBIS a esta velocidad.", { priority: "high" })) {
      announce("La voz no está disponible en este dispositivo.", { urgent: true });
    }
  });

  const logoutBtn = button("Cerrar sesión", { variant: "danger", label: "Cerrar sesión" });
  logoutBtn.addEventListener("click", async () => {
    if (state.mode === "connected") {
      try {
        await auth.logout();
      } catch {
        // Aunque falle la red, la sesión local se borra igualmente.
      }
    }
    logOut();
    announce("Sesión cerrada.");
    ctx.go("#/login");
  });

  root.replaceChildren(
    el("h1", { text: "Configuración" }),
    el("section", { className: "card", "aria-labelledby": "t-voice" }, [
      el("h2", { id: "t-voice", text: "Voz" }),
      el("label", { className: "toggle", for: "speed" }, [el("span", { text: "Velocidad" }), speedValue]),
      speed,
      el("label", { className: "toggle", for: "auto-read" }, [
        el("span", { text: "Leer el resultado al terminar" }),
        autoReadInput,
      ]),
      hasVoice() ? tryBtn : el("p", { text: "Este navegador no tiene voz disponible. En el teléfono se usará la voz del sistema." }),
    ]),
    el("section", { className: "card", "aria-labelledby": "t-accessibility" }, [
      el("h2", { id: "t-accessibility", text: "Accesibilidad" }),
      el("p", { text: "ORBIS respeta la reducción de movimiento del sistema y el tamaño de letra del teléfono." }),
      el("p", { text: "Los mensajes importantes se anuncian a lectores de pantalla y a la voz." }),
    ]),
    el("section", { "aria-labelledby": "t-account" }, [
      el("h2", { id: "t-account", text: "Cuenta" }),
      el("p", { text: state.mode === "connected" ? `Sesión iniciada como ${state.email ?? "tu cuenta"}.` : "Estás en modo demostración." }),
      logoutBtn,
    ]),
  );
}
