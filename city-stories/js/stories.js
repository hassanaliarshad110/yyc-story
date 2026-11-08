// YYC City Stories: five people, five ways into Calgary. Each story is a list of missions that teach real City services.
// Ali is new to Calgary, Natalia is a student, Chris is a senior and Jean has lived here for years.
import { say, card, quiz, toast, setObjective, setPrompt, found } from './hud.js';
import { appHelp, appShop, randomAddressNear } from './phone.js';
import { businessesNear } from './business.js';
import { SPEED_LIMIT } from './tiles.js';
import { wardAt, communityAt } from './world.js';
import { LANG } from './i18n.js';

// real places used by the stories (metres from City Hall; City of Calgary open data and OpenStreetMap)
export const PLACES = {
  newcomers: { x: 5229.8, y: 1263.4, name: 'Centre for Newcomers, #125 565 36 St NE' },
  registry: { x: 1949.2, y: 5728.1, name: 'McKnight Registry, #118 425 Aviation Rd NE' },
  insurance: { x: -193.7, y: -3841.0, name: 'TD Auto Insurance Centre, 4700 1 Street SE' },
  genesis: { x: 7630.4, y: 8386.4, name: 'Genesis Centre of Community Wellness, 7556 Falconridge Blvd NE' },
  saddleLib: { x: 7732.5, y: 8343.1, name: 'Saddletowne Library, 7556 Falconridge Blvd NE' },
  mandela: { x: 7695.2, y: 8586.5, name: 'Nelson Mandela High School, 45 Saddletowne Circle NE' },
  kerby: { x: -2086.3, y: 181.2, name: 'Kerby Centre, 1133 7 Avenue SW' },
  kerbyHome: { x: -2010, y: 260, name: '7 Avenue SW', real: false },
  saddledome: { x: 428.9, y: -878.0, name: 'Scotiabank Saddledome, 555 Saddledome Rise SE' },
  princesIsland: { x: -862, y: 1062, name: "Prince's Island Park" },
  saddletowneStn: { x: 7696.1, y: 8966.1, name: 'Saddletowne CTrain Station' },
  hotel: { x: -560, y: -128, name: '9 Avenue SW', real: false },
  tower: { x: -352, y: -112, name: 'Calgary Tower, 101 9 Avenue SW' },
  stephenAve: { x: -610, y: -28, name: 'Stephen Avenue (8 Avenue SW)' },
  cityHallStn: { x: 104, y: 16, name: 'City Hall' },
  peaceBridge: { x: -1463, y: 962, name: 'Peace Bridge' },
  centralLib: { x: 213, y: 16, name: 'Central Library, 800 3 Street SE' },
  studioBell: { x: 339, y: -79, name: 'Studio Bell, National Music Centre' },
  fortCalgary: { x: 898, y: -67, name: 'Fort Calgary, 750 9 Avenue SE' },
  stampedePark: { x: 130, y: -697, name: 'Stampede Park' },
};
const SRC = {
  fares: ['Calgary Transit: fares and passes', 'https://www.calgarytransit.com/fares---passes.html'],
  c311: ['City of Calgary: 311', 'https://www.calgary.ca/311'],
  newcomers: ['Centre for Newcomers', 'https://www.centrefornewcomers.ca/'],
  licence: ['Alberta: get a driver\'s licence', 'https://www.alberta.ca/get-drivers-licence'],
  insure: ['Alberta: vehicle insurance', 'https://www.alberta.ca/vehicle-insurance'],
  fair: ['City of Calgary: Fair Entry', 'https://www.calgary.ca/fairentry.html'],
  bully: ['Alberta Bullying Helpline', 'https://www.alberta.ca/bullying-prevention'],
  khp: ['Kids Help Phone', 'https://kidshelpphone.ca/'],
  lib: ['Calgary Public Library', 'https://calgarylibrary.ca/'],
  kerby: ['Kerby Centre', 'https://www.kerbycentre.com/'],
  health: ['Alberta Health Services: Health Link 811', 'https://www.albertahealthservices.ca/healthlink/healthlink.aspx'],
  seniorsPass: ['Calgary Transit: senior passes', 'https://www.calgarytransit.com/fares---passes/passes/senior-yearly-pass.html'],
  carts: ['City of Calgary: what goes where', 'https://www.calgary.ca/waste/what-goes-where/default.html'],
  snow: ['City of Calgary: snow and ice on sidewalks', 'https://www.calgary.ca/roads/roads-maintenance/snow-clearing.html'],
  parking: ['Calgary Parking: MyParking app', 'https://www.calgaryparking.com/'],
  help: ['Calgary Police: vulnerable persons (Alpha House HELP team)', 'https://www.calgary.ca/cps/community-programs-and-resources/vulnerable-persons/vulnerable-persons.html'],
  h211: ['211 Alberta', 'https://ab.211.ca/'],
  edAct: ['Alberta Education Act, section 31', 'https://kings-printer.alberta.ca/documents/Acts/E00P3.pdf'],
  tower: ['Calgary Tower', 'https://www.calgarytower.com/'],
  plus15: ['City of Calgary: Plus 15 network', 'https://www.calgary.ca/bike-walk-roll/plus-15-network.html'],
  ffz: ['Calgary Transit: reviewing the Free Fare Zone', 'https://www.calgarytransit.com/news/reviewing-the-free-fare-zone.html'],
  fares26: ['Calgary Transit: fares changing for 2026', 'https://www.calgarytransit.com/news/calgary-transit-fares-changing-for-2026.html'],
  paths: ['City of Calgary: pathways and trails', 'https://www.calgary.ca/parks/pathways/pathways-in-calgary.html'],
  scoot: ['City of Calgary: shared e-scooters and e-bikes', 'https://www.calgary.ca/scootershare'],
  visit: ['Tourism Calgary', 'https://www.visitcalgary.com/'],
  stampede: ['Calgary Stampede', 'https://www.calgarystampede.com/'],
  parksCanada: ['Parks Canada: Banff National Park', 'https://parks.canada.ca/pn-np/ab/banff'],
};
const IMRAN = 'Imran (friend)', MAYA = 'Maya (best friend)', LINDA = 'Linda (daughter)', PRIYA = 'Priya (neighbour)';
const NAT = 'Natalia', AMIRA = 'Amira (new student)', JORDAN = 'Jordan', PRINCIPAL = 'Ms. Okafor (principal)', BULLY = 'Older student', CLASSMATE = 'Classmate';
const SOFIA = 'Sofia (tour guide)', LEO = 'Leo';
const MAYA_LOOK = { skin: 0x8d5a3b, shirt: 0xe0a020, pants: 0x2a3a5a, hair: 0x15100d, long: true, fem: true, scale: 0.93 };
const KID_LOOK = { skin: 0xc49a76, shirt: 0x58a0d8, pants: 0x34404c, hair: 0x6b4a2a, scale: 0.78, bag: 0x9b2a2a };
const BULLY_LOOKS = [0, 1, 2].map(i => ({ skin: [0xb98260, 0xe0b090, 0x8d5a3b][i], shirt: [0x222222, 0x8a1c1c, 0x2e4a2e][i], pants: 0x23252b, hair: 0x15100d, scale: 0.97 }));
const CLASS_LOOKS = [0, 1, 2].map(i => ({ skin: [0xe0b090, 0x8d5a3b, 0xc49a76][i], shirt: [0xc04a7a, 0x3a7ac0, 0xd0a030][i], pants: 0x2c3040, hair: [0x4a2e1a, 0x15100d, 0x15100d][i], long: i !== 1, fem: i !== 1, scale: 0.9 }));
const T = (en, fr, pa, ur, tl, ar) => ({ en, fr, pa, ur, tl, ar });

