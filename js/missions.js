// The story: ten missions, each teaching one City of Calgary service, set at real places.
import * as THREE from 'three';
import { say, card, quiz, toast, setObjective, setObjDist, setPrompt, found } from './hud.js';
import { app311, appHelp, appShop } from './phone.js';
import { makeMarker, makePerson } from './actors.js';
import { wardAt, communityAt } from './world.js';
import { dirOf } from './player.js';

// real places (metres from City Hall; from City of Calgary and OpenStreetMap data)
export const P = {
  airportStop: { x: 3304.8, y: 9717.5, name: 'YYC Airport Domestic Terminal (stop 3900)' },
  downtownStop: { x: -315.1, y: 427.9, name: 'NB Centre St S @ 4 Av S' },
  cityHall: { x: 104, y: 16, name: 'Calgary Municipal Building (City Hall)' },
  library: { x: 213, y: 16, name: 'Central Library' },
  cityHallStation: { x: 92, y: 113, name: 'City Hall / Bow Valley College CTrain Station' },
  saddletowne: { x: 7696.1, y: 8966.1, name: 'Saddletowne CTrain Station' },
  home: { x: 7888, y: 9231, name: 'Home, Saddle Ridge', real: false },   // a real house: no street photo of someone's home
  freshco: { x: 7910.7, y: 8701.5, name: 'Chalo! FreshCo, 850 Saddletowne Circle NE' },
  villageSquare: { x: 7268.8, y: 3417.7, name: 'Village Square Leisure Centre, 2623 56 St NE' },
  princes: { x: -862, y: 1062, name: "Prince's Island Park" },
  peace: { x: -1463, y: 962, name: 'Peace Bridge' },
};
const SRC = {
  fares: ['Calgary Transit: fares and passes', 'https://www.calgarytransit.com/fares---passes.html'],
  c311: ['City of Calgary: 311', 'https://www.calgary.ca/311'],
  app311: ['City of Calgary: 311 app', 'https://www.calgary.ca/311app'],
  lib: ['Calgary Public Library: join', 'https://calgarylibrary.ca/your-library/join'],
  fair: ['City of Calgary: Fair Entry', 'https://www.calgary.ca/fairentry.html'],
  fee: ['City of Calgary: Fee Assistance', 'https://www.calgary.ca/csps/recreation/fee-assistance.html'],
  elect: ['Elections Calgary', 'https://www.electionscalgary.ca/'],
  ab: ['Alberta: municipal elections', 'https://www.alberta.ca/municipal-elections-overview.aspx'],
  h211: ['211 Alberta', 'https://ab.211.ca/'],
};

export class Missions {
  constructor(game) {
    this.g = game; this.marker = makeMarker(); this.marker.visible = false; game.scene.add(this.marker);
    this.state = load() || { done: [], money: 40, landmarks: [], items: [], home: false };
    this.active = null; this.goal = null; this.npcs = [];
    this.list = MISSIONS;
  }
  save() { try { localStorage.setItem('yyc-story', JSON.stringify(this.state)); } catch (e) { } }
  reset() { try { localStorage.removeItem('yyc-story'); } catch (e) { } }
  available(i) { return i === 0 || this.state.done.includes(this.list[i - 1].id) || this.state.done.includes(this.list[i].id); }
  nextIndex() { const i = this.list.findIndex(m => !this.state.done.includes(m.id)); return i; }
  get money() { return this.state.money; }
  pay(n) { this.state.money = Math.round((this.state.money - n) * 100) / 100; this.g.updateMoney(); this.save(); }
  earn(n) { this.state.money = Math.round((this.state.money + n) * 100) / 100; this.g.updateMoney(); this.save(); }

