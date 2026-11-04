/* ================= the worlds you can be in ================= */
// The garden, the temple inside the pagodas, and the Sunflower Garden through Manai Falls (world/sunWorld.js). state.world says which one
// you are in ('sun' there, anything else is the garden); the sunflower world registers how to stand and
// what blocks you there, and the scene that is drawn (core/loop.js, world/post.js) is view.scene.
import { state } from './state.js';
export const worlds = { sun: null, temple: null, shrine: null, grove: null };
// anywhere but the garden: the Sunflower Garden, or inside the pagodas' temple (world/templeInterior.js)
export const away = () => !!worlds[state.world];
// inside a pagoda: the Buddha's temple or the Japanese shrine
export const indoors = () => state.world === 'temple' || state.world === 'shrine' || state.world === 'grove';
