/* ================= the sky icons in the top bar: each shows the garden as it is now ================= */
export const ICONS = {
  spring: '<path d="M12 9.3c1.3-2.4 4.4-2.6 4.6-.2.2 1.8-2.2 2.6-4.6 2.9 2.4.3 4.8 1.1 4.6 2.9-.2 2.4-3.3 2.2-4.6-.2-1.3 2.4-4.4 2.6-4.6.2-.2-1.8 2.2-2.6 4.6-2.9-2.4-.3-4.8-1.1-4.6-2.9.2-2.4 3.3-2.2 4.6.2z"/><circle cx="12" cy="12" r="1.3"/>',
  monsoon: '<path d="M7 13.5a4 4 0 0 1 .6-7.9 5 5 0 0 1 9.4 1.4 3.3 3.3 0 0 1-.5 6.5z"/><path d="M8.5 16.5l-1 2.5M12.5 16.5l-1 2.5M16.5 16.5l-1 2.5"/>',
  autumn: '<path d="M12 2.8l1.5 3.4 3-1.3-.8 3.4 3.4.5-2.4 2.4 1.9 1.3-3.6.9.4 2.3-3.4-1.5-1.4 1.6-1.4-1.6-3.4 1.5.4-2.3-3.6-.9 1.9-1.3-2.4-2.4 3.4-.5-.8-3.4 3 1.3z"/><path d="M12 15.2V21.5"/>',
  day: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  sunset: '<path d="M7 16a5 5 0 0 1 10 0"/><path d="M3 16h18M5.5 19.5h13M12 5v3M5 9l1.8 1.8M19 9l-1.8 1.8"/>',
  night: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
  clear: '<circle cx="9" cy="9" r="3"/><path d="M9 3.5v1.2M3.5 9h1.2M5.1 5.1l.9.9M12.9 5.1l-.9.9"/><path d="M10 18.5a3.4 3.4 0 0 1 .5-6.7 4.2 4.2 0 0 1 7.9 1.2 2.8 2.8 0 0 1-.4 5.5z"/>',
  showers: '<path d="M7 13.5a4 4 0 0 1 .6-7.9 5 5 0 0 1 9.4 1.4 3.3 3.3 0 0 1-.5 6.5z"/><path d="M10 16.5l-.7 2M14.5 16.5l-.7 2"/>',
  rain: '<path d="M7 12.5a4 4 0 0 1 .6-7.9 5 5 0 0 1 9.4 1.4 3.3 3.3 0 0 1-.5 6.5z"/><path d="M7.5 15l-1.2 3M11 15l-1.2 3M14.5 15l-1.2 3M18 15l-1.2 3M9.3 19l-.6 1.6M12.8 19l-.6 1.6"/>',
};
// a top-bar button: the icon is what is true now; the tooltip says so and what a press does
export function setSkyButton(id, icon, now, next, key) {
  const b = document.getElementById(id); if (!b) return;
  b.querySelector('svg').innerHTML = ICONS[icon] || '';
  b.dataset.tip = `${now} · ${next} (${key})`; b.setAttribute('aria-label', `${now}. ${next}`);
}
