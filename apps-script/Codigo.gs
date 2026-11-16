/**
 * ═══════════════════════════════════════════════════════════
 *  Club Zeta Barbería — sistema de turnos (Google Apps Script)
 * ───────────────────────────────────────────────────────────
 *  Va pegado dentro de la planilla «Turnos Club Zeta»
 *  (Extensiones → Apps Script), en la cuenta de Google de Joaquín.
 *
 *  GET  ?accion=ocupados&fecha=AAAA-MM-DD  → horarios tomados del día
 *  POST {turno en JSON}                     → revisa, agenda en Calendar,
 *                                             anota en la planilla y
 *                                             manda mail al cliente
 *
 *  Guía paso a paso: apps-script/INSTALAR.md
 * ═══════════════════════════════════════════════════════════
 */

const AJUSTES = {
  zona: 'America/Argentina/Buenos_Aires',
  calendarId: 'primary',          // 'primary' = el calendario principal de la cuenta
  hoja: 'Turnos',
  avisarA: '',                    // mail extra que recibe cada turno nuevo (opcional)
  direccion: 'Freire 1015, Colegiales, CABA',
  whatsapp: '5491125997840',
  diasMaximos: 14,                // no se aceptan turnos más allá de esto
  margenHoras: 2,                 // ni con menos de esta anticipación

  // 0 = domingo … 6 = sábado. null = cerrado.
  atencion: {
    0: null,
    1: ['13:00', '20:00'], 2: ['13:00', '20:00'], 3: ['13:00', '20:00'],
    4: ['13:00', '20:00'], 5: ['13:00', '20:00'], 6: ['13:00', '20:00'],
  },

  // Tienen que coincidir con CONFIG.servicios de script.js (precio y duración mandan los de acá)
  servicios: {
    'corte':       { nombre: 'Corte',         precio: 17000, min: 45 },
    'corte-barba': { nombre: 'Corte + Barba', precio: 19000, min: 60 },
    'mechas':      { nombre: 'Mechas',        precio: 55000, min: 120 },
    'global':      { nombre: 'Global',        precio: 60000, min: 150 },
  },
};

const COLUMNAS = ['Creado', 'Fecha', 'Hora', 'Cliente', 'WhatsApp', 'Email', 'Servicio',
  'Barbero', 'Duración (min)', 'Precio', 'Notas', 'Estado', 'ID evento'];

/* ─────────────── Entradas web ─────────────── */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.accion === 'ocupados') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '')) return json_({ ok: false, error: 'fecha' });
    return json_({ ok: true, ocupados: ocupadosDelDia_(p.fecha) });
  }
  return json_({ ok: true, servicio: 'Turnos Club Zeta' });
}

