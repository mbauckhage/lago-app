const concepts = [
  ['Shoreline', 'A full-bleed lake photo bends through the featured invitation. The next two plans stay in view.'],
  ['Fluted', 'Vertical ribs in the navigation rail catch the light alongside a clean, date-led agenda.'],
  ['Afterglow', 'A dark glass RSVP tray refracts the edge of the photo. Browse invitations one at a time.'],
  ['Prism', 'Three invitations sit side by side in a gallery. Angled glass corners split the light over each date.'],
  ['Stillwater', 'A quiet feed puts upcoming dates within reach. Glass is reserved for the header and small photo edges.']
];
const events = [
  { title: 'Lakeside walk', host: 'Mia Keller', date: 'Sat, 28 Nov', day: '28', month: 'NOV', time: '14:00', place: 'Lake Brienz', photo: 'lake', alt: 'Pier on a turquoise Alpine lake', going: 2 },
  { title: 'Pasta at Jonas’', host: 'Jonas Frei', date: 'Sun, 29 Nov', day: '29', month: 'NOV', time: '19:00', place: 'Jonas’ place', photo: 'dinner', alt: 'Friends sharing dinner by candlelight', going: 3 },
  { title: 'Coffee & a catch-up', host: 'Lea Rossi', date: 'Sat, 5 Dec', day: '5', month: 'DEC', time: '10:30', place: 'Kreis 4, Zürich', photo: 'coffee', alt: 'A warm neighborhood café', going: 2 }
];
const paths = {
  waves: 'M2 9c3 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2M2 15c3 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2',
  calendar: 'M4 6h16v14H4zM8 4v4m8-4v4M4 10h16',
  pin: 'M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Z M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  check: 'm5 12 4 4L19 6', next: 'm9 5 7 7-7 7', back: 'm15 5-7 7 7 7'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const options = document.querySelector('.options');
const stage = document.querySelector('.lago');
stage.style.setProperty('--lake', `url(${photos.lake})`);
const caption = document.querySelector('.caption');
const sizes = document.querySelector('.sizes');
const replies = ['', '', 'Maybe'];
let mode = 0;
let active = 0;
let size = 'desktop';

const cover = (event, effect = 'edge', badge = false) => `<div class="cover ${effect}"><img src="${photos[event.photo]}" alt="${event.alt}"><canvas aria-hidden="true"></canvas>${badge ? dateBadge(event) : ''}</div>`;
const dateBadge = event => `<span class="date-badge"><b>${event.day}</b><small>${event.month}</small></span>`;
const meta = event => `<div class="meta"><span>${icon('calendar')}${event.date} · ${event.time}</span><span>${icon('pin')}${event.place}</span></div>`;
const actions = i => `<div class="actions" role="group" aria-label="RSVP for ${events[i].title}">${['Going', 'Maybe', 'Declined'].map(label =>
  `<button data-reply="${label}" data-event="${i}" aria-pressed="${replies[i] === label}">${label}</button>`
).join('')}</div>`;
const attendance = i => `${events[i].going + Number(replies[i] === 'Going')} going`;
const detail = i => `<div class="detail"><p class="host">Hosted by ${events[i].host}</p><h3>${events[i].title}</h3>${meta(events[i])}${actions(i)}</div>`;
const heading = '<h2>Your feed</h2>';
const brand = `<div class="brand"><span>${icon('waves')}</span>Lago</div>`;
const header = `<header class="app-header glass">${brand}<span class="page-label">Feed</span><span class="avatar" aria-label="Alex">A</span></header>`;
const shortcuts = (indices, className = '') => `<div class="shortcuts ${className}">${indices.map(i =>
  `<button data-select="${i}" aria-pressed="${active === i}"><img src="${photos[events[i].photo]}" alt=""><span><strong>${events[i].title}</strong><small>${events[i].date} · ${events[i].time}</small></span>${icon('next')}</button>`
).join('')}</div>`;

function shoreline() {
  const others = events.map((_, i) => i).filter(i => active !== i);
  return `${header}<div class="shore-layout"><div class="shore-main">${heading}<article class="feature">${cover(events[active], 'wave')}${detail(active)}</article></div>
    <aside><h3>Other invitations</h3>${shortcuts(others)}</aside></div>`;
}

function fluted() {
  return `<aside class="flute-rail glass">${cover(events[0], 'ribs')}${brand}<span class="page-label">Feed</span></aside>
    <div class="agenda">${heading}<div class="agenda-list">${events.map((event, i) => `<article class="agenda-row">${dateBadge(event)}${detail(i)}${cover(event, 'edge')}</article>`).join('')}</div></div>`;
}

function afterglow() {
  return `${header}<div class="deck">${heading}<article class="deck-card">${cover(events[active], 'wave', true)}${detail(active)}</article>
    <div class="deck-controls"><button data-select="${(active + 2) % 3}" aria-label="Previous invitation">${icon('back')}</button><span>${active + 1} of ${events.length} · ${attendance(active)}</span><button data-select="${(active + 1) % 3}" aria-label="Next invitation">${icon('next')}</button></div></div>`;
}

function prism() {
  return `${header}<div class="gallery">${heading}<div class="gallery-grid">${events.map((event, i) => `<article>${cover(event, 'facet', true)}${detail(i)}</article>`).join('')}</div></div>`;
}

function stillwater() {
  return `${header}<div class="still-layout"><div class="stream">${heading}${events.map((event, i) => `<article id="plan-${i}">${cover(event)}${detail(i)}</article>`).join('')}</div>
    <aside class="date-index"><h3>Upcoming dates</h3>${events.map((event, i) => `<a href="#plan-${i}">${dateBadge(event)}<span>${event.title}<small>${attendance(i)}</small></span>${icon('next')}</a>`).join('')}</aside></div>`;
}

// Sample a displaced copy of the photo in each pane, with opposing channel offsets at the bevel.
function refract(coverElement) {
  const photo = coverElement.querySelector('img');
  const canvas = coverElement.querySelector('canvas');
  const w = Math.round(coverElement.clientWidth);
  const h = Math.round(coverElement.clientHeight);
  if (!photo.naturalWidth || !w || !h) return;
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const scale = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
  const width = photo.naturalWidth * scale;
  const height = photo.naturalHeight * scale;
  context.drawImage(photo, (w - width) / 2, (h - height) / 2, width, height);
  const original = context.getImageData(0, 0, w, h).data;
  const output = context.createImageData(w, h);
  const ribs = coverElement.classList.contains('ribs');
  const facet = coverElement.classList.contains('facet');
  const wave = coverElement.classList.contains('wave');
  const clamp = (value, max) => Math.max(0, Math.min(max - 1, Math.round(value)));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const boundary = facet ? w - 105 + y * .48 : wave ? h * .60 + Math.sin(x / 74) * 9 : w - 24;
      const distance = wave ? y - boundary : x - boundary;
      if (!ribs && distance < 0) continue;
      const bevel = ribs ? Math.sin(x * Math.PI / 11) : Math.exp(-distance / 8);
      const dx = ribs ? bevel * 10 : facet ? 21 + bevel * 14 : wave ? Math.sin(x / 67) * 10 : -11;
      const dy = wave ? -27 + bevel * 20 : facet ? -11 : 0;
      const row = clamp(y + dy, h) * w;
      const index = (y * w + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const source = (row + clamp(x + dx + (channel - 1) * bevel * 5, w)) * 4;
        output.data[index + channel] = original[source + channel] * .81 + 37 + Math.max(0, bevel) * 24;
      }
      output.data[index + 3] = 255;
    }
  }
  context.putImageData(output, 0, 0);
}

