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
export function setLang(code) { LANG.code = code; try { localStorage.setItem('yyc-lang', code); } catch (e) { } }
export const dirOfLang = () => (LANGS.find(l => l.code === LANG.code) || LANGS[0]).dir;

const S = {
  presents: { en: 'Calgary Insight presents', fr: 'Calgary Insight présente', pa: 'ਕੈਲਗਰੀ ਇਨਸਾਈਟ ਪੇਸ਼ ਕਰਦਾ ਹੈ', ur: 'کیلگری انسائٹ پیش کرتا ہے', tl: 'Inihahandog ng Calgary Insight', ar: 'كالغاري إنسايت تقدّم' },
  title: { en: 'YYC City Stories', fr: 'YYC Histoires de ville', pa: 'YYC ਸ਼ਹਿਰ ਦੀਆਂ ਕਹਾਣੀਆਂ', ur: 'YYC شہر کی کہانیاں', tl: 'YYC Mga Kuwento ng Lungsod', ar: 'YYC حكايات المدينة' },
  tagline: { en: 'The real Calgary. Real City services. Your story.', fr: 'Le vrai Calgary. De vrais services municipaux. Votre histoire.', pa: 'ਅਸਲੀ ਕੈਲਗਰੀ। ਅਸਲੀ ਸਿਟੀ ਸੇਵਾਵਾਂ। ਤੁਹਾਡੀ ਕਹਾਣੀ।', ur: 'اصلی کیلگری۔ اصلی سٹی سروسز۔ آپ کی کہانی۔', tl: 'Ang totoong Calgary. Totoong serbisyo ng Lungsod. Ang iyong kuwento.', ar: 'كالغاري الحقيقية. خدمات المدينة الحقيقية. قصتك أنت.' },
  tap: { en: 'Tap to begin', fr: 'Touchez pour commencer', pa: 'ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਟੈਪ ਕਰੋ', ur: 'شروع کرنے کے لیے ٹیپ کریں', tl: 'I-tap para magsimula', ar: 'انقر للبدء' },
  chooseLang: { en: 'Choose your language', fr: 'Choisissez votre langue', pa: 'ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ', ur: 'اپنی زبان منتخب کریں', tl: 'Piliin ang iyong wika', ar: 'اختر لغتك' },
  playAs: { en: 'Play as', fr: 'Jouer en tant que', pa: 'ਕਿਸ ਵਜੋਂ ਖੇਡਣਾ ਹੈ', ur: 'کس کے طور پر کھیلیں', tl: 'Maglaro bilang', ar: 'العب بشخصية' },
  story: { en: 'Start the story', fr: 'Commencer l\'histoire', pa: 'ਕਹਾਣੀ ਸ਼ੁਰੂ ਕਰੋ', ur: 'کہانی شروع کریں', tl: 'Simulan ang kuwento', ar: 'ابدأ القصة' },
  free: { en: 'Free roam', fr: 'Exploration libre', pa: 'ਖੁੱਲ੍ਹਾ ਘੁੰਮਣਾ', ur: 'آزادانہ گھومیں', tl: 'Malayang paglalakbay', ar: 'تجوّل حر' },
  back: { en: '◂ Language', fr: '◂ Langue', pa: '◂ ਭਾਸ਼ਾ', ur: 'زبان ▸', tl: '◂ Wika', ar: 'اللغة ▸' },
  loading: { en: 'Loading the city…', fr: 'Chargement de la ville…', pa: 'ਸ਼ਹਿਰ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…', ur: 'شہر لوڈ ہو رہا ہے…', tl: 'Nilo-load ang lungsod…', ar: 'جارٍ تحميل المدينة…' },
  by: { en: 'A game by Hassan Ali', fr: 'Un jeu de Hassan Ali', pa: 'ਹਸਨ ਅਲੀ ਦੀ ਇੱਕ ਗੇਮ', ur: 'حسن علی کا ایک گیم', tl: 'Isang laro ni Hassan Ali', ar: 'لعبة من إعداد حسن علي' },
  mission: { en: 'Mission', fr: 'Mission', pa: 'ਮਿਸ਼ਨ', ur: 'مشن', tl: 'Misyon', ar: 'المهمة' },
  complete: { en: 'Mission complete', fr: 'Mission accomplie', pa: 'ਮਿਸ਼ਨ ਪੂਰਾ', ur: 'مشن مکمل', tl: 'Tapos na ang misyon', ar: 'اكتملت المهمة' },
  next: { en: 'Next mission', fr: 'Prochaine mission', pa: 'ਅਗਲਾ ਮਿਸ਼ਨ', ur: 'اگلا مشن', tl: 'Susunod na misyon', ar: 'المهمة التالية' },
  freeTitle: { en: 'Free roam', fr: 'Exploration libre', pa: 'ਖੁੱਲ੍ਹਾ ਘੁੰਮਣਾ', ur: 'آزادانہ گھومیں', tl: 'Malayang paglalakbay', ar: 'تجوّل حر' },
  freeText: { en: 'Explore the real Calgary. Press M for the map, P for your phone.', fr: 'Explorez le vrai Calgary. M pour la carte, P pour le téléphone.', pa: 'ਅਸਲੀ ਕੈਲਗਰੀ ਘੁੰਮੋ। ਨਕਸ਼ੇ ਲਈ M, ਫ਼ੋਨ ਲਈ P ਦਬਾਓ।', ur: 'اصلی کیلگری دیکھیں۔ نقشے کے لیے M اور فون کے لیے P دبائیں۔', tl: 'Galugarin ang totoong Calgary. M para sa mapa, P para sa telepono.', ar: 'استكشف كالغاري الحقيقية. اضغط M للخريطة وP للهاتف.' },
  langNote: { en: '', fr: 'Les dialogues des missions sont en anglais pour le moment.', pa: 'ਮਿਸ਼ਨਾਂ ਦੀ ਗੱਲਬਾਤ ਅਜੇ ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ ਹੈ।', ur: 'مشنوں کی گفتگو فی الحال انگریزی میں ہے۔', tl: 'Nasa Ingles muna ang mga usapan sa misyon.', ar: 'حوارات المهام باللغة الإنجليزية حاليًا.' },
};
export function tr(key) { const e = S[key]; return e ? (e[LANG.code] ?? e.en) : key; }
export const pick = obj => (obj && typeof obj === 'object' ? (obj[LANG.code] || obj.en) : obj);
