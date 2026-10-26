/* ================= hCaptcha on sign-in, sign-up and password reset ================= */
// Only when VITE_HCAPTCHA_SITEKEY is set at build time (the site key is public by design; the secret
// lives in Supabase: Authentication → Attack Protection). Without it the forms work as before.
const SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY || '';
export const captchaOn = () => !!SITEKEY && !/YOUR_/.test(SITEKEY);
let ready = null;
function load() {
  if (ready) return ready;
  ready = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit'; s.async = true; s.onload = () => res(window.hcaptcha); s.onerror = rej; document.head.appendChild(s); });
  return ready;
}
// puts the "I am human" box into `box`; returns a function that gives the token (or '' if not ticked yet)
export function mountCaptcha(box) {
  if (!captchaOn()) return () => undefined;
  let id = null, token = '';
  load().then(h => { id = h.render(box, { sitekey: SITEKEY, callback: t => { token = t; }, 'expired-callback': () => { token = ''; } }); }).catch(() => { box.textContent = 'The check that you are human could not load. Try again in a moment.'; });
  return () => token;
}
export function resetCaptcha() { try { window.hcaptcha && window.hcaptcha.reset(); } catch (e) { /* not shown */ } }
