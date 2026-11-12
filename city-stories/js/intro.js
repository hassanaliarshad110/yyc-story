// The opening: "Calgary Insight presents", the YYC City Stories title with the song from the chorus,
// the language choice and the character choice (Ali, Natalia, Chris, Jean).
import { LANGS, LANG, setLang, tr, pick, dirOfLang } from './i18n.js?v=11112231';

const $ = s => document.querySelector(s);
const AV = { ali: 'linear-gradient(#15100d 30%, #b07a52 30% 64%, #1f6fd1 64%)', natalia: 'linear-gradient(#4a2e1a 36%, #d9a77e 36% 64%, #7a3fa0 64%)', chris: 'linear-gradient(#d2d0cc 30%, #e0b896 30% 64%, #6b5a46 64%)', jean: 'linear-gradient(#15100d 30%, #8d5a3b 30% 64%, #2f8f5a 64%)', leo: 'linear-gradient(#a0703a 30%, #e8c4a0 30% 64%, #e07020 64%)' };

export function initIntro({ music, characters, onPick }) {
  const screens = ['#intro-presents', '#intro-title', '#intro-lang', '#intro-who'];
  const show = id => { for (const s of screens) $(s).hidden = s !== id; };
  let ready = false, picked = null, hasProgress = false;
  const apply = () => {
    document.querySelectorAll('[data-t]').forEach(e => { e.textContent = tr(e.dataset.t); });
    $('#intro-who').setAttribute('dir', dirOfLang());
    $('.lang-note').textContent = tr('langNote');
    renderChars();
    storyLabel(hasProgress);
  };
  const storyLabel = has => { hasProgress = has; const b = $('#btn-story'); if (b) b.textContent = has ? '▶ ' + tr('story') : tr('story'); };
  function renderChars() {
    const wrap = $('.chars'); wrap.innerHTML = '';
    for (const [key, c] of Object.entries(characters)) {
      const b = document.createElement('button'); b.className = 'char-btn' + (key === picked ? ' on' : ''); b.dataset.key = key;
      b.innerHTML = `<span class="char-av" style="background:${AV[key]}"></span><b>${c.name}</b><small>${pick(c.role)}</small>`;
      b.onclick = () => choose(key);
      wrap.appendChild(b);
    }
    if (picked) $('.char-blurb').textContent = pick(characters[picked].blurb);
  }
  function choose(key) {
    picked = key; onPick(key);
    document.querySelectorAll('.char-btn').forEach(x => x.classList.toggle('on', x.dataset.key === key));
    $('.char-blurb').textContent = pick(characters[key].blurb);
  }
  // language buttons, each in its own language
  const langs = $('.langs');
  for (const l of LANGS) {
    const b = document.createElement('button'); b.textContent = l.name; b.dir = l.dir;
    b.onclick = () => { setLang(l.code); apply(); show('#intro-who'); if (!picked) choose(localStorageChar() || 'ali'); };
    langs.appendChild(b);
  }
  // first tap: the song starts (from the chorus) with "Calgary Insight presents", then the title
  $('#btn-start').onclick = () => {
    music.titleChorus();
    $('#btn-start').hidden = true; $('.ci-name').hidden = true; const pr = $('.presents'); pr.hidden = false;
    setTimeout(() => { if (!$('#intro-presents').hidden) show('#intro-title'); }, 3700);
  };
  $('#btn-tap').onclick = () => { music.titleChorus(); show('#intro-lang'); };
  $('#btn-lang').onclick = () => show('#intro-lang');
  apply();
  // skip straight to the character choice with #play (for links from the website)
  if (location.hash === '#play' || location.hash === '#menu') { show('#intro-who'); choose(localStorageChar() || 'ali'); if (location.hash === '#menu') music.titleChorus(); }
  else show('#intro-presents');
  return {
    ready() { ready = true; if (picked) onPick(picked); },
    storyLabel,
    stop() { },
  };
}
function localStorageChar() { try { return localStorage.getItem('yyc-char'); } catch (e) { return null; } }
