# Instalar el sistema de turnos (Google Apps Script)

Todo se hace **en la cuenta de Google de Joaquín**, la del Calendar donde quiere ver los turnos. Lleva unos 10 minutos y no tiene costo.

## Qué hace

- Cuando alguien elige un día en la web, el script lee el **Google Calendar de Joaquín** y la web tacha los horarios ocupados.
- Cuando alguien confirma, el script **revisa de nuevo** que el horario siga libre, **crea el evento** en el Calendar, **anota el turno en la planilla** y le **manda un mail** al cliente (si dejó email).
- Si Joaquín carga algo a mano en su Calendar (un turno de WhatsApp, un trámite, un día libre de «todo el día»), la web lo toma como ocupado.

## Pasos

**1. Crear la planilla**
Con la cuenta de Joaquín, entrar a [sheets.new](https://sheets.new) y ponerle de nombre **Turnos Club Zeta**.

**2. Abrir el editor de scripts**
En la planilla: **Extensiones → Apps Script**. Se abre un editor con un archivo `Código.gs`.

**3. Pegar el código**
Borrar lo que haya y pegar todo el contenido de [`Codigo.gs`](Codigo.gs). Guardar (ícono del disquete).

**4. Zona horaria**
Engranaje ⚙️ **Configuración del proyecto** → **Zona horaria**: `(GMT-03:00) Buenos Aires`.

**5. Dar permisos**
Arriba, en el selector de funciones, elegir **`instalar`** y tocar **Ejecutar**.
Google pide permisos (Calendar, planillas y mail): **Revisar permisos → elegir la cuenta → Configuración avanzada → Ir a «Turnos Club Zeta» (no seguro) → Permitir**.
Es normal que diga «no seguro»: es un script propio que no pasó por la verificación de Google.
Al terminar aparece una hoja **Turnos** con los encabezados en azul.

**6. Publicarlo como app web**
**Implementar → Nueva implementación** → tipo **Aplicación web**:
- Descripción: `Turnos web`
- Ejecutar como: **Yo** (la cuenta de Joaquín)
- Quién tiene acceso: **Cualquier usuario**

**Implementar** y copiar la **URL de la aplicación web** (termina en `/exec`).

**7. Pegar la URL en la web**
En `script.js`, al principio:

```js
turnosUrl: 'https://script.google.com/macros/s/XXXXXXXX/exec',
```

Commit + push y listo.

**8. Probar**
Abrir la URL `/exec` agregando `?accion=ocupados&fecha=AAAA-MM-DD` (una fecha con algo en el Calendar): tiene que devolver los horarios ocupados. Después sacar un turno de prueba desde la web y verificar que aparezca en el Calendar y en la planilla.

## Ajustes

Todo está arriba de `Codigo.gs`, en `AJUSTES`:

| Qué | Dónde |
|---|---|
| Horarios de atención | `atencion` (también en `CONFIG.atencion` de `script.js`) |
| Precios y duraciones | `servicios` (también en `CONFIG.servicios` de `script.js`) |
| Recibir un mail por cada turno nuevo | `avisarA: 'mail@gmail.com'` |
| Usar otro calendario que no sea el principal | `calendarId` (ID en la configuración del calendario) |

**Importante:** después de cambiar el código hay que ir a **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. Así la URL sigue siendo la misma; si se hace una implementación nueva, cambia la URL y hay que actualizarla en `script.js`.

## Día a día

- **Cancelar un turno:** borrar el evento del Calendar → el horario se libera solo en la web. En la planilla se puede cambiar el «Estado» a Cancelado.
- **Bloquear un horario o un día:** crear un evento en el Calendar en ese horario (o de todo el día).
- **Límites gratis de Google:** 100 mails por día y miles de eventos; para una barbería no se llega nunca.