function doPost(e) {
  let t;
  try { t = JSON.parse(e.postData.contents); }
  catch (err) { return json_({ ok: false, error: 'datos' }); }

  // Campo trampa: si un bot lo completa, fingimos éxito y no hacemos nada.
  if (t.web) return json_({ ok: true });

  const error = validar_(t);
  if (error) return json_({ ok: false, error: error });

  const srv = AJUSTES.servicios[t.servicioId];
  const inicio = new Date(t.fecha + 'T' + t.hora + ':00-03:00');
  const fin = new Date(inicio.getTime() + srv.min * 60000);

  // Un pedido por vez: evita que dos personas tomen el mismo horario.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return json_({ ok: false, error: 'ocupado-servidor' });

  try {
    const cal = CalendarApp.getCalendarById(AJUSTES.calendarId) || CalendarApp.getDefaultCalendar();
    // Cualquier evento que se superponga (turno, franco, evento de todo el día) bloquea el horario.
    if (cal.getEvents(inicio, fin).length) return json_({ ok: false, error: 'ocupado' });

    const telLimpio = String(t.telefono).replace(/\D/g, '');
    const ev = cal.createEvent(
      '✂ ' + srv.nombre + ' — ' + t.nombre,
      inicio, fin,
      {
        location: AJUSTES.direccion,
        description:
          'Cliente: ' + t.nombre + '\n' +
          'WhatsApp: https://wa.me/' + (telLimpio.startsWith('54') ? telLimpio : '549' + telLimpio) + '\n' +
          (t.email ? 'Email: ' + t.email + '\n' : '') +
          'Servicio: ' + srv.nombre + ' · $' + srv.precio.toLocaleString('es-AR') + '\n' +
          (t.notas ? 'Notas: ' + t.notas + '\n' : '') +
          '\nReservado desde la web.',
      }
    );
    ev.setColor(CalendarApp.EventColor.BLUE);

    hoja_().appendRow([
      new Date(), t.fecha, t.hora, t.nombre, t.telefono, t.email || '', srv.nombre,
      t.barbero || 'Joaco', srv.min, srv.precio, t.notas || '', 'Confirmado', ev.getId(),
    ]);

    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  avisos_(t, srv, inicio);
  return json_({ ok: true });
}

/* ─────────────── Lógica ─────────────── */

function ocupadosDelDia_(fecha) {
  const desde = new Date(fecha + 'T00:00:00-03:00');
  const hasta = new Date(desde.getTime() + 24 * 3600000);
  const cal = CalendarApp.getCalendarById(AJUSTES.calendarId) || CalendarApp.getDefaultCalendar();

  return cal.getEvents(desde, hasta).map(ev => {
    // Un evento de «todo el día» (vacaciones, franco) bloquea el día entero.
    if (ev.isAllDayEvent()) return { ini: '00:00', fin: '23:59' };
    return {
      ini: Utilities.formatDate(ev.getStartTime(), AJUSTES.zona, 'HH:mm'),
      fin: Utilities.formatDate(ev.getEndTime(), AJUSTES.zona, 'HH:mm'),
    };
  });
}

function validar_(t) {
  if (!t || typeof t !== 'object') return 'datos';
  if (!AJUSTES.servicios[t.servicioId]) return 'servicio';
  if (!t.nombre || String(t.nombre).trim().length < 3) return 'nombre';
  if (String(t.telefono || '').replace(/\D/g, '').length < 8) return 'telefono';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.fecha || '') || !/^\d{2}:\d{2}$/.test(t.hora || '')) return 'fecha';

  const inicio = new Date(t.fecha + 'T' + t.hora + ':00-03:00');
  const ahora = Date.now();
  if (inicio.getTime() < ahora + AJUSTES.margenHoras * 3600000) return 'fecha';
  if (inicio.getTime() > ahora + (AJUSTES.diasMaximos + 1) * 86400000) return 'fecha';

  const dia = new Date(t.fecha + 'T12:00:00-03:00').getUTCDay();
  const franja = AJUSTES.atencion[dia];
  if (!franja) return 'fecha';
  const aMin = h => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const ini = aMin(t.hora), fin = ini + AJUSTES.servicios[t.servicioId].min;
  if (ini < aMin(franja[0]) || fin > aMin(franja[1])) return 'fecha';
  return '';
}

function avisos_(t, srv, inicio) {
  const cuando = Utilities.formatDate(inicio, AJUSTES.zona, "EEEE d 'de' MMMM 'a las' HH:mm");
  try {
    if (t.email) {
      MailApp.sendEmail({
        to: t.email,
        name: 'Club Zeta Barbería',
        subject: 'Tu turno en Club Zeta está confirmado',
        body:
          'Hola ' + t.nombre + '!\n\n' +
          'Te esperamos el ' + cuando + ' hs para ' + srv.nombre.toLowerCase() + '.\n' +
          AJUSTES.direccion + '\n\n' +
          'Si no podés venir, avisanos con 2 horas de anticipación por WhatsApp: https://wa.me/' + AJUSTES.whatsapp + '\n\n' +
          'Club Zeta Barbería',
      });
    }
    if (AJUSTES.avisarA) {
      MailApp.sendEmail(AJUSTES.avisarA, 'Nuevo turno: ' + srv.nombre + ' — ' + t.nombre,
        cuando + ' hs\nWhatsApp: ' + t.telefono + (t.notas ? '\nNotas: ' + t.notas : ''));
    }
  } catch (err) {
    console.warn('No se pudo mandar el mail: ' + err);   // el turno ya quedó guardado igual
  }
}

function hoja_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName(AJUSTES.hoja);
  if (!h) h = ss.insertSheet(AJUSTES.hoja);
  if (h.getLastRow() === 0) {
    h.appendRow(COLUMNAS);
    h.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold').setBackground('#3D6EA5').setFontColor('#FDF6E8');
    h.setFrozenRows(1);
  }
  return h;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ─────────────── Para probar desde el editor ─────────────── */

// Ejecutar una vez a mano: pide los permisos y crea la hoja «Turnos».
function instalar() {
  hoja_();
  const hoy = Utilities.formatDate(new Date(), AJUSTES.zona, 'yyyy-MM-dd');
  console.log('Hoja lista. Ocupados de hoy: ' + JSON.stringify(ocupadosDelDia_(hoy)));
}
