# Integraciones — Club Zeta

## Sistema de turnos → Google Calendar + Google Sheets

**Workflow:** `../automatizacion/workflow.json`

### Cómo funciona

```
Formulario de la web
        │
        ├─ GET  /club-zeta-disponibilidad?fecha=…&barbero=…
        │       → lee el Calendar del día → devuelve horarios ocupados
        │       → la web los muestra tachados y no clickeables
        │
        └─ POST /club-zeta-turnos
                → valida los datos
                → crea el evento en el Google Calendar del barbero
                → agrega la fila en la planilla de Google Sheets
                → manda email de confirmación al cliente (si dejó email)
                → responde OK y la web muestra la pantalla de confirmado
```

### Conectar (4 pasos)

**1 — Importar el workflow en n8n**
Workflows → Import from file → `../automatizacion/workflow.json`

**2 — Configurar credenciales**
Cada nodo de Google tiene `"id": "REEMPLAZAR"`. Al abrirlo, seleccionar la credencial real:
- Google Calendar OAuth2 (cuenta del barbero)
- Google Sheets OAuth2
- Gmail OAuth2 (para la confirmación al cliente)

**3 — Reemplazar los IDs**

| Dónde | Qué reemplazar |
|---|---|
| Nodo *Crear evento en Calendar* | `REEMPLAZAR_POR_EMAIL_DEL_CALENDARIO@gmail.com` |
| Nodo *Leer agenda del día* | idem |
| Nodo *Registrar en planilla* | `REEMPLAZAR_POR_ID_DE_LA_PLANILLA` (está en la URL del Sheet) |

**4 — Activar y pegar las URLs en el sitio**
Activar el workflow, copiar las dos URLs de producción y pegarlas en `script.js`:

```js
webhookTurno:          'https://TU-N8N.app.n8n.cloud/webhook/club-zeta-turnos',
webhookDisponibilidad: 'https://TU-N8N.app.n8n.cloud/webhook/club-zeta-disponibilidad',
```

### La planilla de Google Sheets

Crear un Sheet con una hoja llamada **`Turnos`** y esta fila 1 exacta:

```
Creado | Fecha | Hora | Cliente | WhatsApp | Email | Servicio | Barbero | Duracion (min) | Precio | Notas | Estado | Evento Calendar
```

Se abre como Excel desde Archivo → Descargar → `.xlsx`, o se sincroniza con Excel Online.

### Comportamiento sin n8n conectado

El sitio **no se rompe** si los webhooks están vacíos:
- La disponibilidad muestra todos los horarios (el barbero confirma manualmente)
- Al confirmar, el turno se da por hecho y aparece un botón **"Avisar por WhatsApp"**
  con el mensaje ya armado (servicio, barbero, día, hora, nombre)

Esto permite publicar el sitio antes de tener n8n listo.

---

## WhatsApp

Todos los CTAs de contacto apuntan a `https://wa.me/5491125997840` con mensaje pre-cargado.
Botón flotante fijo abajo a la derecha.

---

## Próximos pasos posibles (no cotizados)

- **Recordatorio automático 24 hs antes** por WhatsApp o email → Schedule Trigger que lee el Calendar del día siguiente
- **Chatbot IA** entrenado con servicios, precios y horarios → Claude API en n8n
- **Reprogramar / cancelar** desde un link en el email de confirmación