// ---------------------------------------------------------------- the characters
export const CHARACTERS = {
  ali: { look: 'ali', name: 'Ali', role: T('New to Calgary', 'Nouvel arrivant à Calgary', 'ਕੈਲਗਰੀ ਵਿੱਚ ਨਵਾਂ', 'کیلگری میں نئے', 'Bagong dating sa Calgary', 'وافد جديد إلى كالغاري'),
    blurb: T('Ali just landed at YYC to start a new life. Find your way around, get your licence, a car and insurance, and meet your new community.', 'Ali vient d\'atterrir à YYC pour commencer une nouvelle vie. Trouvez vos repères, obtenez votre permis, une voiture et une assurance, et rencontrez votre communauté.', 'ਅਲੀ ਨਵੀਂ ਜ਼ਿੰਦਗੀ ਸ਼ੁਰੂ ਕਰਨ ਲਈ YYC ਪਹੁੰਚਿਆ ਹੈ। ਸ਼ਹਿਰ ਨੂੰ ਜਾਣੋ, ਲਾਇਸੈਂਸ, ਕਾਰ ਤੇ ਬੀਮਾ ਲਓ, ਅਤੇ ਆਪਣੀ ਕਮਿਊਨਿਟੀ ਨੂੰ ਮਿਲੋ।', 'علی نئی زندگی شروع کرنے YYC پہنچا ہے۔ شہر کو جانیں، لائسنس، گاڑی اور انشورنس لیں، اور اپنی کمیونٹی سے ملیں۔', 'Kararating lang ni Ali sa YYC para magsimula ng bagong buhay. Kilalanin ang lungsod, kumuha ng lisensya, kotse at insurance, at kilalanin ang bagong komunidad.', 'وصل علي للتو إلى مطار YYC ليبدأ حياة جديدة. تعرّف على المدينة، واحصل على رخصة القيادة وسيارة وتأمين، وتعرّف على مجتمعك الجديد.') },
  natalia: { look: 'natalia', name: 'Natalia', role: T('Student', 'Élève', 'ਵਿਦਿਆਰਥਣ', 'طالبہ', 'Estudyante', 'طالبة'),
    blurb: T('Natalia goes to high school in the northeast. Stand up to bullies, help the younger kids and teach your school how to stop bullying.', 'Natalia va à l\'école secondaire dans le nord-est. Tenez tête aux intimidateurs, aidez les plus jeunes et apprenez à votre école à mettre fin à l\'intimidation.', 'ਨਤਾਲੀਆ ਉੱਤਰ-ਪੂਰਬ ਦੇ ਹਾਈ ਸਕੂਲ ਵਿੱਚ ਪੜ੍ਹਦੀ ਹੈ। ਧੱਕੇਸ਼ਾਹੀ ਕਰਨ ਵਾਲਿਆਂ ਦੇ ਸਾਹਮਣੇ ਡਟੋ, ਛੋਟੇ ਬੱਚਿਆਂ ਦੀ ਮਦਦ ਕਰੋ ਅਤੇ ਸਕੂਲ ਨੂੰ ਧੱਕੇਸ਼ਾਹੀ ਰੋਕਣਾ ਸਿਖਾਓ।', 'نتالیا شمال مشرق کے ہائی اسکول میں پڑھتی ہے۔ دھونس جمانے والوں کے سامنے ڈٹ جائیں، چھوٹے بچوں کی مدد کریں اور اسکول کو بُلیئنگ روکنا سکھائیں۔', 'Nag-aaral si Natalia sa isang high school sa northeast. Harapin ang mga bully, tulungan ang mga nakababata, at turuan ang paaralan kung paano pigilan ang bullying.', 'تدرس ناتاليا في مدرسة ثانوية في الشمال الشرقي. واجهي المتنمّرين، وساعدي الأطفال الأصغر سنًا، وعلّمي مدرستك كيف توقف التنمّر.') },
  chris: { look: 'chris', name: 'Chris', role: T('Senior', 'Aîné', 'ਬਜ਼ੁਰਗ', 'بزرگ شہری', 'Nakatatanda', 'كبير السن'),
    blurb: T('Chris is 72 and lives near downtown. Discover the programs, passes and health services that help Calgary seniors stay active and safe.', 'Chris a 72 ans et vit près du centre-ville. Découvrez les programmes, laissez-passer et services de santé qui aident les aînés de Calgary à rester actifs et en sécurité.', 'ਕ੍ਰਿਸ 72 ਸਾਲਾਂ ਦਾ ਹੈ ਅਤੇ ਡਾਊਨਟਾਊਨ ਨੇੜੇ ਰਹਿੰਦਾ ਹੈ। ਉਹ ਪ੍ਰੋਗਰਾਮ, ਪਾਸ ਅਤੇ ਸਿਹਤ ਸੇਵਾਵਾਂ ਲੱਭੋ ਜੋ ਬਜ਼ੁਰਗਾਂ ਨੂੰ ਸਰਗਰਮ ਅਤੇ ਸੁਰੱਖਿਅਤ ਰੱਖਦੀਆਂ ਹਨ।', 'کرس 72 سال کے ہیں اور ڈاؤن ٹاؤن کے قریب رہتے ہیں۔ وہ پروگرام، پاس اور صحت کی سہولیات دریافت کریں جو بزرگوں کو فعال اور محفوظ رکھتی ہیں۔', 'Si Chris ay 72 taong gulang at nakatira malapit sa downtown. Tuklasin ang mga programa, pass at serbisyong pangkalusugan para sa mga nakatatanda sa Calgary.', 'كريس عمره 72 عامًا ويعيش قرب وسط المدينة. اكتشف البرامج والتصاريح والخدمات الصحية التي تساعد كبار السن في كالغاري على البقاء نشطين وآمنين.') },
  jean: { look: 'jean', name: 'Jean', role: T('Calgary resident', 'Résident de Calgary', 'ਕੈਲਗਰੀ ਦਾ ਵਸਨੀਕ', 'کیلگری کا رہائشی', 'Residente ng Calgary', 'من سكان كالغاري'),
    blurb: T('Jean has lived in Martindale for years. Deliver food from local restaurants, sort your carts, clear your sidewalk and catch the concert at the Saddledome.', 'Jean vit à Martindale depuis des années. Livrez des repas de restaurants du quartier, triez vos bacs, déneigez votre trottoir et allez au concert au Saddledome.', 'ਜੀਨ ਕਈ ਸਾਲਾਂ ਤੋਂ ਮਾਰਟਿੰਡੇਲ ਵਿੱਚ ਰਹਿੰਦਾ ਹੈ। ਸਥਾਨਕ ਰੈਸਟੋਰੈਂਟਾਂ ਤੋਂ ਖਾਣਾ ਪਹੁੰਚਾਓ, ਆਪਣੇ ਕੂੜੇਦਾਨ ਛਾਂਟੋ, ਫੁੱਟਪਾਥ ਸਾਫ਼ ਕਰੋ ਅਤੇ ਸੈਡਲਡੋਮ ਵਿੱਚ ਕੰਸਰਟ ਦੇਖੋ।', 'جین برسوں سے مارٹنڈیل میں رہتے ہیں۔ مقامی ریسٹورنٹس سے کھانا پہنچائیں، کوڑے کے ڈبے درست کریں، فٹ پاتھ صاف کریں اور سیڈل ڈوم میں کنسرٹ دیکھیں۔', 'Matagal nang nakatira si Jean sa Martindale. Maghatid ng pagkain mula sa mga lokal na restawran, ayusin ang mga basurahan, linisin ang bangketa at manood ng konsiyerto sa Saddledome.', 'يعيش جان في مارتنديل منذ سنوات. وصّل الطعام من المطاعم المحلية، ورتّب حاويات النفايات، ونظّف الرصيف من الثلج، واحضر الحفل في السادلدوم.') },
  leo: { look: 'leo', name: 'Leo', role: T('Visitor', 'Touriste', 'ਸੈਲਾਨੀ', 'سیاح', 'Turista', 'سائح'),
    blurb: T('Leo is visiting Calgary for the first time. Explore the sights, learn how to get around, and plan day trips.', 'Leo visite Calgary pour la première fois. Découvrez les attraits, apprenez à vous déplacer et planifiez des excursions.', 'ਲੀਓ ਪਹਿਲੀ ਵਾਰ ਕੈਲਗਰੀ ਘੁੰਮਣ ਆਇਆ ਹੈ। ਮਸ਼ਹੂਰ ਥਾਵਾਂ ਦੇਖੋ, ਆਉਣ-ਜਾਣ ਦਾ ਤਰੀਕਾ ਸਿੱਖੋ ਅਤੇ ਇੱਕ ਦਿਨ ਦੀਆਂ ਸੈਰਾਂ ਦੀ ਯੋਜਨਾ ਬਣਾਓ।', 'لیو پہلی بار کیلگری کی سیر کو آیا ہے۔ مشہور جگہیں دیکھیں، آنے جانے کا طریقہ سیکھیں اور ایک دن کی سیر کی منصوبہ بندی کریں۔', 'Unang beses na bumibisita si Leo sa Calgary. Tuklasin ang mga pasyalan, alamin kung paano lumibot, at magplano ng mga day trip.', 'يزور ليو كالغاري لأول مرة. استكشف المعالم وتعلّم كيف تتنقّل وخطّط لرحلات اليوم الواحد.') },
};

// ---------------------------------------------------------------- helpers
function speedWatch(g, onStrike) {         // speeding and crashes during a road test
  let over = 0, strikes = 0, crashes = 0;
  const prevCrash = g.player.onCrash;
  g.player.onCrash = () => { crashes++; if (prevCrash) prevCrash(); onStrike('crash', crashes); };
  const id = setInterval(() => {
    const p = g.player; if (p.mode !== 'car') return;
    const st = g.tiles.streetAt(p.x, p.y, 25), lim = st ? SPEED_LIMIT[st.kind] : 50;
    if (p.dialKmh > lim + 10) { over += 0.25; if (over > 1.5) { over = 0; strikes++; onStrike('speed', strikes, lim); } } else over = Math.max(0, over - 0.1);
  }, 250);
  return { stop() { clearInterval(id); g.player.onCrash = prevCrash; }, get strikes() { return strikes; }, get crashes() { return crashes; } };
}
const nearRoad = (g, x, y, a, b) => g.findRoadSpot(x, y, a, b) || { x: x + a, y };
// an open patch of ground (no buildings within `clear` metres, away from roads) for a scene with several people
function openSpot(g, x, y, dmin, dmax, clear = 7) {
  const T = g.tiles, pcs = g.traffic ? g.traffic.pieces : [];
  for (let k = 0; k < 220; k++) {
    const r = dmin + (dmax - dmin) * ((k * 0.618034) % 1), a = k * 2.39996, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    let ok = true;
    for (let j = 0; j < 9 && ok; j++) { const qx = px + (j ? Math.cos(j * 0.785) * clear : 0), qy = py + (j ? Math.sin(j * 0.785) * clear : 0); if (T.collide(qx, qy, 0.5).hit) ok = false; }
    if (!ok) continue;
    let near = false;
    for (const p of pcs) { for (const q of p.pts) if (Math.abs(q[0] - px) < 10 && Math.abs(q[1] - py) < 10) { near = true; break; } if (near) break; }
    if (!near) return { x: px, y: py };
  }
  return nearRoad(g, x, y, dmin, dmax);
}

