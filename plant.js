// plant.js — shared canvas drawing functions for TaskSprout
// Exposes: drawPot, drawLeaf, drawPetal, drawRanunculus, LEAF_DEFS

'use strict';

function easeInOutSine(t){ return -(Math.cos(Math.PI*t)-1)/2; }
function easeOutCubic(t){ return 1-Math.pow(1-t,3); }
function easeInOutQuart(t){ return t<.5?8*t*t*t*t:1-Math.pow(-2*t+2,4)/2; }
function easeOutBack(t,s=1.1){ return 1+(s+1)*Math.pow(t-1,3)+s*Math.pow(t-1,2); }
function easeOutExpo(t){ return t===1?1:1-Math.pow(2,-10*t); }
function clamp01(x){ return Math.max(0,Math.min(1,x)); }
function lerp(a,b,t){ return a+(b-a)*t; }
function bezierPt(p0,p1,p2,p3,t){ return Math.pow(1-t,3)*p0+3*Math.pow(1-t,2)*t*p1+3*(1-t)*t*t*p2+t*t*t*p3; }
function bezierTan(p0,p1,p2,p3,t){ return 3*Math.pow(1-t,2)*(p1-p0)+6*(1-t)*t*(p2-p1)+3*t*t*(p3-p2); }

window.PlantUtils = { easeInOutSine, easeInOutQuart, easeOutBack, clamp01 };

function drawPot(ctx, cx, pr, bodyH=26, rimH=11) {
  ctx.fillStyle='#c4a882'; ctx.beginPath(); ctx.roundRect(cx-30,pr+rimH,60,bodyH,5); ctx.fill();
  ctx.fillStyle='#b8956e'; ctx.beginPath(); ctx.roundRect(cx-35,pr,70,rimH,4); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.07)'; ctx.beginPath(); ctx.roundRect(cx-14,pr+rimH,10,bodyH,3); ctx.fill();
  ctx.fillStyle='#8a6040'; ctx.beginPath(); ctx.ellipse(cx,pr+2,28,6,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#a07850'; ctx.beginPath(); ctx.ellipse(cx-4,pr+1,12,3.5,-0.2,0,Math.PI*2); ctx.fill();
}
window.drawPot = drawPot;

function drawLeaf(ctx, ax, ay, side, len, thk, droop, color, vc, p) {
  if(p<=0) return;
  len*=p; thk*=p;
  ctx.save(); ctx.globalAlpha=Math.min(p*1.1,1);
  const tx=ax+side*len*.80,ty=ay+len*droop;
  const cp1x=ax+side*len*.18,cp1y=ay-thk*.75;
  const cp2x=ax+side*len*.74,cp2y=ty-thk*.5;
  const lp1x=ax+side*len*.20,lp1y=ay+thk*.55;
  const lp2x=ax+side*len*.70,lp2y=ty+thk*.18;
  ctx.beginPath(); ctx.moveTo(ax,ay);
  ctx.bezierCurveTo(cp1x,cp1y,cp2x,cp2y,tx,ty);
  ctx.bezierCurveTo(lp2x,lp2y,lp1x,lp1y,ax,ay);
  ctx.fillStyle=color; ctx.fill();
  const g=ctx.createLinearGradient(ax,ay-thk,ax,ay+thk*.7);
  g.addColorStop(0,'rgba(255,255,255,0.14)'); g.addColorStop(.4,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.09)');
  ctx.beginPath(); ctx.moveTo(ax,ay);
  ctx.bezierCurveTo(cp1x,cp1y,cp2x,cp2y,tx,ty);
  ctx.bezierCurveTo(lp2x,lp2y,lp1x,lp1y,ax,ay);
  ctx.fillStyle=g; ctx.fill();
  const mc1x=ax+side*len*.20,mc1y=lerp(cp1y,lp1y,.5);
  const mc2x=ax+side*len*.72,mc2y=lerp(cp2y,lp2y,.5);
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.bezierCurveTo(mc1x,mc1y,mc2x,mc2y,tx,ty);
  ctx.strokeStyle=vc; ctx.lineWidth=.9; ctx.globalAlpha=p*.48; ctx.stroke();
  ctx.lineWidth=.45; ctx.globalAlpha=p*.2;
  for(let i=1;i<=5;i++){
    const tt=i/6;
    const mx=bezierPt(ax,mc1x,mc2x,tx,tt),my=bezierPt(ay,mc1y,mc2y,ty,tt);
    const dx=bezierTan(ax,mc1x,mc2x,tx,tt),dy=bezierTan(ay,mc1y,mc2y,ty,tt);
    const n=Math.sqrt(dx*dx+dy*dy)||1;
    const nx=-dy/n,ny=dx/n,vl=thk*(.55-i*.05);
    ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(mx+nx*vl,my+ny*vl); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(mx-nx*vl*.4,my-ny*vl*.4); ctx.stroke();
  }
  ctx.globalAlpha=1; ctx.restore();
}
window.drawLeaf = drawLeaf;

