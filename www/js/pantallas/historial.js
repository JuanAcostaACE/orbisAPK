// Historial: capturas locales (demostración y bastón) y, en modo conectado, eventos reales del backend.
import { cargar } from "../store.js";
import { el, insignia, boton, cargando, mensajeError, vacio } from "../componentes.js";
import { eventos, capturas, ErrorApi } from "../api.js";
import { INSIGNIA_REAL } from "../analisis.js";
import { mensajeFallo } from "./resultado.js";

const ESTADO = {
  PREPARANDO: ["Enviando", "aviso"],
  RECIBIDA: ["Recibida", "neutra"],
  EN_PROCESO: ["Analizando", "aviso"],
  DESCRITA: ["Descrita", "ok"],
  FALLIDA: ["No descrita", "error"],
};

function filaCaptura(c) {
  const [texto, tipo] = ESTADO[c.estado] ?? [c.estado, "neutra"];
  const fecha = c.creadaEn ? new Date(c.creadaEn).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "Sin fecha";
  const real = c.origen === "real";
  const resumen = c.descripcion ?? (c.estado === "FALLIDA" ? (c.resumenFallo ?? "No se pudo analizar.") : "Todavía sin descripción.");
  return el("li", {}, [
    el("a", { href: `#/resultado/${c.id}`, "aria-label": `${fecha}. ${texto}. ${resumen}` }, [
      el("p", { className: "etiqueta", texto: fecha }),
      el("p", {}, [insignia(texto, tipo), " ", real ? insignia(INSIGNIA_REAL, "neutra") : c.simulado ? insignia("Simulada", "demo") : null]),
      el("p", { texto: resumen }),
    ]),
  ]);
}

// Captura del servidor (contrato de GET /api/v1/dispositivos/capturas) -> forma de fila.
function deServidor(s) {
  const c = { id: s.captureId, estado: s.estado, descripcion: s.descripcion ?? null, creadaEn: s.recibidaEn, origen: "real", simulado: false, motivoFallo: s.motivoFallo ?? null };
  if (s.estado === "FALLIDA") c.resumenFallo = mensajeFallo(c);
  return c;
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

export function renderHistorial(raiz, ctx) {
  const estado = cargar();
  const locales = estado.capturas;

  const listaLocal = () => (locales.length
    ? el("ul", { className: "lista", "aria-label": "Capturas guardadas" }, locales.map(filaCaptura))
    : vacio("Todavía no hay capturas", "Cuando describas el entorno, verás aquí cada resultado.", [
      el("a", { className: "boton", href: "#/inicio", texto: "Ir al inicio" }),
    ]));
  const bloqueLocal = el("div", { "aria-busy": estado.modo === "conectado" ? "true" : "false" },
    [estado.modo === "conectado" ? cargando("Cargando capturas…") : listaLocal()]);

  // En modo conectado se intenta el listado del servidor. Si no existe (404/405) o falla, se muestran las locales
  // con un aviso claro (no alarmante) y un botón para reintentar. Un 401 lo gestiona api.js (vuelve al acceso).
  function cargarServidor() {
    bloqueLocal.setAttribute("aria-busy", "true");
    bloqueLocal.replaceChildren(cargando("Cargando capturas…"));
    capturas.listar(0, 20).then(
      (pagina) => {
        bloqueLocal.setAttribute("aria-busy", "false");
        const lista = Array.isArray(pagina?.contenido) ? pagina.contenido : null;
        if (!lista) return bloqueLocal.replaceChildren(listaLocal());
        bloqueLocal.replaceChildren(
          lista.length
            ? el("ul", { className: "lista", "aria-label": "Capturas analizadas en la nube" }, lista.map((x) => filaCaptura(deServidor(x))))
            : listaLocal(),
        );
      },
      (e) => {
        bloqueLocal.setAttribute("aria-busy", "false");
        if (e instanceof ErrorApi && e.status === 401) return;
        const sinRed = e instanceof ErrorApi && e.status === 0;
        bloqueLocal.replaceChildren(
          el("div", { className: "tarjeta", role: "status" }, [
            el("p", { texto: sinRed
              ? "Sin conexión: se muestran las capturas guardadas en este teléfono."
              : "No se pudo cargar el historial del servidor: se muestran las capturas guardadas en este teléfono." }),
            boton("Reintentar", { variante: "secundario", onclick: cargarServidor }),
          ]),
          listaLocal(),
        );
      },
    );
  }
  if (estado.modo === "conectado") cargarServidor();

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
