import { $, V3, clamp, monthYear } from '../core/util.js';
import { state } from '../core/state.js';
import { camera, canvas, renderer, view } from '../world/renderer.js';
import { renderPost } from '../world/post.js';
import { POST, SETTINGS, poems } from '../settings/storage.js';
import { quality } from '../settings/quality.js';
import { plants } from '../plants/registry.js';
import { WORLD_R, groundH } from '../world/terrain.js';
import { gardenMapImage } from './map.js';
import { regionLabel } from './reading.js';
import { toast } from './helpers.js';
import { keys } from './input.js';
import { Cloud, myWishes, setWish } from '../cloud/cloud.ts';
import { late, provide } from '../core/late.js';

provide({ get openBook() { return openBook; } });

/* ================= a book of your poems ================= */
// Every poem in your garden as a book: a cover, the garden's map, the contents, then each poem on its own page
// beneath a picture of its tree (trees already grow in the season their poem was written). It opens as a
// preview; printing it (or saving it as a PDF) gives 6 × 9 inch pages, ready for Lulu or Blurb.
const book = $('#book'), pagesEl = $('#bk-pages'), status = $('#bk-status'), printBtn = $('#bk-print');
let prevMode = 'walk', busy = false;
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

// a portrait picture of one tree, from the side where its neighbours least get in the way, drawn with the
// garden's own film look; the main camera is borrowed for one frame and put back
function photograph(pl) {
  const pos = pl.root.position, h = pl.h || 6, r = pl.radius || 3;
  const tgt = new V3(pos.x, groundH(pos.x, pos.z) + h * 0.47, pos.z), dist = Math.max(h * 1.45, r * 2.6) + 2;
  let best = 0, bc = Infinity;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, cx = pos.x + Math.cos(a) * dist, cz = pos.z + Math.sin(a) * dist;
    let cost = Math.hypot(cx, cz) > WORLD_R - 3 ? 100 : -0.02 * Math.hypot(cx, cz);
    plants.forEach(o => {
      if (o === pl || !o.root.visible) return;
      const ox = o.root.position.x - cx, oz = o.root.position.z - cz, dx = pos.x - cx, dz = pos.z - cz, L = dx * dx + dz * dz;
      const t = clamp((ox * dx + oz * dz) / L, 0, 1), d = Math.hypot(ox - dx * t, oz - dz * t);
      if (t < 0.95 && d < (o.radius || 3) + 1) cost += ((o.radius || 3) + 1 - d) * (2 - t);
    });
    if (cost < bc) { bc = cost; best = a; }
  }
  const cx = pos.x + Math.cos(best) * dist, cz = pos.z + Math.sin(best) * dist;
  const saved = { p: camera.position.clone(), q: camera.quaternion.clone(), fov: camera.fov };
  camera.position.set(cx, groundH(cx, cz) + 1.6 + h * 0.18, cz); camera.lookAt(tgt); camera.fov = 42; camera.updateProjectionMatrix();
  if (POST.on && quality.post) renderPost(); else renderer.render(view.scene, camera);
  const W = 900, H = 1125, cw = canvas.width, ch = canvas.height;
  let sh = ch, sw = ch * W / H; if (sw > cw) { sw = cw; sh = cw * H / W; }
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  out.getContext('2d').drawImage(canvas, (cw - sw) / 2, (ch - sh) / 2, sw, sh, 0, 0, W, H);
  camera.position.copy(saved.p); camera.quaternion.copy(saved.q); camera.fov = saved.fov; camera.updateProjectionMatrix();
  return out.toDataURL('image/jpeg', 0.9);
}

