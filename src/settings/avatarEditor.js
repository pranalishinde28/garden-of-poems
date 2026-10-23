import * as THREE from 'three';
import { $ } from '../core/util.js';
import { state } from '../core/state.js';
import { flag } from './storage.js';
import { renderer } from '../world/renderer.js';
import { Cloud } from '../cloud/cloud.ts';
import { AVATAR_OPTIONS, KIND_PRESETS, animateAvatar, buildAvatar, cleanAvatar } from '../player/avatar.js';
import { getAvatar, setAvatar, setThirdPerson } from '../player/figure.js';
import { setViewUI } from '../ui/hud.js';
import { late, provide } from '../core/late.js';
import { closePanel, openPanel } from '../ui/reading.js';

/* ================= your figure: the editor in Customize ================= */
// The figure belongs to the person, not the garden: it is kept on this device and, when signed in,
// with your profile, and it can be changed while visiting someone else's garden.
const panel = $('#youpanel'), canvas = $('#av-preview');
state.minimap = flag.get('minimap') !== '0';

// ---- live preview: a small separate renderer that only runs while Customize is open ----
let pr = null, pScene, pCam, pFig, raf = 0, last = 0;
function ensurePreview() {
  if (pr) return;
  pr = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); pr.setPixelRatio(1);
  pr.outputEncoding = renderer.outputEncoding; pr.toneMapping = renderer.toneMapping; pr.toneMappingExposure = renderer.toneMappingExposure;
  pScene = new THREE.Scene();
  pScene.add(new THREE.HemisphereLight('#e6eef4', '#5d6e44', 0.75));
  const d = new THREE.DirectionalLight('#fff0d8', 0.9); d.position.set(2, 3, 2.5); pScene.add(d);
  pCam = new THREE.PerspectiveCamera(28, canvas.width / canvas.height, 0.1, 20); pCam.position.set(0, 1.05, 4.4); pCam.lookAt(0, 0.86, 0);
}
function refreshPreview() {
  ensurePreview();
  if (pFig) pScene.remove(pFig.root);
  const a = getAvatar(); pFig = buildAvatar(a); pFig.root.rotation.y = Math.PI * 0.85; pScene.add(pFig.root);
  // a small creature is framed closer
  if (a.kind === 'cat') { pCam.position.set(0, 0.55, 2.1); pCam.lookAt(0, 0.3, 0); } else if (a.kind === 'bird') { pCam.position.set(0, 0.45, 1.6); pCam.lookAt(0, 0.25, 0); } else { pCam.position.set(0, 1.05, 4.4); pCam.lookAt(0, 0.86, 0); }
}
function loop(now) {
  if (!panel.classList.contains('open') || panel.hidden) { raf = 0; return; }
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
  pFig.root.rotation.y += dt * 0.35; animateAvatar(pFig, 'idle', dt, now / 1000);
  pr.render(pScene, pCam); raf = requestAnimationFrame(loop);
}
function startPreview() { refreshPreview(); if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }
new MutationObserver(() => { if (panel.classList.contains('open')) { render(); startPreview(); } }).observe(panel, { attributes: true, attributeFilter: ['class'] });

// ---- controls ----
const label = v => Array.isArray(v) ? v : [v, v];
function build() {
  document.querySelectorAll('#c-you [data-av]').forEach(box => {
    const k = box.dataset.av, list = AVATAR_OPTIONS[k];
    list.forEach((item, i) => {
      const [v, text] = label(item), b = document.createElement('button');
      b.dataset.v = v; b.type = 'button';
      if (box.classList.contains('sw')) { b.style.background = v; b.setAttribute('aria-label', `${box.getAttribute('aria-label')} ${i + 1}`); }
      else b.textContent = text;
      b.onclick = () => change(k === 'kind' && v !== getAvatar().kind ? { kind: v, ...KIND_PRESETS[v] } : { [k]: v });
      box.appendChild(b);
    });
  });
  $('#av-height').oninput = e => change({ height: +e.target.value }, true);
  document.querySelectorAll('[data-av-view] button').forEach(b => { b.onclick = () => { setThirdPerson(b.dataset.v === 'third'); setViewUI(); render(); }; });
  $('#av-minimap').onchange = e => { state.minimap = e.target.checked; flag.set('minimap', state.minimap ? '1' : '0'); };
}
function render() {
  const a = getAvatar();
  document.querySelectorAll('#c-you [data-av]').forEach(box => box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', a[box.dataset.av] === b.dataset.v ? 'true' : 'false')));
  $('#av-height').value = a.height;
  // only the choices that belong to what you are
  const person = a.kind === 'girl' || a.kind === 'boy';
  document.querySelectorAll('#c-you [data-for]').forEach(r => { r.hidden = r.dataset.for === 'person' ? !person : r.dataset.for !== a.kind; });
  document.querySelectorAll('[data-av-view] button').forEach(b => b.setAttribute('aria-pressed', (b.dataset.v === 'third') === !!state.thirdPerson ? 'true' : 'false'));
  $('#av-minimap').checked = !!state.minimap;
}

// ---- saving: this device always, your profile when signed in ----
let saveT = 0, profileTakesAvatar = true;
function change(patch, quiet) {
  setAvatar({ ...getAvatar(), ...patch }); render(); refreshPreview();
  clearTimeout(saveT); saveT = setTimeout(saveToProfile, quiet ? 900 : 400);
}
async function saveToProfile() {
  if (!Cloud.user || !Cloud.sb || !profileTakesAvatar) return;
  const { error } = await Cloud.sb.from('profiles').update({ avatar: getAvatar() }).eq('id', Cloud.user.id);
  // an older database without profiles.avatar: keep the figure on this device only
  if (error) profileTakesAvatar = false;
}
// cloud.js calls this after signing in: a figure saved with the profile wins over this device's
export function useProfileAvatar(prof) {
  if (prof && prof.avatar && typeof prof.avatar === 'object') { setAvatar(cleanAvatar(prof.avatar)); if (panel.classList.contains('open')) { render(); refreshPreview(); } }
  else if (prof) saveToProfile();
}
provide({ get useProfileAvatar() { return useProfileAvatar; } });

build(); render();

// its own box, from its own button
function openYou() { late.closePops(); openPanel(panel); }
$('#h-you').onclick = () => panel.classList.contains('open') ? closePanel(panel) : openYou();
$('#y-close').onclick = () => closePanel(panel);
