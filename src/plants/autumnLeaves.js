import * as THREE from 'three';
import { mapleTex } from '../world/textures.js';
import { windify } from '../world/wind.js';
import { DS } from '../world/geometry.js';
/* ================= autumn leaf material (no decorative trees: every tree is a poem) ================= */
export const mapleMat = windify(new THREE.MeshLambertMaterial({ map: mapleTex, alphaTest: 0.45, side: DS, emissive: '#160d08' }), 0.04, 'const');
export const SAKURA_WHITE = ['#fbf3f5', '#f6e6ec', '#ffffff', '#f2dfe6'];
export const GREEN_PALS = [['#6f9a4a', '#80a957', '#5f8a40', '#8fb562'], ['#4f7a3c', '#5f8a46', '#6a9450', '#476e36'], ['#7aa451', '#93b968', '#a6c57a', '#6b9446']];
// every crown mixes scarlet, orange and gold, as a real maple does (one colour per tree looked painted)
export const AUTUMN_PALS = [['#d0301f', '#e8642c', '#f2a531', '#b9261c'], ['#f2c335', '#e8862e', '#d9472c', '#f7d955'], ['#e2552b', '#f3b83a', '#c8382a', '#ef8a34']];
export function recolorDecor() {}

