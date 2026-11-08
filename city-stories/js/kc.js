// Character rig (skeleton, poses, walk cycle) from Grand Chori Karachi, by Hassan Ali.
export const KC=(()=>{
const B=['hips','spine','chest','neck','head','shL','armL','foreL','handL','shR','armR','foreR','handR','thighL','shinL','footL','thighR','shinR','footR'];
const PAR={spine:'hips',chest:'spine',neck:'chest',head:'neck',shL:'chest',armL:'shL',foreL:'armL',handL:'foreL',shR:'chest',armR:'shR',foreR:'armR',handR:'foreR',thighL:'hips',shinL:'thighL',footL:'shinL',thighR:'hips',shinR:'thighR',footR:'shinR'};
const BI={}; B.forEach((b,i)=>BI[b]=i);
// rest joint positions (model space, metres, facing +z, feet on y=0). L = +x (his left).
const J0={hips:[0,1.2,0],spine:[0,1.42,-.01],chest:[0,1.72,0],neck:[0,2.06,.05],head:[0,2.17,.08],
  shL:[.16,1.98,0],armL:[.5,1.94,-.02],foreL:[.6,1.47,-.02],handL:[.66,1.04,.02],
  shR:[-.16,1.98,0],armR:[-.5,1.94,-.02],foreR:[-.6,1.47,-.02],handR:[-.66,1.04,.02],
  thighL:[.21,1.12,0],shinL:[.23,.62,.03],footL:[.24,.12,-.02],thighR:[-.21,1.12,0],shinR:[-.23,.62,.03],footR:[-.24,.12,-.02]};
const CLR={hips:.22,spine:.3,chest:.3,neck:.3,head:.26,armL:.18,foreL:.15,handL:.12,armR:.18,foreR:.15,handR:.12,shinL:.14,shinR:.14,footL:.13,footR:.13,thighL:.2,thighR:.2};
// ---------- tiny matrix helpers (column-major like three.js)
function mEuler(x,y,z,t){ // R = Rx*Ry*Rz (three.js 'XYZ'), then translation
  const a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z), ae=a*e,af=a*f,be=b*e,bf=b*f;
  return [c*e, af+be*d, bf-ae*d, 0,  -c*f, ae-bf*d, be+af*d, 0,  d, -b*c, a*c, 0,  t[0],t[1],t[2],1]; }
function mMul(A,Bm){ const o=new Array(16); for(let c=0;c<4;c++) for(let r=0;r<4;r++){ let s=0; for(let k=0;k<4;k++) s+=A[k*4+r]*Bm[c*4+k]; o[c*4+r]=s; } return o; }
function offsets(J){ const o={}; for(const b of B){ const p=PAR[b]; o[b]=p?[J[b][0]-J[p][0],J[b][1]-J[p][1],J[b][2]-J[p][2]]:J[b].slice(); } return o; }
// forward kinematics: pose = {bone:[rx,ry,rz]}, dy = hips lift. returns world matrices
function fk(J,off,pose,dy){ const W={}; for(const b of B){ const r=pose[b]||Z3, p=PAR[b], t=off[b].slice(); if(!p) t[1]+=dy||0; const L=mEuler(r[0],r[1],r[2],t); W[b]=p?mMul(W[p],L):L; } return W; }
const Z3=[0,0,0];
// the lowest part of the body touches the ground (feet when standing, knees/chest when down)
function ground(J,off,pose,clr){ clr=clr||CLR; const W=fk(J,off,pose,0); let need=-1e9; for(const b in clr){ const y=W[b][13]; need=Math.max(need,clr[b]-y); } return need; }
// pose angles are authored for straight limbs; subtract the model's own rest bends
function eff(pose,RP){ if(!RP) return pose; const o={}; for(const b of B){ const r=RP[b], v=pose[b]||Z3; o[b]=r?[v[0]-r[0],v[1]-r[1],v[2]-r[2]]:v; } return o; }
// ---------- procedural stand-in body (used until the real model data is present)
function hex(h){ return [parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255]; }
function nz(x,y,z){ return Math.sin(x*12.9+y*7.3)*Math.sin(y*9.1+z*11.7)*Math.sin(z*8.3+x*5.9); }
const sst=(a,b,x)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
function buildBody(J){
  const P=[],C=[],I=[],SI=[],SW=[];
  const SKIN=hex('#7b6a55'), SKIN2=hex('#5d4e3e'), CLOTH=hex('#2e3140'), ROPE=hex('#8a6a3a'), EYE=hex('#ffcf3a'), TUSK=hex('#e8dcc0'), NAIL=hex('#2a221b');
  function addV(p,c,wts){ P.push(p[0],p[1],p[2]); C.push(c[0],c[1],c[2]); wts.sort((a,b)=>b[1]-a[1]); const w=wts.slice(0,4); let s=0; for(const q of w) s+=q[1]; for(let k=0;k<4;k++){ SI.push(w[k]?w[k][0]:0); SW.push(w[k]?w[k][1]/s:0); } return P.length/3-1; }
  function grid(nu,nv,fn){ const base=P.length/3; for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++){ const r=fn(i/nu,j/nv); addV(r[0],r[1],r[2]); }
    for(let j=0;j<nv;j++) for(let i=0;i<nu;i++){ const a=base+j*(nu+1)+i, b=a+1, c=a+nu+1, d=c+1; I.push(a,c,b, b,c,d); } }
  function basis(d){ const l=Math.hypot(d[0],d[1],d[2]); const w=[d[0]/l,d[1]/l,d[2]/l]; let u=Math.abs(w[1])<.9?[0,1,0]:[1,0,0]; let v=[w[1]*u[2]-w[2]*u[1],w[2]*u[0]-w[0]*u[2],w[0]*u[1]-w[1]*u[0]]; const vl=Math.hypot(...v); v=v.map(q=>q/vl); u=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]]; return {w,u,v,l}; }
  const shade=(c,p,k)=>{ const n=1+nz(p[0],p[1],p[2])*.07*(k||1); return [c[0]*n,c[1]*n,c[2]*n]; };
  // capsule from a to b, radius r1->r2, muscle bulge, weights: own bone with parent/child blend at the joints
  function capsule(a,b,r1,r2,bulge,col,own,par,chi,flat){ const f=basis([b[0]-a[0],b[1]-a[1],b[2]-a[2]]); const L=f.l, NR=16;
    grid(18,NR,(i,j)=>{ // j: -r1 .. L+r2 along axis
      const s=j*(L+r1+r2)-r1; let h,r; if(s<0){ const q=Math.asin(Math.max(-1,s/r1)); h=s; r=r1*Math.cos(q); } else if(s>L){ const q=Math.asin(Math.min(1,(s-L)/r2)); h=s; r=r2*Math.cos(q); } else { const t=s/L; h=s; r=(r1+(r2-r1)*t)*(1+bulge*Math.sin(Math.PI*t)); }
      const ang=i*Math.PI*2, ca=Math.cos(ang), sa=Math.sin(ang)*(flat||1);
      const p=[a[0]+f.w[0]*h+(f.u[0]*ca+f.v[0]*sa)*r, a[1]+f.w[1]*h+(f.u[1]*ca+f.v[1]*sa)*r, a[2]+f.w[2]*h+(f.u[2]*ca+f.v[2]*sa)*r];
      const t=Math.min(1,Math.max(0,h/L)); const wt=[[BI[own],1]]; if(par){ const k=.5*(1-sst(0,.32,t)); if(k>0){ wt[0][1]-=k; wt.push([BI[par],k]); } } if(chi){ const k=.5*sst(.68,1,t); if(k>0){ wt[0][1]-=k; wt.push([BI[chi],k]); } }
      return [p,typeof col==='function'?col(p,t):shade(col,p),wt]; }); }
  function ell(c,rx,ry,rz,col,wfn,rot){ grid(20,14,(i,j)=>{ const th=i*Math.PI*2, ph=j*Math.PI-Math.PI/2; let x=Math.cos(ph)*Math.sin(th)*rx, y=Math.sin(ph)*ry, z=Math.cos(ph)*Math.cos(th)*rz;
      if(rot){ const cz=Math.cos(rot),sz=Math.sin(rot); const y2=y*cz-z*sz, z2=y*sz+z*cz; y=y2; z=z2; }
      const p=[c[0]+x,c[1]+y,c[2]+z]; return [p,typeof col==='function'?col(p):shade(col,p),wfn(p)]; }); }
  const j=J;
  // torso weights by height between the spine joints, shoulders blend into the collar bones
  const torsoW=p=>{ const y=p[1], ax=Math.abs(p[0]); const w=[]; const add=(b,k)=>{ if(k>1e-3) w.push([BI[b],k]); };
    const hS=j.spine[1], hC=j.chest[1], hN=j.neck[1];
    let wh=1-sst(hS-.12,hS+.06,y), wsp=sst(hS-.12,hS+.06,y)*(1-sst(hC-.1,hC+.08,y)), wch=sst(hC-.1,hC+.08,y)*(1-sst(hN-.06,hN+.06,y)), wn=sst(hN-.06,hN+.06,y);
    const sh=sst(.26,.46,ax)*sst(hC,hC+.2,y); const side=p[0]>0?'shL':'shR'; const k=1-sh;
    add('hips',wh*k); add('spine',wsp*k); add('chest',wch*k); add('neck',wn*k); add(side,sh);
    if(y<j.hips[1]-.02&&ax>.08){ const tt=sst(j.hips[1]-.02,j.hips[1]-.16,y)*.6; const th=p[0]>0?'thighL':'thighR'; for(const q of w) q[1]*=1-tt; w.push([BI[th],tt]); }
    return w.length?w:[[BI.hips,1]]; };
  const skinCol=p=>{ const n=nz(p[0]*1.3,p[1]*1.3,p[2]*1.3); const v=.5+.5*Math.sin(p[1]*23+Math.sin(p[0]*17)*2)*Math.sin(p[0]*31+p[2]*19); const k=v>.93?.78:1; const d=.92+n*.1; return [SKIN[0]*d*k,SKIN[1]*d*k,SKIN[2]*d*k]; };
  const clothCol=(p)=>{ const d=.9+nz(p[0]*3,p[1]*3,p[2]*3)*.15; return [CLOTH[0]*d,CLOTH[1]*d,CLOTH[2]*d]; };
  const legCol=(p,t)=>{ const rag=.36+.06*Math.sin(Math.atan2(p[2],p[0])*7+p[0]*20); return p[1]>rag?clothCol(p):skinCol(p); };
  const torsoCol=p=>{ if(p[1]<j.hips[1]-.06) return clothCol(p); if(p[1]<j.hips[1]+.02) return shade(ROPE,p,2); const d=Math.max(0,1-Math.abs(p[0])/.5)*(p[2]>0?1:0); return skinCol(p).map((q,i)=>q*(1-.08*(1-d))); };
  // torso: pelvis, belly, ribcage, big back/traps, pecs
  ell([0,j.hips[1]-.02,0],.33,.2,.25,torsoCol,torsoW);
  ell([0,j.spine[1]+.02,.03],.34,.26,.29,torsoCol,torsoW);
  ell([0,j.chest[1]+.06,-.01],.46,.34,.32,torsoCol,torsoW);
  ell([0,j.chest[1]+.2,-.07],.44,.18,.24,torsoCol,torsoW);
  ell([.15,j.chest[1]+.1,.17],.2,.14,.12,torsoCol,torsoW); ell([-.15,j.chest[1]+.1,.17],.2,.14,.12,torsoCol,torsoW);
  // neck + head (skull, heavy jaw, brow ridge, glowing eyes, tusks)
  capsule(j.neck,j.head,.15,.14,0,skinCol,'neck','chest','head');
  const H=j.head, hw=p=>[[BI.head,1]];
  ell([H[0],H[1]+.14,H[2]+.02],.19,.2,.21,skinCol,hw);
  ell([H[0],H[1]+.02,H[2]+.1],.17,.1,.15,skinCol,hw);
  ell([H[0],H[1]+.2,H[2]+.17],.17,.05,.07,p=>shade(SKIN2,p),hw);
  ell([H[0]+.075,H[1]+.155,H[2]+.2],.035,.022,.02,EYE,hw); ell([H[0]-.075,H[1]+.155,H[2]+.2],.035,.022,.02,EYE,hw);
  capsule([H[0]+.08,H[1]+.03,H[2]+.2],[H[0]+.1,H[1]+.13,H[2]+.25],.022,.006,0,TUSK,'head');
  capsule([H[0]-.08,H[1]+.03,H[2]+.2],[H[0]-.1,H[1]+.13,H[2]+.25],.022,.006,0,TUSK,'head');
  // arms: collar, upper arm, forearm, fists
  for(const s of ['L','R']){ const sg=s==='L'?1:-1;
    capsule(j['sh'+s],j['arm'+s],.16,.19,0,skinCol,'sh'+s,'chest','arm'+s);
    capsule(j['arm'+s],j['fore'+s],.19,.16,.14,skinCol,'arm'+s,'sh'+s,'fore'+s);
    capsule(j['fore'+s],j['hand'+s],.165,.12,.12,skinCol,'fore'+s,'arm'+s,'hand'+s);
    const h=j['hand'+s]; ell([h[0]+.01*sg,h[1]-.12,h[2]+.02],.13,.16,.14,skinCol,p=>{ const k=sst(h[1]-.02,h[1]+.06,p[1])*.5; return k>0?[[BI['hand'+s],1-k],[BI['fore'+s],k]]:[[BI['hand'+s],1]]; });
    ell([h[0]+.01*sg,h[1]-.24,h[2]+.08],.1,.04,.05,NAIL,p=>[[BI['hand'+s],1]]);
    // legs: thigh, shin, foot
    capsule(j['thigh'+s],j['shin'+s],.22,.16,.1,legCol,'thigh'+s,'hips','shin'+s);
    capsule(j['shin'+s],j['foot'+s],.16,.11,.12,legCol,'shin'+s,'thigh'+s,'foot'+s);
    const f=j['foot'+s]; ell([f[0],f[1]-.06,f[2]+.09],.12,.07,.21,skinCol,p=>{ const k=.5*(1-sst(f[1]-.05,f[1]+.04,p[1])); return [[BI['foot'+s],1-(.5-k)],[BI['shin'+s],.5-k]]; }); }
  return {p:new Float32Array(P),c:new Float32Array(C),i:new Uint16Array(I),si:new Uint16Array(SI),sw:new Float32Array(SW)}; }
