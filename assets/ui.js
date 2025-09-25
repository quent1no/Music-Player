export const $ = sel => document.querySelector(sel);
export const $$ = sel => Array.from(document.querySelectorAll(sel));


export function formatTime(sec=0){ sec=Math.max(0,Math.floor(sec)); const m=Math.floor(sec/60), s=sec%60; return `${m}:${String(s).padStart(2,'0')}`; }


export function toast(msg, kind='info'){
let wrap = document.getElementById('toastWrap');
if (!wrap){ wrap=document.createElement('div'); wrap.id='toastWrap'; wrap.className='toast space-y-2'; document.body.appendChild(wrap); }
const div = document.createElement('div');
div.className = `px-3 py-2 rounded-lg text-sm border shadow bg-white dark:bg-slate-900 ${kind==='error'?'border-red-300 dark:border-red-800':'border-slate-200 dark:border-slate-800'}`;
div.textContent = msg;
wrap.appendChild(div);
setTimeout(()=>div.remove(), 4000);
}


export function sanitizeTitle(name=''){ return name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g,' ').trim(); }


export function renderTrackCard(track, {onPlay, onDelete}){
const tpl = document.getElementById('trackCardTpl');
const el = tpl.content.firstElementChild.cloneNode(true);
el.dataset.id = track.id;
el.querySelector('.title').textContent = track.title || '(untitled)';
el.querySelector('.artist').textContent = track.artist || '';
el.querySelector('.duration').textContent = formatTime(track.duration||0);
el.querySelector('.uploader').textContent = track.uploader_badge || 'anon-??';
el.querySelector('.uploadedAt').textContent = new Date(track.uploaded_at).toLocaleString();


el.querySelector('.playBtn').addEventListener('click', ()=>onPlay(track));


const menuBtn = el.querySelector('.menuBtn');
const menu = el.querySelector('.menu');
menuBtn.addEventListener('click', (e)=>{ e.stopPropagation(); menu.classList.toggle('hidden'); });
document.addEventListener('click', ()=>menu.classList.add('hidden'));


el.querySelector('.deleteBtn').addEventListener('click', ()=>onDelete(track));
el.querySelector('.downloadLink').href = track.download_url;
return el;
}