// Languages for menus and titles: English, French, Punjabi (Gurmukhi), Urdu, Tagalog and Arabic.
export const LANGS = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', dir: 'ltr' },
  { code: 'ur', name: 'اردو', dir: 'rtl' },
  { code: 'tl', name: 'Tagalog', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
];
export const LANG = { code: 'en' };
try { const s = localStorage.getItem('yyc-lang'); if (LANGS.some(l => l.code === s)) LANG.code = s; } catch (e) { }
export function setLang(code) { LANG.code = code; try { localStorage.setItem('yyc-lang', code); } catch (e) { } loadLangPack(code); }
export const dirOfLang = () => (LANGS.find(l => l.code === LANG.code) || LANGS[0]).dir;

const S = {
  presents: { en: 'Calgary Insight presents', fr: 'Calgary Insight présente', pa: 'ਕੈਲਗਰੀ ਇਨਸਾਈਟ ਪੇਸ਼ ਕਰਦਾ ਹੈ', ur: 'کیلگری انسائٹ پیش کرتا ہے', tl: 'Inihahandog ng Calgary Insight', ar: 'كالغاري إنسايت تقدّم' },
  title: { en: 'YYC City Stories', fr: 'YYC Histoires de ville', pa: 'YYC ਸ਼ਹਿਰ ਦੀਆਂ ਕਹਾਣੀਆਂ', ur: 'YYC شہر کی کہانیاں', tl: 'YYC Mga Kuwento ng Lungsod', ar: 'YYC حكايات المدينة' },
  tagline: { en: 'The real Calgary. Real City services. Your story.', fr: 'Le vrai Calgary. De vrais services municipaux. Votre histoire.', pa: 'ਅਸਲੀ ਕੈਲਗਰੀ। ਅਸਲੀ ਸਿਟੀ ਸੇਵਾਵਾਂ। ਤੁਹਾਡੀ ਕਹਾਣੀ।', ur: 'اصلی کیلگری۔ اصلی سٹی سروسز۔ آپ کی کہانی۔', tl: 'Ang totoong Calgary. Totoong serbisyo ng Lungsod. Ang iyong kuwento.', ar: 'كالغاري الحقيقية. خدمات المدينة الحقيقية. قصتك أنت.' },
  tap: { en: '▶ Tap to start', fr: '▶ Touchez pour commencer', pa: '▶ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਟੈਪ ਕਰੋ', ur: '▶ شروع کرنے کے لیے ٹیپ کریں', tl: '▶ I-tap para magsimula', ar: '▶ انقر للبدء' },
  start: { en: 'Start ▸', fr: 'Commencer ▸', pa: 'ਸ਼ੁਰੂ ਕਰੋ ▸', ur: 'شروع کریں', tl: 'Simulan ▸', ar: 'ابدأ' },
  menu: { en: 'Menu', fr: 'Menu', pa: 'ਮੀਨੂ', ur: 'مینو', tl: 'Menu', ar: 'القائمة' },
  askOk: { en: 'OK', fr: 'OK', pa: 'ਠੀਕ ਹੈ', ur: 'ٹھیک ہے', tl: 'OK', ar: 'موافق' },
  askCancel: { en: 'Cancel', fr: 'Annuler', pa: 'ਰੱਦ ਕਰੋ', ur: 'منسوخ', tl: 'Kanselahin', ar: 'إلغاء' },
  mpName: { en: 'Your name for online play (others will see it):', fr: 'Votre nom pour jouer en ligne (les autres le verront) :', pa: 'ਔਨਲਾਈਨ ਖੇਡਣ ਲਈ ਤੁਹਾਡਾ ਨਾਮ (ਹੋਰ ਇਸਨੂੰ ਦੇਖਣਗੇ):', ur: 'آن لائن کھیلنے کے لیے آپ کا نام (دوسرے اسے دیکھیں گے):', tl: 'Pangalan mo sa online (makikita ng iba):', ar: 'اسمك للعب عبر الإنترنت (سيراه الآخرون):' },
  menuAsk: { en: 'Go back to the main menu? Your mission progress is saved.', fr: 'Retourner au menu principal ? Votre progression est enregistrée.', pa: 'ਮੁੱਖ ਮੀਨੂ ਤੇ ਵਾਪਸ ਜਾਣਾ ਹੈ? ਤੁਹਾਡੀ ਤਰੱਕੀ ਸੇਵ ਹੈ।', ur: 'مین مینو پر واپس جائیں؟ آپ کی پیش رفت محفوظ ہے۔', tl: 'Bumalik sa main menu? Naka-save ang iyong progreso.', ar: 'العودة إلى القائمة الرئيسية؟ تم حفظ تقدمك.' },
  chooseLang: { en: 'Choose your language', fr: 'Choisissez votre langue', pa: 'ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ', ur: 'اپنی زبان منتخب کریں', tl: 'Piliin ang iyong wika', ar: 'اختر لغتك' },
  playAs: { en: 'Play as', fr: 'Jouer en tant que', pa: 'ਕਿਸ ਵਜੋਂ ਖੇਡਣਾ ਹੈ', ur: 'کس کے طور پر کھیلیں', tl: 'Maglaro bilang', ar: 'العب بشخصية' },
  story: { en: 'Start the story', fr: 'Commencer l\'histoire', pa: 'ਕਹਾਣੀ ਸ਼ੁਰੂ ਕਰੋ', ur: 'کہانی شروع کریں', tl: 'Simulan ang kuwento', ar: 'ابدأ القصة' },
  online: { en: '🌐 Play online', fr: '🌐 Jouer en ligne', pa: '🌐 ਔਨਲਾਈਨ ਖੇਡੋ', ur: '🌐 آن لائن کھیلیں', tl: '🌐 Maglaro online', ar: '🌐 العب عبر الإنترنت' },
  free: { en: 'Free roam', fr: 'Exploration libre', pa: 'ਖੁੱਲ੍ਹਾ ਘੁੰਮਣਾ', ur: 'آزادانہ گھومیں', tl: 'Malayang paglalakbay', ar: 'تجوّل حر' },
  back: { en: '◂ Language', fr: '◂ Langue', pa: '◂ ਭਾਸ਼ਾ', ur: 'زبان ▸', tl: '◂ Wika', ar: 'اللغة ▸' },
  loading: { en: 'Loading the city…', fr: 'Chargement de la ville…', pa: 'ਸ਼ਹਿਰ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…', ur: 'شہر لوڈ ہو رہا ہے…', tl: 'Nilo-load ang lungsod…', ar: 'جارٍ تحميل المدينة…' },
  by: { en: 'A game by Hassan Ali', fr: 'Un jeu de Hassan Ali', pa: 'ਹਸਨ ਅਲੀ ਦੀ ਇੱਕ ਗੇਮ', ur: 'حسن علی کا ایک گیم', tl: 'Isang laro ni Hassan Ali', ar: 'لعبة من إعداد حسن علي' },
  mission: { en: 'Mission', fr: 'Mission', pa: 'ਮਿਸ਼ਨ', ur: 'مشن', tl: 'Misyon', ar: 'المهمة' },
  complete: { en: 'Mission complete', fr: 'Mission accomplie', pa: 'ਮਿਸ਼ਨ ਪੂਰਾ', ur: 'مشن مکمل', tl: 'Tapos na ang misyon', ar: 'اكتملت المهمة' },
  next: { en: 'Next mission', fr: 'Prochaine mission', pa: 'ਅਗਲਾ ਮਿਸ਼ਨ', ur: 'اگلا مشن', tl: 'Susunod na misyon', ar: 'المهمة التالية' },
  freeTitle: { en: 'Free roam', fr: 'Exploration libre', pa: 'ਖੁੱਲ੍ਹਾ ਘੁੰਮਣਾ', ur: 'آزادانہ گھومیں', tl: 'Malayang paglalakbay', ar: 'تجوّل حر' },
  freeText: { en: 'Explore the real Calgary. Press M for the map, P for your phone.', fr: 'Explorez le vrai Calgary. M pour la carte, P pour le téléphone.', pa: 'ਅਸਲੀ ਕੈਲਗਰੀ ਘੁੰਮੋ। ਨਕਸ਼ੇ ਲਈ M, ਫ਼ੋਨ ਲਈ P ਦਬਾਓ।', ur: 'اصلی کیلگری دیکھیں۔ نقشے کے لیے M اور فون کے لیے P دبائیں۔', tl: 'Galugarin ang totoong Calgary. M para sa mapa, P para sa telepono.', ar: 'استكشف كالغاري الحقيقية. اضغط M للخريطة وP للهاتف.' },
  langNote: { en: '', fr: '', pa: '', ur: '', tl: '', ar: '' },
  next: { en: 'Next ▸', fr: 'Suivant ▸', pa: 'ਅੱਗੇ ▸', ur: 'آگے', tl: 'Susunod ▸', ar: 'التالي' },
  gotIt: { en: 'Got it', fr: 'Compris', pa: 'ਸਮਝ ਗਏ', ur: 'سمجھ گیا', tl: 'Sige', ar: 'فهمت' },
  quick: { en: 'Quick question', fr: 'Petite question', pa: 'ਛੋਟਾ ਸਵਾਲ', ur: 'ایک سوال', tl: 'Mabilis na tanong', ar: 'سؤال سريع' },
  cont: { en: 'Continue', fr: 'Continuer', pa: 'ਜਾਰੀ ਰੱਖੋ', ur: 'جاری رکھیں', tl: 'Magpatuloy', ar: 'متابعة' },
  source: { en: 'Source', fr: 'Source', pa: 'ਸਰੋਤ', ur: 'ماخذ', tl: 'Pinagmulan', ar: 'المصدر' },
  checked: { en: 'checked Nov 2026', fr: 'vérifié en nov. 2026', pa: 'ਨਵੰਬਰ 2026 ਵਿੱਚ ਜਾਂਚਿਆ', ur: 'نومبر 2026 میں جانچا گیا', tl: 'sinuri noong Nob 2026', ar: 'تم التحقق في نوفمبر 2026' },
  kmAway: { en: '{0} km away', fr: 'à {0} km', pa: '{0} km ਦੂਰ', ur: '{0} km دور', tl: '{0} km ang layo', ar: 'على بعد {0} كم' },
  mAway: { en: '{0} m away', fr: 'à {0} m', pa: '{0} m ਦੂਰ', ur: '{0} m دور', tl: '{0} m ang layo', ar: 'على بعد {0} م' },
  cityService: { en: 'City service', fr: 'Service municipal', pa: 'ਸਿਟੀ ਸੇਵਾ', ur: 'سٹی سروس', tl: 'Serbisyo ng Lungsod', ar: 'خدمة بلدية' },
};
export function tr(key) { const e = S[key]; return e ? (e[LANG.code] ?? e.en) : key; }
export const pick = obj => (obj && typeof obj === 'object' ? (obj[LANG.code] || obj.en) : obj);