// ---------------------------------------------------------------- Ali: new to Calgary
const ALI = [
  {
    id: 'ali-arrive', title: T('Welcome to YYC', 'Bienvenue à YYC', 'YYC ਵਿੱਚ ਜੀ ਆਇਆਂ ਨੂੰ', 'YYC میں خوش آمدید', 'Maligayang pagdating sa YYC', 'مرحبًا بك في YYC'), startAt: 'airportStop',
    async run(M, g, P) {
      g.player.mode = 'foot'; g.player.place(P.airportStop.x - 14, P.airportStop.y + 10, Math.PI * 0.5); g.camSnap();
      await say(IMRAN, `Ali! Welcome to Calgary, brother! I'm stuck at work, so take the Airport Express bus downtown and I'll meet you there.`);
      await card({ tag: 'Calgary Transit', title: 'Paying for the bus and the CTrain', src: [SRC.fares],
        body: `<ul><li>Adults pay <b>$4.00</b> a ride; a fare is good for <b>90 minutes</b> on buses and the CTrain.</li><li>Pay with the <b>My Fare</b> app (activate the ticket before you board), at a ticket machine at any CTrain station, or with cash on the bus.</li><li>Low income? The City's <b>Fair Entry</b> program includes a sliding-scale monthly transit pass.</li></ul>` });
      await M.goto(P.airportStop, 'Walk to the Airport Express stop at the Domestic Terminal', 10);
      await M.ride('500', P.airportStop, P.downtownStop, 'Route 500 Airport Express');
      M.npc({ skin: 0xa86c48, shirt: 0x2f5f8f, pants: 0x2a2e38, hair: 0x15100d }, g.player.x + 3, g.player.y + 2, Math.PI);
      await say(IMRAN, `There you are! This is downtown. Tomorrow we start your to-do list: newcomer centre, driver's licence, car and insurance. Calgary is going to be good to you.`);
    },
  },
  {
    id: 'ali-newcomers', title: T('The Centre for Newcomers', 'Le Centre for Newcomers', 'ਸੈਂਟਰ ਫ਼ਾਰ ਨਿਊਕਮਰਜ਼', 'سینٹر فار نیوکمرز', 'Ang Centre for Newcomers', 'مركز القادمين الجدد'), startAt: 'newcomers',
    async run(M, g, P) {
      await say(IMRAN, `First stop: the Centre for Newcomers on 36 Street NE. They helped me with everything when I arrived. Take the CTrain to Rundle, drive, or walk!`);
      await M.goto(P.newcomers, 'Go to the Centre for Newcomers (#125 565 36 St NE)', 40);
      await card({ tag: 'Settling in', title: 'Help for newcomers is free', src: [SRC.newcomers, SRC.h211],
        body: `<ul><li>Settlement agencies like the <b>Centre for Newcomers</b> help immigrants and refugees settle in: finding housing, school for the kids, health care, and filling in forms.</li><li>They also run <b>English classes</b> and <b>employment programs</b> to help you find work in your field.</li><li>Not sure where to start? Call or text <b>2-1-1</b> to be connected to newcomer services near you.</li></ul>` });
      const ok = await quiz({ q: 'You just arrived and need English classes and help finding a job. Where can you go?', opts: ['A settlement agency like the Centre for Newcomers', 'The police station', 'Nowhere, it costs too much'], a: 0, explain: 'Settlement agencies offer <b>free</b> settlement help, language classes and employment programs for newcomers.' });
      if (ok) M.earn(5);
    },
  },
  {
    id: 'ali-registry', title: T('Your driver\'s licence', 'Votre permis de conduire', 'ਤੁਹਾਡਾ ਡਰਾਈਵਿੰਗ ਲਾਇਸੈਂਸ', 'آپ کا ڈرائیونگ لائسنس', 'Ang iyong lisensya sa pagmamaneho', 'رخصة القيادة'), startAt: 'registry',
    async run(M, g, P) {
      await say(IMRAN, `In Alberta, driver's licences are done at a registry agent. McKnight Registry is on Aviation Road NE. Let's go!`);
      await M.goto(P.registry, 'Go to McKnight Registry (#118 425 Aviation Rd NE)', 40);
      await card({ tag: 'Alberta registries', title: 'Getting an Alberta driver\'s licence', src: [SRC.licence],
        body: `<ul><li><b>Registry agents</b> handle driver's licences, ID cards and vehicle registration in Alberta.</li><li>If you have a licence from another country, bring it: depending on the country and your experience, you may be able to exchange it, or you'll take the tests.</li><li>New drivers start with a <b>Class 7 learner's licence</b> (a written knowledge test), then pass a <b>road test</b> for a Class 5 licence.</li><li>Bring your ID and immigration documents to the registry.</li></ul>` });
      const ok = await quiz({ q: 'Where do you apply for an Alberta driver\'s licence?', opts: ['A registry agent', 'City Hall', 'The airport'], a: 0, explain: 'Driver\'s licences, ID cards and vehicle registration are done at <b>registry agents</b> across Alberta.' });
      if (ok) M.earn(3);
      await say('Registry clerk', `You passed the knowledge test! Your road test is booked: it starts right here. The examiner will ride with you. Obey the speed limits and drive carefully!`);
    },
  },
  {
    id: 'ali-roadtest', title: T('The road test', 'L\'examen de conduite', 'ਰੋਡ ਟੈਸਟ', 'روڈ ٹیسٹ', 'Ang road test', 'اختبار القيادة'), startAt: 'registry',
    async run(M, g, P) {
      const spot = nearRoad(g, P.registry.x, P.registry.y, 20, 90);
      const car = g.spawnCar(spot.x, spot.y, spot.h, 'family');
      await say('Examiner', `Good morning. Get in the car when you're ready (press F or 🚗). Drive through each checkpoint, keep to the speed limit and don't hit anything. Three mistakes and the test is over.`);
      await M.goto({ x: spot.x, y: spot.y, name: 'the test car', real: false }, 'Get in the test car', 4);
      while (g.player.mode !== 'car') await new Promise(r => setTimeout(r, 300));
      let fails = 0, done = false, failMsg = '';
      const w = speedWatch(g, (kind, n, lim) => {
        if (done) return; fails++;
        toast(kind === 'speed' ? `⚠️ Examiner: "Watch your speed, the limit here is ${lim} km/h." (${fails}/3)` : `⚠️ Examiner: "You hit something!" (${fails}/3)`, 3000);
        if (fails >= 3) failMsg = kind;
      });
      let cp = { x: spot.x, y: spot.y }; let passed = true;
      for (let i = 0; i < 4 && passed; i++) {
        const nx = nearRoad(g, cp.x, cp.y, 260, 420); cp = nx;
        let tm = null;
        await Promise.race([M.goto({ ...nx, name: 'checkpoint ' + (i + 1), real: false }, `Road test: drive to checkpoint ${i + 1} of 4`, 18), new Promise(r => { tm = setInterval(() => { if (fails >= 3) r(); }, 300); })]);
        clearInterval(tm);
        if (fails >= 3) passed = false;
      }
      if (passed) await M.goto({ ...P.registry, real: false }, 'Road test: drive back to the registry', 40);
      done = true; w.stop(); M.clearGoal();
      if (!passed || fails >= 3) { await say('Examiner', `I'm sorry, that's a fail today: ${failMsg === 'speed' ? 'too much speeding' : 'too many collisions'}. Practise and book again. You can retry this mission from the phone.`); throw 'cancel'; }
      M.state.items.push('Class 5 licence'); M.save(); found('🪪 You passed! Alberta Class 5 driver\'s licence');
      await card({ tag: 'Driving in Calgary', title: 'Rules of the road', src: [SRC.licence],
        body: `<ul><li>Residential streets in Calgary are <b>40 km/h</b> unless signed otherwise.</li><li>School and playground zones are slower: watch for the signs.</li><li>Always stop for pedestrians at crosswalks.</li></ul>` });
      if (car) car.parked = true;
    },
  },
  {
    id: 'ali-insurance', title: T('A car and insurance', 'Une voiture et une assurance', 'ਕਾਰ ਅਤੇ ਬੀਮਾ', 'گاڑی اور انشورنس', 'Kotse at insurance', 'سيارة وتأمين'), startAt: 'insurance',
    async run(M, g, P) {
      await say(IMRAN, `Licence done! Before you drive your own car you need insurance. Let's get quotes at TD Auto Insurance Centre on 1 Street SE.`);
      await M.goto(P.insurance, 'Go to TD Auto Insurance Centre (4700 1 Street SE)', 40);
      await card({ tag: 'Alberta', title: 'Insurance first, then registration', src: [SRC.insure],
        body: `<ul><li>In Alberta every vehicle on the road <b>must be insured</b>. Keep your proof of insurance (the "pink card") in the car.</li><li>Then <b>register the vehicle</b> at a registry agent before you drive it.</li><li><b>Shop around</b>: prices differ a lot between companies. Ask about discounts for a clean driving record from another country.</li></ul>` });
      const ok = await quiz({ q: 'You bought a used car. What do you need before you drive it?', opts: ['Insurance and registration', 'Just the keys', 'A parking pass'], a: 0, explain: 'Get <b>insurance</b> first, then <b>register</b> the vehicle at a registry agent.' });
      if (ok) M.earn(5);
      M.state.items.push('Car insurance'); M.save(); toast('📄 Insured and registered!');
    },
  },
  {
    id: 'ali-community', title: T('Meet your community', 'Rencontrez votre communauté', 'ਆਪਣੀ ਕਮਿਊਨਿਟੀ ਨੂੰ ਮਿਲੋ', 'اپنی کمیونٹی سے ملیں', 'Kilalanin ang iyong komunidad', 'تعرّف على مجتمعك'), startAt: 'genesis',
    async run(M, g, P) {
      await say(IMRAN, `Your new place is in Martindale. The Genesis Centre in Saddletowne has a gym, a library, a YMCA and community programs. Let's check it out.`);
      await M.goto(P.genesis, 'Go to the Genesis Centre (7556 Falconridge Blvd NE)', 50);
      await card({ tag: 'Your community', title: 'Getting to know the northeast', src: [SRC.fair, SRC.lib],
        body: `<ul><li>Calgary has more than <b>150 community associations</b> run by volunteers: they host events, sports, and community halls.</li><li>The <b>Saddletowne Library</b> inside the Genesis Centre has free programs, English conversation groups and Wi-Fi.</li><li>On a low income? <b>Fair Entry</b> gives discounts on City recreation and transit with one application.</li></ul>` });
      await say(IMRAN, `See? You're not alone here. Now let's ride the CTrain so you know how to get downtown.`);
    },
  },
  {
    id: 'ali-transit', title: T('Ride the Blue Line', 'Prenez la ligne bleue', 'ਬਲੂ ਲਾਈਨ ਦੀ ਸਵਾਰੀ', 'بلیو لائن کا سفر', 'Sumakay sa Blue Line', 'استقل الخط الأزرق'), startAt: 'saddletowneStn',
    async run(M, g, P) {
      await M.goto(P.saddletowneStn, 'Walk to Saddletowne CTrain Station', 30);
      await card({ tag: 'CTrain', title: 'Calgary\'s two CTrain lines', src: [SRC.fares],
        body: `<ul><li>The <b>Blue Line</b> runs from Saddletowne in the northeast through downtown to 69 Street in the west. The <b>Red Line</b> runs from Tuscany to Somerset-Bridlewood.</li><li>Both lines share 7th Avenue downtown, where riding between downtown stations is free.</li><li>Use the <b>Go to address</b> and <b>Transit</b> apps on your phone to plan trips.</li></ul>` });
      await M.ride('202', P.saddletowneStn, P.cityHallStation, 'Blue Line CTrain');
      await card({ tag: 'The end of Ali\'s story', title: 'Welcome home, Ali!', body: `<p>You got settlement help, an Alberta licence, insurance, met your community and learned the CTrain. Keep exploring the real Calgary!</p><p style="margin-top:14px"><b>YYC City Stories — a game by Hassan Ali</b></p>` });
    },
  },
];

