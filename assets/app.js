import { supabase, ensureAnonAuth, shortAnon } from './supabase.js';
import { $, $$, toast, renderTrackCard, formatTime, sanitizeTitle } from './ui.js';

// ---------- Config ----------
const MAX_MB = 20;
const MAX_BYTES = MAX_MB * 1024 * 1024;
$('#maxSizeLabel').textContent = String(MAX_MB);

// ---------- State ----------
const audio = document.getElementById('audio');
let library = [];
let filtered = [];
let queue = [];
let currentIndex = -1;

let shuffle = JSON.parse(localStorage.getItem('smp_shuffle') || 'false');
let repeat = JSON.parse(localStorage.getItem('smp_repeat') || 'false');
let volume = Number(localStorage.getItem('smp_volume') || '0.9');
let followSync = true; // Always ON

$('#volume').value = volume;
audio.volume = volume;

// ---------- Theme ----------
const themeToggle = $('#themeToggle');
(function () {
  const pref =
    localStorage.getItem('theme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', pref === 'dark');
})();
themeToggle.addEventListener('click', () => {
  const d = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', d ? 'dark' : 'light');
});

// ---------- Auth & presence ----------
const me = await ensureAnonAuth();

async function presenceHeartbeat() {
  await supabase
    .from('presence')
    .upsert({ uid: me.id, display_name: shortAnon(me.id), last_active_at: new Date() });
}
setInterval(presenceHeartbeat, 30_000);
presenceHeartbeat();

async function updateOnlineCount() {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { data } = await supabase
    .from('presence')
    .select('uid', { count: 'exact', head: false })
    .gte('last_active_at', since);
  $('#onlineCount').textContent = data?.length ?? 0;
}
setInterval(updateOnlineCount, 10_000);
updateOnlineCount();

// ---------- Upload handling ----------
const dropzone = $('#dropzone');
const fileInput = $('#fileInput');
const uploadBtn = document.getElementById('uploadBtn');
if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('click', () => fileInput.click());
['dragenter', 'dragover'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('ring-2', 'ring-brand-500');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('ring-2', 'ring-brand-500');
  })
);
dropzone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

function validAudio(file) {
  if (!file.type.startsWith('audio/'))
    throw new Error('Only audio files are allowed.');
  if (file.size > MAX_BYTES)
    throw new Error(`File too large. Max ${MAX_MB} MB.`);
}

async function handleFiles(list) {
  for (const f of Array.from(list)) {
    try {
      await uploadFile(f);
    } catch (e) {
      console.error(e);
      toast(e.message || 'Upload failed', 'error');
    }
  }
}

