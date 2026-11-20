// Cliente del backend ORBIS. Solo consume endpoints que EXISTEN en orbisBackend.
// Endpoints inexistentes (lista de dispositivos, descripción de capturas, invitaciones de auxiliar)
// NO se llaman: sus pantallas usan adaptadores identificados en js/adaptadores.js.
import { API_BASE } from "./config.js";
import { tokenActual, borrarToken } from "./sesion.js";

// Se emite cuando un token que estaba en uso deja de valer (401). app.js lleva a la pantalla de acceso.
export const EVENTO_SESION_CADUCADA = "orbis.sesion-caducada";

export class ErrorApi extends Error {
  constructor(status, codigo, mensaje) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

const MENSAJES = {
  SIN_CONEXION: "No hay conexión con ORBIS. Revisa tu Internet e inténtalo de nuevo.",
  SESION_EXPIRADA: "Tu sesión ha caducado. Inicia sesión de nuevo.",
  CREDENCIALES: "Correo o contraseña incorrectos.",
  DEMASIADOS_INTENTOS: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.",
  CODIGO_NO_VALIDO: "El código no es válido. Puede estar usado o caducado. Genera uno nuevo.",
  IMAGEN_DEMASIADO_GRANDE: "La fotografía es demasiado grande. Usa una imagen más pequeña.",
  TIPO_NO_SOPORTADO: "El formato no es válido. Usa una fotografía JPEG.",
  IMAGEN_NO_VALIDA: "No pude leer la fotografía. Inténtalo de nuevo.",
  CAPTURA_CONFLICTO: "Esa captura ya existe con otro contenido.",
  LIMITE_FOTOS: "Has enviado demasiadas fotografías seguidas. Espera un momento e inténtalo de nuevo.",
  ERROR_INTERNO: "ORBIS tiene un problema temporal. Inténtalo más tarde.",
};

const MENSAJE_POR_ESTADO = {
  413: MENSAJES.IMAGEN_DEMASIADO_GRANDE,
  415: MENSAJES.TIPO_NO_SOPORTADO,
  422: MENSAJES.IMAGEN_NO_VALIDA,
};

function mensajePara(codigo, status) {
  if (MENSAJES[codigo]) return MENSAJES[codigo];
  if (MENSAJE_POR_ESTADO[status]) return MENSAJE_POR_ESTADO[status];
  if (status >= 500) return MENSAJES.ERROR_INTERNO;
  return "No se pudo completar la acción. Inténtalo de nuevo.";
}

function cabeceraAntiCsrf(metodo) {
  if (metodo === "GET") return {};
  // El backend usa CookieCsrfTokenRepository: el valor llega en la cookie XSRF-TOKEN.
  const par = document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="));
  return par ? { "X-XSRF-TOKEN": decodeURIComponent(par.split("=")[1]) } : {};
}

// esLogin: el login no envía token. sinAvisoSesion: el llamador gestiona el 401 (no se emite el evento).
// binario: { blob, tipo, cabeceras } envía el cuerpo tal cual (sin JSON).
async function peticion(ruta, { metodo = "GET", cuerpo, binario, esLogin = false, sinAvisoSesion = false } = {}) {
  const token = esLogin ? null : tokenActual();
  let respuesta;
  try {
    respuesta = await fetch(API_BASE + ruta, {
      method: metodo,
      // Se conserva credentials: "include" para el panel web (cookies y CSRF).
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(binario ? { "Content-Type": binario.tipo, ...binario.cabeceras } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...cabeceraAntiCsrf(metodo),
      },
      body: binario ? binario.blob : cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, "SIN_CONEXION", MENSAJES.SIN_CONEXION);
  }

  if (respuesta.status === 401) {
    if (esLogin) throw new ErrorApi(401, "CREDENCIALES", MENSAJES.CREDENCIALES);
    // El token ya no sirve: se borra antes de avisar. Un 401 sin token no es una sesión caducada.
    if (token) {
      await borrarToken();
      if (!sinAvisoSesion) window.dispatchEvent(new Event(EVENTO_SESION_CADUCADA));
    }
    throw new ErrorApi(401, "SESION_EXPIRADA", MENSAJES.SESION_EXPIRADA);
  }
  if (respuesta.status === 429) {
    throw new ErrorApi(429, "DEMASIADOS_INTENTOS", binario ? MENSAJES.LIMITE_FOTOS : MENSAJES.DEMASIADOS_INTENTOS);
  }
  if (!respuesta.ok) {
    let codigo = "ERROR";
    try {
      const cuerpoError = await respuesta.json();
      codigo = cuerpoError.error ?? cuerpoError.codigo ?? codigo;
    } catch {
      // Respuesta sin cuerpo JSON: se usa el mensaje genérico.
    }
    throw new ErrorApi(respuesta.status, codigo, mensajePara(codigo, respuesta.status));
  }
  if (respuesta.status === 204) return null;
  try {
    return await respuesta.json();
  } catch {
    return null;
  }
}

export const auth = {
  // App móvil (Android y navegador de pruebas): token de acceso en la cabecera Authorization.
  // Respuesta: { accessToken, tokenType, expiresIn, correo, nombre }. 401 = CREDENCIALES_INCORRECTAS.
  loginMovil: (correo, contrasena) =>
    peticion("/auth/token", { metodo: "POST", cuerpo: { correo, contrasena }, esLogin: true }),
  yo: () => peticion("/auth/token/yo", { sinAvisoSesion: true }),
  logoutMovil: () => peticion("/auth/token/logout", { metodo: "POST", sinAvisoSesion: true }),
  // Panel web: sesión por cookies (se mantiene como respaldo).
  login: (correo, contrasena) =>
    peticion("/auth/login", { metodo: "POST", cuerpo: { correo, contrasena }, esLogin: true }),
  registro: (nombre, correo, contrasena) =>
    peticion("/auth/registro", { metodo: "POST", cuerpo: { nombre, correo, contrasena } }),
  logout: () => peticion("/auth/logout", { metodo: "POST", sinAvisoSesion: true }),
  me: () => peticion("/auth/me", { sinAvisoSesion: true }),
};

export const eventos = {
  // Eventos de distancia del bastón o del simulador. No son fotografías.
  listar: (pagina = 0, tamano = 20) => peticion(`/api/v1/eventos?page=${pagina}&size=${tamano}`),
};

export const dispositivos = {
  // Código de un solo uso para registrar un bastón (D-002).
  codigoVinculacion: () => peticion("/api/v1/dispositivos/vinculaciones", { metodo: "POST" }),
  revocar: (id) => peticion(`/api/v1/dispositivos/${encodeURIComponent(id)}`, { metodo: "DELETE" }),
};

export const capturas = {
  // Sube una fotografía JPEG (ya reducida, máx. 512 KB). captureId: UUID v4. 202 = nueva, 200 = reintento idéntico.
  subir: (blob, captureId) =>
    peticion("/api/v1/dispositivos/capturas", {
      metodo: "POST",
      binario: { blob, tipo: "image/jpeg", cabeceras: { "X-Capture-Id": captureId } },
    }),
  // { captureId, estado, duplicada, descripcion, etiquetas, motivoFallo }
  estado: (captureId) => peticion(`/api/v1/dispositivos/capturas/${encodeURIComponent(captureId)}`),
  // { contenido: [{ captureId, estado, descripcion, etiquetas, motivoFallo, recibidaEn }], ...paginación }
  // Puede no existir todavía en el servidor (404/405): el historial degrada a las capturas locales.
  listar: (pagina = 0, tamano = 20) => peticion(`/api/v1/dispositivos/capturas?page=${pagina}&size=${tamano}`),
};
