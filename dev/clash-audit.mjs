// Run against npm run dev on 8080: lists anything scattered in the secret world (sunflowers, flower cards,
// terraces, lanterns, trees) that stands inside the footprint of a ride, building or pool (SUN_PLAN.KEEP).
// Only the fair's own lamp globes along the plaza and lagoon should be listed.
// every scattered thing in the secret world (instances and the glowing points) against the footprints of
// everything built there; prints what still stands inside one
import puppeteer from 'puppeteer';
const sleep = ms => new Promise(r => setTimeout(r, ms)), b = await puppeteer.launch({ headless: 'new', args: ['--use-angle=metal'] }), p = await b.newPage();
await p.goto('http://localhost:8080/?debug', { waitUntil: 'load' }); await p.waitForSelector('#enter'); await sleep(2500); await p.click('#enter');
await p.waitForFunction(() => window.__garden && window.__garden.state.mode === 'walk', { timeout: 120000 });
await p.evaluate(() => window.__garden.late.enterSunWorld()); await p.waitForFunction(() => window.__garden.state.world === 'sun', { timeout: 30000 }); await sleep(1500);
console.log(await p.evaluate(() => {
  const g = window.__garden, O = g.worlds.sun.arrive.pos.clone(); O.z -= 34.8; const K = g.SUN_PLAN.KEEP, names = ['teacups', 'drop tower', 'swings', 'plaza', 'kiosk', 'canal', 'wheel', 'castle', 'coaster', 'lagoon', 'Splash Cove'];
  const inK = (x, z) => { for (let i = 0; i < K.length; i++) { const k = K[i]; if (k[0] === 'c' && Math.hypot(x - k[1], z - k[2]) < k[3] - 0.3) return i; if (k[0] === 'e' && Math.hypot((x - k[1]) / k[3], (z - k[2]) / k[4]) < 0.97) return i; if (k[0] === 'r' && x > k[1] + 0.3 && x < k[2] - 0.3 && z > k[3] + 0.3 && z < k[4] - 0.3) return i; } return -1; };
  const m4 = new g.camera.matrix.constructor(), v = g.camera.position.clone(), out = [];
  g.worlds.sun.scene.traverse(o => {
    if (!o.isInstancedMesh || o.count < 30) return;
    // the water park's own loungers and the fair's own lamps belong where they are: only scattered greenery counts
    const hits = {}; for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); v.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld); const k = inK(v.x - O.x, v.z - O.z); if (k >= 0) hits[names[k]] = (hits[names[k]] || 0) + 1; }
    if (Object.keys(hits).length) out.push(`${o.count} instances (geometry of ${o.geometry.attributes.position.count} points, ${o.material.map ? 'textured' : 'plain'}): ` + JSON.stringify(hits));
  });
  return out.join('\n') || 'nothing scattered stands inside anything built';
}));
await b.close();
