import * as THREE from 'three';
import { V3, isTouch } from '../core/util.js';
import { scene } from './renderer.js';

/* ---------- lights ---------- */
export const hemi = new THREE.HemisphereLight(); scene.add(hemi);
export const dirL = new THREE.DirectionalLight(); scene.add(dirL); scene.add(dirL.target);
dirL.castShadow = true;
{ const sc = dirL.shadow.camera; sc.left = -56; sc.right = 56; sc.top = 56; sc.bottom = -56; sc.near = 20; sc.far = 260; dirL.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048); dirL.shadow.bias = -0.0005; dirL.shadow.normalBias = 0.04; }
export const moonDir = new V3(-0.3, 0.42, -0.86).normalize();
export const sunDir = new V3(0.6, 0.48, 0.64).normalize();
export const lightDir = new V3();

