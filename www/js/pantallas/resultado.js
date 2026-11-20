// Resultado de un análisis: fotografía, descripción, estado, voz y alertas.
// Nunca presenta una predicción como certeza: las demostraciones se etiquetan como simuladas
// y los análisis reales como lo que son (detección de objetos, sin distancias).
import { cargar } from "../store.js";
import { anunciar } from "../a11y.js";
import { decir, detener, suscribir } from "../voz.js";
import { el, insignia, boton, vacio, cargando } from "../componentes.js";
import { imagenesEnMemoria, AVISO_SIMULADO, AVISO_SIN_ALERTAS } from "../adaptadores.js";
import { capturas, ErrorApi } from "../api.js";
import {
  AVISO_REAL, INSIGNIA_REAL, MENSAJE_TARDANZA, MENSAJE_SIN_RED, analizarReal, sondear, sondearLocal, uuidV4,
  fotografiasEnMemoria, esTerminal,
} from "../analisis.js";

const ETIQUETA = {
  PREPARANDO: ["Enviando la fotografía", "aviso"],
  RECIBIDA: ["Recibida", "neutra"],
  EN_PROCESO: ["Analizando el entorno", "aviso"],
  DESCRITA: ["Descripción lista", "ok"],
  FALLIDA: ["No se pudo interpretar la imagen", "error"],
};
const ETIQUETA_REAL = {
  ...ETIQUETA,
  EN_PROCESO: ["Analizando", "aviso"],
  FALLIDA: ["No se pudo analizar", "error"],
};

const MOTIVOS = {
  IMAGEN_NO_DECODIFICABLE: "No pude leer la fotografía. Prueba con otra.",
  IA_NO_DISPONIBLE: "El análisis no está disponible ahora. Inténtalo de nuevo en un momento.",
  ERROR_INFERENCIA: "El análisis no está disponible ahora. Inténtalo de nuevo en un momento.",
};
const MOTIVO_GENERICO = "No se pudo analizar la fotografía. Inténtalo de nuevo.";

export function mensajeFallo(c) {
  if (c.motivoFallo === "ENVIO") return c.aviso ?? MOTIVO_GENERICO;
  return MOTIVOS[c.motivoFallo] ?? MOTIVO_GENERICO;
}

function desdeServidor(r) {
  return {
    id: r.captureId, origen: "real", simulado: false, estado: r.estado,
    descripcion: r.descripcion ?? null, etiquetas: Array.isArray(r.etiquetas) ? r.etiquetas : [],
    motivoFallo: r.motivoFallo ?? null, remota: true,
  };
}