// ---------------------------------------------------------------- Natalia: student
const NATALIA = [
  {
    id: 'nat-school', title: T('First day at school', 'Premier jour d\'école', 'ਸਕੂਲ ਦਾ ਪਹਿਲਾ ਦਿਨ', 'اسکول کا پہلا دن', 'Unang araw sa paaralan', 'اليوم الأول في المدرسة'), startAt: 'saddletowneStn',
    async run(M, g, P) {
      M.npc(MAYA_LOOK, P.saddletowneStn.x + 3, P.saddletowneStn.y - 2, 0);
      await say(MAYA, `Natalia! New semester at Nelson Mandela High! Walk with me, it's just south of the station.`);
      await M.goto(P.mandela, 'Walk to Nelson Mandela High School', 45);
      await card({ tag: 'Getting around as a student', title: 'Youth on transit', src: [SRC.fares],
        body: `<ul><li>Youth (13 to 17) pay a lower fare on Calgary Transit, and there are monthly <b>youth passes</b>.</li><li>Kids 12 and under ride free.</li><li>The <b>Saddletowne Library</b> next door is free for students: homework help, study rooms and Wi-Fi.</li></ul>` });
    },
  },
  {
    id: 'nat-stand', title: T('Stand up to the bullies', 'Tenir tête aux intimidateurs', 'ਧੱਕੇਸ਼ਾਹੀ ਦੇ ਖ਼ਿਲਾਫ਼ ਡਟੋ', 'دھونس کے خلاف ڈٹ جاؤ', 'Harapin ang mga bully', 'واجهي المتنمّرين'), startAt: 'mandela',
    async run(M, g, P) {
      const s = openSpot(g, P.mandela.x, P.mandela.y, 50, 150);
      const kid = M.actor(KID_LOOK, s.x, s.y, 0);
      const bl = [[2.2, 1.6], [-2.1, 1.3], [0.6, 2.6]];
      const bullies = bl.map(([dx, dy], i) => M.actor(BULLY_LOOKS[i], s.x + dx, s.y + dy, Math.atan2(-dx, -dy)));
      bullies.forEach((b, i) => M.pose(b, i === 1 ? { wave: true } : { talk: true }));
      await say(MAYA, `Natalia, look over there! Those older kids are pushing a Grade 7 kid around and taking his stuff.`);
      await M.goto({ x: s.x, y: s.y - 4, name: 'the younger kid', real: false }, 'Go and help the younger kid', 5);
      const a1 = await quiz({ q: 'The bullies laugh at you. What do you do first?', opts: ['Shove them as hard as you can', 'Stand next to the kid, stay calm and say firmly: "Stop. Leave him alone."', 'Walk away and pretend you didn\'t see', 'Film it to post online'], a: 1,
        explain: 'Standing <b>next to</b> the person being bullied and speaking up <b>calmly and firmly</b> takes the bully\'s audience away. Fighting can get you or the kid hurt.' });
      const a2 = await quiz({ q: 'What do you say to the bullies?', opts: ['"You\'re all losers!"', '"This isn\'t funny. Leave him alone, or we\'re telling a teacher."', 'Nothing, just stare at them'], a: 1, explain: 'Short, calm and clear. Don\'t insult them: that turns it into a fight.' });
      const a3 = await quiz({ q: 'One bully steps closer to you. Now what?', opts: ['Take the kid and walk away together, toward teachers', 'Start a fight', 'Insult him back'], a: 0, explain: 'Get yourself and the kid <b>to safety</b> and to adults who can help.' });
      const good = a1 && a2 && a3;
      // the scene plays out
      M.cineStart();
      const p = g.player, bx = s.x + 0.2, by = s.y + 1.2;
      M.cam(s.x + 7, s.y - 5, 2.4, s.x, s.y + 0.8, 1.2);
      bullies.forEach(b => M.pose(b, null));
      if (!good) await M.line(null, MAYA, `Wait, Natalia! Fighting back or insulting them makes it worse. Watch: stay calm, stand next to him and speak up.`);
      await M.walk(p, s.x + 0.4, s.y + 0.7, 1.6); M.face(p, s.x + 0.6, s.y + 2.4);
      await M.line(p, NAT, `Hey. Stop. This isn't funny, and you know it.`);
      await M.line(bullies[0], BULLY, `Relax. We're just joking around.`);
      M.cam(s.x - 4, s.y + 6, 2.0, bx, by, 1.3);
      await M.line(p, NAT, `A joke is when everyone is laughing. He isn't laughing.`);
      await M.line(p, NAT, `Pushing someone and taking his stuff is bullying. And everyone watching knows it.`);
      await M.line(bullies[1], BULLY, `So what are you going to do about it?`);
      await M.line(p, NAT, `I'm walking him to the office, and we're telling a teacher. You can come and explain, or you can leave him alone. Your choice.`);
      bullies.forEach((b, i) => M.walk(b, s.x + 30 + i * 3, s.y + 25 + i * 2, 1.5));
      await M.line(bullies[2], BULLY, `Whatever. Let's go.`);
      M.cam(s.x + 3.5, s.y - 3.5, 1.7, s.x, s.y + 0.3, 1.2);
      M.face(p, s.x, s.y); M.face(kid, p.x, p.y);
      await M.line(p, NAT, `You okay? You didn't do anything wrong. Come on, let's go together.`);
      await M.line(kid, 'Kid', `Th-thanks. They do this every day. I didn't know what to do.`);
      M.walk(kid, s.x - 6, s.y - 10, 1.2); await M.walk(p, s.x - 5, s.y - 9, 1.2);
      M.cineEnd();
      found(good ? '💪 You stood up the smart way! The bullies backed off.' : 'The bullies left, but think about the safest choice next time.');
      if (good) M.earn(5);
      await card({ tag: 'Bullying', title: 'You don\'t have to handle it alone', src: [SRC.bully, SRC.khp],
        body: `<ul><li>Tell a <b>trusted adult</b>: a teacher, counsellor, coach or parent. Schools must act on bullying.</li><li><b>Alberta Bullying Helpline</b>: 1-888-456-2323, 24/7, in many languages.</li><li><b>Kids Help Phone</b>: call 1-800-668-6868 or text CONNECT to 686868, any time.</li><li>If someone is in danger, call <b>9-1-1</b>.</li></ul>` });
    },
  },
  {
    id: 'nat-lunch', title: T('Nobody eats alone', 'Personne ne mange seul', 'ਕੋਈ ਇਕੱਲਾ ਨਹੀਂ ਖਾਂਦਾ', 'کوئی اکیلا نہیں کھاتا', 'Walang kumakaing mag-isa', 'لا أحد يأكل وحده'), startAt: 'mandela',
    async run(M, g, P) {
      const s = openSpot(g, P.mandela.x, P.mandela.y, 40, 160);
      const maya = M.actor(MAYA_LOOK, s.x - 9, s.y - 6, 0.5);
      const amira = M.actor({ skin: 0xc8956a, shirt: 0x2f6f8f, pants: 0x2a2e3c, hijab: 0x6a2a4a, fem: true, sleeve: 1, scale: 0.92 }, s.x, s.y, Math.PI);
      const grp = [[7, 3], [8.2, 4.4], [6.4, 4.8]].map(([dx, dy], i) => M.actor(CLASS_LOOKS[i], s.x + dx, s.y + dy, Math.atan2(-dx, -dy) + 0.6));
      grp.forEach(c => M.pose(c, { talk: true }));
      await say(MAYA, `See the new girl by herself? That's Amira. She eats lunch alone every day, and that group keeps whispering about her.`);
      await M.goto({ x: s.x - 3, y: s.y - 3, name: 'Amira', real: false }, 'Go over to Amira', 5);
      const a1 = await quiz({ q: 'Amira is alone again, and some kids whisper about her clothes. What do you do?', opts: ['Invite her to eat with you and Maya', 'Ignore it, it\'s not your business', 'Laugh along so they like you'], a: 0, explain: 'Leaving someone out on purpose is bullying too. One invitation can change someone\'s whole year.' });
      const a2 = await quiz({ q: 'A friend says: "If she sits with us, people will laugh at us too." You say…', opts: ['"Then let them. Being kind is never embarrassing."', '"You\'re right, forget it."'], a: 0, explain: 'Kindness is contagious. When one person goes first, others usually follow.' });
      M.cineStart();
      const p = g.player;
      grp.forEach(c => M.pose(c, null));
      M.cam(s.x - 6, s.y - 6, 2.0, s.x, s.y, 1.3);
      M.walk(maya, s.x - 1.6, s.y - 1.2, 1.4); await M.walk(p, s.x - 0.8, s.y - 1.7, 1.4);
      M.face(p, s.x, s.y); M.face(maya, s.x, s.y); M.face(amira, p.x, p.y);
      await M.line(p, NAT, `Hi! I'm Natalia, and this is Maya. Do you want to eat lunch with us?`);
      await M.line(amira, AMIRA, `Really? I just moved here from Syria. My English isn't very good yet.`);
      await M.line(p, NAT, `Your English is great. And you speak two languages. That's one more than me!`);
      M.pose(amira, { wave: true }); await M.wait(900); M.pose(amira, null);
      M.cam(s.x + 2, s.y - 2, 2.2, s.x + 7, s.y + 4, 1.2);
      await M.walk(p, s.x + 5.2, s.y + 2.2, 1.5); M.face(p, s.x + 7, s.y + 4); grp.forEach(c => M.face(c, p.x, p.y));
      await M.line(p, NAT, `I heard what you were saying about her clothes.`);
      await M.line(p, NAT, `Leaving someone out on purpose, or making fun of where they're from or what they wear, is bullying too.`);
      await M.line(grp[0], CLASSMATE, `We didn't mean anything by it.`);
      await M.line(p, NAT, `Everyone here was new once. Let's make her first week a good one. Come and sit with us.`);
      await M.line(grp[1], CLASSMATE, `Okay... you're right. Sorry.`);
      M.cam(s.x - 5, s.y + 5, 2.3, s.x + 1, s.y, 1.2);
      grp.forEach((c, i) => M.walk(c, s.x + 1.8 + i * 0.9, s.y + 1.4 - i * 0.6, 1.3));
      await M.walk(p, s.x - 0.4, s.y - 1.9, 1.5);
      grp.forEach(c => M.face(c, s.x, s.y));
      await M.line(grp[2], CLASSMATE, `Hi Amira. Want to sit with us?`);
      M.pose(amira, { wave: true });
      await M.line(amira, AMIRA, `Thank you. This is the best day since I came to Calgary.`);
      M.cineEnd();
      found(a1 && a2 ? '🤝 Nobody eats alone at this school now!' : 'Amira has friends now. Next time, be the first to say hello.');
      if (a1 && a2) M.earn(4);
      await card({ tag: 'Bullying', title: 'Leaving people out is bullying too', src: [SRC.bully, SRC.newcomers],
        body: `<ul><li><b>Social bullying</b> means leaving someone out on purpose, spreading rumours or making fun of someone's culture, religion, language or clothes.</li><li>Be the first to say hello. Invite someone new to sit with you or join your group.</li><li>Many Calgary schools have <b>settlement workers</b> who help newcomer students and their families.</li><li>The <b>Alberta Bullying Helpline</b> (1-888-456-2323) helps in many languages, 24/7.</li></ul>` });
    },
  },
  {
    id: 'nat-chat', title: T('The group chat', 'Le clavardage de groupe', 'ਗਰੁੱਪ ਚੈਟ', 'گروپ چیٹ', 'Ang group chat', 'الدردشة الجماعية'), startAt: 'saddletowneStn',
    async run(M, g, P) {
      M.npc(MAYA_LOOK, P.saddletowneStn.x + 3, P.saddletowneStn.y - 2, 0);
      await say(MAYA, `Natalia, did you see the class group chat? Someone posted an edited photo of Jordan, and everyone's laughing at it.`);
      const a1 = await quiz({ q: 'What do you do with the photo?', opts: ['Don\'t share it. Take a screenshot as proof and report the post', 'Share it, it\'s funny', 'Reply with a laughing emoji'], a: 0, explain: 'Every share hurts Jordan again. Keep proof, and report the post in the app.' });
      const a2 = await quiz({ q: 'What do you write in the group chat?', opts: ['"This isn\'t okay. Please delete it."', 'Nothing', '"lol"'], a: 0, explain: 'One clear message can stop a pile-on. You don\'t need to argue: say it once, then tell an adult.' });
      const a3 = await quiz({ q: 'Who should you tell?', opts: ['A teacher or another trusted adult', 'Nobody. It\'s only online'], a: 0, explain: 'In Alberta, students must report bullying, even when it happens online.' });
      await M.goto(P.mandela, 'Go to school and find Jordan', 45);
      const s = openSpot(g, P.mandela.x, P.mandela.y, 40, 160);
      const jordan = M.actor({ skin: 0xe0b090, shirt: 0x3a6a3a, pants: 0x2a2e38, hair: 0x6b4a2a, scale: 0.93 }, s.x + 9, s.y - 3, Math.PI * 0.8);
      const grp = [[0, 3], [1.4, 4], [-1.3, 4.2], [0.2, 5.3]].map(([dx, dy], i) => M.actor(CLASS_LOOKS[i % 3], s.x + dx, s.y + dy, Math.atan2(-dx, -dy) + (i % 2 ? 0.8 : -0.8)));
      grp.forEach(c => M.pose(c, { talk: true }));
      const p = g.player;
      M.cineStart(); grp.forEach(c => M.pose(c, null));
      M.cam(s.x - 5, s.y - 4, 2.2, s.x, s.y + 3, 1.2);
      await M.walk(p, s.x, s.y + 1.2, 1.5); M.face(p, s.x, s.y + 4); grp.forEach(c => M.face(c, p.x, p.y));
      await M.line(p, NAT, `Hey. About that photo of Jordan in the group chat.`);
      await M.line(grp[0], CLASSMATE, `It was just a joke. Everyone was posting.`);
      await M.line(p, NAT, `Everyone posting is exactly why it hurts. One click, and the whole school saw it.`);
      M.cam(s.x + 4, s.y - 2, 1.8, s.x, s.y + 1.5, 1.4);
      await M.line(p, NAT, `Online bullying is still bullying. In Alberta, students have to report bullying, even when it happens online.`);
      await M.line(p, NAT, `I told our teacher, and the post is being taken down. Can you delete what you shared?`);
      await M.line(grp[1], CLASSMATE, `Yeah... you're right. I'm deleting it now.`);
      M.cam(s.x + 4, s.y - 7, 2.0, s.x + 8, s.y - 3, 1.2);
      await M.walk(p, s.x + 7.6, s.y - 1.8, 1.5); M.face(p, jordan.x, jordan.y); M.face(jordan, p.x, p.y);
      await M.line(p, NAT, `Jordan, I'm sorry that happened. You didn't deserve it. We've got your back.`);
      await M.line(jordan, JORDAN, `Thanks, Natalia. I thought nobody cared.`);
      M.cineEnd();
      const good = a1 && a2 && a3;
      found(good ? '📵 You stopped the pile-on!' : 'The post came down, but remember: don\'t share, keep proof, report, tell.');
      if (good) M.earn(4);
      await card({ tag: 'Cyberbullying', title: 'Online is still real life', src: [SRC.edAct, SRC.khp],
        body: `<ul><li>Alberta's Education Act says students must <b>refrain from, report and not tolerate bullying</b>, including bullying <b>by electronic means</b>, even outside school hours.</li><li><b>Don't reply, save the proof, block, report, tell</b> a trusted adult.</li><li>Sharing intimate images of someone without their consent is a <b>crime</b> in Canada. Tell an adult and contact police.</li><li><b>Kids Help Phone</b>: 1-800-668-6868 or text CONNECT to 686868.</li></ul>` });
    },
  },
  {
    id: 'nat-teach', title: T('Teach the younger kids', 'Enseigner aux plus jeunes', 'ਛੋਟੇ ਬੱਚਿਆਂ ਨੂੰ ਸਿਖਾਓ', 'چھوٹے بچوں کو سکھاؤ', 'Turuan ang mga nakababata', 'علّمي الأطفال الأصغر'), startAt: 'mandela',
    async run(M, g, P) {
      await say(MAYA, `The principal wants us to visit the younger kids around the school and share what we know about bullying. Three groups are waiting!`);
      const lessons = [
        { q: 'Kid: "Someone keeps calling my friend names. I\'m just watching. Is that okay?"', opts: ['Bystanders can help: stand with your friend and tell an adult', 'Yes, it\'s not your problem'], a: 0, explain: 'Bystanders have power: most bullying stops within seconds when someone steps in or gets help.' },
        { q: 'Kid: "Someone keeps sending me mean messages online."', opts: ['Don\'t reply, take screenshots, block and report them, and tell an adult', 'Send mean messages back', 'Delete everything and tell no one'], a: 0, explain: '<b>Don\'t reply, save the proof, block, report, tell</b>. Cyberbullying is still bullying.' },
        { q: 'Kid: "What if I\'m scared to tell a teacher?"', opts: ['Call or text Kids Help Phone, or the Alberta Bullying Helpline', 'Keep it to yourself forever'], a: 0, explain: 'Kids Help Phone (1-800-668-6868, text CONNECT to 686868) and the Alberta Bullying Helpline (1-888-456-2323) are free and confidential.' },
      ];
      for (let i = 0; i < 3; i++) {
        const s = nearRoad(g, P.mandela.x, P.mandela.y, 80 + i * 70, 200 + i * 80);
        const n = M.npc({ skin: [0xc49a76, 0x8d5a3b, 0xe0b090][i], shirt: [0xd04a8a, 0x2a8a5a, 0x5a4ad0][i], pants: 0x34404c, hair: 0x15100d, scale: 0.75, long: i === 0, fem: i === 0 }, s.x, s.y, 0);
        await M.goto({ x: s.x, y: s.y, name: 'group ' + (i + 1), real: false }, `Talk to group ${i + 1} of 3`, 5);
        const ok = await quiz(lessons[i]); if (ok) M.earn(2);
        n.visible = false;
      }
      found('🏅 Anti-bullying champion!');
    },
  },
  {
    id: 'nat-assembly', title: T('Speak up at the assembly', 'Prendre la parole à l\'assemblée', 'ਸਭਾ ਵਿੱਚ ਆਵਾਜ਼ ਉਠਾਓ', 'اسمبلی میں آواز اٹھاؤ', 'Magsalita sa assembly', 'تحدّثي في التجمّع المدرسي'), startAt: 'mandela',
    async run(M, g, P) {
      await say(MAYA, `Natalia! The principal asked you to speak at the anti-bullying assembly. Everyone is outside waiting for you!`);
      const s = openSpot(g, P.mandela.x, P.mandela.y, 40, 170, 10);
      const principal = M.actor({ skin: 0x6b4430, shirt: 0x7a2a3a, pants: 0x2a2a30, hair: 0x15100d, long: true, fem: true }, s.x - 2.2, s.y + 0.4, Math.PI);
      const crowd = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
        const x = s.x - 4 + c * 2 + (r % 2) * 0.6, y = s.y - 5 - r * 1.8, i = r * 5 + c;
        const look = i === 2 ? { skin: 0xc8956a, shirt: 0x2f6f8f, pants: 0x2a2e3c, hijab: 0x6a2a4a, fem: true, sleeve: 1, scale: 0.92 } : i === 7 ? { skin: 0xe0b090, shirt: 0x3a6a3a, pants: 0x2a2e38, hair: 0x6b4a2a, scale: 0.93 } : i === 4 ? KID_LOOK : { ...CLASS_LOOKS[i % 3], shirt: [0x2a5a9a, 0xb04a2a, 0x2a8a6a, 0x8a2a8a, 0xc0a020][i % 5], scale: 0.86 + (i % 4) * 0.03 };
        crowd.push(M.actor(look, x, y, 0));
      }
      await M.goto({ x: s.x, y: s.y + 0.8, name: 'the assembly', real: false }, 'Walk up to the front of the assembly', 4);
      const a1 = await quiz({ q: 'How do you want to start your speech?', opts: ['With what we really saw at school this term', 'By naming and shaming the bullies', 'By telling everyone they are bad people'], a: 0, explain: 'Real stories make people listen. Shaming people makes them defensive, and it\'s bullying too.' });
      const a2 = await quiz({ q: 'What is the most important thing for the crowd to remember?', opts: ['Bullies need an audience: stand with the person, speak up and tell an adult', 'Fight back hard so they never try again', 'Stay out of it'], a: 0, explain: 'Most bullying happens in front of others. When bystanders act, it usually stops.' });
      const p = g.player;
      M.cineStart();
      M.walk(p, s.x, s.y, 1.2).then(() => M.face(p, s.x, s.y - 10)); M.face(principal, s.x, s.y - 10);
      M.cam(s.x + 1.5, s.y - 11, 2.6, s.x, s.y - 2, 1.4);
      await M.line(principal, PRINCIPAL, `Students, please welcome Natalia from Grade 10.`);
      crowd.forEach(c => M.pose(c, { wave: true })); await M.wait(1500); crowd.forEach(c => M.pose(c, null));
      M.face(principal, s.x, s.y);
      M.cam(s.x - 2.5, s.y - 4.5, 1.7, s.x, s.y, 1.45);
      await M.line(p, NAT, `Hi everyone. This term I saw a Grade 7 kid pushed around, a new student eating lunch alone, and a photo that went around our group chat.`);
      await M.line(p, NAT, `Every time, lots of people saw it. And most of us did nothing. I used to be one of them.`);
      M.cam(s.x + 5, s.y - 8, 3.2, s.x - 1, s.y - 2, 1.2);
      await M.line(p, NAT, `Here's what I learned. Bullies need an audience. When we stop laughing and stand next to the person instead, it usually stops.`);
      await M.line(p, NAT, `You don't have to fight. Stay calm, say "Stop," get the person to safety, and tell an adult.`);
      M.cam(s.x - 1.5, s.y - 3.2, 1.6, s.x, s.y, 1.5);
      await M.line(p, NAT, `If it happens online: don't reply, save the proof, block, report, and tell someone.`);
      await M.line(p, NAT, `And if you're the one being bullied: it's not your fault. You can call Kids Help Phone any time, day or night.`);
      M.cam(s.x, s.y + 5, 3.6, s.x, s.y - 6, 0.9);
      await M.line(p, NAT, `Let's make this a school where nobody walks alone. Who's with me?`);
      crowd.forEach(c => M.pose(c, { wave: true }));
      await M.line(crowd[1], 'Students', `We're with you!`);
      await M.line(crowd[2], AMIRA, `Me too!`);
      await M.line(crowd[7], JORDAN, `Me too!`);
      crowd.forEach(c => M.pose(c, null));
      M.cam(s.x + 3, s.y - 3, 1.8, s.x - 1, s.y + 0.2, 1.4); M.face(principal, p.x, p.y); M.face(p, principal.x, principal.y);
      await M.line(principal, PRINCIPAL, `Thank you, Natalia. That took real courage.`);
      M.cineEnd();
      if (a1 && a2) M.earn(6);
      found('🎤 The whole school heard you!');
      await card({ tag: 'The end of Natalia\'s story (for now)', title: 'A school where everyone belongs', body: `<p>You stood up to bullies safely, helped a new student feel welcome, stopped an online pile-on, taught younger kids what to do and spoke up in front of the whole school. Keep looking out for each other!</p><p style="margin-top:14px"><b>YYC City Stories — a game by Hassan Ali</b></p>` });
    },
  },
];

