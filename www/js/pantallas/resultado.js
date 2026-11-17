// Resultado de un análisis: fotografía, descripción, estado, voz y alertas.
// Nunca presenta una predicción como certeza: las demostraciones se etiquetan como simuladas.
import { cargar } from "../store.js";
import { anunciar } from "../a11y.js";
import { decir, detener, suscribir } from "../voz.js";
import { el, insignia, boton, vacio, cargando } from "../componentes.js";
import { imagenesEnMemoria, AVISO_SIMULADO, AVISO_SIN_ALERTAS } from "../adaptadores.js";

const ETIQUETA = {
  RECIBIDA: ["Recibida", "neutra"],
  EN_PROCESO: ["Analizando el entorno", "aviso"],
  DESCRITA: ["Descripción lista", "ok"],
  FALLIDA: ["No se pudo interpretar la imagen", "error"],
};

export function renderResultado(raiz, ctx, id) {
  const captura = cargar().capturas.find((c) => c.id === id);
  if (!captura) {
    raiz.replaceChildren(
      vacio("No encontramos ese resultado", "Puede que sea una demostración que ya no está guardada.", [
        el("a", { className: "boton", href: "#/inicio", texto: "Volver al inicio" }),
      ]),
    );
    return;
  }

  const contenedorEstado = el("div", { "aria-live": "polite" });
  const contenedorDescripcion = el("div");
  const contenedorVoz = el("p", { className: "etiqueta", "aria-live": "polite", id: "estado-voz" });
  const imagenUrl = imagenesEnMemoria.get(captura.id);

  const escuchar = boton("Escuchar de nuevo", { etiqueta: "Escuchar la descripción de nuevo" });
  const parar = boton("Detener", { variante: "secundario", etiqueta: "Detener la lectura" });
  escuchar.addEventListener("click", () => {
    const texto = actual().descripcion;
    if (!texto) return;
    if (!decir(texto, { prioridad: "alta" })) anunciar("La voz no está disponible en este dispositivo.", { urgente: true });
  });
  parar.addEventListener("click", () => detener());

  function actual() {
    return cargar().capturas.find((c) => c.id === id) ?? captura;
  }

  function pintar() {
    const c = actual();
    const [texto, tipo] = ETIQUETA[c.estado] ?? [c.estado, "neutra"];
    contenedorEstado.replaceChildren(
      el("p", {}, [insignia(texto, tipo), " ", c.simulado ? insignia("Simulada", "demo") : null]),
    );

    if (c.estado !== "DESCRITA" && c.estado !== "FALLIDA") {
      contenedorDescripcion.replaceChildren(cargando("Analizando la fotografía…"));
      return;
    }
    if (c.estado === "FALLIDA") {
      contenedorDescripcion.replaceChildren(
        el("div", { className: "mensaje-error", role: "alert" }, [
          el("strong", { texto: "No pude interpretar correctamente la imagen." }),
          el("p", { texto: "Inténtalo de nuevo con otra fotografía." }),
        ]),
      );
      return;
    }

    contenedorDescripcion.replaceChildren(
      el("section", { "aria-labelledby": "t-descripcion" }, [
        el("h2", { id: "t-descripcion", texto: "Descripción del entorno" }),
        el("p", { className: "tarjeta", texto: c.descripcion }),
        c.elementos?.length
          ? el("section", { "aria-labelledby": "t-elementos" }, [
            el("h2", { id: "t-elementos", texto: "Elementos reconocidos" }),
            el("ul", { className: "lista" }, c.elementos.map((e) => el("li", { texto: e }))),
          ])
          : null,
        el("section", { "aria-labelledby": "t-alertas" }, [
          el("h2", { id: "t-alertas", texto: "Alertas" }),
          el("p", { texto: AVISO_SIN_ALERTAS }),
        ]),
        c.simulado ? el("p", { className: "tarjeta", role: "note", texto: AVISO_SIMULADO }) : null,
      ]),
    );
  }

  const imagen = imagenUrl
    ? el("img", { className: "imagen-resultado", src: imagenUrl, alt: "Fotografía de prueba seleccionada para este resultado" })
    : el("p", { className: "tarjeta", texto: "La imagen ya no está disponible en esta sesión." });

  raiz.replaceChildren(
    el("h1", { texto: "Resultado" }),
    contenedorEstado,
    imagen,
    contenedorDescripcion,
    el("div", { className: "tarjeta" }, [contenedorVoz, escuchar, parar]),
    el("p", {}, [el("a", { href: "#/inicio", texto: "Volver al inicio" })]),
  );
  pintar();

  // Actualiza mientras el análisis está en curso y lee el resultado al terminar.
  let leida = false;
  const intervalo = setInterval(() => {
    const c = actual();
    pintar();
    if (c.estado === "DESCRITA" && !leida) {
      leida = true;
      if (cargar().lecturaAutomatica) decir(c.descripcion);
      anunciar("Descripción lista.");
    }
    if (c.estado === "DESCRITA" || c.estado === "FALLIDA") clearInterval(intervalo);
  }, 400);
  ctx.alSalir(() => clearInterval(intervalo));

  const quitar = suscribir((e) => {
    contenedorVoz.textContent = e.hablando ? "Reproduciendo la descripción…" : "Lectura detenida o terminada.";
  });
  ctx.alSalir(quitar);
}
