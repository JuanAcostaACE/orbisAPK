// Sección del auxiliar. El backend todavía no tiene invitaciones ni vinculaciones de auxiliares:
// los controles se muestran deshabilitados con el motivo real, sin simular ninguna vinculación.
import { el, badge, button } from "../components.js";
import { ASSISTANT_PENDING_MESSAGE } from "../adapters.js";

export function renderAssistant(root) {
  const help = el("p", { id: "help-aux", text: ASSISTANT_PENDING_MESSAGE });

  const invite = button("Invitar a un auxiliar", { disabled: true, label: "Invitar a un auxiliar. No disponible todavía." });
  invite.setAttribute("aria-describedby", "help-aux");
  const revoke = button("Revocar acceso del auxiliar", { variant: "danger", disabled: true, label: "Revocar el acceso de un auxiliar. No disponible todavía." });
  revoke.setAttribute("aria-describedby", "help-aux");

  root.replaceChildren(
    el("h1", { text: "Auxiliar" }),
    el("p", { text: "Una persona auxiliar de confianza puede revisar tus fotografías y resultados, y corregir una descripción si es incorrecta." }),
    el("section", { className: "card", "aria-labelledby": "t-status-aux" }, [
      el("p", { className: "label", id: "t-status-aux", text: "Estado de la vinculación" }),
      el("p", {}, [badge("No disponible", "neutral")]),
      help,
    ]),
    el("section", { "aria-labelledby": "t-actions" }, [
      el("h2", { id: "t-actions", text: "Acciones" }),
      invite,
      revoke,
    ]),
    el("section", { "aria-labelledby": "t-rules" }, [
      el("h2", { id: "t-rules", text: "Cómo funcionará" }),
      el("ul", { className: "list" }, [
        el("li", { text: "La vinculación es explícita: solo cuando tú la aceptas." }),
        el("li", { text: "Puedes revocarla en cualquier momento." }),
        el("li", { text: "Una corrección nunca borra la descripción original de la IA." }),
      ]),
    ]),
  );
}
