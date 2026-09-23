# Club Zeta Barbería — Sitio web

Web completa con sistema de turnos online que impacta en Google Calendar + Google Sheets.

## Stack
- HTML + CSS + JS puro. Cero frameworks, cero build step.
- Tipografías: **Baloo 2** + **Barlow** (Google Fonts)
- Paleta: azul `#3D6EA5` · crema `#F7E8CC` · azul noche `#13293F`
- Datos estructurados `HairSalon` (schema.org) para Google Maps y búsquedas locales

## Estructura
```
web/
├── index.html        ← todo el contenido
├── styles.css        ← paleta, layout, responsive
├── script.js         ← nav, animaciones y motor de turnos (CONFIG arriba de todo)
├── INTEGRACIONES.md  ← cómo conectar n8n
└── assets/           ← logo, favicon, fotos reales
```

## Correr en local
```bash
python3 -m http.server 8080
```
Abrir http://localhost:8080

## Deploy
**Vercel (recomendado):**
```bash
npx vercel --prod
```
O conectar el repo desde vercel.com → deploy automático en cada push.

**GitHub Pages:**
```bash
gh repo create club-zeta-web --public --source=. --push
```
Settings → Pages → Source: `main` / root

## Qué editar

### Precios, servicios, barberos y horarios
Todo está en el objeto `CONFIG` al principio de `script.js`.
Cambiando ahí, se actualizan los botones del formulario de turnos automáticamente.

> Ojo: las cards de la sección **Servicios** en `index.html` son visuales y se editan aparte.
> Si cambiás un precio, cambialo en los dos lugares.

### Horario de atención
```js
atencion: {
  0: null,                                  // domingo cerrado
  1: { abre: '13:00', cierra: '20:00' },    // lunes
  ...
}
```

### Días cerrados puntuales (feriados, vacaciones)
```js
cerrado: ['2026-12-25', '2027-01-01'],
```

### Textos e imágenes
Buscá los comentarios `<!-- EDITAR: ... -->` en `index.html`.
Las fotos son placeholders de `picsum.photos` — reemplazar por fotos reales en `assets/`.

### Archivos que faltan en `assets/`
| Archivo | Qué es |
|---|---|
| `mascota.png` | **Provisorio.** Hoy es un recorte de la lámina de marca y arrastra restos de las letras. Reemplazar por el PNG original con fondo transparente. |
| `favicon.png` | Ícono de la pestaña, 64×64 |
| `og.jpg` | Imagen para compartir en WhatsApp/redes, 1200×630 |

## Datos del cliente
- **WhatsApp:** +54 9 11 2599 7840 → `5491125997840`
- **Instagram:** [@clubzeta_](https://www.instagram.com/clubzeta_)
- **Dirección:** Freire 1015, Colegiales, CABA
- **Horarios:** lunes a sábados, 13 a 20 hs
