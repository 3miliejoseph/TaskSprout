'use strict';

// ── Themed Confirmation Modal ───────────────────────────────────────────────
function themedConfirm(message) {
  return new Promise(resolve => {
    // Create modal background
    const bg = document.createElement('div');
    bg.className = 'tsprout-modal-bg';
    // Modal box
    const modal = document.createElement('div');
    modal.className = 'tsprout-modal';
    // Title/message
    const title = document.createElement('div');
    title.className = 'tsprout-modal-title';
    title.textContent = message;
    // Buttons
    const btns = document.createElement('div');
    btns.className = 'tsprout-modal-btns';
    const yes = document.createElement('button');
    yes.className = 'tsprout-modal-btn';
    yes.textContent = 'Delete';
    const no = document.createElement('button');
    no.className = 'tsprout-modal-btn cancel';
    no.textContent = 'Cancel';
    btns.appendChild(yes);
    btns.appendChild(no);
    modal.appendChild(title);
    modal.appendChild(btns);
    bg.appendChild(modal);
    document.body.appendChild(bg);
    // Focus for accessibility
    yes.focus();
    // Handlers
    function cleanup() {
      document.body.removeChild(bg);
    }
    yes.onclick = () => { cleanup(); resolve(true); };
    no.onclick = () => { cleanup(); resolve(false); };
    bg.onclick = e => { if (e.target === bg) { cleanup(); resolve(false); } };
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { cleanup(); resolve(false); document.removeEventListener('keydown', esc); }
    });
  });
}

'use strict';

