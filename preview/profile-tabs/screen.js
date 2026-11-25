import { createApp, h, ref } from 'vue';
import MemberProfile from '../../src/components/MemberProfile.vue';
import '../../src/style.css';

const person = { id: 1, name: 'Mia Keller' };
const events = [
  ['Morgen am See', 'lake', 1],
  ['Kaffee am Sonntag', 'coffee', 2],
  ['Gemeinsames Znacht', 'dinner', 1]
].map(([title, photo, host_id], index) => ({
  id: index, title, photo: '../assets/' + photo + '.jpg', host_id, guests: [{ id: 1 }],
  date: '2026-12-0' + (5 + index), time: ['09:00', '10:30', '18:30'][index]
}));
const labelDate = (date, options) => new Date(date + 'T12:00:00').toLocaleDateString('de-CH', options);
function applyVariant() { document.body.className = location.hash.slice(1); }
applyVariant();
window.addEventListener('hashchange', applyVariant);
createApp({ setup() {
  const selected = ref('own');
  return () => h(MemberProfile, { own: true, person, events, selectedTab: selected.value, labelDate,
    'onUpdate:selectedTab': value => { selected.value = value; } });
} }).mount('#app');
