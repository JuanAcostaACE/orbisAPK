// Pantallas de acceso: inicio de sesión y registro.
import { auth, ErrorApi } from "../api.js";
import { actualizar } from "../store.js";
import { anunciar } from "../a11y.js";
import { el, campo, boton, mensajeError, cargando } from "../componentes.js";

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_CONTRASENA = 8; // Política local. Confirmar con la política real del backend.

function mostrarErrorCampo(c, texto) {
  c.error.textContent = texto ?? "";
  c.entrada.setAttribute("aria-invalid", texto ? "true" : "false");
  return !texto;
}

// Campo de contraseña con mostrar/ocultar. El valor nunca se escribe en el DOM como texto.
function campoContrasena(id, etiqueta, autocomplete) {
  const c = campo({ id, etiqueta, tipo: "password", autocomplete });
  const alternar = boton("Mostrar", { variante: "secundario", etiqueta: `Mostrar ${etiqueta.toLowerCase()}` });
  alternar.setAttribute("aria-pressed", "false");
  alternar.addEventListener("click", () => {
    const mostrando = c.entrada.type === "text";
    c.entrada.type = mostrando ? "password" : "text";
    alternar.textContent = mostrando ? "Mostrar" : "Ocultar";
    alternar.setAttribute("aria-pressed", String(!mostrando));
    alternar.setAttribute("aria-label", `${mostrando ? "Mostrar" : "Ocultar"} ${etiqueta.toLowerCase()}`);
  });
  // Se sustituye el input in situ: primero se coloca el contenedor, luego se mueve el input dentro.
  const fila = el("div", { className: "fila-contrasena" });
  c.entrada.replaceWith(fila);
  fila.append(c.entrada, alternar);
  return { ...c };
}

export function renderLogin(raiz, ctx) {
  raiz.replaceChildren(
    el("h1", { texto: "Iniciar sesión" }),
    el("p", { texto: "Entra con tu cuenta de ORBIS para ver tu bastón, tus resultados y tu historial." }),
  );

  const aviso = el("div");
  const correo = campo({ id: "correo", etiqueta: "Correo electrónico", tipo: "email", autocomplete: "email" });
  const contrasena = campoContrasena("contrasena", "Contraseña", "current-password");
  const enviar = boton("Entrar", { tipo: "submit" });
  const formulario = el("form", { novalidate: true, "aria-label": "Iniciar sesión" }, [
    aviso,
    correo.nodo,
    contrasena.nodo,
    enviar,
  ]);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    aviso.replaceChildren();
    const okCorreo = mostrarErrorCampo(correo, CORREO_VALIDO.test(correo.entrada.value.trim()) ? "" : "Escribe un correo válido.");
    const okPass = mostrarErrorCampo(contrasena, contrasena.entrada.value ? "" : "Escribe tu contraseña.");
    if (!okCorreo || !okPass) {
      anunciar("Revisa los campos marcados.", { urgente: true });
      (okCorreo ? contrasena.entrada : correo.entrada).focus();
      return;
    }
    enviar.disabled = true;
    aviso.replaceChildren(cargando("Entrando…"));
    try {
      await auth.login(correo.entrada.value.trim(), contrasena.entrada.value);
      const sesion = await auth.me().catch(() => null);
      actualizar({ modo: "conectado", correo: sesion?.correo ?? correo.entrada.value.trim(), nombre: null });
      anunciar("Sesión iniciada.");
      ctx.ir("#/inicio");
    } catch (e) {
      enviar.disabled = false;
      aviso.replaceChildren(mensajeError("No se pudo iniciar sesión", e instanceof ErrorApi ? e.message : "Inténtalo de nuevo."));
      anunciar(e.message, { urgente: true });
    }
  });

  const demo = boton("Probar sin cuenta (modo demostración)", { variante: "secundario" });
  demo.addEventListener("click", () => {
    actualizar({ modo: "demo", correo: null, nombre: "Demostración" });
    anunciar("Modo demostración activado. Las descripciones son simuladas.");
    ctx.ir("#/inicio");
  });

  raiz.append(
    formulario,
    el("p", {}, [el("a", { href: "#/registro", texto: "Crear una cuenta nueva" })]),
    demo,
  );
}

export function renderRegistro(raiz, ctx) {
  raiz.replaceChildren(
    el("h1", { texto: "Crear cuenta" }),
    el("p", { texto: "Tu cuenta sirve para vincular tu bastón y guardar tu historial." }),
  );

  const aviso = el("div");
  const nombre = campo({ id: "nombre", etiqueta: "Nombre", autocomplete: "name" });
  const correo = campo({ id: "correo", etiqueta: "Correo electrónico", tipo: "email", autocomplete: "email" });
  const contrasena = campoContrasena("contrasena", "Contraseña", "new-password");
  const confirmar = campoContrasena("confirmar", "Repite la contraseña", "new-password");
  const enviar = boton("Crear cuenta", { tipo: "submit" });

  const formulario = el("form", { novalidate: true, "aria-label": "Crear cuenta" }, [
    aviso, nombre.nodo, correo.nodo, contrasena.nodo, confirmar.nodo, enviar,
  ]);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    aviso.replaceChildren();
    const okNombre = mostrarErrorCampo(nombre, nombre.entrada.value.trim() ? "" : "Escribe tu nombre.");
    const okCorreo = mostrarErrorCampo(correo, CORREO_VALIDO.test(correo.entrada.value.trim()) ? "" : "Escribe un correo válido.");
    const okPass = mostrarErrorCampo(
      contrasena,
      contrasena.entrada.value.length >= MIN_CONTRASENA ? "" : `Usa al menos ${MIN_CONTRASENA} caracteres.`,
    );
    const okConfirmar = mostrarErrorCampo(
      confirmar,
      confirmar.entrada.value === contrasena.entrada.value ? "" : "Las contraseñas no coinciden.",
    );
    const primerError = [okNombre, okCorreo, okPass, okConfirmar].findIndex((ok) => !ok);
    if (primerError !== -1) {
      anunciar("Revisa los campos marcados.", { urgente: true });
      [nombre, correo, contrasena, confirmar][primerError].entrada.focus();
      return;
    }
    enviar.disabled = true;
    aviso.replaceChildren(cargando("Creando tu cuenta…"));
    try {
      await auth.registro(nombre.entrada.value.trim(), correo.entrada.value.trim(), contrasena.entrada.value);
      // El backend responde igual exista o no el correo (protección frente a enumeración).
      anunciar("Solicitud procesada. Inicia sesión para continuar.");
      ctx.ir("#/login");
    } catch (e) {
      enviar.disabled = false;
      aviso.replaceChildren(mensajeError("No se pudo crear la cuenta", e instanceof ErrorApi ? e.message : "Inténtalo de nuevo."));
      anunciar(e.message, { urgente: true });
    }
  });

  raiz.append(formulario, el("p", {}, [el("a", { href: "#/login", texto: "Ya tengo cuenta" })]));
}