document.addEventListener('DOMContentLoaded', () => {

// ── Helpers ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function fmt(s){ return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }

// ── State ─────────────────────────────────────────────────────────────────────

let todos = [], memos = [], tid = 1, mid = 1;
let recording = false, recSecs = 0, recInterval = null;
let mediaRecorder = null, audioChunks = [];
let wasComplete = false;
let landRaf = null, bloomRaf = null;

// ── Screen navigation ─────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');

  if (name === 'landing') {
    startLandingIdle();
  } else {
    stopLanding();
    if (name === 'reward') startBloom();
    else stopBloom();
  }
}

$('btn-start').addEventListener('click', async () => {
  console.log('[DEBUG] Start day button clicked');
  try {
    await loadTodos();
    await loadMemos();
    const todayStr = new Date().toLocaleDateString('en-CA');
    const lastOpened = localStorage.getItem('tasksprout-last-date');
    if (lastOpened !== todayStr) {
      // New day: clear tasks and memos
      todos = [];
      memos = [];
      saveTodos();
      saveMemos();
      renderTasks();
      renderMemos();
      updateProgress();
      localStorage.setItem('tasksprout-last-date', todayStr);
    } else {
      // Same day: render loaded data
      renderTasks();
      renderMemos();
      updateProgress();
    }
    showScreen('app');
  } catch (err) {
    console.error('[ERROR] Start day handler failed:', err);
    alert('Error: ' + (err && err.message ? err.message : err));
  }
});
$('btn-end').addEventListener('click', () => showScreen('reward'));
$('btn-new-day').addEventListener('click', () => {
  todos = [];
  memos = [];
  saveTodos();
  saveMemos();
  renderTasks();
  renderMemos();
  updateProgress();
  showScreen('app');
});

// ── Date display ──────────────────────────────────────────────────────────────

(function() {
  const now = new Date();
  $('day-name').textContent = now.toLocaleDateString('en-US', { weekday: 'long' });
  $('day-num').textContent  = now.getDate();
  $('month-str').textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
})();

// ── Persistence ───────────────────────────────────────────────────────────────
async function loadTodos() {
  if (window.api) {
    todos = await window.api.todos.load();
  } else {
    const raw = localStorage.getItem('tasksprout-todos');
    todos = raw ? JSON.parse(raw) : [];
  }
  tid = todos.reduce((m, t) => Math.max(m, t.id + 1), 1);
}
function saveTodos() {
  if (window.api) {
    window.api.todos.save(todos);
  } else {
    localStorage.setItem('tasksprout-todos', JSON.stringify(todos));
  }
}
async function loadMemos() {
  if (window.api) {
    memos = await window.api.memos.load();
  } else {
    const raw = localStorage.getItem('tasksprout-memos');
    memos = raw ? JSON.parse(raw) : [];
    // Load audio blobs from localStorage
    for (const m of memos) {
      if (m.audioKey) {
        const audioData = localStorage.getItem(m.audioKey);
        if (audioData) {
          m.audioDataUrl = audioData;
        }
      }
    }
  }
  mid = memos.reduce((m, x) => Math.max(m, x.id + 1), 1);
}
function saveMemos() {
  if (window.api) {
    window.api.memos.saveMeta(memos.map(m => ({...m, audioData: undefined})));
  } else {
    localStorage.setItem('tasksprout-memos', JSON.stringify(memos));
  }
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
function getPct() {
  const n = todos.length, d = todos.filter(t => t.done).length;
  return n ? Math.round(d / n * 100) : 0;
}

function updateProgress() {
  const d = todos.filter(t => t.done).length, n = todos.length, p = getPct();
  $('prog-fill').style.width = p + '%';
  $('prog-count').textContent = d + ' of ' + n + ' complete';
  $('prog-pct').textContent   = p + '%';

  if (p === 100 && n > 0 && !wasComplete) {
    wasComplete = true;
    triggerCompleteAnimation();
  } else if (p < 100) {
    wasComplete = false;
    $('prog-pct').style.color = '';
    $('prog-count').style.color = '';
    const card = document.querySelector('.prog-card');
    card.style.borderColor = '';
    card.style.background  = '';
  }
}

function triggerCompleteAnimation() {
  const card = document.querySelector('.prog-card');
  const track = document.querySelector('.prog-track');
  const right = document.querySelector('.right');

  $('prog-pct').style.color = '#3a5a3e';
  $('prog-count').style.color = '#5c7d61';
  card.style.borderColor = '#a8c5aa';
  card.style.background  = '#ddeedd';
  setTimeout(() => { card.style.background = '#e8ede5'; }, 1200);

  // ripple rings
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const ring = document.createElement('div');
      ring.className = 'ring-pulse';
      ring.style.animation = `ring-out ${.8+i*.2}s ease-out forwards`;
      track.style.position = 'relative'; track.style.overflow = 'visible';
      track.appendChild(ring);
      setTimeout(() => ring.remove(), 1100);
    }, i * 200);
  }

  // petal drift — appended to .right so they fall over the full task section
  const colors = ['#d4c4d8','#c8dbc9','#e8d4c0','#d8c4c8','#c4d4c0','#e0d0c4'];
  for (let i = 0; i < 32; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'petal-particle';
      const mx=(Math.random()-.5)*40,fx=(Math.random()-.5)*70,ex=(Math.random()-.5)*90;
      const mr=-30+Math.random()*80,fr=mr+(Math.random()-.5)*120,er=fr+(Math.random()-.5)*60;
      const dur=2.8+Math.random()*1.2,delay=Math.random()*0.8;
      const size=5+Math.random()*9;
      p.style.cssText=`width:${size}px;height:${size}px;left:${4+Math.random()*92}%;top:0px;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        --mx:${mx}px;--mr:${mr}deg;--fx:${fx}px;--fr:${fr}deg;--ex:${ex}px;--er:${er}deg;
        animation:petal-drift ${dur}s cubic-bezier(.25,.8,.3,1) ${delay}s forwards;
        position:absolute;`;
      right.appendChild(p);
      setTimeout(() => p.remove(), (dur+delay)*1000+200);
    }, i * 40);
  }
}

function renderTasks() {
  const list = $('task-list');
  list.innerHTML = '';
  if (!todos.length) {
    const li = document.createElement('li');
    li.className = 'task-empty';
    li.textContent = 'No tasks yet';
    list.appendChild(li);
    return;
  }
  todos.forEach(t => {
    const li = document.createElement('li');
    li.className = 'task-item' + (t.done ? ' done' : '');
    li.innerHTML = `<div class="check ${t.done?'on':''}"></div><span class="task-text">${escHtml(t.text)}</span><button class="task-del">×</button>`;
    li.querySelector('.check').onclick = () => { t.done = !t.done; saveTodos(); renderTasks(); updateProgress(); };
    li.querySelector('.task-del').onclick = () => { todos = todos.filter(x => x !== t); saveTodos(); renderTasks(); updateProgress(); };
        li.querySelector('.task-del').onclick = () => {
          themedConfirm('Are you sure you want to delete this task?').then(yes => {
            if (yes) {
              todos = todos.filter(x => x !== t); saveTodos(); renderTasks(); updateProgress();
            }
          });
        };
    list.appendChild(li);
  });
  updateProgress();
}

