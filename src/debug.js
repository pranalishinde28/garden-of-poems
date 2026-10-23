import { animals } from './animals/animals.js';
// A small handle for the headless harness (dev/screenshot.mjs). Only present with ?debug in the URL.
import { state } from './core/state.js';
import { camera } from './world/renderer.js';
import { curLook } from './player/camera.js';
import { plants } from './plants/registry.js';
import { openPoem } from './ui/reading.js';
import { setSetting } from './settings/customize.js';
import { SETTINGS, poems } from './settings/storage.js';
import { Cloud } from './cloud/cloud.ts';
import { swings } from './world/swings.js';
import { late } from './core/late.js';
import { scene } from './world/renderer.js';
import { groundH } from './world/terrain.js';
import { player } from './player/camera.js';
import { buildAvatar, animateAvatar } from './player/avatar.js';
import { setAvatar, setThirdPerson } from './player/figure.js';
import { chooseQuality, quality } from './settings/quality.js';
import { power } from './core/power.js';
import { renderer, reflRT } from './world/renderer.js';

if (new URLSearchParams(location.search).has('debug')) {
  window.__garden = { drawBoard: () => late.drawLinkBoards && late.drawLinkBoards(), animals, state, camera, curLook, plants, openPoem, setSetting, get SETTINGS() { return SETTINGS; }, get poems() { return poems; }, get cloudReady() { return Cloud.ready; }, cloud: Cloud, swings, sit: i => late.sitSwing(swings[i]), player, setAvatar, setThirdPerson, chooseQuality, quality, renderer, reflRT, get framesDrawn() { return power.framesDrawn; },
    // stand a row of figures (posed) at x0..; for judging the avatar's look
    lineup(cfgs, x0, z, pose = 'idle') { cfgs.forEach((c, i) => { const f = buildAvatar(c), x = x0 + i * 0.45; f.root.position.set(x, groundH(x, z), z); f.root.rotation.y = Math.PI; for (let k = 0; k < 60; k++) animateAvatar(f, pose, 1 / 30, k / 30, { speed: 2.5, omega: 0 }); scene.add(f.root); }); } };
}
