// A small handle for the headless harness (dev/screenshot.mjs). Only present with ?debug in the URL.
import { state } from './core/state.js';
import { camera } from './world/renderer.js';
import { curLook } from './player/camera.js';
import { plants } from './plants/registry.js';
import { openPoem } from './ui/reading.js';
import { setSetting } from './settings/customize.js';
import { SETTINGS, poems } from './settings/storage.js';
import { Cloud } from './cloud/cloud.js';

if (new URLSearchParams(location.search).has('debug')) {
  window.__garden = { state, camera, curLook, plants, openPoem, setSetting, get SETTINGS() { return SETTINGS; }, get poems() { return poems; }, get cloudReady() { return Cloud.ready; } };
}
