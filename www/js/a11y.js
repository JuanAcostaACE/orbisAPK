// Utilidades de accesibilidad: anuncios para lectores de pantalla y gestión del foco.

// Tiempo durante el que un aviso urgente tiene prioridad sobre el anuncio del título de pantalla.
const PRIORIDAD_URGENTE_MS = 2500;
let urgenteHasta = 0;

export function anunciar(mensaje, { urgente = false } = {}) {
  const region = document.getElementById("anuncios");
  if (!region) return;
  if (urgente) urgenteHasta = Date.now() + PRIORIDAD_URGENTE_MS;
  region.setAttribute("aria-live", urgente ? "assertive" : "polite");
  region.textContent = "";
  // Un retardo corto hace que el lector vuelva a anunciar aunque el texto sea igual.
  setTimeout(() => {
    region.textContent = mensaje;
  }, 60);
}

// Anuncia el título de una pantalla salvo que haya un aviso urgente reciente (no se pisa).
export function anunciarTitulo(titulo) {
  if (Date.now() < urgenteHasta) return;
  anunciar(titulo);
}

export function estadoConexion(texto) {
  const el = document.getElementById("estado-conexion");
  if (el) el.textContent = texto;
}

// Tras cambiar de pantalla, el foco va al título para que TalkBack empiece por lo importante.
export function enfocarTitulo(raiz) {
  const titulo = raiz.querySelector("h1");
  if (!titulo) {
    raiz.focus({ preventScroll: true });
    return;
  }
  titulo.setAttribute("tabindex", "-1");
  titulo.focus({ preventScroll: true });
}
