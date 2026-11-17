// Sección del auxiliar. El backend todavía no tiene invitaciones ni vinculaciones de auxiliares:
// los controles se muestran deshabilitados con el motivo real, sin simular ninguna vinculación.
import { el, insignia, boton } from "../componentes.js";
import { MENSAJE_AUXILIAR_PENDIENTE } from "../adaptadores.js";

export function renderAuxiliar(raiz) {
  const ayuda = el("p", { id: "ayuda-aux", texto: MENSAJE_AUXILIAR_PENDIENTE });

  const invitar = boton("Invitar a un auxiliar", { deshabilitado: true, etiqueta: "Invitar a un auxiliar. No disponible todavía." });
  invitar.setAttribute("aria-describedby", "ayuda-aux");
  const revocar = boton("Revocar acceso del auxiliar", { variante: "peligro", deshabilitado: true, etiqueta: "Revocar el acceso de un auxiliar. No disponible todavía." });
  revocar.setAttribute("aria-describedby", "ayuda-aux");

  raiz.replaceChildren(
    el("h1", { texto: "Auxiliar" }),
    el("p", { texto: "Una persona auxiliar de confianza puede revisar tus fotografías y resultados, y corregir una descripción si es incorrecta." }),
    el("section", { className: "tarjeta", "aria-labelledby": "t-estado-aux" }, [
      el("p", { className: "etiqueta", id: "t-estado-aux", texto: "Estado de la vinculación" }),
      el("p", {}, [insignia("No disponible", "neutra")]),
      ayuda,
    ]),
    el("section", { "aria-labelledby": "t-acciones" }, [
      el("h2", { id: "t-acciones", texto: "Acciones" }),
      invitar,
      revocar,
    ]),
    el("section", { "aria-labelledby": "t-reglas" }, [
      el("h2", { id: "t-reglas", texto: "Cómo funcionará" }),
      el("ul", { className: "lista" }, [
        el("li", { texto: "La vinculación es explícita: solo cuando tú la aceptas." }),
        el("li", { texto: "Puedes revocarla en cualquier momento." }),
        el("li", { texto: "Una corrección nunca borra la descripción original de la IA." }),
      ]),
    ]),
  );
}
