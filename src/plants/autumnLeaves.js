import * as THREE from 'three';
import { mapleTex } from '../world/textures.js';
import { windify } from '../world/wind.js';
import { DS } from '../world/geometry.js';
/* ================= autumn leaf material (no decorative trees: every tree is a poem) ================= */
export const mapleMat = windify(new THREE.MeshLambertMaterial({ map: mapleTex, alphaTest: 0.45, side: DS, emissive: '#160d08' }), 0.04, 'const');
export const SAKURA_WHITE = ['#fbf3f5', '#f6e6ec', '#ffffff', '#f2dfe6'];
export const GREEN_PALS = [['#6f9a4a', '#80a957', '#5f8a40', '#8fb562'], ['#4f7a3c', '#5f8a46', '#6a9450', '#476e36'], ['#7aa451', '#93b968', '#a6c57a', '#6b9446']];
export const AUTUMN_PALS = [['#c8382a', '#d9472c', '#e2622f', '#b82f2a'], ['#f0c23a', '#f4cf52', '#e6b22e', '#f7dc6c'], ['#e07a2e', '#d34a2c', '#f0b23c', '#c94a2a']];
export function recolorDecor() {}

