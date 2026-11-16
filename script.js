/* ════════════════════════════════════════════════
   Club Zeta Barbería — lógica del sitio
   ──────────────────────────────────────────────
   TODO lo configurable vive en CONFIG. No hace falta
   tocar nada más abajo para cambiar precios, horarios,
   servicios, barberos o la URL de turnos.
   ════════════════════════════════════════════════ */

const CONFIG = {

  /* ── Sistema de turnos (Google Apps Script) ─────
     EDITAR: pegar acá la URL de la app web que termina en /exec
     (ver apps-script/INSTALAR.md). Si queda vacía, la web pide
     confirmar cada turno por WhatsApp.                    */
  turnosUrl: '',

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
  diasVisibles: 14,    // cuántos días hacia adelante se pueden reservar
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
      <span><b>${s.nombre}</b><small>${s.desc}</small></span>
      <i>${aPesos(s.precio)}</i>
    </button>`).join('');

  // Un solo barbero → no tiene sentido preguntar; lo damos por elegido.
  if (CONFIG.barberos.length < 2) {
    estado.barbero = CONFIG.barberos[0];
    $('#optBarberos').hidden = true;
    $('#optBarberos').previousElementSibling.hidden = true;
    $('#nav1').hidden = true;   // elegir el servicio ya avanza solo
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
    if (estado.fecha) { estado.hora = null; pintarSlots(); }   // cambió la duración → recalcular
    // Con un solo barbero no hay nada más que elegir: pasamos solos al paso 2
    // (pequeña pausa para que se vea la selección).
    if (estado.barbero && estado.paso === 1) setTimeout(() => estado.paso === 1 && avanzar(2), 240);
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
  actualizarCTA();
  centrarDia();
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

/* Devuelve los tramos ocupados del día: [{ ini:'15:00', fin:'15:45' }, …] */
async function traerOcupados(iso) {
  if (!CONFIG.turnosUrl) return [];
  try {
    const params = new URLSearchParams({ accion: 'ocupados', fecha: iso });
    const r = await fetch(`${CONFIG.turnosUrl}?${params}`);
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    return data.ocupados || [];
  } catch (e) {
    console.warn('[Club Zeta] No se pudo leer la disponibilidad:', e);
    return [];   // ante la duda, mostramos todo: el servidor igual revisa al confirmar
  }
}

/* Un horario está tomado si el turno (de la duración del servicio) pisa algún tramo ocupado */
function chocan(hora, duracion, ocupados) {
  const ini = aMin(hora), fin = ini + duracion;
  return ocupados.some(o => ini < aMin(o.fin) && fin > aMin(o.ini));
}

async function pintarSlots() {
  const cont = $('#slots');
  if (!estado.fecha) { cont.innerHTML = '<p class="slots__msg">Elegí un día para ver los horarios.</p>'; return; }
  if (!estado.servicio) { cont.innerHTML = '<p class="slots__msg">Elegí primero el servicio.</p>'; return; }

  cont.innerHTML = '<p class="slots__msg">Buscando horarios…</p>';

  const pedido = estado.fecha + estado.servicio.id;   // por si cambian de día mientras carga
  const libres = generarSlots(estado.fecha, estado.servicio.min);
  const ocupados = await traerOcupados(estado.fecha);
  if (pedido !== estado.fecha + estado.servicio.id) return;

  if (!libres.length || libres.every(h => chocan(h, estado.servicio.min, ocupados))) {
    cont.innerHTML = '<p class="slots__msg">No quedan horarios para ese día. Probá con otro.</p>';
    return;
  }

  cont.innerHTML = libres.map(h => {
    const tomado = chocan(h, estado.servicio.min, ocupados);
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
  actualizarCTA();   // el botón (fijo abajo en mobile) pasa a "Continuar · día y hora"
});

/* El botón del paso 2 dice qué falta o qué elegiste */
function actualizarCTA() {
  const b = $('#btnPaso2');
  if (!b) return;
  const listo = estado.fecha && estado.hora;
  b.classList.toggle('is-dim', !listo);
  b.textContent = listo
    ? `Continuar · ${fechaCorta(estado.fecha)} ${estado.hora} hs`
    : 'Elegí un horario';
}

function fechaCorta(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS[new Date(a, m - 1, d).getDay()]} ${d}`;
}

