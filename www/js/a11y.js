// Utilidades de accesibilidad: anuncios para lectores de pantalla y gestión del foco.

// Tiempo durante el que un aviso urgente tiene prioridad sobre el anuncio del título de pantalla.
const URGENT_PRIORITY_MS = 2500;
let urgentUntil = 0;

export function announce(message, { urgent = false } = {}) {
  const region = document.getElementById("announcements");
  if (!region) return;
  if (urgent) urgentUntil = Date.now() + URGENT_PRIORITY_MS;
  region.setAttribute("aria-live", urgent ? "assertive" : "polite");
  region.textContent = "";
  // Un retardo corto hace que el lector vuelva a anunciar aunque el texto sea igual.
  setTimeout(() => {
    region.textContent = message;
  }, 60);
}

// Anuncia el título de una pantalla salvo que haya un aviso urgente reciente (no se pisa).
export function announceTitle(title) {
  if (Date.now() < urgentUntil) return;
  announce(title);
}

export function connectionStatus(text) {
  const el = document.getElementById("connection-status");
  if (el) el.textContent = text;
}

// Tras cambiar de pantalla, el foco va al título para que TalkBack empiece por lo importante.
export function focusTitle(root) {
  const title = root.querySelector("h1");
  if (!title) {
    root.focus({ preventScroll: true });
    return;
  }
  title.setAttribute("tabindex", "-1");
  title.focus({ preventScroll: true });
}