function addTask() {
  const inp = $('task-inp'), text = inp.value.trim();
  if (!text) return;
  todos.push({ id: tid++, text, done: false });
  inp.value = ''; saveTodos(); renderTasks(); updateProgress();
}
$('btn-add').addEventListener('click', addTask);
$('task-inp').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

// ── Voice memos ───────────────────────────────────────────────────────────────
$('rec-btn').addEventListener('click', async () => {
  if (!recording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Safari iOS compatible recording format
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      let options = {};
      
      if (isSafari) {
        // Safari prefers different formats
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        }
      } else {
        // Other browsers
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        }
      }
      
      mediaRecorder = new MediaRecorder(stream, options);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); onRecordingStop(); };
      mediaRecorder.start(100);
      
      console.log('Recording started with options:', options);
    } catch (err) {
      console.error('Recording failed:', err);
      /* mic not available */
    }

    recording = true; recSecs = 0;
    $('rec-btn').classList.add('recording');
    $('rec-label').textContent = 'Stop';
    recInterval = setInterval(() => { recSecs++; $('rec-timer').textContent = fmt(recSecs); }, 1000);
  } else {
    recording = false; clearInterval(recInterval);
    $('rec-btn').classList.remove('recording');
    $('rec-label').textContent = 'Record';
    $('rec-timer').textContent = '00:00';
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    else onRecordingStop();
  }
});

async function onRecordingStop() {
  const dur = recSecs;
  const ts  = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const id  = mid++;

  let audioKey = null;
  if (audioChunks.length) {
    // Use the same MIME type as recording
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    let blobType = 'audio/webm'; // default
    
    if (isSafari && mediaRecorder.mimeType) {
      blobType = mediaRecorder.mimeType;
    }
    
    const blob = new Blob(audioChunks, { type: blobType });
    console.log('Created blob with type:', blobType);
    if (window.api) {
      const buf  = await blob.arrayBuffer();
      window.api.memos.saveAudio(id, Array.from(new Uint8Array(buf)));
    } else {
      // Save audio as data URL in localStorage
      audioKey = `tasksprout-memo-audio-${id}`;
      const reader = new FileReader();
      reader.onloadend = function() {
        localStorage.setItem(audioKey, reader.result);
        // Set audioDataUrl on the memo object for immediate playback
        memo.audioDataUrl = reader.result;
      };
      reader.readAsDataURL(blob);
    }
  }
  const memo = { id, name: 'Memo', timestamp: ts, dur: fmt(dur), generating: true };
  if (audioKey) memo.audioKey = audioKey;
  memos.unshift(memo);
  saveMemos();
  renderMemos();

  // AI title generation
  generateMemoTitle(dur, ts).then(title => {
    memo.name = title;
    memo.generating = false;
    saveMemos();
    renderMemos();
  });
}

async function generateMemoTitle(durationSecs, ts) {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 40,
        messages: [{
          role: 'user',
          content: `Generate a short, creative memo title (3-5 words max, no quotes, no punctuation) for a ${fmt(durationSecs)} voice note recorded in the ${timeOfDay}. Make it feel personal and warm, like a journal entry. Just the title, nothing else.`
        }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || 'Memo';
  } catch {
    return 'Memo';
  }
}

