// Swatches from lago-opening.gif, ordered so adjacent member IDs get different hues.
const colors = ['#adcfd8', '#ffe047', '#f3c79f', '#e3efed', '#a0c9c5', '#e9bd63'];

export function memberColor(id) {
  return colors[(id - 1) % colors.length];
}
