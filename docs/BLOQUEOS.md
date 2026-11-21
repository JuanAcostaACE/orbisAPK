# Bloqueos y pendientes de la app

## 1. Sesión del modo conectado (bloqueo de diseño, crítico)

- El backend crea la sesión con cookie `ORBIS_SID` `HttpOnly` y `SameSite=Strict`.
- La app Android carga la interfaz desde `https://localhost` (Capacitor) y llama a `https://<backend>`: es un **origen distinto**.
- Con `SameSite=Strict`, el navegador **no envía la cookie** en esas peticiones, así que `/auth/me` y el resto de rutas autenticadas responden 401.
- **Consecuencia:** el inicio de sesión funciona contra el backend, pero la sesión no se mantiene en la app Android.
- **Opciones para decidir (requieren autorización del propietario):**
  - A. Autenticación por token (`Authorization: Bearer`) para clientes móviles: un endpoint nuevo que devuelva un token de sesión. Cambia el modelo de seguridad.
  - B. Relajar `SameSite` a `None; Secure` para la sesión: más exposición a CSRF, y el panel web lo empeora.
- Recomendación: A, con token de corta duración y rotación, reutilizando el mismo mecanismo de D-002.

## 2. Estado y datos del bastón (endpoints inexistentes)

- No existe `GET` de la lista de dispositivos ni del estado de conexión del bastón.
- No existe endpoint que devuelva la **descripción** de una captura: `GET /api/v1/devices/captures/{id}` solo devuelve el estado.
- La app muestra estos datos como "sin datos" y no los simula.

## 3. Vinculación con auxiliares (endpoints inexistentes)

- No existen invitación, aceptación, revocación ni consulta de auxiliares en el backend.
- Las pantallas de auxiliar muestran los controles deshabilitados y el motivo real.

## 4. Análisis de IA (no implementado)

- No hay modelo de descripción conectado a la app ni al backend.
- El modo demostración genera descripciones **simuladas** y las etiqueta como tales en pantalla, en la voz y en los datos.

## 5. Android (pendiente de verificación en dispositivo)

- TalkBack, TTS del sistema, audífonos Bluetooth y comportamiento en segundo plano no están verificados en un teléfono real.
- Ver `docs/DECISION_TECNOLOGIA.md`, riesgo 1.

## 6. Seguridad de la app

- La app no contiene credenciales ni claves.
- `API_BASE` apunta a `http://localhost:8080` (backend de pruebas). **No se usa producción.** La URL de Railway se configura solo con autorización.
- Revisar la política de contraseñas local (mínimo 8 caracteres) con la política real del backend.