function renderMemos() {
  const nl = $('memos-list');
  nl.innerHTML = '';
  console.log('[renderMemos] memos array:', memos);
  if (!memos.length) {
    nl.innerHTML = '<div class="memo-empty">No memos yet</div>';
    return;
  }
  // If memos exist but nothing renders, show debug info
  setTimeout(() => {
    if (!nl.querySelector('.memo-card') && memos.length) {
      const dbg = document.createElement('div');
      dbg.style = 'color: #c98878; font-size: 13px; margin-top: 8px;';
      dbg.textContent = '[Debug] Memos exist in memory but are not rendering.';
      nl.appendChild(dbg);
    }
  }, 100);
  memos.forEach((m, idx) => {
    const card = document.createElement('div');
    card.className = 'memo-card';
    // Layout handled by CSS

    // Play button (SVG icon only)
    const playBtn = document.createElement('button');
    playBtn.className = 'memo-play';
    playBtn.title = 'Play memo';
    playBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="11" fill="#e8ede5"/><polygon points="8,6 17,11 8,16" fill="#5c7d61"/></svg>';
    playBtn.style = 'background:none; border:none; cursor:pointer; padding: 4px; border-radius: 50%; transition:background .2s; width:32px; height:32px; display:flex; align-items:center; justify-content:center;';
    playBtn.addEventListener('mouseenter',()=>playBtn.style.background='#dde5d9');
    playBtn.addEventListener('mouseleave',()=>playBtn.style.background='none');

    // Audio element for playback and volume
    const audio = document.createElement('audio');
    audio.style.display = 'none';
    // Safari iOS specific attributes
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.muted = false;
    let audioUrl = null;
    // For browser: set src to data URL if available
    if (!window.api && m.audioKey) {
      if (m.audioDataUrl) {
        audio.src = m.audioDataUrl;
        console.log('Set audio src from memo.audioDataUrl');
      } else {
        // Try to load from localStorage
        const dataUrl = localStorage.getItem(m.audioKey);
        if (dataUrl) {
          audio.src = dataUrl;
          m.audioDataUrl = dataUrl; // Cache it
          console.log('Set audio src from localStorage');
        } else {
          console.warn('No audio data found for key:', m.audioKey);
        }
      }
    }

    // Play/pause SVG icons
    const playSVG = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="11" fill="#e8ede5"/><polygon points="8,6 17,11 8,16" fill="#5c7d61"/></svg>';
    const pauseSVG = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="11" fill="#e8ede5"/><rect x="8" y="6" width="2.8" height="10" rx="1.2" fill="#5c7d61"/><rect x="13.2" y="6" width="2.8" height="10" rx="1.2" fill="#5c7d61"/></svg>';
    playBtn.innerHTML = playSVG;
    let isLoading = false;
    playBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isLoading) return;
      
      // Safari iOS specific audio initialization
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // Initialize audio context for mobile browsers
      if (!window.audioContext) {
        try {
          window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          if (window.audioContext.state === 'suspended') {
            await window.audioContext.resume();
          }
        } catch (err) {
          console.warn('AudioContext initialization failed:', err);
        }
      }
      
      // For Safari iOS, ensure we have user interaction
      if (isSafari && isIOS) {
        // Create a silent audio to "prime" Safari's audio system
        const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAAAQAEAAEAfAAAQAQABAAgAZGF0YQAAAAA=');
        silentAudio.volume = 0;
        try {
          await silentAudio.play();
          silentAudio.pause();
        } catch (err) {
          console.warn('Silent audio priming failed:', err);
        }
      }
      
      if (!audio.src) {
        isLoading = true;
        playBtn.style.opacity = '0.5';
        try {
          if (window.api && window.api.memos && window.api.memos.loadAudio) {
            const audioArr = await window.api.memos.loadAudio(m.id);
            if (audioArr && audioArr.length) {
              if (audioUrl) URL.revokeObjectURL(audioUrl);
              // Try different audio formats for Safari compatibility
              let blob;
              const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
              if (isSafari) {
                // Safari prefers MP4/M4A format
                blob = new Blob([new Uint8Array(audioArr)], { type: 'audio/mp4' });
              } else {
                blob = new Blob([new Uint8Array(audioArr)], { type: 'audio/webm;codecs=opus' });
              }
              audioUrl = URL.createObjectURL(blob);
              audio.src = audioUrl;
              audio.load();
              // Set volume to 100% on mobile, 80% on desktop
              const isMobile = window.innerWidth <= 768;
              audio.volume = isMobile ? 1.0 : 0.8;
              // Audio element will be in the card DOM
              try {
                // Multiple playback attempts for Safari
                let playAttempt = 0;
                const maxAttempts = 3;
                
                const attemptPlay = async () => {
                  try {
                    await audio.play();
                    console.log('Audio playback successful');
                  } catch (err) {
                    playAttempt++;
                    console.warn(`Play attempt ${playAttempt} failed:`, err);
                    if (playAttempt < maxAttempts) {
                      // Add delay for Safari
                      setTimeout(attemptPlay, 100);
                    } else {
                      console.error('All playback attempts failed');
                      playBtn.innerHTML = playSVG;
                    }
                  }
                };
                
                await attemptPlay();
              } catch (err) {
                console.error('Audio play failed:', err);
                // If play fails, show play icon
                playBtn.innerHTML = playSVG;
              }
            }
          } else if (m.audioDataUrl) {
            // Browser version with data URL
            audio.src = m.audioDataUrl;
            audio.load();
            // Set volume to 100% on mobile, 80% on desktop
              const isMobile = window.innerWidth <= 768;
              audio.volume = isMobile ? 1.0 : 0.8;
            try {
              // Multiple playback attempts for Safari
              let playAttempt = 0;
              const maxAttempts = 3;
              
              const attemptPlay = async () => {
                try {
                  await audio.play();
                  console.log('Audio playback successful');
                } catch (err) {
                  playAttempt++;
                  console.warn(`Play attempt ${playAttempt} failed:`, err);
                  if (playAttempt < maxAttempts) {
                    // Add delay for Safari
                    setTimeout(attemptPlay, 100);
                  } else {
                    console.error('All playback attempts failed');
                    playBtn.innerHTML = playSVG;
                  }
                }
              };
              
              await attemptPlay();
            } catch (err) {
              console.error('Audio play failed:', err);
              playBtn.innerHTML = playSVG;
            }
          }
        } catch (err) {
          console.error('Audio loading failed:', err);
          playBtn.innerHTML = playSVG;
        } finally {
          isLoading = false;
          playBtn.style.opacity = '';
        }
      } else {
        if (audio.paused) {
          try { 
            await audio.play(); 
          } catch (err) { 
            console.error('Audio play failed:', err);
            playBtn.innerHTML = playSVG; 
          }
        } else {
          audio.pause();
        }
      }
    });
    
    // Also add touch events for mobile (especially Safari)
    playBtn.addEventListener('touchstart', async (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    
    playBtn.addEventListener('touchend', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Trigger the click handler for Safari
      playBtn.click();
    });
    audio.addEventListener('play',()=>{
      console.log('Audio play event fired');
      playBtn.innerHTML=pauseSVG;
    });
    audio.addEventListener('pause',()=>{
      console.log('Audio pause event fired');
      playBtn.innerHTML=playSVG;
    });
    audio.addEventListener('ended',()=>{
      console.log('Audio ended event fired');
      playBtn.innerHTML=playSVG;
    });
    audio.addEventListener('error', (e) => {
      console.error('Audio error event:', e);
      console.error('Audio error details:', audio.error);
    });
    audio.addEventListener('loadeddata', () => {
      console.log('Audio loaded data event');
    });
    audio.addEventListener('canplay', () => {
      console.log('Audio can play event');
    });

    // Progress bar
    const progress = document.createElement('input');
    progress.type = 'range';
    progress.className = 'memo-progress';
    progress.min = 0;
    progress.max = 1;
    progress.step = 0.01;
    progress.value = 0;
    progress.title = 'Seek';
    progress.addEventListener('input', () => {
      audio.currentTime = audio.duration * progress.value;
    });
    audio.addEventListener('timeupdate', () => {
      if (!isNaN(audio.duration) && audio.duration > 0) {
        progress.value = audio.currentTime / audio.duration;
      }
    });
    // Volume icon button
    const volBtn = document.createElement('button');
    volBtn.className = 'memo-volume-btn';
    volBtn.title = 'Volume';
    function getVolumeSVG(level) {
      // level: 0 = muted, 1 = low, 2 = medium, 3 = high
      // User-provided icon, lines reduce with each level
      if (level === 0) {
        return `<svg width="22" height="22" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"><g><rect width="200" height="200" fill="none"/><path d="M40 80 L80 80 L120 40 L120 160 L80 120 L40 120 Z" fill="#b5b5b5"/><line x1="150" y1="60" x2="190" y2="140" stroke="#b5b5b5" stroke-width="14"/><line x1="190" y1="60" x2="150" y2="140" stroke="#b5b5b5" stroke-width="14"/></g></svg>`;
      } else if (level === 1) {
        return `<svg width="22" height="22" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"><g><rect width="200" height="200" fill="none"/><path d="M40 80 L80 80 L120 40 L120 160 L80 120 L40 120 Z" fill="#5c7d61"/><path d="M140 80 Q160 100 140 120" stroke="#5c7d61" stroke-width="12" fill="none"/></g></svg>`;
      } else if (level === 2) {
        return `<svg width="22" height="22" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"><g><rect width="200" height="200" fill="none"/><path d="M40 80 L80 80 L120 40 L120 160 L80 120 L40 120 Z" fill="#5c7d61"/><path d="M140 80 Q160 100 140 120" stroke="#5c7d61" stroke-width="12" fill="none"/><path d="M150 70 Q180 100 150 130" stroke="#5c7d61" stroke-width="12" fill="none"/></g></svg>`;
      } else {
        return `<svg width="22" height="22" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"><g><rect width="200" height="200" fill="none"/><path d="M40 80 L80 80 L120 40 L120 160 L80 120 L40 120 Z" fill="#5c7d61"/><path d="M140 80 Q160 100 140 120" stroke="#5c7d61" stroke-width="12" fill="none"/><path d="M150 70 Q180 100 150 130" stroke="#5c7d61" stroke-width="12" fill="none"/><path d="M160 60 Q200 100 160 140" stroke="#5c7d61" stroke-width="12" fill="none"/></g></svg>`;
      }
    }
    function getVolumeLevel(vol) {
      if (vol == 0 || audio.muted) return 0;
      if (vol <= 0.33) return 1;
      if (vol <= 0.66) return 2;
      return 3;
    }
    function updateVolumeIcon() {
      volBtn.innerHTML = getVolumeSVG(getVolumeLevel(audio.volume));
    }
    updateVolumeIcon();
    volBtn.style = 'background:none; border:none; cursor:pointer; padding:0 2px; display:flex; align-items:center; position:relative;';

    // Create vertical slider (hidden by default)
    const volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.className = 'memo-volume-slider';
    volSlider.min = 0;
    volSlider.max = 1;
    volSlider.step = 0.01;
    volSlider.value = audio.volume;
    volSlider.style.display = 'none';
    volSlider.addEventListener('input', () => {
      audio.volume = volSlider.value;
      audio.muted = (volSlider.value == 0);
      updateVolumeIcon();
    });
    volBtn.appendChild(volSlider);
    // Show slider on hover or click, hide on mouseleave or click outside
    let sliderVisible = false;
    function showSlider() {
      volSlider.style.display = 'block';
      sliderVisible = true;
    }
    function hideSlider() {
      volSlider.style.display = 'none';
      sliderVisible = false;
    }
    volBtn.addEventListener('mouseenter', showSlider);
    volBtn.addEventListener('mouseleave', hideSlider);
    volBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // On click, reduce volume by 1 step
      let level = getVolumeLevel(audio.volume);
      if (level > 0) {
        // Reduce to next lower step
        if (level === 3) audio.volume = 0.66;
        else if (level === 2) audio.volume = 0.33;
        else if (level === 1) audio.volume = 0;
        audio.muted = (audio.volume == 0);
        volSlider.value = audio.volume;
        updateVolumeIcon();
      } else {
        // If muted, restore to max
        audio.volume = 1;
        audio.muted = false;
        volSlider.value = 1;
        updateVolumeIcon();
      }
    });
    document.addEventListener('click', (e) => {
      if (sliderVisible && !volBtn.contains(e.target)) {
        hideSlider();
      }
    });


    // Row 1: play, title, timestamp
    // Row 1: title, timestamp
    const row1 = document.createElement('div');
    row1.className = 'memo-row1';
    // Title (double tap to rename)
    const title = document.createElement('div');
    title.className = 'memo-title';
    title.contentEditable = false;
    title.textContent = m.name.replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, '');
    let tap = null;
    title.addEventListener('click', () => {
      if (tap) {
        clearTimeout(tap); tap = null;
        title.contentEditable = true; title.focus();
        const r = document.createRange(); r.selectNodeContents(title);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      } else { tap = setTimeout(() => { tap = null; }, 300); }
    });
    title.addEventListener('blur', () => {
      // Always set to 'Memo' if empty or whitespace
      m.name = title.textContent.trim() || 'Memo';
      title.textContent = m.name.replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, '');
      title.contentEditable = false;
      saveMemos();
    });
    title.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
      if (e.key === 'Escape') { title.textContent = m.name.replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, ''); title.blur(); }
    });
    // Timestamp (only)
    const timestamp = document.createElement('div');
    timestamp.className = 'memo-timestamp';
    timestamp.textContent = m.timestamp;
    row1.append(title, timestamp);

    // Row 2: play, progress, length, volume, delete
    const row2 = document.createElement('div');
    row2.className = 'memo-row2';
    // Length (only duration)
    const length = document.createElement('div');
    length.className = 'memo-length';
    length.textContent = m.dur;
    // Delete button
    const del = document.createElement('button');
    del.className = 'memo-del'; del.textContent = '×'; del.title = 'Delete';
    del.style = 'font-size:22px; background:none; border:none; cursor:pointer; margin-left:0px; align-self:center;';
    del.addEventListener('click', () => {
      themedConfirm('Are you sure you want to delete this voice memo?').then(yes => {
        if (yes) {
          if (window.api) window.api.memos.delete(m.id);
          memos.splice(idx, 1); saveMemos(); renderMemos();
        }
      });
    });
    // Only add volume button on desktop
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      row2.append(playBtn, progress, length, volBtn, del);
    } else {
      row2.append(playBtn, progress, length, del);
    }
    // Keep audio element hidden in the card for playback
    card.appendChild(audio);

    card.append(row1, row2);

    if (m.generating) {
      const gen = document.createElement('div');
      gen.className = 'memo-generating';
      gen.textContent = 'generating title…';
      card.append(gen);
    }

    nl.appendChild(card);
  });
}

