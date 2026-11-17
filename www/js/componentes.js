// Constructores de DOM seguros: nunca se inserta texto de la API como HTML.

export function el(etiqueta, atributos = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (clave === "texto") {
      nodo.textContent = valor;
    } else if (clave.startsWith("on") && typeof valor === "function") {
      nodo.addEventListener(clave.slice(2), valor);
    } else if (clave === "className") {
      nodo.className = valor;
    } else {
      nodo.setAttribute(clave, valor === true ? "" : String(valor));
    }
  }
  for (const hijo of [].concat(hijos)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return nodo;
}

export function insignia(texto, tipo = "neutra") {
  return el("span", { className: `insignia ${tipo}`, texto });
}

export function cargando(texto) {
  return el("p", { className: "cargando", role: "status", texto });
}

export function mensajeError(titulo, detalle) {
  return el("div", { className: "mensaje-error", role: "alert" }, [
    el("strong", { texto: titulo }),
    el("p", { texto: detalle }),
  ]);
}

export function vacio(titulo, detalle, acciones = []) {
  return el("section", { className: "vacio", "aria-labelledby": "vacio-titulo" }, [
    el("h2", { id: "vacio-titulo", texto: titulo }),
    el("p", { texto: detalle }),
    ...acciones,
  ]);
}

export function boton(texto, { onclick, variante = "", tipo = "button", deshabilitado = false, etiqueta } = {}) {
  return el("button", {
    type: tipo,
    className: `boton ${variante}`.trim(),
    texto,
    "aria-label": etiqueta,
    disabled: deshabilitado,
    onclick,
  });
}

export function enlaceBoton(texto, href, variante = "") {
  return el("a", { className: `boton ${variante}`.trim(), href, texto });
}

export function campo({ id, etiqueta, tipo = "text", autocomplete, ayuda, requerido = true }) {
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const entrada = el("input", {
    id,
    name: id,
    type: tipo,
    autocomplete,
    required: requerido,
    "aria-describedby": `${ayuda ? idAyuda + " " : ""}${idError}`,
  });
  const nodo = el("div", { className: "campo" }, [
    el("label", { for: id, texto: etiqueta }),
    entrada,
    ayuda ? el("p", { className: "ayuda", id: idAyuda, texto: ayuda }) : null,
    // Sin role="alert": un alert vacío se anunciaría como ruido. Se anuncia el texto cuando aparece.
    el("p", { className: "error-campo", id: idError, "aria-live": "polite", texto: "" }),
  ]);
  return { nodo, entrada, error: nodo.querySelector(`#${idError}`) };
}

export function fila(etiqueta, valor) {
  return el("div", { className: "fila" }, [el("dt", { texto: etiqueta }), el("dd", { texto: valor })]);
}
