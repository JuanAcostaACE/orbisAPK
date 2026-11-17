// Historial: capturas locales (demostración y bastón) y, en modo conectado, eventos reales del backend.
import { cargar } from "../store.js";
import { el, insignia, cargando, mensajeError, vacio } from "../componentes.js";
import { eventos, ErrorApi } from "../api.js";

const ESTADO = {
  RECIBIDA: ["Recibida", "neutra"],
  EN_PROCESO: ["Analizando", "aviso"],
  DESCRITA: ["Descrita", "ok"],
  FALLIDA: ["No descrita", "error"],
};

function filaCaptura(c) {
  const [texto, tipo] = ESTADO[c.estado] ?? [c.estado, "neutra"];
  const fecha = new Date(c.creadaEn).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
  return el("li", {}, [
    el("a", { href: `#/resultado/${c.id}`, "aria-label": `${fecha}. ${texto}. ${c.descripcion ?? "Sin descripción"}` }, [
      el("p", { className: "etiqueta", texto: fecha }),
      el("p", {}, [insignia(texto, tipo), " ", c.simulado ? insignia("Simulada", "demo") : null]),
      el("p", { texto: c.descripcion ?? "Todavía sin descripción." }),
    ]),
  ]);
}

function filaEvento(e) {
  const fecha = e.fechaHora ? new Date(e.fechaHora).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "Sin fecha";
  const distancia = e.distanciaCm != null ? `${Math.round(e.distanciaCm)} cm` : "distancia no disponible";
  return el("li", {}, [
    el("div", { className: "tarjeta" }, [
      el("p", { className: "etiqueta", texto: fecha }),
      el("p", { texto: `Evento ${e.modo ?? ""}: ${distancia}.` }),
      e.etiquetasIA ? el("p", { texto: `Etiquetas de IA: ${e.etiquetasIA}` }) : null,
    ]),
  ]);
}

export function renderHistorial(raiz) {
  const estado = cargar();
  const locales = estado.capturas;

  const bloqueLocal = locales.length
    ? el("ul", { className: "lista", "aria-label": "Capturas guardadas" }, locales.map(filaCaptura))
    : vacio("Todavía no hay capturas", "Cuando describas el entorno, verás aquí cada resultado.", [
      el("a", { className: "boton", href: "#/inicio", texto: "Ir al inicio" }),
    ]);

  const bloqueRemoto = el("section", { "aria-labelledby": "t-eventos" }, [
    el("h2", { id: "t-eventos", texto: "Eventos del bastón" }),
  ]);

  if (estado.modo !== "conectado") {
    bloqueRemoto.append(el("p", { texto: "Los eventos del bastón solo se muestran con una cuenta conectada." }));
  } else {
    bloqueRemoto.append(cargando("Cargando eventos…"));
    eventos.listar(0, 20).then(
      (pagina) => {
        const lista = pagina?.contenido ?? []; // Campo real de PaginaResponse en orbisBackend
        bloqueRemoto.querySelector(".cargando")?.remove();
        bloqueRemoto.append(
          lista.length
            ? el("ul", { className: "lista" }, lista.map(filaEvento))
            : el("p", { texto: "No hay eventos del bastón todavía." }),
        );
      },
      (e) => {
        bloqueRemoto.querySelector(".cargando")?.remove();
        const mensaje = e instanceof ErrorApi ? e.message : "No se pudieron cargar los eventos.";
        bloqueRemoto.append(mensajeError("Eventos no disponibles", mensaje));
      },
    );
  }

  raiz.replaceChildren(
    el("h1", { texto: "Historial" }),
    el("p", { texto: "Tus capturas y resultados, del más reciente al más antiguo." }),
    el("section", { "aria-labelledby": "t-capturas" }, [
      el("h2", { id: "t-capturas", texto: "Capturas" }),
      bloqueLocal,
    ]),
    bloqueRemoto,
  );
}