export function renderResultado(raiz, ctx, id) {
  const local = cargar().capturas.find((c) => c.id === id);
  const esConectado = cargar().modo === "conectado";
  if (!local && !esConectado) return noEncontrado(raiz);

  let remota = null; // captura que solo existe en el servidor (por ejemplo, abierta desde el historial)
  const actual = () => cargar().capturas.find((c) => c.id === id) ?? remota;

  const contenedorEstado = el("div", { "aria-live": "polite" });
  const contenedorDescripcion = el("div");
  const contenedorVoz = el("p", { className: "etiqueta", "aria-live": "polite", id: "estado-voz" });
  const imagenUrl = imagenesEnMemoria.get(id);

  const escuchar = boton("Repetir descripción", { etiqueta: "Repetir la descripción en voz alta" });
  const parar = boton("Detener", { variante: "secundario", etiqueta: "Detener la lectura" });
  escuchar.addEventListener("click", () => {
    const texto = actual()?.descripcion;
    if (!texto) return;
    if (!decir(texto, { prioridad: "alta" })) anunciar("La voz no está disponible en este dispositivo.", { urgente: true });
  });
  parar.addEventListener("click", () => detener());

  function reintentar() {
    const c = actual();
    const blob = fotografiasEnMemoria.get(id);
    if (!blob || c?.motivoFallo === "IMAGEN_NO_DECODIFICABLE") {
      ctx.ir("#/inicio");
      return;
    }
    const nuevo = uuidV4();
    const url = imagenesEnMemoria.get(id);
    if (url) imagenesEnMemoria.set(nuevo, url);
    analizarReal({ name: c?.nombre }, nuevo, { blob });
    ctx.ir(`#/resultado/${nuevo}`);
  }

  function pintarReal(c) {
    const [texto, tipo] = ETIQUETA_REAL[c.estado] ?? [c.estado, "neutra"];
    contenedorEstado.replaceChildren(
      el("p", {}, [insignia(texto, tipo), " ", insignia(INSIGNIA_REAL, "neutra")]),
    );
    const aviso = el("p", { className: "tarjeta", role: "note", texto: AVISO_REAL });

    if (c.estado === "FALLIDA") {
      contenedorDescripcion.replaceChildren(
        el("div", { className: "mensaje-error", role: "alert" }, [
          el("strong", { texto: "No se pudo analizar la fotografía." }),
          el("p", { texto: mensajeFallo(c) }),
        ]),
        boton("Intentar de nuevo", { onclick: reintentar }),
        aviso,
      );
      return;
    }
    if (c.estado !== "DESCRITA") {
      const nodos = [cargando(c.estado === "PREPARANDO" ? "Enviando la fotografía…" : "Analizando la fotografía…")];
      if (c.sinRed && !c.tardando) {
        nodos.push(el("p", { className: "tarjeta", role: "status", texto: MENSAJE_SIN_RED }));
      }
      if (c.tardando) {
        nodos.push(
          el("div", { className: "mensaje-error", role: "alert" }, [el("p", { texto: c.aviso ?? MENSAJE_TARDANZA })]),
          boton("Consultar de nuevo", { onclick: () => sondearLocal(id) }),
          boton("Intentar con otra fotografía", { variante: "secundario", onclick: () => ctx.ir("#/inicio") }),
        );
      }
      contenedorDescripcion.replaceChildren(...nodos);
      return;
    }
    const etiquetas = c.etiquetas ?? [];
    contenedorDescripcion.replaceChildren(
      el("section", { "aria-labelledby": "t-descripcion" }, [
        el("h2", { id: "t-descripcion", texto: "Descripción del entorno" }),
        el("p", { className: "tarjeta", texto: c.descripcion ?? "" }),
        etiquetas.length
          ? el("section", { "aria-labelledby": "t-elementos" }, [
            el("h2", { id: "t-elementos", texto: "Elementos reconocidos" }),
            el("ul", { className: "lista" }, etiquetas.map((e) => el("li", { texto: e }))),
          ])
          : null,
        aviso,
      ]),
    );
  }

  function pintarSimulado(c) {
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

  function pintar() {
    const c = actual();
    const hayTexto = Boolean(c?.estado === "DESCRITA" && c.descripcion);
    escuchar.disabled = !hayTexto;
    contenedorDescripcion.setAttribute("aria-busy", c && !esTerminal(c.estado) ? "true" : "false");
    if (!c) {
      contenedorEstado.replaceChildren();
      contenedorDescripcion.replaceChildren(cargando("Consultando el resultado…"));
      return;
    }
    if (c.origen === "real") pintarReal(c);
    else pintarSimulado(c);
  }

  const imagen = imagenUrl
    ? el("img", {
      className: "imagen-resultado",
      src: imagenUrl,
      alt: local?.origen === "real" ? "Fotografía enviada para este análisis" : "Fotografía de prueba seleccionada para este resultado",
    })
    : el("p", { className: "tarjeta", texto: "La imagen ya no está disponible en esta sesión." });

  raiz.replaceChildren(
    el("h1", { texto: "Resultado" }),
    contenedorEstado,
    imagen,
    contenedorDescripcion,
    el("section", { className: "tarjeta", "aria-labelledby": "t-voz" }, [
      el("h2", { id: "t-voz", texto: "Voz" }),
      contenedorVoz, escuchar, parar,
    ]),
    el("a", { className: "boton secundario", href: "#/inicio", texto: "Volver al inicio" }),
  );
  pintar();

  // Lee el resultado solo cuando TERMINA mientras se mira la pantalla (no al abrir uno antiguo).
  let leida = !!actual() && esTerminal(actual().estado);
  function alTerminar(c) {
    if (leida || c.estado !== "DESCRITA") return;
    leida = true;
    if (cargar().lecturaAutomatica && c.descripcion) decir(c.descripcion);
    anunciar("Descripción lista.");
  }

  const intervalo = setInterval(() => {
    const c = actual();
    if (!c) return;
    pintar();
    alTerminar(c);
    if (esTerminal(c.estado)) clearInterval(intervalo);
  }, 400);
  ctx.alSalir(() => clearInterval(intervalo));

  // Captura que no está en el teléfono (p. ej. abierta desde el historial): se consulta al servidor.
  if (!local) {
    const cancelar = new AbortController();
    ctx.alSalir(() => cancelar.abort());
    capturas.estado(id).then(
      (r) => {
        if (cancelar.signal.aborted) return;
        remota = desdeServidor(r);
        if (esTerminal(remota.estado)) leida = true; // un resultado ya terminado no se lee solo al abrirlo
        pintar();
        if (!esTerminal(remota.estado)) {
          sondear(id, { alCambiar: (x) => { remota = { ...desdeServidor(x), sinRed: false }; }, alFalloRed: (_e, n) => { if (n >= 2 && remota) remota = { ...remota, sinRed: true }; }, senal: cancelar.signal })
            .then(({ tiempoAgotado }) => {
              if (tiempoAgotado && remota) remota = { ...remota, tardando: true, aviso: MENSAJE_TARDANZA };
            })
            .catch(() => {});
        }
      },
      (e) => {
        if (cancelar.signal.aborted) return;
        if (e instanceof ErrorApi && e.status === 401) return; // api.js lleva a la pantalla de acceso
        clearInterval(intervalo);
        if (e instanceof ErrorApi && e.status === 404) noEncontrado(raiz);
        else {
          raiz.replaceChildren(vacio("No se pudo cargar el resultado", e?.message ?? "Inténtalo de nuevo.", [
            boton("Reintentar", { onclick: () => ctx.ir(`#/resultado/${id}`) }),
            el("a", { className: "boton secundario", href: "#/historial", texto: "Volver al historial" }),
          ]));
        }
      },
    );
  }

  const quitar = suscribir((e) => {
    contenedorVoz.textContent = e.hablando ? "Reproduciendo la descripción…" : "Lectura detenida o terminada.";
  });
  ctx.alSalir(quitar);
}

function noEncontrado(raiz) {
  raiz.replaceChildren(
    vacio("No encontramos ese resultado", "Puede que sea una demostración que ya no está guardada.", [
      el("a", { className: "boton", href: "#/inicio", texto: "Volver al inicio" }),
    ]),
  );
}