function drawPetal(ctx, fcx, fcy, angle, orbitR, pw, ph, tilt, color, alpha, progress, ws) {
  if(alpha<=0||progress<=0) return;
  ctx.save(); ctx.translate(fcx,fcy); ctx.rotate(angle); ctx.globalAlpha=clamp01(alpha);
  const p=easeInOutSine(progress);
  const r=orbitR*p,w=pw*(.3+tilt*.7)*p,h=ph*(.6+p*.4),cup=(1-tilt)*h*.38*p;
  ctx.translate(0,-r);
  const wL=w*(1+ws*.08),wR=w*(1-ws*.06),und=w*.12*p;
  ctx.beginPath(); ctx.moveTo(0,h*.08);
  ctx.bezierCurveTo(-wL*.85,h*.08-cup*.5,-wL*.92-und,-h*.35,-wL*.55,-h*.72);
  ctx.bezierCurveTo(-wL*.22,-h*1.04,wR*.22,-h*1.04,wR*.55,-h*.72);
  ctx.bezierCurveTo(wR*.92+und*.85,-h*.35,wR*.85,h*.08-cup*.5,0,h*.08);
  ctx.fillStyle=color; ctx.fill();
  const sg=ctx.createRadialGradient(0,-h*.3,0,0,-h*.3,w*1.1);
  sg.addColorStop(0,'rgba(0,0,0,0)'); sg.addColorStop(.5,'rgba(0,0,0,0)'); sg.addColorStop(1,'rgba(80,20,30,0.14)');
  ctx.beginPath(); ctx.moveTo(0,h*.08);
  ctx.bezierCurveTo(-wL*.85,h*.08-cup*.5,-wL*.92-und,-h*.35,-wL*.55,-h*.72);
  ctx.bezierCurveTo(-wL*.22,-h*1.04,wR*.22,-h*1.04,wR*.55,-h*.72);
  ctx.bezierCurveTo(wR*.92+und*.85,-h*.35,wR*.85,h*.08-cup*.5,0,h*.08);
  ctx.fillStyle=sg; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-w*.1,-h*.05);
  ctx.bezierCurveTo(-w*.38,-h*.28,-w*.32,-h*.62,-w*.1,-h*.88);
  ctx.strokeStyle='rgba(255,255,255,0.30)'; ctx.lineWidth=w*.22; ctx.lineCap='round';
  ctx.globalAlpha=clamp01(alpha)*.5*p; ctx.stroke();
  ctx.restore();
}
window.drawPetal = drawPetal;

const RING_DEFS = [
  {n:12,r:18,pw:13,ph:15,tilt:1.00,col:'#ddb0b8',ps:.00},
  {n:11,r:14,pw:12,ph:15,tilt:.90, col:'#d4a0a8',ps:.08},
  {n:10,r:10,pw:11,ph:14,tilt:.75, col:'#ca909a',ps:.17},
  {n: 9,r: 7,pw:10,ph:13,tilt:.58, col:'#c0828e',ps:.26},
  {n: 8,r: 4,pw: 9,ph:12,tilt:.40, col:'#b67282',ps:.36},
  {n: 6,r: 2,pw: 7,ph:11,tilt:.20, col:'#ac6274',ps:.48},
  {n: 4,r: 0,pw: 5,ph: 9,tilt:.05, col:'#a05268',ps:.60},
];

function drawRanunculus(ctx, fx, fy, progress, scale=1) {
  if(progress<=0) return;
  const s=scale;
  [...RING_DEFS].reverse().forEach((ring,ri)=>{
    const rIdx=RING_DEFS.length-1-ri;
    const rP=clamp01((progress-ring.ps)/.50);
    if(rP<=0) return;
    for(let i=0;i<ring.n;i++){
      const ang=(i/ring.n)*Math.PI*2+rIdx*(Math.PI/ring.n)*.7;
      const op=clamp01((rP-(i/ring.n)*.12)/.80);
      const ws=Math.sin(rIdx*7.3+i*13.1)*.5;
      const al=easeOutCubic(rP)*(.82+rIdx*.025);
      drawPetal(ctx,fx,fy,ang,ring.r*s,ring.pw*s,ring.ph*s,ring.tilt,ring.col,al,op,ws);
    }
  });
  const cp=clamp01((progress-.72)/.28);
  if(cp>0){
    ctx.save(); ctx.translate(fx,fy);
    const cr=4.5*s*easeOutBack(cp,1.2);
    ctx.globalAlpha=easeOutExpo(cp)*.95;
    const cg=ctx.createRadialGradient(0,0,0,0,0,cr);
    cg.addColorStop(0,'#98485e'); cg.addColorStop(1,'#8a3c52');
    ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(0,0,cr,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha=1;
}
window.drawRanunculus = drawRanunculus;

window.LEAF_DEFS = [
  {side:-1,oy:.82,len:26,thk:11,droop:-.20,col:'#6aab6e',vc:'rgba(34,82,34,0.6)'},
  {side: 1,oy:.74,len:20,thk:10,droop:-.15,col:'#74b876',vc:'rgba(38,86,38,0.6)'},
  {side: 1,oy:.56,len:30,thk:12,droop:-.18,col:'#68a86c',vc:'rgba(32,80,32,0.6)'},
  {side:-1,oy:.48,len:24,thk:11,droop:-.12,col:'#72b472',vc:'rgba(36,84,36,0.6)'},
  {side:-1,oy:.30,len:32,thk:13,droop:-.22,col:'#6aaa6e',vc:'rgba(34,84,34,0.6)'},
  {side: 1,oy:.24,len:25,thk:11,droop:-.16,col:'#7cbc7c',vc:'rgba(40,90,40,0.6)'},
];
