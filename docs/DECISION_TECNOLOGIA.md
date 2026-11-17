# Decisión tecnológica de la app ORBIS

Fecha: 2026-11-17. Responsable: agente principal de la misión de la app.

## Cambio respecto a la recomendación anterior

En `docs/ORBIS_ANDROID_STRATEGY.md` (rama `docs/orbis-arquitectura`) se recomendó **Kotlin + Jetpack Compose**. Esta decisión **la sustituye** para la primera versión, por una razón de plazo y verificabilidad: el propietario pidió una aplicación ejecutable y probable en navegador en el menor tiempo posible. Con Capacitor se puede probar la interfaz completa en navegador hoy y generar la APK con el mismo código.

La recomendación de Kotlin nativa **sigue vigente para una versión de producción** si las pruebas en dispositivo real (TalkBack, TTS, push, Bluetooth) revelan limitaciones del WebView.

## Opciones evaluadas (límite de 30 minutos)

| Criterio | Capacitor 8 + JavaScript | Kotlin + Compose |
|---|---|---|
| Tiempo a una APK ejecutable | Bajo: el mismo código corre en navegador y en el WebView | Medio-alto: toda la interfaz se escribe de nuevo |
| Probar la interfaz sin emulador | Sí, con Playwright en navegador | Solo con emulador o dispositivo |
| TTS | Plugin nativo `@capacitor-community/text-to-speech` (TTS del sistema) | API nativa `TextToSpeech` directa |
| TalkBack | Depende del WebView; se usan roles y etiquetas ARIA, sin garantía hasta probar en dispositivo | Semántica nativa completa |
| Push (FCM) | Plugin de terceros, pendiente | SDK oficial |
| Bluetooth audio | Lo gestiona Android; la app no accede directamente | Igual |
| Mantenibilidad | Un solo código para web y móvil | Dos códigos si se mantiene web |

## Riesgos aceptados

1. **TalkBack sobre WebView** no está verificado en dispositivo. Es el riesgo principal.
2. **Sesión por cookie.** El backend emite `ORBIS_SID` con `SameSite=Strict`. La app Android sirve su interfaz desde otro origen, así que **el modo conectado no puede mantener la sesión tal como está**. Se necesita un cambio de autenticación en el backend (token para cliente móvil). Ver `docs/BLOQUEOS.md`.
3. **Dependencias de Capacitor** fijadas a versiones publicadas hace al menos dos semanas (Capacitor 8.6.0, plugin TTS 8.0.2).

## Qué no se usa

- No hay framework de interfaz: el código es JavaScript modular sin bundler, para reducir dependencias.
- No hay analizador de imágenes: el modo demostración usa descripciones **simuladas** y así se etiquetan.
