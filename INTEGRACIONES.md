# Integraciones — Club Zeta

## Sistema de turnos → Google Apps Script (Calendar + Sheets + mail)

Reemplaza el workflow de n8n: hace lo mismo y es gratis.

- Código: [`apps-script/Codigo.gs`](apps-script/Codigo.gs)
- Instalación paso a paso (en la cuenta de Joaquín): [`apps-script/INSTALAR.md`](apps-script/INSTALAR.md)
- En la web: `CONFIG.turnosUrl` en `script.js`

```
Web ── GET  ?accion=ocupados&fecha=…  → lee el Calendar → tramos ocupados (la web tacha horarios)
    └─ POST {turno}                    → revisa choque (con lock) → evento en Calendar
                                          → fila en la hoja «Turnos» → mail al cliente
```

**Sin `turnosUrl` configurada**, la web no da el turno por hecho: muestra «Último paso: confirmalo por WhatsApp» con el mensaje armado.

---

## WhatsApp

Todos los CTAs de contacto apuntan a `https://wa.me/5491125997840` con mensaje pre-cargado.
Botón flotante fijo abajo a la derecha.

---

## Próximos pasos posibles (no cotizados)

- **Recordatorio automático 24 hs antes** por WhatsApp o email → Schedule Trigger que lee el Calendar del día siguiente
- **Chatbot IA** entrenado con servicios, precios y horarios → Claude API en n8n
- **Reprogramar / cancelar** desde un link en el email de confirmación
