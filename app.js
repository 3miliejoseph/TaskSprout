'use strict';

const $ = id => document.getElementById(id);
function fmt(s){ return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
function escHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Persistence (localStorage) ─────────────────────────────────────────────
function loadTodos(){
  try { return JSON.parse(localStorage.getItem('ts-todos') || '[]'); } catch { return []; }
}
function saveTodos(todos){
  localStorage.setItem('ts-todos', JSON.stringify(todos));
}
function loadMemos(){
  try { return JSON.parse(localStorage.getItem('ts-memos') || '[]'); } catch { return []; }
}
function saveMemos(memos){
  // strip blob URLs before saving (can't persist across sessions)
  localStorage.setItem('ts-memos', JSON.stringify(memos.map(m => ({...m, blobUrl: undefined}))));
}

// ── State ──────────────────────────────────────────────────────────────────
let todos   = loadTodos();
let memos   = loadMemos();
let tid     = todos.reduce((m,t) => Math.max(m, t.id+1), 1);
let mid     = memos.reduce((m,x) => Math.max(m, x.id+1), 1);
let wasComplete = false;
let recording   = false, recSecs = 0, recInterval = null;
let mediaRecorder = null, audioChunks = [];
let landRaf = null, bloomRaf = null;

// ── Screen nav ─────────────────────────────────────────────────────────────
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-'+name).classList.add('active');
  if(name === 'landing'){ startLandingIdle(); stopBloom(); }
  else if(name === 'reward'){ stopLanding(); startBloom(); }
  else { stopLanding(); stopBloom(); }
}

$('btn-start').addEventListener('click', () => showScreen('app'));
$('btn-end').addEventListener('click',   () => showScreen('reward'));
$('btn-new-day').addEventListener('click', () => {
  todos = []; saveTodos(todos); renderTasks(); updateProgress();
  showScreen('app');
});

// ── Date ───────────────────────────────────────────────────────────────────
(function(){
  const now = new Date();
  $('day-name').textContent  = now.toLocaleDateString('en-US',{weekday:'long'});
  $('day-num').textContent   = now.getDate();
  $('month-str').textContent = now.toLocaleDateString('en-US',{month:'long',year:'numeric'});
})();

// ── Progress ───────────────────────────────────────────────────────────────
function getPct(){
  const n=todos.length, d=todos.filter(t=>t.done).length;
  return n ? Math.round(d/n*100) : 0;
}

function updateProgress(){
  const d=todos.filter(t=>t.done).length, n=todos.length, p=getPct();
  $('prog-fill').style.width  = p+'%';
  $('prog-count').textContent = d+' of '+n+' complete';
  $('prog-pct').textContent   = p+'%';

  if(p===100 && n>0 && !wasComplete){
    wasComplete = true;
    triggerCompleteAnimation();
  } else if(p < 100){
    wasComplete = false;
    $('prog-pct').style.color   = '';
    $('prog-count').style.color = '';
    const card = $('prog-card');
    card.style.borderColor = '';
    card.style.background  = '';
  }
}