// ---------------------------------------------------------------- story and prompt text
// lang/en.json lists every English line of the missions and prompts; lang/<code>.json has the same lines translated
// (tools/extract_strings.mjs and tools/build_lang.py). Lines built with values ({0}, {1}) are matched as patterns.
const PACK = { code: 'en', map: null, pats: [], loading: null };
export function loadLangPack(code = LANG.code) {
  if (code === 'en') { PACK.code = 'en'; PACK.map = null; PACK.pats = []; return Promise.resolve(); }
  if (PACK.code === code && PACK.map) return Promise.resolve();
  return PACK.loading = (async () => {
    try {
      const [en, tl] = await Promise.all([fetch('lang/en.json').then(r => r.json()), fetch(`lang/${code}.json`).then(r => r.json())]);
      const map = new Map(), pats = [];
      en.forEach((s, i) => {
        const t = tl[i]; if (!t || t === s) return;
        if (/\{\d\}/.test(s)) {
          const order = []; const re = new RegExp('^' + s.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d)\\?\}/g, (m, d) => { order.push(+d); return '([\\s\\S]+?)'; }) + '$');
          pats.push({ re, order, t, n: s.length });
        } else map.set(s, t);
      });
      pats.sort((a, b) => b.n - a.n);
      PACK.code = code; PACK.map = map; PACK.pats = pats;
    } catch (e) { console.warn('language pack', code, e); }
  })();
}
export function tx(s) {
  if (s == null || typeof s !== 'string' || !PACK.map || PACK.code !== LANG.code) return s;
  const k = s.trim(), hit = PACK.map.get(k);
  if (hit) return hit;
  for (const p of PACK.pats) {
    const m = p.re.exec(k); if (!m) continue;
    const vals = []; p.order.forEach((d, i) => { vals[d] = m[i + 1]; });
    return p.t.replace(/\{(\d)\}/g, (_, d) => { const v = vals[+d] ?? ''; return PACK.map.get(v) || v; });
  }
  return s;
}
export const rtl = () => dirOfLang() === 'rtl';
loadLangPack();
