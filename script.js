/* ════════════════════════════════════════════════
   Club Zeta Barbería — lógica del sitio
   ──────────────────────────────────────────────
   TODO lo configurable vive en CONFIG. No hace falta
   tocar nada más abajo para cambiar precios, horarios,
   servicios, barberos o webhooks.
   ════════════════════════════════════════════════ */

const CONFIG = {

  /* ── Webhooks de n8n ───────────────────────────
     EDITAR: reemplazar por las URLs reales cuando el
     workflow esté activo en n8n (ver INTEGRACIONES.md).
     Si se dejan vacías, el sitio funciona igual y cae
     al fallback de WhatsApp.                         */
  webhookTurno: '',          // POST — crea el turno (Calendar + Sheets)
  webhookDisponibilidad: '', // GET  — devuelve horarios ya ocupados

  whatsapp: '5491125997840',
  zonaHoraria: '-03:00',     // Argentina

  /* ── Horario de atención ──────────────────────
     0 = domingo … 6 = sábado. null = cerrado.      */
  atencion: {
    0: null,
    1: { abre: '13:00', cierra: '20:00' },
    2: { abre: '13:00', cierra: '20:00' },
    3: { abre: '13:00', cierra: '20:00' },
    4: { abre: '13:00', cierra: '20:00' },
    5: { abre: '13:00', cierra: '20:00' },
    6: { abre: '13:00', cierra: '20:00' },
  },

  paso: 30,            // grilla de horarios, en minutos
  diasVisibles: 21,    // cuántos días hacia adelante se pueden reservar
  margenHoras: 2,      // no se puede reservar con menos de X horas de anticipación

  /* ── Feriados / días cerrados (YYYY-MM-DD) ──── */
  cerrado: [],

  /* ── Servicios ── EDITAR duraciones ── */
  servicios: [
    { id:'corte',      nombre:'Corte',         precio:17000, min:45,  desc:'Tijera o máquina + lavado' },
    { id:'corte-barba',nombre:'Corte + Barba', precio:19000, min:60,  desc:'El combo completo', destacado:true },
    { id:'mechas',     nombre:'Mechas',        precio:55000, min:120, desc:'Incluye corte' },
    { id:'global',     nombre:'Global',        precio:60000, min:150, desc:'Decoloración completa' },
  ],

  /* ── Barberos ──────────────────────────────────
     Con un solo barbero, el paso "¿Con quién?" se
     oculta solo y queda preseleccionado.           */
  barberos: [
    { id:'joaco', nombre:'Joaco Zeta', desc:'Fade, barba y color' },
  ],
};

/* ════════════════════════════════════════════════
   Utilidades
   ════════════════════════════════════════════════ */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const aMin   = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const aHora  = min  => `${String(Math.floor(min / 60)).padStart(2,'0')}:${String(min % 60).padStart(2,'0')}`;
const aISO   = d    => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const aPesos = n    => '$' + n.toLocaleString('es-AR');

/* ════════════════════════════════════════════════
   Nav
   ════════════════════════════════════════════════ */
const nav = $('#nav'), burger = $('#burger'), navLinks = $('#navLinks');

addEventListener('scroll', () => nav.classList.toggle('is-stuck', scrollY > 20), { passive:true });

burger.addEventListener('click', () => {
  const abierto = navLinks.classList.toggle('is-open');
  burger.classList.toggle('is-on', abierto);
  burger.setAttribute('aria-expanded', abierto);
  burger.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
});

$$('#navLinks a').forEach(a => a.addEventListener('click', () => {
  navLinks.classList.remove('is-open');
  burger.classList.remove('is-on');
  burger.setAttribute('aria-expanded', 'false');
}));

/* ════════════════════════════════════════════════
   Reveal on scroll
   ════════════════════════════════════════════════ */