// ---------------------------------------------------------------- Chris: senior
const CHRIS = [
  {
    id: 'chris-kerby', title: T('The Kerby Centre', 'Le Kerby Centre', 'ਕਰਬੀ ਸੈਂਟਰ', 'کربی سینٹر', 'Ang Kerby Centre', 'مركز كيربي'), startAt: 'kerbyHome',
    async run(M, g, P) {
      await say(LINDA, `Dad, you've been home alone too much since you retired. The Kerby Centre is right on 7 Avenue. Will you go and see what they offer? For me?`);
      await M.goto(P.kerby, 'Walk to the Kerby Centre (1133 7 Avenue SW)', 35);
      await card({ tag: 'Seniors', title: 'A centre for older adults', src: [SRC.kerby],
        body: `<ul><li>The <b>Kerby Centre</b> serves older adults with activities, fitness and learning programs, meals and help finding the right services.</li><li>Seniors' centres across Calgary run social clubs, exercise classes and day trips: a great way to stay connected.</li><li>Feeling lonely or need to talk? <b>Distress Centre Calgary</b> answers 24/7 at 403-266-4357.</li></ul>` });
      await say(LINDA, `Tai chi on Tuesdays? I'm signing you up!`);
    },
  },
  {
    id: 'chris-transit', title: T('A senior transit pass', 'Laissez-passer aîné', 'ਬਜ਼ੁਰਗ ਟ੍ਰਾਂਜ਼ਿਟ ਪਾਸ', 'بزرگوں کا ٹرانزٹ پاس', 'Senior transit pass', 'تصريح النقل لكبار السن'), startAt: 'kerby',
    async run(M, g, P) {
      await say(LINDA, `You don't need to drive downtown anymore. Seniors can get a yearly transit pass. Let's walk to the 7 Avenue CTrain platform and ride to City Hall.`);
      await M.goto(P.cityHallStation, 'Ride or walk east along 7 Avenue to City Hall Station', 40);
      await card({ tag: 'Calgary Transit', title: 'Passes for seniors', src: [SRC.seniorsPass, SRC.fair],
        body: `<ul><li>Calgarians <b>65 and older</b> can buy a <b>Senior Yearly Pass</b> for unlimited rides on buses and the CTrain.</li><li>Seniors with a <b>low income</b> pay much less: apply through <b>Fair Entry</b>.</li><li>Need door-to-door help? <b>Calgary Transit Access</b> serves people who can't use regular transit.</li></ul>` });
      const ok = await quiz({ q: 'Chris is 72 with a low income. How can he save on transit?', opts: ['A low-income Senior Yearly Pass through Fair Entry', 'Pay cash every ride', 'Seniors can\'t ride transit'], a: 0, explain: 'Seniors 65+ can buy a yearly pass; with a low income it costs much less through <b>Fair Entry</b>.' });
      if (ok) M.earn(3);
    },
  },
  {
    id: 'chris-health', title: T('Stay healthy', 'Rester en santé', 'ਸਿਹਤਮੰਦ ਰਹੋ', 'صحت مند رہیں', 'Manatiling malusog', 'ابقَ بصحة جيدة'), startAt: 'princesIsland',
    async run(M, g, P) {
      await say(LINDA, `Your doctor said walk every day. Prince's Island Park is flat and beautiful. Let's go!`);
      await M.goto(P.princesIsland, "Walk to Prince's Island Park", 70);
      await card({ tag: 'Health', title: 'Help with health questions, 24/7', src: [SRC.health],
        body: `<ul><li>Not sure if you need a doctor? Call <b>Health Link at 8-1-1</b> any time to talk to a registered nurse, for free.</li><li>The <b>flu shot</b> and COVID-19 vaccines are free in Alberta; many pharmacies give them.</li><li>Ask your pharmacist to review all your medicines once a year.</li><li>In an emergency like chest pain or a stroke, call <b>9-1-1</b>.</li></ul>` });
      const ok = await quiz({ q: 'Chris has a cough and a fever at 2 a.m. and isn\'t sure what to do. Who can he call?', opts: ['Health Link at 8-1-1', '3-1-1', 'Nobody until morning'], a: 0, explain: '<b>8-1-1 Health Link</b> has nurses 24/7. If it is a life-threatening emergency, call 9-1-1.' });
      if (ok) M.earn(3);
    },
  },
  {
    id: 'chris-scam', title: T('Don\'t get scammed', 'Évitez les arnaques', 'ਠੱਗੀ ਤੋਂ ਬਚੋ', 'دھوکہ دہی سے بچیں', 'Iwasan ang scam', 'احذر الاحتيال'), startAt: 'kerbyHome',
    async run(M, g, P) {
      await say('Phone call', `"Hello grandpa, it's me! I'm in jail and I need $2,000 in gift cards right now. Don't tell mom!"`);
      const ok = await quiz({ q: 'What should Chris do?', opts: ['Hang up and call the family member or Linda on a number he knows', 'Buy the gift cards quickly', 'Give his banking details'], a: 0,
        explain: 'This is the <b>"grandparent scam"</b>. Real police and courts never ask for gift cards. Hang up, check with family, and report it to the Calgary Police non-emergency line, 403-266-1234.' });
      if (ok) M.earn(5);
      await card({ tag: 'Staying safe', title: 'Common scams', src: [['Calgary Police: frauds and scams', 'https://www.calgary.ca/cps/community-programs-and-resources/crime-prevention/frauds-and-scams.html']],
        body: `<ul><li>Never pay with <b>gift cards</b> or crypto because someone on the phone says so.</li><li>Government agencies won't threaten you with arrest over the phone.</li><li>Report scams to the Calgary Police non-emergency line: <b>403-266-1234</b>.</li></ul>` });
      await card({ tag: 'The end of Chris\'s story', title: 'Active, healthy and connected', body: `<p>Chris found a seniors' centre, a transit pass, health help and how to spot scams. Calgary is a great city to grow older in!</p><p style="margin-top:14px"><b>YYC City Stories — a game by Hassan Ali</b></p>` });
    },
  },
];

