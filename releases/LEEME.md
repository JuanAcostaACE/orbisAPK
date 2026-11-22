# ORBIS: APK de depuración

- Archivo: [`../apks/ORBIS-debug.apk`](../apks/ORBIS-debug.apk) (4,0 MB)
- SHA-256: `842be67c534a14016fc3369dee62c8e809dc5fe94161475cfebcd13de6b55a36`
- Paquete: `com.orbis.app` · versión 1.0 (código 1)
- Android mínimo: 7.0 (API 24) · objetivo: Android 16 (API 36)
- Firma: clave de depuración. No es un APK de publicación.

## Instalar
1. Abrir el archivo desde el teléfono y permitir "instalar apps desconocidas" para la app que lo abre.
2. Pulsar Instalar y después Abrir.

## Qué está verificado
- Compila (Gradle, AGP 8.13, JDK 21). Pruebas de navegador: 23 de 23 pasan (Playwright). Son pruebas de navegador, no de Android.

## Qué NO está verificado
- No se ha probado en un teléfono real.
- TalkBack, voz nativa (TTS) y audífonos Bluetooth no están verificados.
- El inicio de sesión con cuenta no funciona en Android todavía: el servidor usa cookies que la app no puede usar. El modo demostración sí funciona.
- Las descripciones del modo demostración son simuladas.