const observer = new ResizeObserver(entries => entries.forEach(({ target }) => refract(target)));
function render() {
  observer.disconnect();
  stage.className = `lago ${concepts[mode][0].toLowerCase()} ${size}`;
  stage.innerHTML = [shoreline, fluted, afterglow, prism, stillwater][mode]();
  stage.querySelectorAll('.cover').forEach(element => {
    observer.observe(element);
    element.querySelector('img').addEventListener('load', () => refract(element), { once: true });
  });
}
options.innerHTML = concepts.map(([name], i) => `<button data-option="${i}" aria-pressed="${i === mode}">${name}</button>`).join('');
caption.textContent = concepts[mode][1];
options.addEventListener('click', event => {
  const button = event.target.closest('[data-option]');
  if (!button) return;
  mode = Number(button.dataset.option);
  active = 0;
  options.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', item === button));
  caption.textContent = concepts[mode][1];
  render();
});
sizes.addEventListener('click', event => {
  const button = event.target.closest('[data-size]');
  if (!button) return;
  size = button.dataset.size;
  sizes.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', item === button));
  stage.classList.toggle('mobile', size === 'mobile');
  stage.classList.toggle('desktop', size === 'desktop');
});
stage.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.select !== undefined) {
    active = Number(button.dataset.select);
    const label = button.getAttribute('aria-label');
    render();
    const nextFocus = label ? [...stage.querySelectorAll('.deck-controls button')].find(control => control.getAttribute('aria-label') === label) : stage.querySelector('.feature button');
    nextFocus?.focus({ preventScroll: true });
  }
  if (button.dataset.reply !== undefined) {
    replies[Number(button.dataset.event)] = button.dataset.reply;
    const selector = `[data-event="${button.dataset.event}"][data-reply="${button.dataset.reply}"]`;
    render();
    stage.querySelector(selector)?.focus({ preventScroll: true });
  }
});
render();