// ---------------------------------------------------------------- Jean: resident
const JEAN = [
  {
    id: 'jean-delivery', title: T('Food delivery shift', 'Quart de livraison', 'ਖਾਣਾ ਡਿਲੀਵਰੀ ਸ਼ਿਫ਼ਟ', 'فوڈ ڈیلیوری شفٹ', 'Shift sa food delivery', 'وردية توصيل الطعام'), startAt: 'martinbrook',
    async run(M, g, P) {
      await say('Delivery app', `New order! Pick up from a local restaurant near you and drive it to the customer. Grab the family car outside or go on foot!`);
      for (let i = 0; i < 3; i++) {
        const near = businessesNear(g.player.x, g.player.y, 3000, 'food').filter(o => o.d > 120).slice(0, 12);
        if (!near.length) break;
        const r = near[Math.floor(Math.random() * near.length)].b;
        await M.goto({ x: r.x, y: r.y, name: r.name, real: false }, `Order ${i + 1}/3: pick up at ${r.name}`, 25);
        toast('🛍️ Order picked up!');
        const a = await randomAddressNear(r.x, r.y, 400, 1800);
        if (!a) break;
        await M.goto({ x: a.x, y: a.y, name: a.label, real: false }, `Deliver to ${a.label}`, 18);
        const tip = 5 + Math.round(Math.random() * 6); M.earn(tip); found(`💵 Delivered! Earned $${tip}`);
      }
      await card({ tag: 'Shop local', title: 'Your neighbourhood businesses', body: `<ul><li>Calgary has tens of thousands of licensed small businesses. Use the <b>Nearby</b> app on your phone to find them.</li><li>Delivery drivers in Calgary must follow the same traffic laws: no stopping in bike lanes or crosswalks!</li></ul>` });
    },
  },
  {
    id: 'jean-carts', title: T('Black, blue and green', 'Noir, bleu et vert', 'ਕਾਲਾ, ਨੀਲਾ ਅਤੇ ਹਰਾ', 'کالا، نیلا اور سبز', 'Itim, asul at berde', 'الأسود والأزرق والأخضر'), startAt: 'home',
    async run(M, g, P) {
      await say(PRIYA, `Jean! Collection day tomorrow. Can you help me sort my stuff? My son put everything in the wrong cart again.`);
      const qs = [
        { q: 'Banana peels, coffee grounds and leaves go in…', opts: ['the green cart', 'the blue cart', 'the black cart'], a: 0, explain: '<b>Green cart</b>: food scraps and yard waste become compost.' },
        { q: 'Clean cardboard, cans and plastic bottles go in…', opts: ['the blue cart', 'the green cart', 'the black cart'], a: 0, explain: '<b>Blue cart</b>: recycling. Rinse containers; no plastic bags of recycling.' },
        { q: 'A broken toy and chip bags go in…', opts: ['the black cart', 'the blue cart', 'the green cart'], a: 0, explain: '<b>Black cart</b>: garbage. Not sure? Search "What goes where" on calgary.ca or in the 311 app.' },
      ];
      let score = 0; for (const q of qs) if (await quiz(q)) score++;
      M.earn(score * 2); toast(`${score}/3 right: +$${score * 2}`);
      await card({ tag: 'Waste and recycling', title: 'What goes where', src: [SRC.carts], body: `<ul><li>Put carts out by <b>7 a.m.</b> on collection day, lids closed, with space around them.</li><li>Hazardous waste (paint, batteries, chemicals) goes to a <b>household hazardous waste drop-off</b>, never in a cart.</li></ul>` });
    },
  },
  {
    id: 'jean-snow', title: T('Shovel your sidewalk', 'Déneiger le trottoir', 'ਫੁੱਟਪਾਥ ਤੋਂ ਬਰਫ਼ ਹਟਾਓ', 'فٹ پاتھ سے برف ہٹائیں', 'Linisin ang bangketa', 'نظّف الرصيف من الثلج'), startAt: 'home',
    async run(M, g, P) {
      await say(PRIYA, `It snowed last night! Mrs. Kaur next door is 80 and can't shovel. Can you clear her walk and yours?`);
      for (let i = 0; i < 3; i++) {
        const s = nearRoad(g, P.home.x, P.home.y, 10 + i * 18, 30 + i * 20);
        await M.goto({ x: s.x, y: s.y, name: 'sidewalk', real: false }, `Shovel the sidewalk (${i + 1}/3)`, 6);
        toast('❄️ Shoveled!');
      }
      await card({ tag: 'Snow and ice', title: '24 hours to clear your sidewalk', src: [SRC.snow],
        body: `<ul><li>Calgary's bylaw says to clear snow and ice from the sidewalks around your home <b>within 24 hours</b> after it stops snowing.</li><li>Help neighbours who can't shovel: the City calls them <b>Snow Angels</b>.</li><li>Report an icy City sidewalk or path to <b>311</b>.</li></ul>` });
      M.earn(5); found('😇 You\'re a Snow Angel!');
    },
  },
  {
    id: 'jean-concert', title: T('Concert night', 'Soirée concert', 'ਕੰਸਰਟ ਦੀ ਰਾਤ', 'کنسرٹ کی رات', 'Gabi ng konsiyerto', 'ليلة الحفل'), startAt: 'home',
    async run(M, g, P) {
      g.clock = 20.2;
      await say(PRIYA, `Tonight there's a concert at the Saddledome! Park downtown or take the CTrain to Victoria Park / Stampede Station.`);
      await card({ tag: 'Parking', title: 'Paying for parking', src: [SRC.parking], body: `<ul><li>Calgary on-street parking uses <b>zone numbers</b>: pay with the <b>MyParking app</b> or a pay station, using your licence plate.</li><li>Taking the CTrain to events saves parking and traffic.</li></ul>` });
      await M.goto(P.saddledome, 'Get to the Scotiabank Saddledome', 90);
      await say(PRIYA, `Listen to that crowd! 🎤`);
      await card({ tag: 'The end of Jean\'s story (for now)', title: 'Living well in Calgary', body: `<p>Deliveries done, carts sorted, sidewalks shoveled and a night out. Keep exploring: every street and building is the real Calgary.</p><p style="margin-top:14px"><b>YYC City Stories — a game by Hassan Ali</b></p>` });
    },
  },
];