// ---------- poses and clips
const S=(o)=>o; const PI=Math.PI;
function stance(){ return {hips:[0,0,0],spine:[.16,0,0],chest:[.12,0,0],neck:[-.08,0,0],head:[-.12,0,0],shL:[0,0,.05],shR:[0,0,-.05],
  armL:[-.12,0,.26],foreL:[-.4,0,0],handL:[0,0,0],armR:[-.12,0,-.26],foreR:[-.4,0,0],handR:[0,0,0],
  thighL:[-.3,0,.08],shinL:[.5,0,0],footL:[-.2,0,-.08],thighR:[-.3,0,-.08],shinR:[.5,0,0],footR:[-.2,0,.08]}; }
function gait(ph,amp,run){ const P=stance(), s=Math.sin(ph), c=Math.cos(ph), sw=a=>Math.pow(Math.max(0,a),1.3);
  P.thighL=[-.22-.6*amp*s,0,.08]; P.thighR=[-.22+.6*amp*s,0,-.08];
  P.shinL=[.3+amp*(.2+.8*sw(c)),0,0]; P.shinR=[.3+amp*(.2+.8*sw(-c)),0,0];
  P.footL=[-(P.thighL[0]+P.shinL[0])*.75-.1*amp*sw(c),0,-.08]; P.footR=[-(P.thighR[0]+P.shinR[0])*.75-.1*amp*sw(-c),0,.08];
  P.hips=[.04*run,-.16*amp*s,.06*amp*c]; P.spine=[.16+.2*run,.08*amp*s,-.03*amp*c]; P.chest=[.12+.12*run,.18*amp*s,-.05*amp*c];
  P.neck=[-.1-.1*run,-.12*amp*s,0]; P.head=[-.14-.12*run+.05*amp*Math.abs(c),-.1*amp*s,.04*amp*c];
  P.armL=[.5*amp*s-.12-.3*run,0,.28+.05*amp*c]; P.armR=[-.5*amp*s-.12-.3*run,0,-.28+.05*amp*c];
  P.foreL=[-.45-.35*run-.25*amp*Math.max(0,-s),0,0]; P.foreR=[-.45-.35*run-.25*amp*Math.max(0,s),0,0];
  P.handL=[.1*amp*c,0,0]; P.handR=[-.1*amp*c,0,0]; return P; }
