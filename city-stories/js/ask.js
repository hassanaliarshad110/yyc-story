// In-game question box (instead of the browser's pop-ups, which show the site's address)
import { tr } from './i18n.js?v=11112231';
let box = null;
function build() {
  box = document.createElement('div'); box.id = 'ask'; box.hidden = true;
  box.innerHTML = '<div class="ask-in"><p class="ask-q" dir="auto"></p><input class="ask-i" maxlength="20" autocomplete="off" hidden><div class="ask-b"><button class="ask-no"></button><button class="ask-ok"></button></div></div>';
  document.body.appendChild(box);
}
// ask(question, { input: default text or undefined, ok, cancel }) -> Promise: true/false, or the text typed (null if cancelled)
export function ask(q, o = {}) {
  if (!box) build();
  const inp = box.querySelector('.ask-i'), ok = box.querySelector('.ask-ok'), no = box.querySelector('.ask-no');
  box.querySelector('.ask-q').textContent = q;
  const text = o.input !== undefined; inp.hidden = !text; inp.value = text ? o.input || '' : '';
  ok.textContent = o.ok || tr('askOk'); no.textContent = o.cancel || tr('askCancel');
  box.hidden = false; if (text) setTimeout(() => inp.focus(), 50);
  return new Promise(res => {
    const done = v => { box.hidden = true; ok.onclick = no.onclick = inp.onkeydown = null; res(v); };
    ok.onclick = () => done(text ? inp.value.trim() : true);
    no.onclick = () => done(text ? null : false);
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') ok.click(); if (e.key === 'Escape') no.click(); };
  });
}