const obs = new IntersectionObserver((entradas) => {
  entradas.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    obs.unobserve(e.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

$$('.reveal').forEach((el, i) => {
  el.style.transitionDelay = `${Math.min(i % 6, 5) * 70}ms`;
  obs.observe(el);
});

$('#year').textContent = new Date().getFullYear();

/* ════════════════════════════════════════════════
   Motor de turnos
   ════════════════════════════════════════════════ */
const estado = { servicio:null, barbero:null, fecha:null, hora:null, paso:1 };

const form = $('#bookForm');
const elErr = $('#formErr');

/* ── Paso 1: servicios y barberos ── */
function pintarOpciones() {
  $('#optServicios').innerHTML = CONFIG.servicios.map(s => `
    <button type="button" class="opt" role="radio" aria-checked="false" data-tipo="servicio" data-id="${s.id}">
      <span><b>${s.nombre}</b><small>${s.desc} · ${s.min} min</small></span>
      <i>${aPesos(s.precio)}</i>
    </button>`).join('');

  // Un solo barbero → no tiene sentido preguntar; lo damos por elegido.
  if (CONFIG.barberos.length < 2) {
    estado.barbero = CONFIG.barberos[0];
    $('#optBarberos').hidden = true;
    $('#optBarberos').previousElementSibling.hidden = true;
    return;
  }

  $('#optBarberos').innerHTML = CONFIG.barberos.map(b => `
    <button type="button" class="opt" role="radio" aria-checked="false" data-tipo="barbero" data-id="${b.id}">
      <span><b>${b.nombre}</b><small>${b.desc}</small></span>
    </button>`).join('');
}

document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.opt');
  if (!btn) return;
  const grupo = btn.parentElement;
  $$('.opt', grupo).forEach(o => { o.classList.remove('is-sel'); o.setAttribute('aria-checked','false'); });
  btn.classList.add('is-sel');
  btn.setAttribute('aria-checked','true');

  if (btn.dataset.tipo === 'servicio') {
    estado.servicio = CONFIG.servicios.find(s => s.id === btn.dataset.id);
    if (estado.fecha) pintarSlots();      // cambió la duración → recalcular
  } else {
    estado.barbero = CONFIG.barberos.find(b => b.id === btn.dataset.id);
    if (estado.fecha) pintarSlots();      // otro barbero → otra disponibilidad
  }
  ocultarError();
});

/* ── Paso 2: días ── */
function pintarDias() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  let html = '';

  for (let i = 0; i < CONFIG.diasVisibles; i++) {
    const d = new Date(hoy); d.setDate(hoy.getDate() + i);
    const iso = aISO(d);
    const cerrado = !CONFIG.atencion[d.getDay()] || CONFIG.cerrado.includes(iso);
    html += `
      <button type="button" class="day" role="radio" aria-checked="false" data-fecha="${iso}" ${cerrado ? 'disabled' : ''}
              aria-label="${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}${cerrado ? ', cerrado' : ''}">
        <u>${i === 0 ? 'Hoy' : DIAS[d.getDay()]}</u>
        <b>${d.getDate()}</b>
        <s>${MESES[d.getMonth()]}</s>
      </button>`;
  }
  $('#days').innerHTML = html;
}

$('#days').addEventListener('click', (ev) => {
  const btn = ev.target.closest('.day');
  if (!btn || btn.disabled) return;
  $$('.day').forEach(d => { d.classList.remove('is-sel'); d.setAttribute('aria-checked','false'); });
  btn.classList.add('is-sel');
  btn.setAttribute('aria-checked','true');
  estado.fecha = btn.dataset.fecha;
  estado.hora = null;
  ocultarError();
  pintarSlots();
});

/* ── Paso 2: horarios ── */
function generarSlots(iso, duracion) {
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(a, m - 1, d);
  const franja = CONFIG.atencion[fecha.getDay()];
  if (!franja || CONFIG.cerrado.includes(iso)) return [];

  const abre = aMin(franja.abre);
  const cierra = aMin(franja.cierra);
  const ultimo = cierra - duracion;      // el turno tiene que terminar antes de cerrar

  // margen mínimo de anticipación
  const ahora = new Date();
  const esHoy = aISO(ahora) === iso;
  const minimoHoy = ahora.getHours() * 60 + ahora.getMinutes() + CONFIG.margenHoras * 60;

  const slots = [];
  for (let t = abre; t <= ultimo; t += CONFIG.paso) {
    if (esHoy && t < minimoHoy) continue;
    slots.push(aHora(t));
  }
  return slots;
}