// ── Landing canvas ────────────────────────────────────────────────────────────
const landCanvas = $('land-c');
const lctx = landCanvas.getContext('2d');
const LW = 370, LH = 390, lcx = LW / 2;
const POT_BODY_H = 48, POT_RIM_H = 19;
const POT_BODY_W = 92; // wider pot
const POT_RIM_W = 110; // wider rim
const L_POT_BOTTOM = LH - 22; // move pot and flower up by 10px
const L_POT_RIM    = L_POT_BOTTOM - POT_BODY_H - POT_RIM_H;
const L_STEM_H     = 155;
const L_STEM_TOP   = L_POT_RIM - L_STEM_H;

let landTime = 0, landLast = null;

function drawLandingFrame(ts) {
  if (!landLast) landLast = ts;
  landTime += (ts - landLast) / 1000; landLast = ts;
  lctx.clearRect(0, 0, LW, LH);

  const sway    = Math.sin(landTime * .42) * 2.6 + Math.sin(landTime * .26) * 1.1;
  const breathe = Math.sin(landTime * .22) * .011;
  const fx = lcx + sway * .20;

  lctx.save(); lctx.strokeStyle = '#5a8c5e'; lctx.lineWidth = 8; lctx.lineCap = 'round';
  lctx.beginPath(); lctx.moveTo(lcx, L_POT_RIM - 1);
  lctx.quadraticCurveTo(lcx + sway * .9, L_POT_RIM - L_STEM_H * .5, fx, L_STEM_TOP);
  lctx.stroke(); lctx.restore();

  window.LEAF_DEFS.forEach(l => {
    const ly = L_STEM_TOP + L_STEM_H * l.oy, lx = lcx + sway * l.oy * .16;
    window.drawLeaf(lctx, lx, ly, l.side, l.len * (1 + breathe), l.thk, l.droop, l.col, l.vc, 1);
  });
  // Make the flower petals much bigger by increasing the scale argument
  window.drawRanunculus(lctx, fx, L_STEM_TOP, 1, 1.7 + breathe);
  // Draw a wider pot by passing new width params if supported
  if (window.drawPot.length >= 6) {
    window.drawPot(lctx, lcx, L_POT_RIM, POT_BODY_H, POT_RIM_H, POT_BODY_W, POT_RIM_W);
  } else {
    window.drawPot(lctx, lcx, L_POT_RIM, POT_BODY_H, POT_RIM_H);
  }

  landRaf = requestAnimationFrame(drawLandingFrame);
}

