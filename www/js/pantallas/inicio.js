// Pantalla principal: saludo, estado, última captura y la acción principal.
import { cargar } from "../store.js";
import { anunciar } from "../a11y.js";
import { el, insignia, boton, enlaceBoton } from "../componentes.js";
import {
  crearCapturaPrueba, analizarSimulado, estadoBaston, imagenesEnMemoria, AVISO_SIMULADO,
} from "../adaptadores.js";
import { analizarReal, uuidV4, INSIGNIA_REAL } from "../analisis.js";

const ETIQUETA_ESTADO = {
  PREPARANDO: ["Enviando la fotografía", "aviso"],
  RECIBIDA: ["Recibida", "neutra"],
  EN_PROCESO: ["Analizando", "aviso"],
  DESCRITA: ["Descrita", "ok"],
  FALLIDA: ["No se pudo describir", "error"],
};

export function renderInicio(raiz, ctx) {
  const estado = cargar();
  const saludo = estado.nombre ? `Hola, ${estado.nombre}` : "Hola";
  const baston = estadoBaston(estado.modo);
  const ultima = estado.capturas[0];

  const entrada = el("input", {
    type: "file",
    accept: "image/jpeg,image/*",
    hidden: true,
    "aria-hidden": "true",
    tabindex: "-1",
  });
  entrada.addEventListener("change", () => {
    const archivo = entrada.files?.[0];
    if (!archivo) return;
    if (cargar().modo === "conectado") {
      // Análisis real en la nube. El input se vacía para poder elegir la misma foto otra vez.
      const id = uuidV4();
      imagenesEnMemoria.set(id, URL.createObjectURL(archivo));
      anunciar("Fotografía recibida. Enviándola para analizar el entorno.");
      analizarReal(archivo, id); // crea la captura local de forma síncrona y sigue en segundo plano
      entrada.value = "";
      ctx.ir(`#/resultado/${id}`);
      return;
    }
    const captura = crearCapturaPrueba(archivo.name);
    imagenesEnMemoria.set(captura.id, URL.createObjectURL(archivo));
    anunciar("Fotografía de prueba recibida. Analizando el entorno.");
    ctx.ir(`#/resultado/${captura.id}`);
    analizarSimulado(captura.id);
  });

  const accion = boton("Describir el entorno", {
    etiqueta: "Describir el entorno. Usa una fotografía de prueba seleccionada en el teléfono.",
    onclick: () => entrada.click(),
  });

  const bloqueConexion = el("section", { className: "tarjeta", "aria-labelledby": "t-conexion" }, [
    el("p", { className: "etiqueta", id: "t-conexion", texto: "Conexión" }),
    estado.modo === "demo"
      ? el("p", {}, [insignia("Modo demostración", "demo")])
      : estado.modo === "conectado"
        ? el("p", {}, [insignia("Conectado a ORBIS", "ok")])
        : el("p", {}, [insignia("Sin sesión", "neutra")]),
    el("p", { texto: baston.mensaje }),
  ]);

  const bloqueUltima = el("section", { className: "tarjeta", "aria-labelledby": "t-ultima" }, [
    el("p", { className: "etiqueta", id: "t-ultima", texto: "Última captura" }),
    ultima
      ? el("div", {}, [
        el("p", {}, [insignia(ETIQUETA_ESTADO[ultima.estado]?.[0] ?? ultima.estado, ETIQUETA_ESTADO[ultima.estado]?.[1] ?? "neutra"),
          " ",
          ultima.simulado ? insignia("Simulada", "demo") : insignia(INSIGNIA_REAL, "neutra")]),
        el("p", { texto: ultima.descripcion ?? "Todavía sin descripción." }),
        enlaceBoton("Ver resultado", `#/resultado/${ultima.id}`, "secundario"),
      ])
      : el("p", { texto: "Aún no hay capturas. Describe el entorno para empezar." }),
  ]);

  const accesos = el("nav", { "aria-label": "Accesos rápidos" }, [
    enlaceBoton("Historial", "#/historial", "secundario"),
    enlaceBoton("Bastón", "#/baston", "secundario"),
    enlaceBoton("Auxiliar", "#/auxiliar", "secundario"),
    enlaceBoton("Configuración", "#/ajustes", "secundario"),
  ]);

  raiz.replaceChildren(
    el("h1", { texto: saludo }),
    bloqueConexion,
    el("section", { "aria-labelledby": "t-accion" }, [
      el("h2", { id: "t-accion", texto: "Describir el entorno" }),
      el("p", { texto: estado.modo === "demo" ? AVISO_SIMULADO : "Elige una fotografía y ORBIS la analizará en la nube. Se reduce en tu teléfono antes de enviarla." }),
      accion,
      entrada,
    ]),
    bloqueUltima,
    accesos,
  );
}