  async start(i) {
    if (this.active) { toast('Finish the mission you are on first'); return; }
    const m = this.list[i]; if (!m) return;
    this.active = m;
    toast(`Mission ${i + 1}: ${m.title}`, 3200);
    try { await m.run(this, this.g); this.complete(m); }
    catch (e) { if (e !== 'cancel') console.error(e); }
    finally { this.active = null; this.clearGoal(); this.clearNpcs(); }
  }
  complete(m) {
    if (!this.state.done.includes(m.id)) this.state.done.push(m.id);
    this.save();
    found(`✅ Mission complete: ${m.title}`);
    const ni = this.nextIndex();
    if (ni >= 0) setTimeout(() => { setObjective('Next mission', `${ni + 1}. ${this.list[ni].title} — open the phone ⭐ or press J`); this.g.setWaypointRaw(this.list[ni].startAt ? P[this.list[ni].startAt] : null); }, 3500);
    else setObjective('Free roam', 'You finished the story! Explore Calgary and find all the landmarks.');
  }
  // ---------------------------------------------------------------- step helpers
  goto(place, text, radius = 25) {
    return new Promise(res => {
      this.goal = { ...place, r: radius, res };
      this.marker.visible = true; this.marker.position.set(place.x, 0, -place.y);
      setObjective(this.active ? this.active.title : 'Go', text || `Go to ${place.name}`);
    });
  }
  clearGoal() { this.goal = null; this.marker.visible = false; setObjective(null); }
  npc(look, x, y, h = 0) {
    const p = makePerson(look); p.position.set(x, 0, -y); p.rotation.y = Math.PI - h; this.g.scene.add(p); this.npcs.push(p); return p;
  }
  clearNpcs() { for (const n of this.npcs) this.g.scene.remove(n); this.npcs = []; }
  ride(route, from, to, label) {
    const g = this.g, T = g.transit;
    const best = T.findPath(route, [from.x, from.y], [to.x, to.y]);
    if (!best) { toast('Route not found in the timetable'); return Promise.resolve(); }
    return new Promise(res => {
      const start = Math.max(0, best.a.s - 120);
      const v = T.add(best.p, start, { mission: true, keep: true });
      v.stops = [{ s: best.a.s, x: from.x, y: from.y, name: from.name }, { s: best.b.s, x: to.x, y: to.y, name: to.name }];
      v.nextStop = 0; v.holdAt = 0;
      setObjective(this.active.title, `Wait for the ${label} at the stop`);
      const rideUI = document.getElementById('ride'), txt = document.getElementById('ride-text');
      document.getElementById('ride').hidden = false; document.getElementById('ride-text').textContent = `The ${label} is on its way`;
      document.getElementById('ride-skip').onclick = () => { v.s = Math.max(v.s, best.a.s - 25); v.v = 5; v.gy = null; };
      v.onStop = (st, idx) => {
        if (idx === 0) {
          document.getElementById('ride').hidden = true;
          setPrompt(`Press E (✋) to board the ${label}`);
          this.boardWait = () => {
            setPrompt(null); this.boardWait = null; v.holdAt = -1; v.wait = 1.5;
            const fare = 2.65; this.pay(fare); toast(`Paid the youth fare: $${fare.toFixed(2)} (good for 90 minutes)`);
            g.player.mode = 'ride'; g.rideVehicle = v; g.player.sync();
            rideUI.hidden = false; txt.textContent = `Riding the ${label} to ${to.name}`;
            v.fast = 6;                              // the ride runs at 6x speed; Skip jumps to your stop
            document.getElementById('ride-skip').onclick = () => {   // jump to just before your stop
              v.s = Math.max(v.s, best.b.s - 160); v.wait = 0; v.v = 9; v.fast = 1; v.gy = null;
              toast('Skipped ahead: almost at ' + to.name);
            };
          };
        } else {
          v.fast = 1; rideUI.hidden = true;
          const [dx, dy] = dirOf(v.h);
          g.player.mode = 'foot'; g.rideVehicle = null; g.player.place(v.x + dy * 3.2, v.y - dx * 3.2, v.h);
          v.keep = false; v.mission = false; v.holdAt = -1;
          setTimeout(() => { v.done = true; }, 8000);
          res();
        }
      };
    });
  }
  // ---------------------------------------------------------------- per-frame
  update(dt) {
    const p = this.g.player;
    if (this.goal) {
      const d = Math.hypot(p.x - this.goal.x, p.y - this.goal.y);
      setObjDist(d);
      if (d < this.goal.r && p.mode !== 'ride') { const g = this.goal, r = g.res; this.clearGoal(); if (g.name && g.real !== false) { this.seen(g); this.g.offerReal(g); } r(); }
    }
    this.marker.userData.arrow.position.y = 4 + Math.sin(performance.now() / 300) * 0.6;
    this.marker.rotation.y += dt;
    // landmarks
    if (!this._lmT || performance.now() - this._lmT > 500) {
      this._lmT = performance.now();
      for (const l of this.g.world.landmarks) {
        if (this.state.landmarks.includes(l.label)) continue;
        const r = l.full && !l.downtown ? 180 : 70;
        if (Math.hypot(p.x - l.x, p.y - l.y) < r) { this.state.landmarks.push(l.label); this.save(); found(`📍 Landmark found: ${l.label} (${this.state.landmarks.length}/${this.g.world.landmarks.length})`); this.earn(2); this.g.offerReal({ x: l.x, y: l.y, name: l.label, radius: l.full && !l.downtown ? 300 : 120 }); }
      }
    }
  }
  seen(g) { const v = this.state.visited ||= []; if (!v.some(p => p.name === g.name)) { v.push({ name: g.name, x: g.x, y: g.y }); this.save(); } }
  interact() { if (this.boardWait) { this.boardWait(); return true; } return false; }
}
function load() { try { return JSON.parse(localStorage.getItem('yyc-story')); } catch (e) { return null; } }