function triggerCompleteAnimation(){
  const card  = $('prog-card');
  const track = $('prog-track');
  $('prog-pct').style.color   = '#3a5a3e';
  $('prog-count').style.color = '#5c7d61';
  card.style.borderColor = '#a8c5aa';
  card.style.background  = '#ddeedd';
  setTimeout(()=>{ card.style.background='#e8ede5'; }, 1200);

  for(let i=0;i<3;i++){
    setTimeout(()=>{
      const ring=document.createElement('div'); ring.className='ring-pulse';
      ring.style.animation=`ring-out ${.8+i*.2}s ease-out forwards`;
      track.appendChild(ring);
      setTimeout(()=>ring.remove(),1100);
    }, i*200);
  }

  const colors=['#d4c4d8','#c8dbc9','#e8d4c0','#d8c4c8','#c4d4c0','#e0d0c4'];
  for(let i=0;i<18;i++){
    setTimeout(()=>{
      const p=document.createElement('div'); p.className='petal-particle';
      const mx=(Math.random()-.5)*40,fx=(Math.random()-.5)*70,ex=(Math.random()-.5)*90;
      const mr=-30+Math.random()*80,fr=mr+(Math.random()-.5)*120,er=fr+(Math.random()-.5)*60;
      const dur=2.2+Math.random()*2,delay=Math.random()*1.2,size=5+Math.random()*9;
      p.style.cssText=`width:${size}px;height:${size}px;left:${5+Math.random()*90}%;top:4px;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        --mx:${mx}px;--mr:${mr}deg;--fx:${fx}px;--fr:${fr}deg;--ex:${ex}px;--er:${er}deg;
        animation:petal-drift ${dur}s cubic-bezier(.25,.8,.3,1) ${delay}s forwards;
        position:absolute;`;
      card.appendChild(p);
      setTimeout(()=>p.remove(),(dur+delay)*1000+200);
    }, i*60);
  }
}

// ── Tasks ──────────────────────────────────────────────────────────────────
function renderTasks(){
  const list=$('task-list'); list.innerHTML='';
  if(!todos.length){
    const li=document.createElement('li'); li.className='task-empty';
    li.textContent='Nothing here yet'; list.appendChild(li); return;
  }
  todos.forEach(t=>{
    const li=document.createElement('li');
    li.className='task-item'+(t.done?' done':'');
    li.innerHTML=`<div class="check ${t.done?'on':''}"></div><span class="task-text">${escHtml(t.text)}</span><button class="task-del">×</button>`;
    li.querySelector('.check').onclick=()=>{ t.done=!t.done; saveTodos(todos); renderTasks(); updateProgress(); };
    li.querySelector('.task-del').onclick=()=>{ todos=todos.filter(x=>x!==t); saveTodos(todos); renderTasks(); updateProgress(); };
    list.appendChild(li);
  });
  updateProgress();
}

function addTask(){
  const inp=$('task-inp'), text=inp.value.trim();
  if(!text) return;
  todos.unshift({id:tid++,text,done:false});
  inp.value=''; saveTodos(todos); renderTasks(); updateProgress();
}
$('btn-add').addEventListener('click', addTask);
$('task-inp').addEventListener('keydown', e=>{ if(e.key==='Enter') addTask(); });

// ── Voice memos ────────────────────────────────────────────────────────────
$('rec-btn').addEventListener('click', async ()=>{
  if(!recording){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const opts=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?{mimeType:'audio/webm;codecs=opus'}:{};
      mediaRecorder=new MediaRecorder(stream,opts);
      audioChunks=[];
      mediaRecorder.ondataavailable=e=>{ if(e.data.size>0) audioChunks.push(e.data); };
      mediaRecorder.onstop=()=>{ stream.getTracks().forEach(t=>t.stop()); onRecordStop(); };
      mediaRecorder.start(100);
    }catch(e){
      // mic blocked — still allow simulated recording
    }
    recording=true; recSecs=0;
    $('rec-btn').classList.add('recording');
    $('rec-label').textContent='Stop';
    recInterval=setInterval(()=>{ recSecs++; $('rec-timer').textContent=fmt(recSecs); },1000);
  } else {
    recording=false; clearInterval(recInterval);
    $('rec-btn').classList.remove('recording');
    $('rec-label').textContent='Record';
    $('rec-timer').textContent='00:00';
    if(mediaRecorder&&mediaRecorder.state!=='inactive') mediaRecorder.stop();
    else onRecordStop();
  }
});

async function onRecordStop(){
  const dur=recSecs;
  const ts=new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  const id=mid++;

  // create object URL for in-session playback
  let blobUrl=null;
  if(audioChunks.length){
    const blob=new Blob(audioChunks,{type:'audio/webm'});
    blobUrl=URL.createObjectURL(blob);
  }

  const memo={id,name:'Voice memo',timestamp:ts,dur:fmt(dur),blobUrl,generating:true};
  memos.unshift(memo);
  saveMemos(memos);
  renderMemos();

  // AI title via serverless function
  const title=await generateMemoTitle(dur,ts);
  memo.name=title;
  memo.generating=false;
  saveMemos(memos);
  renderMemos();
}

