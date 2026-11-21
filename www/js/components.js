// Constructores de DOM seguros: nunca se inserta texto de la API como HTML.

export function el(label, attributes = {}, children = []) {
  const node = document.createElement(label);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "text") {
      node.textContent = value;
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2), value);
    } else if (key === "className") {
      node.className = value;
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function badge(text, kind = "neutral") {
  return el("span", { className: `badge ${kind}`, text });
}

export function loading(text) {
  return el("p", { className: "loading", role: "status", text });
}

export function errorMessage(title, detail) {
  return el("div", { className: "error-message", role: "alert" }, [
    el("strong", { text: title }),
    el("p", { text: detail }),
  ]);
}

export function empty(title, detail, actions = []) {
  return el("section", { className: "empty", "aria-labelledby": "empty-title" }, [
    el("h2", { id: "empty-title", text: title }),
    el("p", { text: detail }),
    ...actions,
  ]);
}

export function button(text, { onclick, variant = "", kind = "button", disabled = false, label } = {}) {
  return el("button", {
    type: kind,
    className: `button ${variant}`.trim(),
    text,
    "aria-label": label,
    disabled: disabled,
    onclick,
  });
}

export function linkButton(text, href, variant = "") {
  return el("a", { className: `button ${variant}`.trim(), href, text });
}

export function field({ id, label, kind = "text", autocomplete, help, required = true }) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const input = el("input", {
    id,
    name: id,
    type: kind,
    autocomplete,
    required: required,
    "aria-describedby": `${help ? helpId + " " : ""}${errorId}`,
  });
  const node = el("div", { className: "field" }, [
    el("label", { for: id, text: label }),
    input,
    help ? el("p", { className: "help", id: helpId, text: help }) : null,
    // Sin role="alert": un alert vacío se anunciaría como ruido. Se anuncia el texto cuando aparece.
    el("p", { className: "field-error", id: errorId, "aria-live": "polite", text: "" }),
  ]);
  return { node, input, error: node.querySelector(`#${errorId}`) };
}

export function row(label, value) {
  return el("div", { className: "row" }, [el("dt", { text: label }), el("dd", { text: value })]);
}