// ---------------------------------------------------------------- the story
const AMMI = 'Ammi (Mom)', ABBU = 'Abbu (Dad)', BILAL = 'Bilal (cousin)', NOOR = 'Noor (little sister)';
const MISSIONS = [
  {
    id: 'arrive', title: 'Welcome to YYC', teaches: 'Calgary Transit: fares and the airport bus', startAt: 'airportStop',
    async run(M, g) {
      g.player.mode = 'foot'; g.player.place(P.airportStop.x - 14, P.airportStop.y + 10, Math.PI * 0.75); g.camSnap();
      M.npc({ skin: 0xb98260, shirt: 0x7a2e5a, pants: 0x3a2c40, hair: 0x15100d, long: true }, P.airportStop.x - 12, P.airportStop.y + 12, Math.PI * 0.6);
      const me = g.name;
      await say(AMMI, `We're finally here, ${me}! Welcome to Calgary. Abbu went ahead to the new house in Saddle Ridge with the keys.`);
      await say(AMMI, `Your cousin Bilal will meet us downtown. The Airport Express bus goes straight there. Let's take it, like real Calgarians!`);
      await card({ tag: 'Calgary Transit', title: 'Paying for the bus and the CTrain', src: [SRC.fares],
        body: `<ul><li><b>Youth (13 to 17): $2.65</b> a ride. Adults pay $4.00. <b>Kids 12 and under ride free</b>, so Noor doesn't pay.</li><li>A fare is good for <b>90 minutes</b>, so you can change buses or trains on one ticket.</li><li>Pay with the <b>My Fare</b> app (activate the ticket before you board), at a ticket machine at any CTrain station, or with cash on the bus.</li></ul>` });
      await M.goto(P.airportStop, 'Walk to the Airport Express stop at the Domestic Terminal', 10);
      await M.ride('500', P.airportStop, P.downtownStop, 'Route 500 Airport Express');
      M.clearNpcs();
      M.npc({ skin: 0xa86c48, shirt: 0x2f8f5a, pants: 0x2a2e38, hair: 0x15100d }, g.player.x + 3, g.player.y + 2, Math.PI);
      await say(BILAL, `Assalam-o-alaikum! Welcome to Calgary! This is downtown: those towers are The Bow and Brookfield Place, and that's the Calgary Tower.`);
      await say(BILAL, `First stop: City Hall. It's a short walk southeast from here. Follow the yellow marker!`);
    },
  },
  {
    id: '311', title: 'City Hall and 311', teaches: '311: City services, any time', startAt: 'cityHall',
    async run(M, g) {
      await M.goto(P.cityHall, 'Walk to Calgary City Hall (the Municipal Building)', 45);
      await say(BILAL, `This is where City Council meets: the Mayor and 14 councillors, one for each ward. But you don't have to come here to get help from the City.`);
      await card({ tag: 'Calgary 311', title: '311: your line to City services', src: [SRC.c311, SRC.app311],
        body: `<ul><li><b>311</b> is for City services that are <b>not emergencies</b>: potholes, streetlights, garbage pickup, graffiti, parks, bylaw questions and more.</li><li>Reach it 24/7 by <b>phone (311)</b>, the free <b>Calgary 311 app</b> or <b>online</b>. The app lets you add photos and your location.</li><li>The 311 phone line offers service in over 200 languages.</li><li><b>9-1-1</b> is only for emergencies. <b>2-1-1</b> connects you to community and social help such as food or shelter.</li></ul>` });
      const ok1 = await quiz({ q: 'The streetlight on your street has been out for a week. What do you do?', opts: ['Call 9-1-1', 'Report it to 311 (app, online or phone)', 'Call 2-1-1', 'Nothing, someone else will report it'], a: 1,
        explain: 'Right: a broken streetlight is a City service problem, so it goes to <b>311</b>. 9-1-1 is only for emergencies.' });
      const ok2 = await quiz({ q: 'Someone has collapsed on the sidewalk and is not breathing. What do you do?', opts: ['Report it in the 311 app', 'Call 9-1-1 right away', 'Call 2-1-1'], a: 1,
        explain: 'A life-threatening emergency is always <b>9-1-1</b>.' });
      if (ok1 && ok2) { M.earn(5); toast('Both right first time: +$5'); }
    },
  },
  {
    id: 'library', title: 'Your free library card', teaches: 'Calgary Public Library', startAt: 'library',
    async run(M, g) {
      await say(BILAL, `See the building with the wooden curves across Macleod Trail? That's the Central Library. Let's get you a card.`);
      await M.goto(P.library, 'Walk to the Central Library', 40);
      await card({ tag: 'Calgary Public Library', title: 'A library card is free', src: [SRC.lib],
        body: `<ul><li>A Calgary Public Library card is <b>free for everyone who lives in Calgary</b>. Sign up online or at any branch.</li><li>Borrow books, movies and e-books, use free Wi-Fi and computers, book meeting rooms and join free programs and courses.</li><li>Libraries also run programs for newcomers, like English conversation groups and help finding a job.</li></ul>` });
      M.state.items.push('Library card'); M.save(); toast('🎟️ You got a Calgary Public Library card!');
    },
  },
  {
    id: 'ctrain', title: 'The Blue Line home', teaches: 'Riding the CTrain', startAt: 'cityHallStation',
    async run(M, g) {
      await say(BILAL, `Time to go home! The Blue Line CTrain runs from right here to Saddletowne, near your new house. The station is on 7th Avenue.`);
      await M.goto(P.cityHallStation, 'Walk to City Hall / Bow Valley College CTrain Station', 30);
      await card({ tag: 'CTrain', title: 'Calgary\'s two CTrain lines', src: [SRC.fares],
        body: `<ul><li>The <b>Red Line</b> runs between Tuscany in the northwest and Somerset-Bridlewood in the south. The <b>Blue Line</b> runs between 69 Street in the west and Saddletowne in the northeast.</li><li>Both lines share 7th Avenue downtown.</li><li>Have your ticket ready before you get on: activate it in My Fare, or buy one at the station machine.</li></ul>` });
      await M.ride('202', P.cityHallStation, P.saddletowne, 'Blue Line CTrain');
      await say(BILAL, `This is Saddletowne, your stop! Your house is a short walk north in Saddle Ridge. See you later!`);
      await M.goto(P.home, 'Walk home to Saddle Ridge', 22);
      M.npc({ skin: 0xa8714c, shirt: 0x4d5a68, pants: 0x2a2e38, hair: 0x2a2420 }, P.home.x + 2, P.home.y - 3, 0);
      await say(ABBU, `You made it! Welcome home. Ammi and Noor came by car. How was the CTrain? Rest up: tomorrow there's lots to do.`);
      M.state.home = true; M.save();
    },
  },
  {
    id: 'report', title: 'See it, report it', teaches: 'Reporting a problem with the 311 app', startAt: 'home',
    async run(M, g) {
      const spot = g.findRoadSpot(P.home.x, P.home.y, 90, 200) || { x: P.home.x + 120, y: P.home.y };
      await say(ABBU, `There's a huge pothole on our street. It nearly took the tire off the car this morning. Can you report it to the City with the 311 app?`);
      const hole = g.addPothole(spot.x, spot.y);
      await M.goto({ ...spot, name: 'the pothole', real: false }, 'Find the pothole down the street', 10);
      let r = null;
      while (!r || r.cat !== 'pothole') {
        await say('Tip', `Open the Calgary 311 app, choose the right kind of problem, take a photo and submit.`);
        r = await app311('pothole');
        if (r && r.cat !== 'pothole') toast('Choose "Pothole or road damage" so it goes to the road crews');
      }
      await card({ tag: 'Calgary 311', title: 'What happens next', src: [SRC.app311],
        body: `<ul><li>311 sends your request to the right City team, and you get a <b>service request number</b> (like ${r.sr}).</li><li>Check the status any time in the app, online, or by calling 311.</li><li>Asking for City services through 311 is free.</li></ul>` });
      g.removePothole(hole);
      M.earn(3);
    },
  },
  {
    id: 'grocery', title: 'Groceries on a budget', teaches: 'Shopping nearby, and help if money is tight', startAt: 'home',
    async run(M, g) {
      await say(AMMI, `Can you get a few things from the grocery store by the station? Milk, eggs, bread, rice and onions. Use the money in your wallet, and bring back the change!`);
      await M.goto(P.freshco, 'Walk to Chalo! FreshCo on Saddletowne Circle', 30);
      const r = await appShop('Chalo! FreshCo', M.money);
      M.pay(r.total);
      toast(`Paid $${r.total.toFixed(2)}`);
      await card({ tag: 'Help with food', title: 'If money is tight', src: [SRC.h211],
        body: `<ul><li>Nobody should go hungry. Call or text <b>2-1-1</b>, any time, to find the nearest food bank, community meal or food hamper.</li><li>The <b>Find help</b> app on your phone lists meals and food programs, nearest first.</li></ul>` });
      await M.goto(P.home, 'Take the groceries home', 22);
      await say(AMMI, r.treats ? `Chips too? Fine, just this once! Thank you, beta.` : `Everything on the list and change left over. Shabash!`);
    },
  },
  {
    id: 'rec', title: 'Swimming lessons for Noor', teaches: 'Fair Entry and recreation fee assistance', startAt: 'home',
    async run(M, g) {
      M.npc({ skin: 0xb98260, shirt: 0xf2a33a, pants: 0x3a5a8c, hair: 0x15100d, long: true }, P.home.x - 2, P.home.y - 2, 0);
      await say(NOOR, `My friend goes to swimming lessons at a City pool! Can I go too? Pleeease?`);
      await say(AMMI, `Lessons cost money and Abbu is still looking for work. Let's find out if the City can help.`);
      await card({ tag: 'Fair Entry', title: 'One application, many discounts', src: [SRC.fair, SRC.fee],
        body: `<ul><li><b>Fair Entry</b> is the City's program for Calgarians with low incomes. You apply <b>once</b> and can qualify for several programs.</li><li><b>Recreation Fee Assistance</b>: big discounts on City recreation programs and drop-ins, like swimming lessons.</li><li>A <b>low-income monthly transit pass</b>, priced on a sliding scale.</li><li>Apply online at calgary.ca/fairentry. For help applying, call 311.</li></ul>` });
      await say(ABBU, `Let's go and ask at Village Square Leisure Centre, a City rec centre with a pool. Get there however you like: drive, take the bus, or run!`);
      await M.goto(P.villageSquare, 'Go to Village Square Leisure Centre (2623 56 St NE)', 45);
      const ok = await quiz({ q: 'Which City program lets a family apply once for recreation discounts AND a low-income transit pass?', opts: ['Fair Entry', 'The 311 app', 'My Fare', 'A library card'], a: 0,
        explain: '<b>Fair Entry</b>: one application for several City programs, including Recreation Fee Assistance and the low-income transit pass.' });
      if (ok) M.earn(3);
      await say(NOOR, `Yay! Swimming lessons! 🏊`);
    },
  },
  {
    id: 'parks', title: 'Parks and pathways', teaches: 'Parks, the river pathways and park manners', startAt: 'princes',
    async run(M, g) {
      await say(BILAL, `Meet me at Prince's Island Park downtown, on the Bow River! Take the CTrain or drive.`);
      await M.goto(P.princes, "Get to Prince's Island Park", 70);
      M.npc({ skin: 0xa86c48, shirt: 0x2f8f5a, pants: 0x2a2e38, hair: 0x15100d }, g.player.x + 3, g.player.y + 2, Math.PI);
      await card({ tag: 'Parks', title: 'Sharing the pathways', src: [['City of Calgary: pathways', 'https://www.calgary.ca/parks/pathways.html']],
        body: `<ul><li>Calgary's pathways run along the Bow and Elbow rivers and through parks across the city, for walking, biking and rolling.</li><li><b>Keep right, pass on the left</b>, and ring a bell or say "on your left" before you pass.</li><li>Dogs need a leash except in signed off-leash areas.</li><li>See broken equipment, a fallen tree or garbage in a park? Report it to <b>311</b>.</li></ul>` });
      await say(BILAL, `Let's walk over the Peace Bridge, the red bridge just upstream. It's only for people walking and biking.`);
      await M.goto(P.peace, 'Walk to the Peace Bridge', 40);
      await say(BILAL, `It was designed by the architect Santiago Calatrava and opened in 2012. Great photo spot!`);
    },
  },
  {
    id: 'help', title: 'Help is near', teaches: '2-1-1, 9-1-1, 9-8-8 and the Find help app', startAt: null,
    async run(M, g) {
      await say(BILAL, `My classmate Sam's family just arrived too, and their money ran out before payday. They don't know where to get food. Can you help me find out?`);
      await say('Tip', `Open <b>Find help</b> on your phone. Look at "Food and meals", then call 2-1-1 (in the game).`);
      let r = null;
      while (!r || !r.called) r = await appHelp('food');
      await card({ tag: 'Getting help', title: 'Numbers worth knowing', src: [SRC.h211],
        body: `<ul><li><b>9-1-1</b>: police, fire or ambulance in an emergency.</li><li><b>2-1-1</b>: call or text, 24/7, free and confidential, to find food, shelter, mental health and other community help.</li><li><b>9-8-8</b>: call or text if you or someone you know is thinking about suicide.</li><li><b>Distress Centre Calgary</b>, 403-266-4357, 24/7, for anyone who needs to talk.</li></ul>` });
      await say(BILAL, `I'll text Sam's mom about 2-1-1 right now. Thanks, ${g.name}!`);
    },
  },
  {
    id: 'vote', title: 'Your voice, your vote', teaches: 'City elections and wards', startAt: 'cityHall',
    async run(M, g) {
      await M.goto(P.cityHall, 'Go back to City Hall', 45);
      const w = wardAt(g.world, P.home.x, P.home.y), cm = communityAt(g.world, P.home.x, P.home.y);
      await card({ tag: 'Elections Calgary', title: 'Who runs the city?', src: [SRC.elect, SRC.ab],
        body: `<ul><li>Calgarians elect a <b>Mayor</b>, <b>14 ward councillors</b> and school board trustees every four years.</li><li>The next general election is <b>Monday, October 15, 2029</b>.</li><li>To vote you must be <b>at least 18</b>, a <b>Canadian citizen</b>, and live in Calgary. Voters are on Alberta's provincial voter register.</li><li>Your home in ${cm ? cm.n : 'Saddle Ridge'} is in <b>Ward ${w ? w.n : '?'}</b>.</li></ul>` });
      const ok = await quiz({ q: 'How old do you have to be to vote in a Calgary municipal election?', opts: ['16', '18', '21'], a: 1, explain: 'You must be <b>18</b> or older, a Canadian citizen, and live in Calgary.' });
      if (ok) M.earn(3);
      await say(AMMI, `When we become citizens, we'll vote too. And in 2029, you'll still be too young, but you can come with us and see how it works!`);
      await card({ tag: 'The end of the story', title: 'You know your way around Calgary!', body: `<p>You rode the bus and the CTrain, got a library card, reported a pothole, shopped on a budget, learned about Fair Entry, walked the river pathways, found help for a friend and learned how City elections work.</p><p>Keep exploring: every street and building is the real Calgary. Can you find all ${g.world.landmarks.length} landmarks?</p><p style="margin-top:14px"><b>YYC Story — a game by Hassan Ali</b></p>` });
    },
  },
];