async function generateMemoTitle(durationSecs,ts){
  const hour=new Date().getHours();
  const timeOfDay=hour<12?'morning':hour<17?'afternoon':'evening';
  try{
    const res=await fetch('/api/generate-title',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({durationSecs,timeOfDay})
    });
    const data=await res.json();
    return data.title||`Memo · ${ts}`;
  }catch{
    return `Memo · ${ts}`;
  }
}

function renderMemos(){
  const nl=$('memos-list'); nl.innerHTML='';
  if(!memos.length){ nl.innerHTML='<div class="memo-empty">No memos yet</div>'; return; }
  memos.forEach((m,idx)=>{
    const card=document.createElement('div'); card.className='memo-card';

    const title=document.createElement('div'); title.className='memo-title';
    title.contentEditable=false; title.textContent=m.name;
    let tap=null;
    title.addEventListener('click',()=>{
      if(tap){ clearTimeout(tap);tap=null;title.contentEditable=true;title.focus();
        const r=document.createRange();r.selectNodeContents(title);
        const s=window.getSelection();s.removeAllRanges();s.addRange(r);
      } else tap=setTimeout(()=>{tap=null;},300);
    });
    title.addEventListener('blur',()=>{ m.name=title.textContent.trim()||m.name;title.textContent=m.name;title.contentEditable=false;saveMemos(memos); });
    title.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();title.blur();}if(e.key==='Escape'){title.textContent=m.name;title.blur();} });

    const header=document.createElement('div'); header.className='memo-header';
    const del=document.createElement('button'); del.className='memo-del'; del.textContent='×';
    del.addEventListener('click',()=>{ memos.splice(idx,1); saveMemos(memos); renderMemos(); });
    header.append(title,del);

    const meta=document.createElement('div'); meta.className='memo-meta';
    meta.textContent=m.timestamp+' · '+m.dur;

    card.append(header,meta);

    // audio playback if blob URL exists (in-session only)
    if(m.blobUrl){
      const audio=document.createElement('audio');
      audio.className='memo-audio';
      audio.controls=true;
      audio.src=m.blobUrl;
      card.append(audio);
    }

    if(m.generating){
      const gen=document.createElement('div'); gen.className='memo-generating';
      gen.textContent='generating title…'; card.append(gen);
    }

    nl.appendChild(card);
  });
}

// ── Landing canvas ─────────────────────────────────────────────────────────
const landCanvas=$('land-c'), lctx=landCanvas.getContext('2d');
const LW=200,LH=210,lcx=LW/2;
const POT_BODY_H=26,POT_RIM_H=11;
const L_POT_RIM=LH-6-POT_BODY_H-POT_RIM_H;
const L_STEM_H=82,L_STEM_TOP=L_POT_RIM-L_STEM_H;
let landTime=0,landLast=null;

function drawLandingFrame(ts){
  if(!landLast) landLast=ts;
  landTime+=(ts-landLast)/1000; landLast=ts;
  lctx.clearRect(0,0,LW,LH);
  const sway=Math.sin(landTime*.42)*2.6+Math.sin(landTime*.26)*1.1;
  const breathe=Math.sin(landTime*.22)*.011;
  const fx=lcx+sway*.20;
  lctx.save(); lctx.strokeStyle='#5a8c5e'; lctx.lineWidth=4; lctx.lineCap='round';
  lctx.beginPath(); lctx.moveTo(lcx,L_POT_RIM-1);
  lctx.quadraticCurveTo(lcx+sway*.5,L_POT_RIM-L_STEM_H*.5,fx,L_STEM_TOP);
  lctx.stroke(); lctx.restore();
  window.LEAF_DEFS.forEach(l=>{
    const ly=L_STEM_TOP+L_STEM_H*l.oy,lx=lcx+sway*l.oy*.16;
    window.drawLeaf(lctx,lx,ly,l.side,l.len*(1+breathe),l.thk,l.droop,l.col,l.vc,1);
  });
  window.drawRanunculus(lctx,fx,L_STEM_TOP,1,1+breathe);
  window.drawPot(lctx,lcx,L_POT_RIM,POT_BODY_H,POT_RIM_H);
  landRaf=requestAnimationFrame(drawLandingFrame);
}
function startLandingIdle(){ if(!landRaf) landRaf=requestAnimationFrame(drawLandingFrame); }
function stopLanding(){ if(landRaf){cancelAnimationFrame(landRaf);landRaf=null;landLast=null;} }

