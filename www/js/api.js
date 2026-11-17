// Cliente del backend ORBIS. Solo consume endpoints que EXISTEN en orbisBackend.
// Endpoints inexistentes (lista de dispositivos, descripción de capturas, invitaciones de auxiliar)
// NO se llaman: sus pantallas usan adaptadores identificados en js/adaptadores.js.
import { API_BASE } from "./config.js";

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
  ERROR_INTERNO: "ORBIS tiene un problema temporal. Inténtalo más tarde.",
};

function mensajePara(codigo, status) {
  if (MENSAJES[codigo]) return MENSAJES[codigo];
  if (status >= 500) return MENSAJES.ERROR_INTERNO;
  return "No se pudo completar la acción. Inténtalo de nuevo.";
}

function cabeceraAntiCsrf(metodo) {
  if (metodo === "GET") return {};
  // El backend usa CookieCsrfTokenRepository: el valor llega en la cookie XSRF-TOKEN.
  const par = document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="));
  return par ? { "X-XSRF-TOKEN": decodeURIComponent(par.split("=")[1]) } : {};
}

async function peticion(ruta, { metodo = "GET", cuerpo, esLogin = false } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(API_BASE + ruta, {
      method: metodo,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
        ...cabeceraAntiCsrf(metodo),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, "SIN_CONEXION", MENSAJES.SIN_CONEXION);
  }

  if (respuesta.status === 401) {
    if (esLogin) throw new ErrorApi(401, "CREDENCIALES", MENSAJES.CREDENCIALES);
    throw new ErrorApi(401, "SESION_EXPIRADA", MENSAJES.SESION_EXPIRADA);
  }
  if (respuesta.status === 429) {
    throw new ErrorApi(429, "DEMASIADOS_INTENTOS", MENSAJES.DEMASIADOS_INTENTOS);
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
  login: (correo, contrasena) =>
    peticion("/auth/login", { metodo: "POST", cuerpo: { correo, contrasena }, esLogin: true }),
  registro: (nombre, correo, contrasena) =>
    peticion("/auth/registro", { metodo: "POST", cuerpo: { nombre, correo, contrasena } }),
  logout: () => peticion("/auth/logout", { metodo: "POST" }),
  me: () => peticion("/auth/me"),
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
  // Solo devuelve el ESTADO de una captura. El backend todavía no devuelve la descripción.
  estado: (captureId) => peticion(`/api/v1/dispositivos/capturas/${encodeURIComponent(captureId)}`),
};
