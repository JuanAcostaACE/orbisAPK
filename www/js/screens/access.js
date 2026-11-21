// Pantallas de acceso: inicio de sesión y registro.
import { auth, ApiError } from "../api.js";
import { update } from "../store.js";
import { announce } from "../a11y.js";
import { el, field, button, errorMessage, loading } from "../components.js";

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8; // Política local. Confirmar con la política real del backend.

function showFieldError(c, text) {
  c.error.textContent = text ?? "";
  c.input.setAttribute("aria-invalid", text ? "true" : "false");
  return !text;
}

// Campo de contraseña con mostrar/ocultar. El valor nunca se escribe en el DOM como texto.
function passwordField(id, label, autocomplete) {
  const c = field({ id, label, kind: "password", autocomplete });
  const toggleBtn = button("Mostrar", { variant: "secondary", label: `Mostrar ${label.toLowerCase()}` });
  toggleBtn.setAttribute("aria-pressed", "false");
  toggleBtn.addEventListener("click", () => {
    const showing = c.input.type === "text";
    c.input.type = showing ? "password" : "text";
    toggleBtn.textContent = showing ? "Mostrar" : "Ocultar";
    toggleBtn.setAttribute("aria-pressed", String(!showing));
    toggleBtn.setAttribute("aria-label", `${showing ? "Mostrar" : "Ocultar"} ${label.toLowerCase()}`);
  });
  // Se sustituye el input in situ: primero se coloca el contenedor, luego se mueve el input dentro.
  const row = el("div", { className: "password-row" });
  c.input.replaceWith(row);
  row.append(c.input, toggleBtn);
  return { ...c };
}

export function renderLogin(root, ctx) {
  root.replaceChildren(
    el("h1", { text: "Iniciar sesión" }),
    el("p", { text: "Entra con tu cuenta de ORBIS para ver tu bastón, tus resultados y tu historial." }),
  );

  const notice = el("div");
  const email = field({ id: "email", label: "Correo electrónico", kind: "email", autocomplete: "email" });
  const password = passwordField("password", "Contraseña", "current-password");
  const submit = button("Entrar", { kind: "submit" });
  const form = el("form", { novalidate: true, "aria-label": "Iniciar sesión" }, [
    notice,
    email.node,
    password.node,
    submit,
  ]);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    notice.replaceChildren();
    const okEmail = showFieldError(email, VALID_EMAIL.test(email.input.value.trim()) ? "" : "Escribe un correo válido.");
    const okPass = showFieldError(password, password.input.value ? "" : "Escribe tu contraseña.");
    if (!okEmail || !okPass) {
      announce("Revisa los campos marcados.", { urgent: true });
      (okEmail ? password.input : email.input).focus();
      return;
    }
    submit.disabled = true;
    notice.replaceChildren(loading("Entrando…"));
    try {
      await auth.login(email.input.value.trim(), password.input.value);
      const session = await auth.me().catch(() => null);
      update({ mode: "connected", email: session?.email ?? email.input.value.trim(), name: null });
      announce("Sesión iniciada.");
      ctx.go("#/home");
    } catch (e) {
      submit.disabled = false;
      notice.replaceChildren(errorMessage("No se pudo iniciar sesión", e instanceof ApiError ? e.message : "Inténtalo de nuevo."));
      announce(e.message, { urgent: true });
    }
  });

  const demo = button("Probar sin cuenta (modo demostración)", { variant: "secondary" });
  demo.addEventListener("click", () => {
    update({ mode: "demo", email: null, name: "Demostración" });
    announce("Modo demostración activado. Las descripciones son simuladas.");
    ctx.go("#/home");
  });

  root.append(
    form,
    el("p", {}, [el("a", { href: "#/register", text: "Crear una cuenta nueva" })]),
    demo,
  );
}

export function renderRegister(root, ctx) {
  root.replaceChildren(
    el("h1", { text: "Crear cuenta" }),
    el("p", { text: "Tu cuenta sirve para vincular tu bastón y guardar tu historial." }),
  );

  const notice = el("div");
  const name = field({ id: "name", label: "Nombre", autocomplete: "name" });
  const email = field({ id: "email", label: "Correo electrónico", kind: "email", autocomplete: "email" });
  const password = passwordField("password", "Contraseña", "new-password");
  const confirm = passwordField("confirm", "Repite la contraseña", "new-password");
  const submit = button("Crear cuenta", { kind: "submit" });

  const form = el("form", { novalidate: true, "aria-label": "Crear cuenta" }, [
    notice, name.node, email.node, password.node, confirm.node, submit,
  ]);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    notice.replaceChildren();
    const okName = showFieldError(name, name.input.value.trim() ? "" : "Escribe tu nombre.");
    const okEmail = showFieldError(email, VALID_EMAIL.test(email.input.value.trim()) ? "" : "Escribe un correo válido.");
    const okPass = showFieldError(
      password,
      password.input.value.length >= MIN_PASSWORD ? "" : `Usa al menos ${MIN_PASSWORD} caracteres.`,
    );
    const okConfirm = showFieldError(
      confirm,
      confirm.input.value === password.input.value ? "" : "Las contraseñas no coinciden.",
    );
    const firstError = [okName, okEmail, okPass, okConfirm].findIndex((ok) => !ok);
    if (firstError !== -1) {
      announce("Revisa los campos marcados.", { urgent: true });
      [name, email, password, confirm][firstError].input.focus();
      return;
    }
    submit.disabled = true;
    notice.replaceChildren(loading("Creando tu cuenta…"));
    try {
      await auth.register(name.input.value.trim(), email.input.value.trim(), password.input.value);
      // El backend responde igual exista o no el correo (protección frente a enumeración).
      announce("Solicitud procesada. Inicia sesión para continuar.");
      ctx.go("#/login");
    } catch (e) {
      submit.disabled = false;
      notice.replaceChildren(errorMessage("No se pudo crear la cuenta", e instanceof ApiError ? e.message : "Inténtalo de nuevo."));
      announce(e.message, { urgent: true });
    }
  });

  root.append(form, el("p", {}, [el("a", { href: "#/login", text: "Ya tengo cuenta" })]));
}