async function traerOcupados(iso) {
  if (!CONFIG.webhookDisponibilidad) return [];
  try {
    const params = new URLSearchParams({ fecha: iso, barbero: estado.barbero?.id || '' });
    const r = await fetch(`${CONFIG.webhookDisponibilidad}?${params}`, { headers:{ 'Accept':'application/json' } });
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    return Array.isArray(data) ? data : (data.ocupados || []);
  } catch (e) {
    console.warn('[Club Zeta] No se pudo leer la disponibilidad:', e);
    return [];   // ante la duda, mostramos todo y el barbero confirma
  }
}

async function pintarSlots() {
  const cont = $('#slots');
  if (!estado.fecha) { cont.innerHTML = '<p class="slots__msg">Elegí un día para ver los horarios.</p>'; return; }
  if (!estado.servicio) { cont.innerHTML = '<p class="slots__msg">Elegí primero el servicio.</p>'; return; }

  cont.innerHTML = '<p class="slots__msg">Buscando horarios…</p>';

  const libres = generarSlots(estado.fecha, estado.servicio.min);
  const ocupados = await traerOcupados(estado.fecha);

  if (!libres.length) {
    cont.innerHTML = '<p class="slots__msg">No quedan horarios para ese día. Probá con otro.</p>';
    return;
  }

  cont.innerHTML = libres.map(h => {
    const tomado = ocupados.includes(h);
    return `<button type="button" class="slot" role="radio" aria-checked="false" data-hora="${h}"
             ${tomado ? 'disabled aria-label="' + h + ', ocupado"' : ''}>${h}</button>`;
  }).join('');
}

$('#slots').addEventListener('click', (ev) => {
  const btn = ev.target.closest('.slot');
  if (!btn || btn.disabled) return;
  $$('.slot').forEach(s => { s.classList.remove('is-sel'); s.setAttribute('aria-checked','false'); });
  btn.classList.add('is-sel');
  btn.setAttribute('aria-checked','true');
  estado.hora = btn.dataset.hora;
  ocultarError();
});