function startLandingIdle() {
  if (!landRaf) landRaf = requestAnimationFrame(drawLandingFrame);
}
function stopLanding() {
  if (landRaf) { cancelAnimationFrame(landRaf); landRaf = null; landLast = null; }
}

// ── Bloom reveal canvas ───────────────────────────────────────────────────────
const bloomCanvas = $('bloom-c');
const bctx = bloomCanvas.getContext('2d');
const BW = 370, BH = 470, bcx = BW / 2;
const B_POT_RIM = BH - 120, B_STEM_H = 155;
const BLOOM_MS  = 5400;
const LEAF_TIMINGS = [.34, .40, .44, .49, .52, .56];

function startBloom() {
  if (bloomRaf) { cancelAnimationFrame(bloomRaf); bloomRaf = null; }

  const pct  = getPct();
  const maxH = pct === 0 ? 0 : Math.max(18, Math.round(B_STEM_H * pct / 100));
  const leafCount = pct === 0 ? 0 : pct <= 20 ? 2 : pct <= 40 ? 3 : pct <= 60 ? 4 : pct <= 80 ? 5 : 6;

  // set reward text
  $('reward-title').textContent = pct === 100 ? 'Day complete!' : pct === 0 ? 'Day ended' : 'Great effort!';
  $('reward-msg').textContent   = pct === 100 ? 'You completed everything — full bloom!'
    : pct === 0   ? 'No tasks completed. The pot is waiting for you.'
    : `You finished ${pct}% of your tasks.`;

  const start = performance.now();

  function frame(now) {
    const t = Math.min((now - start) / BLOOM_MS, 1);
    bctx.clearRect(0, 0, BW, BH);

    const stemP = window.PlantUtils.easeInOutSine(window.PlantUtils.clamp01((t - .05) / .30));
    const drawnH = maxH * stemP;

    if (drawnH > 0) {
      bctx.save(); bctx.strokeStyle = '#5a8c5e'; bctx.lineWidth = 5; bctx.lineCap = 'round';
      const topY = B_POT_RIM - drawnH;
      const ns = Math.sin(stemP * Math.PI) * 2 * (1 - stemP * .7);
      bctx.beginPath(); bctx.moveTo(bcx, B_POT_RIM - 1);
      bctx.quadraticCurveTo(bcx + ns * .5, B_POT_RIM - drawnH * .5, bcx, topY);
      bctx.stroke(); bctx.restore();
    }

    window.LEAF_DEFS.slice(0, leafCount).forEach((l, i) => {
      const lp = window.PlantUtils.easeOutBack(window.PlantUtils.clamp01((t - (LEAF_TIMINGS[i] || .34)) / .14), 1.12);
      if (lp <= 0) return;
      const stemTop = B_POT_RIM - maxH;
      window.drawLeaf(bctx, bcx, stemTop + maxH * l.oy, l.side, l.len * lp, l.thk, l.droop, l.col, l.vc, lp);
    });

    if (pct === 100) {
      const rP = window.PlantUtils.easeInOutSine(window.PlantUtils.clamp01((t - .64) / .36));
      window.drawRanunculus(bctx, bcx, B_POT_RIM - maxH, rP, 1.7);
    }

    // Use the same pot as the landing page
    if (window.drawPot.length >= 6) {
      window.drawPot(bctx, bcx, B_POT_RIM, 48, 19, 92, 110);
    } else {
      window.drawPot(bctx, bcx, B_POT_RIM, 48, 19);
    }

    if (t < 1) bloomRaf = requestAnimationFrame(frame);
  }
  bloomRaf = requestAnimationFrame(frame);
}

function stopBloom() {
  if (bloomRaf) { cancelAnimationFrame(bloomRaf); bloomRaf = null; }
}

// ── Utility ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
  (async function init() {
    // Only show the landing screen on boot. Do not pre-load app state.
    showScreen('landing');
  })();
});