async function uploadFile(file) {
  validAudio(file);

  const row = document.createElement('div');
  row.className =
    'flex items-center gap-3 border rounded-xl p-3 bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800';
  row.innerHTML = `<div class="w-8 h-8 rounded-md bg-slate-200 dark:bg-slate-800 flex items-center justify-center"><i data-lucide="music" class="w-4 h-4"></i></div>
  <div class="min-w-0 flex-1"><div class="truncate text-sm font-medium">${file.name}</div>
  <div class="h-1 bg-slate-200 dark:bg-slate-800 rounded mt-2 overflow-hidden"><div class="h-full bg-brand-500 progress" style="width:20%"></div></div></div>
  <div class="text-xs status">Uploading…</div>`;
  $('#uploadList').prepend(row);
  lucide.createIcons();

  const path = `uploads/${me.id}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage
    .from('uploads')
    .upload(path, file, { upsert: false, cacheControl: '3600' });
  if (error) throw error;
  row.querySelector('.progress').style.width = '70%';

  const { data: pub } = supabase.storage.from('uploads').getPublicUrl(path);
  const downloadURL = pub.publicUrl;

  // Wait & retry to get accurate duration
  await new Promise((res) => setTimeout(res, 500));
  let duration = 0;
  for (let attempt = 0; attempt < 2 && duration === 0; attempt++) {
    try { duration = await calcDurationFromURL(downloadURL); }
    catch { await new Promise((res) => setTimeout(res, 500)); }
  }

  const title = sanitizeTitle(file.name);
  const { error: dberr } = await supabase.from('tracks').insert({
    title,
    artist: null,
    storage_path: path,
    download_url: downloadURL,
    duration,
    uploader_id: me.id,
    uploaded_at: new Date(),
    uploader_badge: shortAnon(me.id),
  });
  if (dberr) throw dberr;

  row.querySelector('.progress').style.width = '100%';
  row.querySelector('.status').textContent = 'Done';
  toast('Uploaded: ' + file.name);

  await initialLoad();
}

function calcDurationFromURL(url) {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.src = url;
    a.onloadedmetadata = () => resolve(Math.round(a.duration || 0));
    a.onerror = () => reject(new Error('Failed to read audio duration'));
  });
}

// ---------- Library load & polling ----------
async function initialLoad() {
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .order('uploaded_at', { ascending: false })
    .limit(200);
  if (!error && data) {
    library = data;
    applySearchAndSort();
  }
}
await initialLoad();
setInterval(initialLoad, 5000);

$('#sortSelect').addEventListener('change', applySearchAndSort);
$('#search').addEventListener('input', applySearchAndSort);

function applySearchAndSort() {
  const q = $('#search').value.toLowerCase().trim();
  filtered = library.filter(
    (t) =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.artist || '').toLowerCase().includes(q)
  );
  const [field, dir] = $('#sortSelect').value.split('-');
  filtered.sort((a, b) => {
    const va = a[field] ?? '';
    const vb = b[field] ?? '';
    if (field === 'uploaded_at')
      return dir === 'desc'
        ? new Date(vb) - new Date(va)
        : new Date(va) - new Date(vb);
    return (
      String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' }) *
      (dir === 'asc' ? 1 : -1)
    );
  });
  renderPlaylist();
}

function renderPlaylist() {
  const list = $('#playlist');
  list.innerHTML = '';
  filtered.forEach((track) => {
    const card = renderTrackCard(track, {
      onPlay: playFromLibrary,
      onDelete: confirmDelete,
    });
    list.appendChild(card);
  });
  lucide.createIcons();
}

async function confirmDelete(track) {
  if (!confirm(`Delete "${track.title}"?`)) return;
  await supabase.from('tracks').delete().eq('id', track.id);
  await supabase.storage.from('uploads').remove([track.storage_path]).catch(() => {});
  toast('Deleted');
  await initialLoad();
}

// ---------- Player ----------
const nowTitle = $('#nowTitle'),
  nowArtist = $('#nowArtist'),
  seek = $('#seek'),
  timeCur = $('#timeCur'),
  timeTotal = $('#timeTotal');
const playPauseBtn = $('#playPauseBtn'),
  prevBtn = $('#prevBtn'),
  nextBtn = $('#nextBtn'),
  shuffleBtn = $('#shuffleBtn'),
  repeatBtn = $('#repeatBtn'),
  volumeSlider = $('#volume');

function loadQueue() {
  try {
    queue = JSON.parse(localStorage.getItem('smp_queue') || '[]');
    currentIndex = Number(localStorage.getItem('smp_index') || -1);
  } catch {
    queue = [];
    currentIndex = -1;
  }
}
function saveQueue() {
  localStorage.setItem('smp_queue', JSON.stringify(queue));
  localStorage.setItem('smp_index', String(currentIndex));
}
loadQueue();

function trackById(id) { return library.find((t) => t.id === id); }

function playFromLibrary(track) {
  const ids = filtered.map((t) => t.id);
  const idx = ids.indexOf(track.id);
  if (shuffle) { queue = shuffleArray(ids); currentIndex = queue.indexOf(track.id); }
  else { queue = ids; currentIndex = idx; }
  startPlayback(track);
  saveQueue();
}

function startPlayback(track) {
  if (!track) return;
  audio.src = track.download_url;
  audio.play().catch(() => {});
  nowTitle.textContent = track.title || '(untitled)';
  nowArtist.textContent = track.artist || '';
  timeTotal.textContent = formatTime(track.duration || 0);
  setPlayPauseIcon('pause');
  pushSyncStateSoon();
}

function setPlayPauseIcon(state) {
  const icon = playPauseBtn.querySelector('svg');
  icon.parentNode.innerHTML =
    state === 'pause'
      ? '<i data-lucide="pause" class="w-6 h-6"></i>'
      : '<i data-lucide="play" class="w-6 h-6"></i>';
  lucide.createIcons();
}

function next() {
  if (!queue.length) return;
  if (repeat) { /* replay same */ }
  else if (shuffle) { currentIndex = Math.floor(Math.random() * queue.length); }
  else { currentIndex = (currentIndex + 1) % queue.length; }
  startPlayback(trackById(queue[currentIndex]));
  saveQueue();
}
function prev() {
  if (!queue.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (shuffle) currentIndex = Math.floor(Math.random() * queue.length);
  else currentIndex = (currentIndex - 1 + queue.length) % queue.length;
  startPlayback(trackById(queue[currentIndex]));
  saveQueue();
}

playPauseBtn.addEventListener('click', () => {
  if (audio.paused) { audio.play(); setPlayPauseIcon('pause'); }
  else { audio.pause(); setPlayPauseIcon('play'); }
  pushSyncStateSoon();
});
nextBtn.addEventListener('click', next);
prevBtn.addEventListener('click', prev);
shuffleBtn.addEventListener('click', () => {
  shuffle = !shuffle; localStorage.setItem('smp_shuffle', JSON.stringify(shuffle));
  toast('Shuffle ' + (shuffle ? 'on' : 'off'));
});
repeatBtn.addEventListener('click', () => {
  repeat = !repeat; localStorage.setItem('smp_repeat', JSON.stringify(repeat));
  toast('Repeat ' + (repeat ? 'on' : 'off'));
});
volumeSlider.addEventListener('input', (e) => {
  audio.volume = Number(e.target.value);
  localStorage.setItem('smp_volume', String(audio.volume));
});

seek.addEventListener('input', () => {
  if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
  pushSyncStateSoon();
});

audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  seek.value = String((audio.currentTime / audio.duration) * 100);
  timeCur.textContent = formatTime(audio.currentTime);
  if (!audio.paused) throttledPush();
});
audio.addEventListener('ended', () => {
  if (repeat) { audio.currentTime = 0; audio.play(); }
  else next();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); playPauseBtn.click(); }
  if (e.key === 'j' || e.key === 'J') prev();
  if (e.key === 'k' || e.key === 'K') next();
});

function shuffleArray(arr) {
  return arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

// ---------- Shared Sync ----------
let suppressPushUntil = 0;

async function pollState() {
  if (!followSync) return;
  const { data, error } = await supabase
    .from('state')
    .select('*')
    .eq('id', 'global')
    .maybeSingle();
  if (error || !data) return;
  applyRemoteState(data);
}
setInterval(pollState, 1000);
pollState();

try {
  supabase
    .channel('realtime:state')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'state', filter: 'id=eq.global' },
      payload => { applyRemoteState(payload.new || payload.old || {}); })
    .subscribe();
} catch {}

function applyRemoteState(s) {
  suppressPushUntil = Date.now() + 1200;
  const t = library.find(x => x.id === s.current_track_id);
  if (t) {
    if (!queue.length || queue[currentIndex] !== t.id) {
      queue = [t.id]; currentIndex = 0; saveQueue(); startPlayback(t);
    }
    if (typeof s.position === 'number' && audio.duration) {
      if (Math.abs((audio.currentTime || 0) - s.position) > 0.8) {
        audio.currentTime = s.position;
      }
    }
    if (s.is_playing && audio.paused) audio.play().catch(()=>{});
    if (!s.is_playing && !audio.paused) audio.pause();
  }
}

function nowState() {
  return {
    id: 'global',
    current_track_id: queue[currentIndex] || null,
    position: audio.currentTime || 0,
    is_playing: !audio.paused,
    updated_at: new Date(),
  };
}

const pushSyncStateSoon = debounce(pushState, 300);
let lastThrottled = 0;
async function throttledPush() {
  const now = Date.now();
  if (now - lastThrottled > 2000) { lastThrottled = now; pushState(); }
}

async function pushState() {
  if (!followSync) return;
  if (Date.now() < suppressPushUntil) return;
  await supabase.from('state').upsert(nowState());
}

function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

// ---------- Restore previous queue ----------
(function () {
  if (!queue.length) return;
  const cur = trackById(queue[currentIndex]);
  if (cur) startPlayback(cur);
})();
