import { toast } from '../ui/helpers.js';
import { Cloud, unsubscribeDigest } from './cloud.ts';

/* ================= the weekly letter's "Stop these letters" link ================= */
// Every letter ends with …/?unsubscribe=<token>. Opening it stops that person's letters at once, signed in or not,
// says so, and takes the token out of the address bar. (The letters themselves are written by the edge function
// supabase/functions/weekly-digest; the switch is in the Gardens panel, under your account.)
const token = new URLSearchParams(location.search).get('unsubscribe');
if (token && /^[0-9a-f-]{36}$/i.test(token)) {
  const url = new URL(location.href); url.searchParams.delete('unsubscribe'); history.replaceState(null, '', url);
  let tries = 0;
  const go = async () => {
    if (!Cloud.sb) { if (++tries < 60) setTimeout(go, 500); return; }
    const ok = await unsubscribeDigest(token);
    // on the welcome screen the message sits at the foot, clear of the title
    const t = document.querySelector('#toast'), intro = document.querySelector('#intro');
    if (t && intro && !intro.hidden) { t.classList.add('at-foot'); setTimeout(() => t.classList.remove('at-foot'), 9600); }
    toast(ok ? 'No more weekly letters. You can turn them on again in Gardens, under your account.' : 'Those letters are already stopped.', 9000);
  };
  go();
}
