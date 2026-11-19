// Puente sin bundler para los módulos vendorizados de plugins Capacitor.
// En la app nativa, window.Capacitor lo crea el puente nativo de Capacitor. Este archivo solo reexporta
// lo que el plugin de almacenamiento seguro necesita. No se carga en el navegador (ver js/sesion.js).
export const Capacitor = window.Capacitor;
export const registerPlugin = (...args) => window.Capacitor.registerPlugin(...args);

// Clases base usadas por el plugin. La implementación web del plugin no se usa en la app.
export class WebPlugin {}

export class CapacitorException extends Error {
  constructor(mensaje, codigo) {
    super(mensaje);
    this.code = codigo;
  }
}
