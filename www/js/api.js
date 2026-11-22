// Cliente del backend ORBIS. Solo consume endpoints que EXISTEN en orbisBackend.
// Endpoints inexistentes (lista de dispositivos, descripción de capturas, invitaciones de auxiliar)
// NO se llaman: sus pantallas usan adaptadores identificados en js/adapters.js.
import { API_BASE } from "./config.js";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const MESSAGES = {
  NO_CONNECTION: "No hay conexión con ORBIS. Revisa tu Internet e inténtalo de nuevo.",
  SESSION_EXPIRED: "Tu sesión ha caducado. Inicia sesión de nuevo.",
  INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
  TOO_MANY_ATTEMPTS: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.",
  INVALID_CODE: "El código no es válido. Puede estar usado o caducado. Genera uno nuevo.",
  IMAGE_TOO_LARGE: "La fotografía es demasiado grande. Usa una imagen más pequeña.",
  UNSUPPORTED_TYPE: "El formato no es válido. Usa una fotografía JPEG.",
  INVALID_IMAGE: "No pude leer la fotografía. Inténtalo de nuevo.",
  CAPTURE_CONFLICT: "Esa captura ya existe con otro contenido.",
  INTERNAL_ERROR: "ORBIS tiene un problema temporal. Inténtalo más tarde.",
};

function messageFor(code, status) {
  if (MESSAGES[code]) return MESSAGES[code];
  if (status >= 500) return MESSAGES.INTERNAL_ERROR;
  return "No se pudo completar la acción. Inténtalo de nuevo.";
}

function antiCsrfHeader(method) {
  if (method === "GET") return {};
  // El backend usa CookieCsrfTokenRepository: el valor llega en la cookie XSRF-TOKEN.
  const pair = document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="));
  return pair ? { "X-XSRF-TOKEN": decodeURIComponent(pair.split("=")[1]) } : {};
}

async function request(route, { method = "GET", body, isLogin = false } = {}) {
  let response;
  try {
    response = await fetch(API_BASE + route, {
      method: method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...antiCsrfHeader(method),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NO_CONNECTION", MESSAGES.NO_CONNECTION);
  }

  if (response.status === 401) {
    if (isLogin) throw new ApiError(401, "INVALID_CREDENTIALS", MESSAGES.INVALID_CREDENTIALS);
    throw new ApiError(401, "SESSION_EXPIRED", MESSAGES.SESSION_EXPIRED);
  }
  if (response.status === 429) {
    throw new ApiError(429, "TOO_MANY_ATTEMPTS", MESSAGES.TOO_MANY_ATTEMPTS);
  }
  if (!response.ok) {
    let code = "ERROR";
    try {
      const errorBody = await response.json();
      code = errorBody.error ?? errorBody.code ?? code;
    } catch {
      // Respuesta sin cuerpo JSON: se usa el mensaje genérico.
    }
    throw new ApiError(response.status, code, messageFor(code, response.status));
  }
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export const auth = {
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password }, isLogin: true }),
  register: (name, email, password) =>
    request("/auth/register", { method: "POST", body: { name, email, password } }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
};

export const events = {
  // Eventos de distancia del bastón o del simulador. No son fotografías.
  list: (page = 0, size = 20) => request(`/api/v1/events?page=${page}&size=${size}`),
};

export const devices = {
  // Código de un solo uso para registrar un bastón (D-002).
  pairingCode: () => request("/api/v1/devices/pairings", { method: "POST" }),
  revoke: (id) => request(`/api/v1/devices/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const captures = {
  // Solo devuelve el ESTADO de una captura. El backend todavía no devuelve la descripción.
  state: (captureId) => request(`/api/v1/devices/captures/${encodeURIComponent(captureId)}`),
};