async function openBook() {
  if (busy) return;
  if (state.visiting) { toast('A book is made from your own garden. Return home first.'); return; }
  if (state.world === 'sun') { toast('The white door leads home, where your poems grow.'); return; }
  if (state.world === 'temple' || state.world === 'shrine') { toast('Step back out into the garden, where your poems grow.'); return; }
  if (state.mode !== 'walk') return;
  const list = poems.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (!list.length) { toast('Plant a poem first, and your book will have its first page.'); return; }
  busy = true; late.closePops && late.closePops(); keys.clear();
  prevMode = state.mode; state.mode = 'book';
  pagesEl.innerHTML = ''; printBtn.disabled = true; book.hidden = false; renderWish();
  const pics = [];
  for (let i = 0; i < list.length; i++) {
    status.textContent = `Binding your book… ${i + 1} of ${list.length}`;
    await nextFrame();
    const pl = plants.get(list[i].id);
    pics.push(pl && pl.root.visible ? photograph(pl) : null);
  }
  status.textContent = 'Drawing the map…'; await nextFrame();
  const map = gardenMapImage(1400);
  const name = SETTINGS.name || 'The Garden of Poems', poet = (Cloud.profile && (Cloud.profile.display_name || Cloud.profile.username)) || SETTINGS.by || '';
  const years = [...new Set(list.map(p => new Date(p.createdAt).getFullYear()))], span = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : String(years[0]);
  let html = `<section class="bp cover"><span class="orn">✿</span><h1>${esc(name)}</h1>${poet ? `<p class="by">by ${esc(poet)}</p>` : ''}<p class="sm">Poems, ${span}</p></section>`;
  html += `<section class="bp full mapp"><h2>The garden</h2><img src="${map}" alt="A map of the garden"><p class="cap">Every tree in this garden grew from a poem. Each dot is one of them, in the colour of its mood.</p></section>`;
  html += `<section class="bp contents"><h2>The poems</h2><ol>${list.map(p => `<li><span>${esc(p.title || 'Untitled')}</span><i>${esc(monthYear(p.createdAt))}</i></li>`).join('')}</ol></section>`;
  list.forEach((p, i) => {
    html += `<section class="bp poem">${pics[i] ? `<figure><img src="${pics[i]}" alt="The tree this poem grew into"></figure>` : ''}<h3>${esc(p.title || 'Untitled')}</h3><p class="meta">${esc(monthYear(p.createdAt))} · ${esc(regionLabel(p))}</p><div class="text">${esc(p.content.replace(/\s+$/, ''))}</div></section>`;
  });
  html += `<section class="bp full colophon"><p>This book grew in The Garden of Poems,<br>where every poem becomes a tree.</p><p class="sm">${esc(new Date().toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' }))}</p></section>`;
  pagesEl.innerHTML = html;
  status.textContent = `${list.length} poem${list.length === 1 ? '' : 's'}, ready`;
  printBtn.disabled = false; busy = false; printBtn.focus({ preventScroll: true });
}
function closeBook() { if (busy) return; book.hidden = true; pagesEl.innerHTML = ''; if (state.mode === 'book') state.mode = prevMode; }
printBtn.onclick = () => window.print();
$('#bk-close').onclick = closeBook;
addEventListener('keydown', e => { if (e.key === 'Escape' && !book.hidden) { e.preventDefault(); e.stopImmediatePropagation(); closeBook(); } }, true);

// "tell me when printed copies can be ordered here": a wish on the waitlist
async function renderWish() {
  const b = $('#bk-wish');
  if (!Cloud.ready) { $('#bk-wish-row').hidden = true; return; }
  $('#bk-wish-row').hidden = false;
  if (!Cloud.user) { b.textContent = 'Sign in to hear when printed copies can be ordered here'; b.onclick = () => { closeBook(); late.openGardens && late.openGardens(); }; return; }
  const w = await myWishes();
  if (w === null) { $('#bk-wish-row').hidden = true; return; }
  const on = w.has('book');
  b.textContent = on ? 'You will hear when printed copies can be ordered here. (Take my name off)' : 'Tell me when printed copies can be ordered here';
  b.onclick = async () => { b.disabled = true; if (await setWish('book', !on)) toast(on ? 'Your name is off that list.' : 'We will let you know. Thank you.'); b.disabled = false; renderWish(); };
}
$('#m-book').onclick = () => openBook();