// ---------------------------------------------------------------- Leo: visitor
const SOFIA_LOOK = { skin: 0xd9a77e, shirt: 0xd04030, pants: 0x2a3a5a, hair: 0x2a1a10, long: true, fem: true, scale: 0.95 };
const LEO_STORY = [
  {
    id: 'leo-tower', title: T('The best view in town', 'La plus belle vue de la ville', 'ਸ਼ਹਿਰ ਦਾ ਸਭ ਤੋਂ ਸੋਹਣਾ ਨਜ਼ਾਰਾ', 'شہر کا سب سے خوبصورت نظارہ', 'Ang pinakamagandang tanawin', 'أجمل إطلالة في المدينة'), startAt: 'hotel',
    async run(M, g, P) {
      M.npc(SOFIA_LOOK, P.hotel.x + 2.5, P.hotel.y + 1.5, -1.6);
      await say(SOFIA, `Welcome to Calgary, Leo! I'm Sofia, your guide for the next few days. Let's start with the best view in town: the Calgary Tower, just down 9 Avenue.`);
      await M.goto(P.tower, 'Walk to the Calgary Tower', 35);
      await card({ tag: 'Visiting Calgary', title: 'The Calgary Tower', src: [SRC.tower],
        body: `<ul><li>Opened in <b>1968</b>, the tower is <b>191 metres</b> tall. An elevator takes you up to the observation deck in about a minute.</li><li>Part of the deck has a <b>glass floor</b>: you look straight down on 9 Avenue and Centre Street.</li><li>On a clear day you can see the <b>Rocky Mountains</b> to the west.</li><li>The flame on top was lit for the <b>1988 Winter Olympics</b>, and it is still lit for special days.</li></ul>` });
      const ok = await quiz({ q: 'How tall is the Calgary Tower?', opts: ['191 metres', '91 metres', '500 metres'], a: 0, explain: 'The tower is 191 metres tall, and it opened in 1968.' });
      if (ok) M.earn(2);
      await say(SOFIA, `Tip: come back at sunset. You get the city lights and the mountains at the same time.`);
    },
  },
  {
    id: 'leo-downtown', title: T('Getting around downtown', 'Se déplacer au centre-ville', 'ਡਾਊਨਟਾਊਨ ਵਿੱਚ ਘੁੰਮਣਾ', 'ڈاؤن ٹاؤن میں گھومنا', 'Paglibot sa downtown', 'التنقّل في وسط المدينة'), startAt: 'tower',
    async run(M, g, P) {
      await say(SOFIA, `Now let's walk Stephen Avenue, one block north. It's a pedestrian street full of restaurants, shops and old sandstone buildings.`);
      await M.goto(P.stephenAve, 'Walk to Stephen Avenue (8 Avenue SW)', 35);
      await card({ tag: 'Visiting Calgary', title: 'The Plus 15: walk downtown indoors', src: [SRC.plus15],
        body: `<ul><li>The <b>Plus 15</b> is a network of enclosed walkways about 15 feet above the street, linking downtown buildings.</li><li>It has <b>86 bridges</b> and over <b>16 kilometres</b> of heated walkways: perfect on a cold day.</li><li>It is open weekdays from 6 a.m. to 9 p.m. and weekends and holidays from 9 a.m. to 7 p.m.</li></ul>` });
      await say(SOFIA, `Next, let's catch the CTrain on 7 Avenue. Meet me at City Hall station.`);
      await M.goto(P.cityHallStn, 'Walk east to City Hall station', 40);
      await card({ tag: 'Calgary Transit', title: 'Transit for visitors', src: [SRC.fares26, SRC.ffz],
        body: `<ul><li>A single adult fare is <b>$4.00</b> and is good for <b>90 minutes</b> on buses and the CTrain.</li><li>Riding a lot today? An adult <b>Day Pass</b> is <b>$12.65</b> for unlimited rides until the end of service.</li><li>Buy tickets in the <b>My Fare</b> app or at the machines in any CTrain station.</li><li>The CTrain has been free along 7 Avenue between Downtown West/Kerby and City Hall stations (the <b>Free Fare Zone</b>). The City is reviewing it in 2026, so check the signs on the platform.</li></ul>` });
      const ok = await quiz({ q: 'You plan to take five rides today. What should you buy?', opts: ['A Day Pass', 'Five single tickets', 'A monthly pass'], a: 0, explain: 'Five single rides cost $20.00. A Day Pass is $12.65 for unlimited rides that day.' });
      if (ok) M.earn(2);
    },
  },
  {
    id: 'leo-river', title: T('Walk the river', 'Marcher le long de la rivière', 'ਦਰਿਆ ਕਿਨਾਰੇ ਸੈਰ', 'دریا کنارے سیر', 'Maglakad sa tabi ng ilog', 'نزهة على ضفة النهر'), startAt: 'princesIsland',
    async run(M, g, P) {
      await say(SOFIA, `Calgary is a city of rivers and pathways. Walk west along the Bow River to the Peace Bridge, the red bridge you can see from here.`);
      await M.goto(P.peaceBridge, 'Walk along the Bow River to the Peace Bridge', 40);
      await card({ tag: 'Visiting Calgary', title: 'The pathway city', src: [SRC.paths],
        body: `<ul><li>Calgary has about <b>1,000 kilometres</b> of paved pathways, the most extensive urban pathway and bikeway network in North America.</li><li>The pathways follow the <b>Bow and Elbow rivers</b> and link parks across the city.</li><li>The <b>Peace Bridge</b> is a red, tube-shaped bridge for people walking and cycling over the Bow River.</li><li>On the pathway, pass on the left, ring your bell or call out "passing on your left," and leave at least a metre of space.</li></ul>` });
      await card({ tag: 'Getting around', title: 'Shared e-scooters and e-bikes', src: [SRC.scoot],
        body: `<ul><li>Shared e-scooters and e-bikes are for riders <b>18 and older</b>, and their top speed is <b>20 km/h</b>.</li><li>Ride on bike lanes, pathways, empty sidewalks and quiet streets. People walking always have the right of way.</li><li>One rider per scooter: carrying a passenger can get you a <b>$75</b> fine.</li><li>Park it in a way that doesn't block the sidewalk.</li></ul>` });
      const ok = await quiz({ q: 'Where can you ride a shared e-scooter in Calgary?', opts: ['On bike lanes, pathways, empty sidewalks and quiet streets', 'On any road, at any speed', 'Only indoors in the Plus 15'], a: 0, explain: 'Shared e-scooters go up to 20 km/h on bike lanes, pathways, empty sidewalks and quieter streets. Riders must be 18 or older.' });
      if (ok) M.earn(2);
    },
  },
  {
    id: 'leo-east', title: T('East Village and Stampede Park', 'East Village et le parc du Stampede', 'ਈਸਟ ਵਿਲੇਜ ਅਤੇ ਸਟੈਂਪੀਡ ਪਾਰਕ', 'ایسٹ ولیج اور اسٹیمپیڈ پارک', 'East Village at Stampede Park', 'إيست فيلدج وحديقة ستامبيد'), startAt: 'cityHallStn',
    async run(M, g, P) {
      await say(SOFIA, `East Village is just past City Hall. First stop: the Central Library. Even if you're only visiting, it's worth seeing.`);
      await M.goto(P.centralLib, 'Walk to the Central Library', 35);
      await card({ tag: 'Visiting Calgary', title: 'East Village', src: [SRC.lib, SRC.visit],
        body: `<ul><li>The <b>Central Library</b> opened in <b>2018</b>. Its wooden arch entrance and bright reading rooms are free to visit.</li><li><b>Studio Bell</b>, next door, is home to the National Music Centre.</li><li>The <b>RiverWalk</b> pathway follows the Bow River past East Village.</li></ul>` });
      await M.goto(P.studioBell, 'Walk to Studio Bell', 35);
      await say(SOFIA, `Now east to where Calgary began: Fort Calgary, where the Bow and Elbow rivers meet.`);
      await M.goto(P.fortCalgary, 'Walk to Fort Calgary', 45);
      await card({ tag: 'History', title: 'Where Calgary began', src: [SRC.visit],
        body: `<ul><li>The North-West Mounted Police built a fort here in <b>1875</b>, where the <b>Bow and Elbow rivers</b> meet.</li><li>Long before that, this meeting of the rivers was a gathering place for the <b>Blackfoot</b> and other First Nations. The Blackfoot name for this place is <b>Mohkinstsis</b>.</li></ul>` });
      await say(SOFIA, `Last stop today: Stampede Park, home of the Calgary Stampede.`);
      await M.goto(P.stampedePark, 'Walk south to Stampede Park', 50);
      await card({ tag: 'Visiting Calgary', title: 'The Calgary Stampede', src: [SRC.stampede],
        body: `<ul><li>Every July, the <b>Calgary Stampede</b> runs for <b>ten days</b>: rodeo, chuckwagon races, a midway, concerts and pancake breakfasts all over the city.</li><li>The <b>Scotiabank Saddledome</b>, next door, hosts hockey games and concerts all year.</li><li>Take the CTrain to <b>Victoria Park/Stampede</b> station and skip the parking.</li></ul>` });
    },
  },
  {
    id: 'leo-plan', title: T('Plan your trip', 'Planifiez votre voyage', 'ਆਪਣੀ ਯਾਤਰਾ ਦੀ ਯੋਜਨਾ ਬਣਾਓ', 'اپنے سفر کی منصوبہ بندی کریں', 'Planuhin ang iyong biyahe', 'خطّط لرحلتك'), startAt: 'stampedePark',
    async run(M, g, P) {
      await say(SOFIA, `You've seen downtown. Before you go further, let's make sure you can explore safely on your own.`);
      const q1 = await quiz({ q: 'You find a broken streetlight or want to know a City service. Who do you contact?', opts: ['311, the City\'s help line and app', '9-1-1', 'Nobody, you\'re only visiting'], a: 0, explain: '<b>311</b> is for City information and non-emergency problems. <b>9-1-1</b> is only for emergencies.' });
      const q2 = await quiz({ q: 'The sky is sunny, but you\'re heading out for the whole day. What do you pack?', opts: ['Layers and a jacket: Calgary weather can change fast', 'Just a T-shirt', 'Nothing, it never rains here'], a: 0, explain: 'Calgary is famous for fast weather changes, including warm "chinook" winds in winter. Dress in layers.' });
      const q3 = await quiz({ q: 'You want to visit Banff National Park, about an hour and a half west. What do you need?', opts: ['A Parks Canada pass', 'Nothing at all', 'A Calgary Transit Day Pass'], a: 0, explain: 'National parks need a <b>Parks Canada pass</b>. Check road conditions in winter before you drive.' });
      M.earn([q1, q2, q3].filter(Boolean).length * 2);
      await card({ tag: 'Visiting Calgary', title: 'More to explore', src: [SRC.visit, SRC.parksCanada],
        body: `<ul><li>In the city: the <b>Calgary Zoo</b>, <b>Heritage Park</b>, <b>TELUS Spark</b> science centre and the views from <b>Nose Hill Park</b>.</li><li>Day trips: <b>Banff National Park</b> and <b>Kananaskis</b> are in the Rocky Mountains, west of the city.</li><li>Use your phone's <b>Nearby</b> and <b>Go to address</b> apps, or tap the big map, and follow the purple line.</li></ul>` });
      await say(SOFIA, `That's my tour, Leo. The rest of the city is yours. Enjoy Calgary!`);
      await card({ tag: 'The end of Leo\'s story', title: 'Enjoy Calgary!', body: `<p>You saw the city from the Calgary Tower, walked Stephen Avenue and the Plus 15, learned the CTrain and the pathways, found where Calgary began and planned your next trip. Keep exploring: every street and building is the real Calgary.</p><p style="margin-top:14px"><b>YYC City Stories — a game by Hassan Ali</b></p>` });
    },
  },
];

export const STORIES = { ali: ALI, natalia: NATALIA, chris: CHRIS, jean: JEAN, leo: LEO_STORY };
export const titleOf = m => (typeof m.title === 'string' ? m.title : (m.title[LANG.code] || m.title.en));