// ── Bloom canvas ───────────────────────────────────────────────────────────
const bloomCanvas=$('bloom-c'), bctx=bloomCanvas.getContext('2d');
const BW=220,BH=250,bcx=BW/2;
const B_POT_RIM=BH-48,B_STEM_H=110,BLOOM_MS=5400;
const LEAF_TIMINGS=[.34,.40,.44,.49,.52,.56];

function startBloom(){
  if(bloomRaf){cancelAnimationFrame(bloomRaf);bloomRaf=null;}
  const pct=getPct();
  const maxH=pct===0?0:Math.max(18,Math.round(B_STEM_H*pct/100));
  const leafCount=pct===0?0:pct<=20?2:pct<=40?3:pct<=60?4:pct<=80?5:6;

  $('reward-title').textContent=pct===100?'Day complete!':pct===0?'Day ended':'Great effort!';
  $('reward-msg').textContent=pct===100?'You completed everything — full bloom!':pct===0?'No tasks completed. The pot is waiting for you.':'You finished '+pct+'% of your tasks.';

  const start=performance.now();
  function frame(now){
    const t=Math.min((now-start)/BLOOM_MS,1);
    bctx.clearRect(0,0,BW,BH);
    const stemP=window.PlantUtils.easeInOutSine(window.PlantUtils.clamp01((t-.05)/.30));
    const drawnH=maxH*stemP;
    if(drawnH>0){
      bctx.save(); bctx.strokeStyle='#5a8c5e'; bctx.lineWidth=5; bctx.lineCap='round';
      const topY=B_POT_RIM-drawnH;
      const ns=Math.sin(stemP*Math.PI)*2*(1-stemP*.7);
      bctx.beginPath(); bctx.moveTo(bcx,B_POT_RIM-1);
      bctx.quadraticCurveTo(bcx+ns*.5,B_POT_RIM-drawnH*.5,bcx,topY);
      bctx.stroke(); bctx.restore();
    }
    window.LEAF_DEFS.slice(0,leafCount).forEach((l,i)=>{
      const lp=window.PlantUtils.easeOutBack(window.PlantUtils.clamp01((t-(LEAF_TIMINGS[i]||.34))/.14),1.12);
      if(lp<=0) return;
      window.drawLeaf(bctx,bcx,B_POT_RIM-maxH+maxH*l.oy,l.side,l.len*lp,l.thk,l.droop,l.col,l.vc,lp);
    });
    if(pct===100){
      const rP=window.PlantUtils.easeInOutSine(window.PlantUtils.clamp01((t-.64)/.36));
      window.drawRanunculus(bctx,bcx,B_POT_RIM-maxH,rP);
    }
    window.drawPot(bctx,bcx,B_POT_RIM,26,11);
    if(t<1) bloomRaf=requestAnimationFrame(frame);
  }
  bloomRaf=requestAnimationFrame(frame);
}
function stopBloom(){ if(bloomRaf){cancelAnimationFrame(bloomRaf);bloomRaf=null;} }

// ── Boot ───────────────────────────────────────────────────────────────────
renderTasks();
renderMemos();
updateProgress();
showScreen('landing');
