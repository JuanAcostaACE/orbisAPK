// Configuración y accesibilidad: velocidad de voz, lectura automática, prueba de voz y cierre de sesión.
import { cargar, actualizar, cerrarSesion } from "../store.js";
import { anunciar } from "../a11y.js";
import { decir, hayVoz } from "../voz.js";
import { el, boton } from "../componentes.js";
import { auth } from "../api.js";
import { tokenActual, borrarToken } from "../sesion.js";

export function renderAjustes(raiz, ctx) {
  const estado = cargar();

  const velocidad = el("input", {
    id: "velocidad",
    type: "range",
    min: "0.5",
    max: "1.5",
    step: "0.1",
    value: String(estado.velocidadVoz),
    "aria-label": "Velocidad de la voz",
  });
  const valorVelocidad = el("span", { id: "valor-velocidad", texto: `${estado.velocidadVoz}×` });
  velocidad.addEventListener("input", () => {
    const v = Number(velocidad.value);
    actualizar({ velocidadVoz: v });
    valorVelocidad.textContent = `${v}×`;
    velocidad.setAttribute("aria-valuetext", `${v} veces la velocidad normal`);
  });

  const lectura = el("input", { type: "checkbox", id: "lectura-auto", checked: estado.lecturaAutomatica });
  lectura.addEventListener("change", () => actualizar({ lecturaAutomatica: lectura.checked }));

  const probar = boton("Probar la voz", { variante: "secundario" });
  probar.addEventListener("click", () => {
    if (!decir("Así suena ORBIS a esta velocidad.", { prioridad: "alta" })) {
      anunciar("La voz no está disponible en este dispositivo.", { urgente: true });
    }
  });

  const salir = boton("Cerrar sesión", { variante: "peligro", etiqueta: "Cerrar sesión" });
  salir.addEventListener("click", async () => {
    if (tokenActual()) {
      // Revoca el token en el backend. Si falla la red, el token se borra igualmente en el dispositivo.
      await auth.logoutMovil().catch(() => {});
    }
    await borrarToken();
    cerrarSesion();
    anunciar("Sesión cerrada.");
    ctx.ir("#/login");
  });

  raiz.replaceChildren(
    el("h1", { texto: "Configuración" }),
    el("section", { className: "tarjeta", "aria-labelledby": "t-voz" }, [
      el("h2", { id: "t-voz", texto: "Voz" }),
      el("label", { className: "toggle", for: "velocidad" }, [el("span", { texto: "Velocidad" }), valorVelocidad]),
      velocidad,
      el("label", { className: "toggle", for: "lectura-auto" }, [
        el("span", { texto: "Leer el resultado al terminar" }),
        lectura,
      ]),
      hayVoz() ? probar : el("p", { texto: "Este navegador no tiene voz disponible. En el teléfono se usará la voz del sistema." }),
    ]),
    el("section", { className: "tarjeta", "aria-labelledby": "t-acc" }, [
      el("h2", { id: "t-acc", texto: "Accesibilidad" }),
      el("p", { texto: "ORBIS respeta la reducción de movimiento del sistema y el tamaño de letra del teléfono." }),
      el("p", { texto: "Los mensajes importantes se anuncian a lectores de pantalla y a la voz." }),
    ]),
    el("section", { "aria-labelledby": "t-cuenta" }, [
      el("h2", { id: "t-cuenta", texto: "Cuenta" }),
      el("p", { texto: estado.modo === "conectado" ? `Sesión iniciada como ${estado.correo ?? "tu cuenta"}.` : "Estás en modo demostración." }),
      salir,
    ]),
  );
}