const CLIPS={
  hammer:{d:1.5,ev:{hit:.62},k:[[0,{}],[.45,{spine:[-.28,0,0],chest:[-.22,0,0],neck:[-.1,0,0],head:[-.2,0,0],armL:[-2.75,0,-.42],armR:[-2.75,0,.42],foreL:[-.55,0,0],foreR:[-.55,0,0],shL:[0,0,.2],shR:[0,0,-.2],thighL:[-.1,0,.1],thighR:[-.1,0,-.1],shinL:[.15,0,0],shinR:[.15,0,0],footL:[-.05,0,-.08],footR:[-.05,0,.08]}],
    [.62,{spine:[.62,0,0],chest:[.38,0,0],neck:[.05,0,0],head:[.15,0,0],armL:[-.95,0,-.38],armR:[-.95,0,.38],foreL:[-.12,0,0],foreR:[-.12,0,0],thighL:[-.8,0,.16],shinL:[1.15,0,0],footL:[-.35,0,-.08],thighR:[-.28,0,-.16],shinR:[.95,0,0],footR:[-.67,0,.08]}],
    [.86,{spine:[.52,0,0],chest:[.3,0,0],head:[.05,0,0],armL:[-.8,0,-.34],armR:[-.8,0,.34],foreL:[-.25,0,0],foreR:[-.25,0,0],thighL:[-.72,0,.16],shinL:[1.05,0,0],footL:[-.33,0,-.08],thighR:[-.26,0,-.16],shinR:[.85,0,0],footR:[-.59,0,.08]}],[1.5,{}]]},
  hook:{d:1.15,ev:{hit:.48},k:[[0,{}],[.32,{hips:[0,-.32,0],spine:[.18,-.12,0],chest:[.1,-.6,0],head:[-.05,.45,0],armR:[-.35,0,-1.15],foreR:[-1.75,0,0],armL:[-1.05,0,.3],foreL:[-1.25,0,0],thighL:[-.6,0,.1],shinL:[.85,0,0],footL:[-.25,0,-.08],thighR:[-.08,0,-.1],shinR:[.35,0,0],footR:[-.27,0,.08]}],
    [.48,{hips:[0,.38,0],spine:[.3,.15,0],chest:[.25,.62,0],head:[.05,-.55,0],armR:[-1.45,0,-.95],foreR:[-.45,0,0],armL:[-.3,0,.45],foreL:[-1.3,0,0],thighL:[-.62,0,.1],shinL:[.5,0,0],footL:[.12,0,-.08],thighR:[.3,0,-.1],shinR:[.4,0,0],footR:[-.7,0,.08]}],
    [.68,{hips:[0,.48,0],spine:[.32,.2,0],chest:[.3,.9,0],head:[.05,-.7,0],armR:[-1.25,0,-.35],foreR:[-.95,0,0],armL:[-.25,0,.4],foreL:[-1.2,0,0],thighL:[-.6,0,.1],shinL:[.5,0,0],footL:[.1,0,-.08],thighR:[.3,0,-.1],shinR:[.45,0,0],footR:[-.75,0,.08]}],[1.15,{}]]},
  grab:{d:2.3,ev:{grab:.55,throw:1.56},k:[[0,{}],[.35,{spine:[.72,0,0],chest:[.3,0,0],neck:[-.25,0,0],head:[-.25,0,0],armL:[-1.3,0,-.18],armR:[-1.3,0,.18],foreL:[-.25,0,0],foreR:[-.25,0,0],thighL:[-.75,0,.14],thighR:[-.75,0,-.14],shinL:[1.15,0,0],shinR:[1.15,0,0],footL:[-.4,0,-.08],footR:[-.4,0,.08]}],
    [.55,{spine:[.7,0,0],chest:[.3,0,0],neck:[-.25,0,0],head:[-.2,0,0],armL:[-1.25,0,-.3],armR:[-1.25,0,.3],foreL:[-.7,0,0],foreR:[-.7,0,0],thighL:[-.75,0,.14],thighR:[-.75,0,-.14],shinL:[1.15,0,0],shinR:[1.15,0,0],footL:[-.4,0,-.08],footR:[-.4,0,.08]}],
    [1.05,{spine:[-.18,0,0],chest:[-.22,0,0],neck:[-.15,0,0],head:[-.2,0,0],armL:[-2.5,0,.45],armR:[-2.5,0,-.45],foreL:[-.5,0,0],foreR:[-.5,0,0],thighL:[-.15,0,.14],thighR:[-.15,0,-.14],shinL:[.25,0,0],shinR:[.25,0,0],footL:[-.1,0,-.08],footR:[-.1,0,.08]}],
    [1.4,{spine:[-.24,-.12,0],chest:[-.2,-.15,0],neck:[-.1,0,0],head:[-.25,0,0],armL:[-2.65,0,.4],armR:[-2.65,0,-.4],foreL:[-.9,0,0],foreR:[-.9,0,0],thighL:[-.25,0,.14],thighR:[-.1,0,-.14],shinL:[.35,0,0],shinR:[.3,0,0],footL:[-.1,0,-.08],footR:[-.2,0,.08]}],
    [1.58,{spine:[.58,.1,0],chest:[.32,.15,0],head:[.1,0,0],armL:[-1.05,0,-.25],armR:[-1.05,0,.25],foreL:[-.1,0,0],foreR:[-.1,0,0],thighL:[-.65,0,.14],shinL:[.65,0,0],footL:[0,0,-.08],thighR:[.3,0,-.14],shinR:[.35,0,0],footR:[-.65,0,.08]}],[2.3,{}]]},
  stomp:{d:1.3,ev:{hit:.6},k:[[0,{}],[.45,{spine:[.08,0,0],chest:[-.12,0,0],head:[.25,0,0],armL:[-.35,0,.95],armR:[-.35,0,-.95],foreL:[-.6,0,0],foreR:[-.6,0,0],thighR:[-1.55,0,-.1],shinR:[1.65,0,0],footR:[.15,0,.08],thighL:[-.1,0,.1],shinL:[.25,0,0],footL:[-.15,0,-.08]}],
    [.6,{spine:[.42,0,0],chest:[.15,0,0],head:[.35,0,0],armL:[.15,0,.75],armR:[.15,0,-.75],foreL:[-.4,0,0],foreR:[-.4,0,0],thighR:[-.6,0,-.1],shinR:[.5,0,0],footR:[.1,0,.08],thighL:[-.35,0,.1],shinL:[.85,0,0],footL:[-.5,0,-.08]}],[1.3,{}]]},
  roar:{d:1.9,ev:{roar:.4},k:[[0,{}],[.4,{spine:[-.18,0,0],chest:[-.38,0,0],neck:[-.3,0,0],head:[-.4,0,0],armL:[-.55,0,1.15],armR:[-.55,0,-1.15],foreL:[-1.35,0,0],foreR:[-1.35,0,0],shL:[0,0,.2],shR:[0,0,-.2],thighL:[-.4,0,.22],thighR:[-.4,0,-.22],shinL:[.65,0,0],shinR:[.65,0,0],footL:[-.25,0,-.2],footR:[-.25,0,.2]}],
    [1.35,{spine:[-.15,0,0],chest:[-.35,0,0],neck:[-.28,0,0],head:[-.36,0,0],armL:[-.5,0,1.1],armR:[-.5,0,-1.1],foreL:[-1.45,0,0],foreR:[-1.45,0,0],shL:[0,0,.2],shR:[0,0,-.2],thighL:[-.4,0,.22],thighR:[-.4,0,-.22],shinL:[.65,0,0],shinR:[.65,0,0],footL:[-.25,0,-.2],footR:[-.25,0,.2]}],[1.9,{}]]},
  hurt:{d:.55,ev:{},k:[[0,{}],[.12,{spine:[-.12,0,.1],chest:[-.2,.2,.08],head:[-.35,-.2,0],armL:[.1,0,.5],armR:[.1,0,-.5]}],[.55,{}]]},
  die:{d:2.4,hold:true,ev:{fall:1.9},k:[[0,{}],[.45,{spine:[-.25,0,.1],chest:[-.3,.2,0],head:[-.45,0,0],armL:[.3,0,.7],armR:[.3,0,-.7],thighL:[-.25,0,.1],shinL:[.45,0,0],thighR:[-.2,0,-.1],shinR:[.4,0,0]}],
    [1.15,{spine:[.45,0,0],chest:[.2,0,0],head:[.35,0,0],armL:[-.3,0,.2],armR:[-.3,0,-.2],foreL:[-.3,0,0],foreR:[-.3,0,0],thighL:[-1.55,0,.2],shinL:[2.2,0,0],footL:[-.5,0,0],thighR:[-1.55,0,-.2],shinR:[2.2,0,0],footR:[-.5,0,0]}],
    [1.9,{hips:[1.45,0,0],spine:[.15,0,0],chest:[.05,0,0],neck:[-.3,0,0],head:[-.5,.4,0],armL:[-2.7,0,.5],armR:[-2.6,0,-.6],foreL:[-.4,0,0],foreR:[-.2,0,0],thighL:[-.15,0,.2],shinL:[.4,0,0],footL:[.8,0,0],thighR:[-.05,0,-.15],shinR:[.2,0,0],footR:[.8,0,0]}],
    [2.4,{hips:[1.52,0,0],spine:[.1,0,0],chest:[0,0,0],neck:[-.3,0,0],head:[-.4,.6,0],armL:[-2.8,0,.55],armR:[-2.7,0,-.65],foreL:[-.3,0,0],foreR:[-.15,0,0],thighL:[-.1,0,.2],shinL:[.3,0,0],footL:[.9,0,0],thighR:[0,0,-.15],shinR:[.15,0,0],footR:[.9,0,0]}]]}
};
// fill every key with the stance for bones it doesn't mention
for(const n in CLIPS){ const st=stance(); for(const k of CLIPS[n].k){ const f={}; for(const b of B) f[b]=(k[1][b]||st[b]).slice(); k[1]=f; } }
function cr(p0,p1,p2,p3,t){ const t2=t*t,t3=t2*t; return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3); }
function clipPose(name,t){ const c=CLIPS[name], K=c.k; t=Math.min(Math.max(t,0),K[K.length-1][0]); let i=0; while(i<K.length-2&&t>K[i+1][0]) i++;
  const k0=K[Math.max(0,i-1)][1],k1=K[i][1],k2=K[i+1][1],k3=K[Math.min(K.length-1,i+2)][1]; const u=(t-K[i][0])/((K[i+1][0]-K[i][0])||1);
  const out={}; for(const b of B){ out[b]=[0,1,2].map(a=>cr(k0[b][a],k1[b][a],k2[b][a],k3[b][a],u)); } return out; }
return {B,PAR,BI,J0,offsets,fk,ground,eff,buildBody,stance,gait,CLIPS,clipPose,mMul,mEuler};
})();
