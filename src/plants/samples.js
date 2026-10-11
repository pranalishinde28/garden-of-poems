import { poems, savePoems } from '../settings/storage.js';
import { state } from '../core/state.js';
import { createPlant, preparePoem } from './registry.js';
import { sign } from '../world/decor.js';
import { rebuildConnections, rebuildPetals } from '../world/particles.js';
import { computeSeason, inFilter } from '../ui/filter.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get plantSamples() { return plantSamples; },
  get updateSign() { return updateSign; },
});

/* ================= samples ================= */
function samplePoems() {
  const today = new Date(); today.setHours(9, 12, 0, 0);
  return [
    { id: 'demo-july', title: 'July', mood: 'love', theme: 'summer', createdAt: '2026-07-14T21:10:00', content: 'I remember the summer\nby the way the light\nstayed longer\non your hands,\nas if it, too,\ndid not want to leave.' },
    { id: 'demo-kettle', title: 'Kettle', mood: 'childhood', theme: 'home', createdAt: '2025-11-03T07:40:00', content: "My grandmother's kettle\nsang before the house woke.\nI learned the word morning\nfrom that small, steady whistle,\nsteam on the window,\nmy name drawn through it,\nfading as I watched." },
    { id: 'demo-lowtide', title: 'Low Tide', mood: 'sorrow', theme: 'you', createdAt: '2026-01-20T23:05:00', content: 'You left the way water does,\nnot all at once,\nbut a little more each night\nuntil the stones I knew\nwere standing in the open,\nsurprised to be so dry.' },
    { id: 'demo-static', title: 'Static', mood: 'anger', createdAt: '2025-10-12T18:30:00', content: "I said it was fine.\nIt was not fine.\nIt was a field of dry grass\nwaiting for one more word,\nand you, with your hands full of matches,\nasking why I'm quiet." },
    { id: 'demo-lantern', title: 'The Lantern Fish', mood: 'dream', createdAt: '2026-03-08T04:20:00', content: 'Last night the ceiling opened\nand the sea came down politely,\nlantern fish reading the shelves,\na whale asleep in the hallway.\nI did not wake.\nI was not afraid.\nI left the door open for them.' },
    { id: 'demo-commute', title: 'Commute', mood: 'reflection', theme: 'the city', createdAt: '2026-05-22T08:15:00', content: "Every morning the train\ncarries a thousand quiet lives\npressed close and not touching.\nI hold the strap and wonder\nwhich of us is carrying\nthe heaviest thing today,\nand which of us,\nwithout knowing,\nis lighter than they've been in years." },
    { id: 'demo-smallyes', title: 'Small Yes', mood: 'joy', createdAt: '2026-04-11T12:00:00', content: 'The plum tree said yes\nto one blossom,\nthen another,\nas if spring were\na question\nit had been asked politely.' },
    { id: 'demo-letters', title: "Letters I Didn't Send", mood: 'reflection', theme: 'you', createdAt: '2025-09-02T22:45:00', content: 'I wrote to you from every city\nI passed through that year,\nfrom the bus along the coast,\nfrom a bench in a station\nwhose name I have forgotten,\nfrom the floor of a room\nwith the window open\nand someone practicing violin next door.\nI told you about the rivers.\nI told you about the bread.\nI told you I was fine,\nwhich was nearly true.\nThe letters are still in a box\nunder the bed, unstamped,\ngrowing older beside me,\nlearning to be patient.' },
    { id: 'demo-tuesday', title: 'Mother, Tuesday', mood: 'love', important: true, theme: 'home', createdAt: '2025-12-28T20:00:00', content: "She calls to ask if I've eaten.\nThat is the whole call.\nThat is the whole love,\nfolded small enough\nto fit across an ocean." },
    { id: 'demo-snow', title: 'Snow on the Station', mood: 'reflection', theme: 'the city', createdAt: '2026-02-14T19:30:00', content: 'Snow on the station roof,\nevery footprint a small decision\nsomeone made and walked away from.\nMine among them, somewhere,\nalready softening.' },
    { id: 'demo-fireflies', title: 'Fireflies', mood: 'joy', theme: 'summer', createdAt: '2026-08-03T21:30:00', content: 'Children chasing small lights\nacross the riverbank,\nnot to keep them,\njust to be near\nsomething that glows\nwithout trying.' },
    { id: 'demo-firstcold', title: 'First Cold', mood: 'reflection', createdAt: today.toISOString(), content: "The first cold morning\narrives like a letter\nin handwriting I almost recognise.\nI put on last year's coat\nand find, in the pocket,\na receipt for a life\nI was still learning to live." }
  ].map(p => Object.assign(p, { demo: true, createdAt: new Date(p.createdAt).toISOString() }));
}
export function plantSamples(animate) {
  let added = 0;
  samplePoems().forEach((p, i) => {
    if (poems.some(q => q.id === p.id)) return;
    preparePoem(p); poems.push(p); added++;
    const pl = createPlant(p, { visible: !animate });
    if (animate) { pl.target = inFilter(p) ? 1 : 0; pl.speed = 1 / 2.6; pl.delay = 0.3 + i * 0.35; }
  });
  if (added) { savePoems(); rebuildConnections(); rebuildPetals(); updateSign(); state.season = computeSeason(); }
  return added;
}
export function updateSign() { sign.visible = poems.length === 0; }

