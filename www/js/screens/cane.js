// Sección del bastón: estado real, vinculación y errores. No simula una conexión física.
import { load } from "../store.js";
import { announce } from "../a11y.js";
import { el, badge, button, row, errorMessage } from "../components.js";
import { devices, ApiError } from "../api.js";
import { caneStatus } from "../adapters.js";

function spellOut(code) {
  // Se lee letra a letra para que el lector de pantalla no lo pronuncie como palabra.
  return code.split("").join(" ");
}

export function renderCane(root) {
  const state = load();
  const cane = caneStatus(state.mode);
  const codeArea = el("div", { "aria-live": "polite" });

  const generate = button("Generar código de vinculación", {
    label: "Generar código de vinculación para registrar un bastón",
    disabled: state.mode !== "connected",
  });
  generate.addEventListener("click", async () => {
    generate.disabled = true;
    try {
      const r = await devices.pairingCode();
      codeArea.replaceChildren(
        el("div", { className: "card" }, [
          el("p", { className: "label", text: "Código de un solo uso" }),
          el("p", { className: "code", "aria-label": `Código: ${spellOut(r.code)}`, text: r.code }),
          el("p", { text: `Caduca a las ${new Date(r.expiresAt).toLocaleTimeString("es-ES", { timeStyle: "short" })}. Introdúcelo en el bastón antes de que caduque.` }),
        ]),
      );
      announce(`Código generado: ${spellOut(r.code)}`);
    } catch (e) {
      codeArea.replaceChildren(errorMessage("No se pudo generar el código", e instanceof ApiError ? e.message : "Inténtalo de nuevo."));
    } finally {
      generate.disabled = state.mode !== "connected";
    }
  });

  root.replaceChildren(
    el("h1", { text: "Bastón" }),
    el("section", { className: "card", "aria-labelledby": "t-status" }, [
      el("p", { className: "label", id: "t-status", text: "Estado del dispositivo" }),
      el("p", {}, [badge(cane.connected ? "Conectado" : "No conectado", cane.connected ? "ok" : "neutral")]),
      el("dl", {}, [
        row("Identificador", "Sin datos"),
        row("Última comunicación", "Sin datos"),
        row("Asociado a tu cuenta", "No"),
      ]),
      el("p", { text: cane.message }),
    ]),
    el("section", { "aria-labelledby": "t-pair" }, [
      el("h2", { id: "t-pair", text: "Vincular un bastón" }),
      el("p", { text: "Genera un código y escríbelo en el bastón. El código sirve una sola vez." }),
      generate,
      codeArea,
    ]),
    el("section", { "aria-labelledby": "t-errors" }, [
      el("h2", { id: "t-errors", text: "Si algo falla" }),
      el("ul", { className: "list" }, [
        el("li", { text: "Si el bastón no aparece, comprueba que el teléfono tiene datos móviles o Wi-Fi." }),
        el("li", { text: "Si el código caduca, genera uno nuevo." }),
        el("li", { text: "Si el bastón se desconecta, ORBIS lo mostrará aquí y no enviará nada hasta que vuelva a conectarse." }),
      ]),
    ]),
  );
}