/* ── Navegación entre pasos ── */
function irA(paso) {
  estado.paso = paso;
  $$('.pane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === String(paso)));
  $$('.steps__i').forEach(s => {
    const n = Number(s.dataset.step);
    s.classList.toggle('is-on', n === paso);
    s.classList.toggle('is-done', n < paso);
  });
  if (paso === 3) pintarResumen();
  $('#book').scrollIntoView({ behavior:'smooth', block:'start' });
}

function fechaLinda(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  return `${DIAS[f.getDay()]} ${d} de ${MESES[m - 1]}`;
}

function pintarResumen() {
  $('#resumen').innerHTML = `
    <div><span>Servicio</span><span>${estado.servicio.nombre}</span></div>
    <div><span>Barbero</span><span>${estado.barbero.nombre}</span></div>
    <div><span>Día</span><span>${fechaLinda(estado.fecha)}</span></div>
    <div><span>Hora</span><span>${estado.hora} hs</span></div>
    <div><span>Duración</span><span>${estado.servicio.min} min</span></div>
    <div><span>Precio</span><span>${aPesos(estado.servicio.precio)}</span></div>`;
}

function mostrarError(msg) { elErr.textContent = msg; elErr.hidden = false; }
function ocultarError() { elErr.hidden = true; }

$$('[data-next]').forEach(b => b.addEventListener('click', () => {
  const destino = Number(b.dataset.next);

  if (destino === 2) {
    if (!estado.servicio) return mostrarError('Elegí qué servicio querés.');
    if (!estado.barbero)  return mostrarError('Elegí con qué barbero te querés atender.');
    ocultarError();
    pintarSlots();
  }

  if (destino === 3) {
    if (!estado.fecha) return mostrarError('Elegí el día del turno.');
    if (!estado.hora)  return mostrarError('Elegí un horario disponible.');
    ocultarError();
  }

  irA(destino);
}));

$$('[data-back]').forEach(b => b.addEventListener('click', () => { ocultarError(); irA(Number(b.dataset.back)); }));

/* ── Envío ── */
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  ocultarError();

  const nombre = $('#f_nombre').value.trim();
  const tel    = $('#f_tel').value.trim();
  const email  = $('#f_email').value.trim();
  const notas  = $('#f_notas').value.trim();

  if (nombre.length < 3) return mostrarError('Escribí tu nombre y apellido.');
  if (tel.replace(/\D/g, '').length < 8) return mostrarError('Dejanos un WhatsApp válido para confirmarte el turno.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mostrarError('Revisá el email, parece que tiene un error.');

  const inicio = `${estado.fecha}T${estado.hora}:00${CONFIG.zonaHoraria}`;
  const fin    = `${estado.fecha}T${aHora(aMin(estado.hora) + estado.servicio.min)}:00${CONFIG.zonaHoraria}`;

  const turno = {
    nombre, telefono: tel, email, notas,
    servicio: estado.servicio.nombre,
    servicioId: estado.servicio.id,
    precio: estado.servicio.precio,
    duracionMin: estado.servicio.min,
    barbero: estado.barbero.nombre,
    barberoId: estado.barbero.id,
    fecha: estado.fecha,
    hora: estado.hora,
    inicioISO: inicio,
    finISO: fin,
    origen: 'web',
    creadoEn: new Date().toISOString(),
  };

  const btn = $('#btnSubmit');
  btn.disabled = true;
  btn.textContent = 'Reservando…';

  try {
    if (CONFIG.webhookTurno) {
      const r = await fetch(CONFIG.webhookTurno, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(turno),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
    } else {
      // Sin webhook configurado todavía: no perdemos el turno, lo mandamos por WhatsApp.
      console.warn('[Club Zeta] webhookTurno sin configurar — fallback a WhatsApp.');
      await new Promise(res => setTimeout(res, 600));
    }
    exito(turno);
  } catch (e) {
    console.error('[Club Zeta] Error al reservar:', e);
    mostrarError('No pudimos guardar el turno. Mandanos un WhatsApp al 11 2599 7840 y lo arreglamos en el momento.');
    btn.disabled = false;
    btn.textContent = 'Confirmar turno';
  }
});

function exito(t) {
  $('#okTxt').textContent =
    `${t.nombre}, te esperamos el ${fechaLinda(t.fecha)} a las ${t.hora} hs para ${t.servicio.toLowerCase()} con ${t.barbero}. Freire 1015, Colegiales.`;

  const msg = `Hola Club Zeta! Reservé un turno por la web:%0A%0A` +
    `*${t.servicio}* con ${t.barbero}%0A` +
    `${fechaLinda(t.fecha)} a las ${t.hora} hs%0A` +
    `A nombre de ${t.nombre}` +
    (t.notas ? `%0A%0ANota: ${encodeURIComponent(t.notas)}` : '');
  $('#okWa').href = `https://wa.me/${CONFIG.whatsapp}?text=${msg}`;

  $$('.pane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === 'ok'));
  $$('.steps__i').forEach(s => { s.classList.remove('is-on'); s.classList.add('is-done'); });
  $('#book').scrollIntoView({ behavior:'smooth', block:'start' });
}

$('#okReset').addEventListener('click', () => {
  form.reset();
  Object.assign(estado, { servicio:null, fecha:null, hora:null, paso:1 });
  if (CONFIG.barberos.length >= 2) estado.barbero = null;
  $$('.opt,.day,.slot').forEach(e => { e.classList.remove('is-sel'); e.setAttribute('aria-checked','false'); });
  $('#slots').innerHTML = '<p class="slots__msg">Elegí un día para ver los horarios.</p>';
  const btn = $('#btnSubmit');
  btn.disabled = false;
  btn.textContent = 'Confirmar turno';
  irA(1);
});

/* ── Arranque ── */
pintarOpciones();
pintarDias();
$('#slots').innerHTML = '<p class="slots__msg">Elegí un día para ver los horarios.</p>';
