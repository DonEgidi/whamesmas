# WhatsSender PRO 🚀
### Sistema Inteligente de Envío Masivo por WhatsApp para Números No Agendados

Un sistema completo, moderno y seguro desarrollado con **Node.js**, **Express**, **Socket.IO** y **whatsapp-web.js** para enviar mensajes a listas de contactos no agendados, con soporte para variables personalizadas (`{nombre}`, `{monto}`, `{vencimiento}`), protección contra bloqueos y un dashboard visual en tiempo real.

---

## ✨ Características Principales

1. **Envíos a Números No Agendados**:
   - No necesitas guardar los contactos en tu libreta telefónica.
   - Verificación previa automática (`isRegisteredUser` / `getNumberId`): si el número no tiene WhatsApp, el sistema lo detecta y lo clasifica como *"Sin WhatsApp"* sin interrumpir la campaña.
   - Normalización inteligente de formatos internacionales (detección de prefijos, código de país por defecto y limpieza de caracteres `+`, `-`, espacios, etc.).
   - Tratamiento especial para Argentina: remoción automática del `15` interno y agregado de `549`.

2. **Variables Dinámicas Personalizadas**:
   - Soporte para cualquier columna de tu archivo Excel (.xlsx / .xls) o CSV (ej: `{nombre}`, `{empresa}`, `{saldo}`, `{fecha}`).
   - Botones rápidos (chips) para insertar variables al hacer clic.
   - Formateo de texto WhatsApp (*negrita*, _cursiva_, ~tachado~).

3. **Simulador de Chat en Tiempo Real**:
   - Vista previa interactiva con el diseño de una burbuja de chat de WhatsApp real.
   - Permite alternar entre contactos de tu lista para verificar cómo se leerá el mensaje antes de lanzarlo.

4. **Protección Anti-Baneo**:
   - **Demora aleatoria configurable**: Simula el ritmo humano entre envíos (por defecto entre 8s y 20s).
   - Contador regresivo en pantalla antes de cada mensaje.
   - Botón de **"Mensaje de Prueba"** para enviar 1 mensaje a tu propio número antes de arrancar.
   - Controles de campaña: **Iniciar**, **Pausar**, **Reanudar** y **Detener**.

5. **Panel de Control y Métricas en Vivo**:
   - Indicadores de conexión WebSocket (Desconectado, Escaneo QR, Conectado).
   - Barra de progreso porcentual y contadores en tiempo real: Total, Enviados, Sin WhatsApp, Errores.
   - Tabla detallada con estado por destinatario.
   - Consola de actividad y logs en vivo.
   - **Exportación de Reporte en CSV** con el resultado final de cada envío.

6. **Persistencia de Sesión**:
   - Utiliza `LocalAuth` para guardar la sesión en `.wwebjs_auth/`. Solo necesitas escanear el QR la primera vez.

---

## 🚀 Cómo Iniciar el Sistema

### 1. Iniciar el servidor
En esta misma carpeta, ejecuta:

```bash
npm start
```
*(O `npm run dev` para modo desarrollo con reinicio automático).*

### 2. Abrir el Panel Web
Abre tu navegador en:
👉 **[http://localhost:3000](http://localhost:3000)**

### 3. Vincular WhatsApp
1. Al abrir el panel, haz clic en **"Vincular QR"** (o se abrirá automáticamente si es la primera vez).
2. Abre WhatsApp en tu celular:
   - **Android**: Tres puntos arriba a la derecha > *Dispositivos vinculados* > *Vincular un dispositivo*.
   - **iPhone**: Configuración > *Dispositivos vinculados* > *Vincular un dispositivo*.
3. Escanea el código QR que aparece en pantalla.
4. Una vez vinculado, el indicador cambiará a **"Conectado: Tu Nombre (+Tu Número)"**.

---

## 📋 Pasos para Realizar un Envío

1. **Paso 1: Lista de Contactos**:
   - Puedes arrastrar un archivo **Excel (.xlsx, .xls)** o **CSV**, o bien usar la pestaña **"Pegar Números Manualmente"**.
   - En el menú superior de la tarjeta puedes presionar **"Descargar Plantilla Excel"** para tener una planilla base de ejemplo.
   - Selecciona la columna correspondiente al teléfono y tu prefijo de país por defecto (por ej. `+54 9` para Argentina).
2. **Paso 2: Mensaje y Variables**:
   - Escribe tu mensaje en el editor. Usa los botones superiores para insertar negritas o cursivas.
   - Haz clic en los chips de variables (ej. `+ {nombre}`) para insertarlas donde desees.
   - Observa en el panel derecho cómo queda tu mensaje en el simulador de WhatsApp.
3. **Paso 3: Configuración Anti-Baneo**:
   - Ajusta los segundos de espera mínimo y máximo.
   - Opcional: prueba el envío con tu propio teléfono en **"Enviar 1 Mensaje de Prueba"**.
4. **Paso 4: Iniciar Envíos**:
   - Haz clic en **"Iniciar Envíos"**.
   - Verás el avance en tiempo real en la barra de progreso, los contadores y la tabla de resultados.
   - Al finalizar, presiona **"Exportar Reporte"** para guardar una copia en CSV de todos los envíos.

---

## 🛡️ Recomendaciones de Seguridad (Anti-Spam / Anti-Ban)

WhatsApp cuenta con sistemas automatizados para detectar spam. Sigue estas buenas prácticas:
- **Tiempos de espera**: Mantén al menos 10 a 25 segundos de demora entre mensajes.
- **Calentamiento de número**: Si tu número de WhatsApp es nuevo, no envíes 200 mensajes el primer día. Comienza con tandas de 20-30 y ve aumentando gradualmente.
- **Personalización**: Usa variables dinámicas (`{nombre}`). Los mensajes que son idénticos para cientos de personas son detectados más fácilmente por los filtros de spam.
- **Opt-in / Relevancia**: Envía únicamente a personas que tengan relación con tu actividad o negocio para evitar que los destinatarios te reporten como spam.
