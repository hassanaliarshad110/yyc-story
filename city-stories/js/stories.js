// YYC City Stories: four people, four ways into Calgary. Each story is a list of missions that teach real City services.
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
};
const IMRAN = 'Imran (friend)', MAYA = 'Maya (best friend)', LINDA = 'Linda (daughter)', PRIYA = 'Priya (neighbour)';
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
};

// ---------------------------------------------------------------- helpers
function speedWatch(g, onStrike) {         // speeding and crashes during a road test
  let over = 0, strikes = 0, crashes = 0;
  const prevCrash = g.player.onCrash;
  g.player.onCrash = () => { crashes++; if (prevCrash) prevCrash(); onStrike('crash', crashes); };
  const id = setInterval(() => {
    const p = g.player; if (p.mode !== 'car') return;
    const st = g.tiles.streetAt(p.x, p.y, 25), lim = st ? SPEED_LIMIT[st.kind] : 50;
    if (p.speedKmh > lim + 10) { over += 0.25; if (over > 1.5) { over = 0; strikes++; onStrike('speed', strikes, lim); } } else over = Math.max(0, over - 0.1);
  }, 250);
  return { stop() { clearInterval(id); g.player.onCrash = prevCrash; }, get strikes() { return strikes; }, get crashes() { return crashes; } };
}
const nearRoad = (g, x, y, a, b) => g.findRoadSpot(x, y, a, b) || { x: x + a, y };

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
      M.npc({ skin: 0x8d5a3b, shirt: 0xe0a020, pants: 0x2a3a5a, hair: 0x15100d, long: true, fem: true, scale: 0.93 }, P.saddletowneStn.x + 3, P.saddletowneStn.y - 2, 0);
      await say(MAYA, `Natalia! New semester at Nelson Mandela High! Walk with me, it's just south of the station.`);
      await M.goto(P.mandela, 'Walk to Nelson Mandela High School', 45);
      await card({ tag: 'Getting around as a student', title: 'Youth on transit', src: [SRC.fares],
        body: `<ul><li>Youth (13 to 17) pay a lower fare on Calgary Transit, and there are monthly <b>youth passes</b>.</li><li>Kids 12 and under ride free.</li><li>The <b>Saddletowne Library</b> next door is free for students: homework help, study rooms and Wi-Fi.</li></ul>` });
    },
  },
  {
    id: 'nat-stand', title: T('Stand up to the bullies', 'Tenir tête aux intimidateurs', 'ਧੱਕੇਸ਼ਾਹੀ ਦੇ ਖ਼ਿਲਾਫ਼ ਡਟੋ', 'دھونس کے خلاف ڈٹ جاؤ', 'Harapin ang mga bully', 'واجهي المتنمّرين'), startAt: 'mandela',
    async run(M, g, P) {
      const s = nearRoad(g, P.mandela.x, P.mandela.y, 60, 140);
      const kid = M.npc({ skin: 0xc49a76, shirt: 0x58a0d8, pants: 0x34404c, hair: 0x6b4a2a, scale: 0.78, bag: 0x9b2a2a }, s.x, s.y, 0);
      const bullies = [[2, 1.5], [-2, 1.2], [0.5, -2.2]].map(([dx, dy], i) => M.npc({ skin: [0xb98260, 0xe0b090, 0x8d5a3b][i], shirt: [0x222222, 0x8a1c1c, 0x2e4a2e][i], pants: 0x23252b, hair: 0x15100d, scale: 0.95 }, s.x + dx, s.y + dy, Math.atan2(-dx, -dy)));
      await say(MAYA, `Natalia, look over there! Those older kids are pushing a Grade 7 kid around and taking his stuff.`);
      await M.goto({ x: s.x, y: s.y, name: 'the younger kid', real: false }, 'Go and help the younger kid', 6);
      const a1 = await quiz({ q: 'The bullies laugh at you. What do you do first?', opts: ['Shove them as hard as you can', 'Stand next to the kid, stay calm and say firmly: "Stop. Leave him alone."', 'Walk away and pretend you didn\'t see', 'Film it to post online'], a: 1,
        explain: 'Standing <b>next to</b> the person being bullied and speaking up <b>calmly and firmly</b> takes the bully\'s audience away. Fighting can get you or the kid hurt.' });
      const a2 = await quiz({ q: 'One bully steps closer to you. Now what?', opts: ['Take the kid and walk away together, toward teachers', 'Start a fight', 'Insult him back'], a: 0, explain: 'Get yourself and the kid <b>to safety</b> and to adults who can help.' });
      for (const b of bullies) b.visible = false;
      found(a1 && a2 ? '💪 You stood up the smart way! The bullies backed off.' : 'The bullies left, but think about the safest choice next time.');
      if (a1 && a2) M.earn(5);
      await say('Kid', `Th-thanks. They do this every day. I didn't know what to do.`);
      await card({ tag: 'Bullying', title: 'You don\'t have to handle it alone', src: [SRC.bully, SRC.khp],
        body: `<ul><li>Tell a <b>trusted adult</b>: a teacher, counsellor, coach or parent. Schools must act on bullying.</li><li><b>Alberta Bullying Helpline</b>: 1-888-456-2323, 24/7, in many languages.</li><li><b>Kids Help Phone</b>: call 1-800-668-6868 or text CONNECT to 686868, any time.</li><li>If someone is in danger, call <b>9-1-1</b>.</li></ul>` });
      kid.visible = false;
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
      await card({ tag: 'The end of Natalia\'s story (for now)', title: 'A school where everyone belongs', body: `<p>You stood up to bullies safely, helped a younger student and taught three groups what to do. Keep exploring, and keep looking out for each other!</p><p style="margin-top:14px"><b>YYC City Stories — a game by Hassan Ali</b></p>` });
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

export const STORIES = { ali: ALI, natalia: NATALIA, chris: CHRIS, jean: JEAN };
export const titleOf = m => (typeof m.title === 'string' ? m.title : (m.title[LANG.code] || m.title.en));