/* Resumen de lo elegido arriba del paso 2, con atajo para cambiarlo */
function pintarElegido() {
  const s = estado.servicio;
  if (!s) return;
  $('#elegido').innerHTML = `
    <span><b>${s.nombre}</b> · ${aPesos(s.precio)}</span>
    <button type="button" class="elegido__cambiar" data-ir="1">Cambiar</button>`;
}

/* ── Navegación entre pasos ── */
function irA(paso) {
  estado.paso = paso;
  $$('.pane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === String(paso)));
  $$('.steps__i').forEach(s => {
    const n = Number(s.dataset.step);
    s.classList.toggle('is-on', n === paso);
    s.classList.toggle('is-done', n < paso);
  });
  if (paso === 2) { pintarElegido(); actualizarCTA(); centrarDia(); }
  if (paso === 3) pintarResumen();

  // Solo movemos la pantalla si el inicio del formulario quedó fuera de vista
  // (evita los saltos de página en cada paso).
  const top = $('#book').getBoundingClientRect().top;
  if (top < 0 || top > innerHeight * 0.35) {
    $('#book').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start' });
  }
}

/* En mobile los días son una tira horizontal: dejamos visible el elegido */
function centrarDia() {
  const sel = $('.day.is-sel');
  const tira = $('#days');
  if (sel && tira.scrollWidth > tira.clientWidth) {
    tira.scrollTo({ left: sel.offsetLeft - tira.clientWidth / 2 + sel.clientWidth / 2, behavior:'smooth' });
  }
}

/* Atajos: "Cambiar" del resumen y los pasos ya hechos del encabezado */
document.addEventListener('click', (ev) => {
  const ir = ev.target.closest('[data-ir]');
  if (ir) { ocultarError(); irA(Number(ir.dataset.ir)); return; }
  const paso = ev.target.closest('.steps__i.is-done');
  if (paso && !$('.pane--ok.is-on')) { ocultarError(); irA(Number(paso.dataset.step)); }
});

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
    <div><span>Precio</span><span>${aPesos(estado.servicio.precio)}</span></div>`;
}

function mostrarError(msg, campo) {
  elErr.textContent = msg; elErr.hidden = false;
  if (campo) $(campo).focus({ preventScroll:false });   // lleva el cursor (y el teclado) al campo que falta
}
function ocultarError() { elErr.hidden = true; }

$$('[data-next]').forEach(b => b.addEventListener('click', () => avanzar(Number(b.dataset.next))));

function avanzar(destino) {
  if (destino === 2) {
    if (!estado.servicio) return mostrarError('Elegí qué servicio querés.');
    if (!estado.barbero)  return mostrarError('Elegí con qué barbero te querés atender.');
    ocultarError();
    // Sin día elegido el bloque de horarios queda vacío: arrancamos en el primero abierto.
    if (!estado.fecha) {
      const primero = $$('.day').find(d => !d.disabled);
      if (primero) primero.click();
    } else {
      pintarSlots();
    }
  }

  if (destino === 3) {
    if (!estado.fecha) return mostrarError('Elegí el día del turno.');
    if (!estado.hora)  return mostrarError('Elegí un horario disponible.');
    ocultarError();
  }

  irA(destino);
}

$$('[data-back]').forEach(b => b.addEventListener('click', () => { ocultarError(); irA(Number(b.dataset.back)); }));

/* ── Envío ── */
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  ocultarError();

  const nombre = $('#f_nombre').value.trim();
  const tel    = $('#f_tel').value.trim();
  const email  = $('#f_email').value.trim();
  const notas  = $('#f_notas').value.trim();

  if (nombre.length < 3) return mostrarError('Escribí tu nombre y apellido.', '#f_nombre');
  if (tel.replace(/\D/g, '').length < 8) return mostrarError('Dejanos un WhatsApp válido para confirmarte el turno.', '#f_tel');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mostrarError('Revisá el email, parece que tiene un error.', '#f_email');

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

  turno.web = $('#f_web')?.value || '';   // campo trampa anti-bots

  try {
    if (CONFIG.turnosUrl) {
      // text/plain evita el "preflight" CORS, que Apps Script no responde
      const r = await fetch(CONFIG.turnosUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(turno),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const res = await r.json();
      if (!res.ok) {
        if (res.error === 'ocupado' || res.error === 'ocupado-servidor') {
          mostrarError('Uy, ese horario se acaba de ocupar. Elegí otro y listo.');
          btn.disabled = false;
          btn.textContent = 'Confirmar turno';
          estado.hora = null;
          irA(2);
          pintarSlots();
          return;
        }
        throw new Error('Servidor: ' + res.error);
      }
      exito(turno, true);
    } else {
      // Sin sistema conectado: el turno se confirma por WhatsApp (si no, Joaco no se entera).
      exito(turno, false);
    }
  } catch (e) {
    console.error('[Club Zeta] Error al reservar:', e);
    mostrarError('No pudimos guardar el turno. Mandanos un WhatsApp al 11 2599 7840 y lo arreglamos en el momento.');
    btn.disabled = false;
    btn.textContent = 'Confirmar turno';
  }
});

function exito(t, guardado) {
  const cuando = `${fechaLinda(t.fecha)} a las ${t.hora} hs`;
  if (guardado) {
    $('#okTit').textContent = '¡Turno confirmado!';
    $('#okTxt').textContent =
      `${t.nombre}, te esperamos el ${cuando} para ${t.servicio.toLowerCase()} con ${t.barbero}. Freire 1015, Colegiales.` +
      (t.email ? ' Te mandamos la confirmación por mail.' : '');
    $('#okWa').textContent = 'Escribinos por WhatsApp';
  } else {
    $('#okTit').textContent = 'Último paso: confirmalo por WhatsApp';
    $('#okTxt').textContent =
      `${t.nombre}, mandanos el mensaje ya armado para reservar el ${cuando} (${t.servicio.toLowerCase()}). El turno queda tomado cuando te respondemos.`;
    $('#okWa').textContent = 'Confirmar por WhatsApp';
  }

  const msg = encodeURIComponent(
    `Hola Club Zeta! ${guardado ? 'Reservé' : 'Quiero confirmar'} un turno por la web:\n\n` +
    `*${t.servicio}* con ${t.barbero}\n${cuando}\nA nombre de ${t.nombre}` +
    (t.notas ? `\n\nNota: ${t.notas}` : ''));
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

/* Apenas empieza a corregir, el aviso de error se va */
$$('#f_nombre,#f_tel,#f_email').forEach(i => i.addEventListener('input', ocultarError));

/* ── Arranque ── */
pintarOpciones();
pintarDias();
$('#slots').innerHTML = '<p class="slots__msg">Elegí un día para ver los horarios.</p>';

/* ── Barra de reserva mobile: se esconde cuando ya estás reservando ── */
const mbar = $('#mbar');
if (mbar) {
  new IntersectionObserver(([e]) => mbar.classList.toggle('is-off', e.isIntersecting), { threshold: 0.05 })
    .observe($('#turnos'));
}

/* ── Videos de cortes: se reproducen (en cámara lenta) solo cuando están en pantalla ── */
const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
const obsVid = new IntersectionObserver((entradas) => {
  entradas.forEach(({ target: v, isIntersecting }) => {
    if (isIntersecting && !reducir) { v.preload = 'auto'; v.play().catch(() => {}); }
    else v.pause();
  });
}, { threshold: 0.5 });
$$('.reel video').forEach(v => obsVid.observe(v));
