"use strict";

/* ================= STATE ================= */
const S = {
  albums: [],
  currentAlbum: null,
  currentTrack: 0,
  playing: false,
  editing: null,
};

const $ = id => document.getElementById(id);
const audio = $("audio");

/* ================= HELPERS ================= */
const fmt = s => { s=Math.max(0,Math.floor(s||0)); return Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); };
let toastT;
function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),2200); }
function esc(s){ return String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }

/* ================= COVER GENERATOR ================= */
function makeCover(album, size=128){
  const c=document.createElement("canvas"); c.width=c.height=size;
  const x=c.getContext("2d");
  const pal={
    stripes:["#e0533d","#f2a541","#7bc96f","#4aa3df","#9b59b6"],
    checker:["#e8e0d0","#14121a"], dots:["#f2a541","#14121a"],
    sun:["#e0533d","#f2a541"], grid:["#4aa3df","#14121a"], wave:["#7bc96f","#14121a"]
  }[album.pattern] || ["#e0533d","#14121a"];
  x.fillStyle=pal[1]||"#14121a"; x.fillRect(0,0,size,size);
  const p=size/16;
  if(album.pattern==="stripes"){
    for(let i=0;i<16;i++){ x.fillStyle=pal[i%pal.length]; x.fillRect(0,i*p,size,p); }
  } else if(album.pattern==="checker"){
    for(let i=0;i<16;i++)for(let j=0;j<16;j++){ x.fillStyle=pal[(i+j)%2]; x.fillRect(i*p,j*p,p,p); }
  } else if(album.pattern==="dots"){
    for(let i=0;i<8;i++)for(let j=0;j<8;j++){ x.fillStyle=(i+j)%2?pal[0]:pal[1];
      x.fillRect(i*2*p+p/2, j*2*p+p/2, p, p); }
  } else if(album.pattern==="sun"){
    x.fillStyle=pal[0];
    for(let i=0;i<16;i++) x.fillRect(i*p, size/2, p, size/2);
    x.fillStyle=pal[1];
    for(let i=0;i<8;i++) x.fillRect(i*2*p, size/2 - p, p, p);
    x.fillStyle=pal[0]; x.fillRect(size/2-2*p, size/4, 4*p, 4*p);
  } else if(album.pattern==="grid"){
    x.strokeStyle=pal[0]; x.lineWidth=2;
    for(let i=0;i<=16;i++){ x.beginPath();x.moveTo(i*p,0);x.lineTo(i*p,size);x.stroke();
      x.beginPath();x.moveTo(0,i*p);x.lineTo(size,i*p);x.stroke(); }
  } else if(album.pattern==="wave"){
    x.fillStyle=pal[0];
    for(let i=0;i<16;i++){ const h=(Math.sin(i*1.2)+1.5)*p*2; x.fillRect(i*p, size-h, p, h); }
  }
  for(let i=0;i<60;i++){ x.fillStyle=`rgba(255,255,255,${Math.random()*0.08})`;
    x.fillRect(Math.floor(Math.random()*16)*p, Math.floor(Math.random()*16)*p, p, p); }
  return c.toDataURL();
}

/* ================= THEMES ================= */
const THEMES=[
  {id:"dark",   c:"#e0533d", name:"basement"},
  {id:"pink",   c:"#ff5d8f", name:"bubblegum"},
  {id:"blue",   c:"#4aa3ff", name:"midnight"},
  {id:"red",    c:"#ff4d4d", name:"cherry"},
  {id:"green",  c:"#51cf66", name:"forest"},
  {id:"purple", c:"#b197fc", name:"grape"},
  {id:"amber",  c:"#ffa94d", name:"honey"},
];
function buildThemePicker(){
  const w=$("themes"); w.innerHTML="";
  THEMES.forEach(t=>{
    const d=document.createElement("div");
    d.className="tdot"+(document.body.dataset.theme===t.id?" sel":"");
    d.style.background=t.c; d.title=t.name;
    d.onclick=()=>{
      document.body.dataset.theme=t.id;
      localStorage.setItem("pixelwax.theme", t.id);
      buildThemePicker();
    };
    w.appendChild(d);
  });
}
document.body.dataset.theme = localStorage.getItem("pixelwax.theme") || "dark";

/* ================= AUDIO GRAPH ================= */
let actx, analyser, gainNode, filters={};
function buildGraph(){
  if(actx) return;
  actx = new (window.AudioContext||window.webkitAudioContext)();
  const src = actx.createMediaElementSource(audio);
  analyser = actx.createAnalyser(); analyser.fftSize=64;
  gainNode = actx.createGain();
  filters.b = actx.createBiquadFilter(); filters.b.type="lowshelf"; filters.b.frequency.value=200;
  filters.m = actx.createBiquadFilter(); filters.m.type="peaking"; filters.m.frequency.value=1000; filters.m.Q.value=1;
  filters.t = actx.createBiquadFilter(); filters.t.type="highshelf"; filters.t.frequency.value=4000;
  src.connect(filters.b); filters.b.connect(filters.m); filters.m.connect(filters.t);
  filters.t.connect(gainNode); gainNode.connect(analyser); analyser.connect(actx.destination);
  gainNode.gain.value = $("vol").value/100;
  requestAnimationFrame(vuLoop);
}

/* VU meter */
const vuEl=$("vu"), BARS=28, bars=[];
for(let i=0;i<BARS;i++){ const b=document.createElement("i"); vuEl.appendChild(b); bars.push(b); }
function vuLoop(){
  if(!analyser) return;
  const data=new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  for(let i=0;i<BARS;i++){
    const v=data[Math.floor(i*data.length/BARS)]/255;
    bars[i].style.height=Math.max(2, Math.round(v*40))+"px";
    bars[i].classList.toggle("hot", v>0.75);
  }
  requestAnimationFrame(vuLoop);
}

/* ================= ALBUM CRUD ================= */
function newAlbum(data){
  const al=Object.assign({
    id:"al"+Date.now()+Math.floor(Math.random()*999),
    title:"untitled album", artist:"unknown",
    color:"#e0533d", pattern:"stripes", tracks:[]
  }, data||{});
  al.cover=makeCover(al);
  S.albums.push(al);
  save(); renderShelf();
  return al;
}
function deleteAlbum(id){
  const al=S.albums.find(a=>a.id===id);
  if(!al) return;
  if(!confirm(`toss "${al.title}" into the bin?`)) return;
  al.tracks.forEach(t=>URL.revokeObjectURL(t.url));
  S.albums=S.albums.filter(a=>a.id!==id);
  if(S.currentAlbum===id){ stop(); S.currentAlbum=null; setVinyl(null); }
  save(); renderShelf(); renderTracklist();
  toast("album binned.");
}
function selectAlbum(id){
  S.currentAlbum=id; S.currentTrack=0;
  const al=S.albums.find(a=>a.id===id);
  setVinyl(al);
  renderShelf(); renderTracklist();
  if(al && al.tracks.length) loadTrack(0,false);
}
function setVinyl(al){
  const art=$("vinylArt"), lab=$("vinylLabel");
  if(!al){
    art.innerHTML=""; lab.textContent="NO DISC"; lab.style.background="#333";
    $("nowPlaying").textContent="pick an album on the left — or press PLAY";
    return;
  }
  art.innerHTML=`<img src="${al.cover}" alt="">`;
  lab.textContent=al.title.slice(0,10).toUpperCase();
  lab.style.background=al.color;
}

/* ================= TRACKS ================= */
function addTracksToAlbum(al, files){
  let added=0;
  [...files].forEach(f=>{
    if(!f.type.startsWith("audio") && !/\.(mp3|wav|ogg|m4a|flac)$/i.test(f.name)) return;
    al.tracks.push({ name:f.name.replace(/\.[^.]+$/,""), url:URL.createObjectURL(f), dur:0 });
    added++;
  });
  save(); renderShelf(); renderTracklist();
  if(added) toast(`added ${added} track${added>1?"s":""} to "${al.title}"`);
}
function removeTrack(al, idx){
  const t=al.tracks[idx];
  if(S.currentAlbum===al.id && S.currentTrack===idx){ stop(); }
  URL.revokeObjectURL(t.url);
  al.tracks.splice(idx,1);
  if(S.currentTrack>=al.tracks.length) S.currentTrack=0;
  save(); renderShelf(); renderTracklist();
  toast("track removed.");
}
function loadTrack(i, autoplay=true){
  const al=S.albums.find(a=>a.id===S.currentAlbum);
  if(!al || !al.tracks.length) return;
  S.currentTrack=(i+al.tracks.length)%al.tracks.length;
  const tr=al.tracks[S.currentTrack];
  audio.src=tr.url;
  $("nowPlaying").textContent=`♪ ${al.artist} — ${tr.name}`;
  renderTracklist();
  if(autoplay) play();
}

/* ================= RENDER: shelf ================= */
function renderShelf(){
  const sh=$("shelf"); sh.innerHTML="";
  if(!S.albums.length){
    sh.innerHTML='<div style="color:var(--dim);text-align:center;padding:26px 8px;">no albums yet…<br>hit + NEW ALBUM ↑</div>';
    return;
  }
  S.albums.forEach(al=>{
    const d=document.createElement("div");
    d.className="album"+(S.currentAlbum===al.id?" active":"");
    const cover=document.createElement("div"); cover.className="cover";
    cover.style.backgroundImage=`url(${al.cover})`;
    d.appendChild(cover);
    const meta=document.createElement("div"); meta.className="meta";
    meta.innerHTML=`<b>${esc(al.title)}</b><small>${esc(al.artist)} · ${al.tracks.length} trk</small>`;
    d.appendChild(meta);
    const del=document.createElement("button"); del.className="del"; del.title="delete album"; del.textContent="✕";
    del.onclick=e=>{ e.stopPropagation(); deleteAlbum(al.id); };
    d.appendChild(del);
    d.onclick=()=>selectAlbum(al.id);
    d.draggable=true;
    d.ondragstart=e=>e.dataTransfer.setData("text/album", al.id);
    sh.appendChild(d);
  });
}

/* ================= RENDER: tracklist ================= */
function renderTracklist(){
  const tl=$("tracklist"); tl.innerHTML="";
  const al=S.albums.find(a=>a.id===S.currentAlbum);
  if(!al){
    $("trackHeader").textContent="♫ TRACKS";
    tl.innerHTML='<div class="track empty">select an album to see its songs</div>';
    return;
  }
  $("trackHeader").textContent=`♫ ${al.title.toUpperCase().slice(0,18)}`;
  if(!al.tracks.length){
    tl.innerHTML='<div class="track empty">empty album — drop songs below ↓</div>';
    return;
  }
  al.tracks.forEach((tr,i)=>{
    const d=document.createElement("div");
    d.className="track"+(S.playing && S.currentAlbum===al.id && S.currentTrack===i ? " playing":"");
    const num=document.createElement("span"); num.className="num";
    num.textContent=String(i+1).padStart(2,"0");
    d.appendChild(num);
    const nm=document.createElement("span"); nm.className="tname"; nm.textContent=tr.name;
    d.appendChild(nm);
    const dur=document.createElement("span"); dur.className="tdur"; dur.textContent=tr.dur?fmt(tr.dur):"--:--";
    d.appendChild(dur);
    const pb=document.createElement("button"); pb.className="tplay"; pb.textContent="▶"; pb.title="play";
    pb.onclick=e=>{ e.stopPropagation(); S.currentAlbum=al.id; setVinyl(al); loadTrack(i); };
    d.appendChild(pb);
    const db=document.createElement("button"); db.className="tdel"; db.textContent="✕"; db.title="delete track";
    db.onclick=e=>{ e.stopPropagation(); removeTrack(al,i); };
    d.appendChild(db);
    d.onclick=()=>{ S.currentAlbum=al.id; setVinyl(al); loadTrack(i); };
    tl.appendChild(d);
  });
}
audio.ondurationchange=()=>{
  const al=S.albums.find(a=>a.id===S.currentAlbum);
  if(al && al.tracks[S.currentTrack]){ al.tracks[S.currentTrack].dur=audio.duration; renderTracklist(); }
};

/* ================= TRANSPORT ================= */
function play(){
  if(!audio.src){
    const al=S.albums.find(a=>a.id===S.currentAlbum);
    if(al&&al.tracks.length) loadTrack(0);
    else { toast("pick an album first!"); return; }
  }
  buildGraph(); if(actx.state==="suspended") actx.resume();
  audio.play(); S.playing=true; syncUI(); renderTracklist();
}
function pause(){ audio.pause(); S.playing=false; syncUI(); renderTracklist(); }
function stop(){ audio.pause(); audio.currentTime=0; S.playing=false; syncUI(); renderTracklist(); }
function syncUI(){
  $("tt").classList.toggle("playing", S.playing);
  $("btnPlay").textContent=S.playing?"⏸":"▶";
  $("btnPlay").classList.toggle("on", S.playing);
  $("led").classList.toggle("on", S.playing);
}
$("btnPlay").onclick=()=>S.playing?pause():play();
$("btnStop").onclick=stop;
$("btnPrev").onclick=()=>loadTrack(S.currentTrack-1);
$("btnNext").onclick=()=>loadTrack(S.currentTrack+1);
$("btnPlayAll").onclick=()=>{ const al=S.albums.find(a=>a.id===S.currentAlbum);
  if(al&&al.tracks.length){ setVinyl(al); loadTrack(0); } else toast("no album selected!"); };
audio.onended=()=>loadTrack(S.currentTrack+1);
audio.onerror=()=>{
  if(!audio.src) return;
  S.playing=false; syncUI(); renderTracklist();
  toast(audio.src.endsWith(DEMO_TRACK) ? "no demo track installed — drop your own songs!"
                                       : "couldn't play that file.");
};
audio.ontimeupdate=()=>{ $("time").textContent=fmt(audio.currentTime)+" / "+fmt(audio.duration); };

/* ================= EQ / VOL / PITCH ================= */
$("vol").oninput=e=>{ if(gainNode) gainNode.gain.value=e.target.value/100; };
function applyEQ(){
  if(!actx) return;
  const t=actx.currentTime;
  filters.b.gain.setTargetAtTime(+$("eqB").value, t, .05);
  filters.m.gain.setTargetAtTime(+$("eqM").value, t, .05);
  filters.t.gain.setTargetAtTime(+$("eqT").value, t, .05);
}
["eqB","eqM","eqT"].forEach(id=>$(id).oninput=applyEQ);
$("pitch").oninput=e=>{ audio.playbackRate=e.target.value/100; audio.preservesPitch=false; };

/* ================= DRAG & DROP ================= */
function bindDrop(el, input, onFiles){
  el.onclick=()=>input.click();
  input.onchange=e=>{ onFiles(e.target.files); input.value=""; };
  ["dragenter","dragover"].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();el.classList.add("over");}));
  ["dragleave","drop"].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();el.classList.remove("over");}));
  el.ondrop=e=>onFiles(e.dataTransfer.files);
}
bindDrop($("dropAlbum"), $("fileNewAlbum"), files=>{
  const fs=[...files].filter(f=>f.type.startsWith("audio")||/\.(mp3|wav|ogg|m4a|flac)$/i.test(f.name));
  if(!fs.length){ toast("those aren't songs!"); return; }
  const al=newAlbum({title:fs[0].name.replace(/\.[^.]+$/,"").slice(0,18)||"dropped"});
  S.currentAlbum=al.id; addTracksToAlbum(al, fs); selectAlbum(al.id);
});
bindDrop($("dropTracks"), $("fileAddTracks"), files=>{
  const al=S.albums.find(a=>a.id===S.currentAlbum);
  if(!al){ toast("select an album first!"); return; }
  addTracksToAlbum(al, files);
});

/* drop onto turntable */
const tt=$("tt");
tt.ondragover=e=>e.preventDefault();
tt.ondrop=e=>{
  e.preventDefault();
  const alId=e.dataTransfer.getData("text/album");
  if(alId){ selectAlbum(alId); flyToTurntable(e.clientX,e.clientY); return; }
  const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith("audio")||/\.(mp3|wav|ogg|m4a|flac)$/i.test(f.name));
  if(!files.length) return;
  let al=S.albums.find(a=>a.id===S.currentAlbum) || newAlbum({title:files[0].name.replace(/\.[^.]+$/,"").slice(0,18)||"dropped"});
  S.currentAlbum=al.id;
  addTracksToAlbum(al, files); selectAlbum(al.id);
  flyToTurntable(e.clientX,e.clientY);
};
function flyToTurntable(x,y){
  const r=tt.getBoundingClientRect();
  const d=document.createElement("div"); d.className="flydisc";
  const size=90; d.style.width=d.style.height=size+"px";
  d.style.left=(x-size/2)+"px"; d.style.top=(y-size/2)+"px";
  document.body.appendChild(d);
  d.animate([
    {transform:"translate(0,0) rotate(0deg) scale(1)", opacity:1},
    {transform:`translate(${r.left+r.width/2-x}px, ${r.top+r.height/2-y}px) rotate(720deg) scale(.35)`, opacity:.9}
  ], {duration:900, easing:"cubic-bezier(.3,.7,.4,1)"}).onfinish=()=>d.remove();
}

/* ================= MODAL ================= */
const COLORS=["#e0533d","#f2a541","#7bc96f","#4aa3df","#9b59b6","#e8e0d0","#e05da0","#5de0c8"];
const PATTERNS=["stripes","checker","dots","sun","grid","wave"];
const TEMPLATES=[
  {title:"midnight loops", artist:"dj pixel",   color:"#4aa3df", pattern:"grid"},
  {title:"cherry bomb",    artist:"the pits",   color:"#ff4d4d", pattern:"sun"},
  {title:"bubblegum pop",  artist:"candy crew", color:"#ff5d8f", pattern:"dots"},
  {title:"forest tapes",   artist:"moss man",   color:"#51cf66", pattern:"wave"},
  {title:"honey drip",     artist:"bee side",   color:"#ffa94d", pattern:"stripes"},
  {title:"grape soda",     artist:"fizz",       color:"#b197fc", pattern:"checker"},
];
let selColor=COLORS[0], selPat=PATTERNS[0], selTpl=null;

function buildModalPickers(){
  const sw=$("swatches"); sw.innerHTML="";
  COLORS.forEach(c=>{ const d=document.createElement("div"); d.className="sw"; d.style.background=c;
    d.onclick=()=>{ selColor=c; selTpl=null; clearTplSel(); refreshPats(); sw.querySelectorAll(".sw").forEach(x=>x.classList.remove("sel")); d.classList.add("sel"); };
    if(c===selColor)d.classList.add("sel"); sw.appendChild(d); });
  refreshPats();
  buildTemplates();
}
function refreshPats(){
  const pw=$("patterns"); pw.innerHTML="";
  PATTERNS.forEach(p=>{ const d=document.createElement("div"); d.className="pat";
    d.style.backgroundImage=`url(${makeCover({color:selColor,pattern:p},46)})`;
    d.onclick=()=>{ selPat=p; selTpl=null; clearTplSel(); pw.querySelectorAll(".pat").forEach(x=>x.classList.remove("sel")); d.classList.add("sel"); };
    if(p===selPat)d.classList.add("sel"); pw.appendChild(d); });
}
function clearTplSel(){ $("templates").querySelectorAll(".tpl").forEach(x=>x.classList.remove("sel")); }
function buildTemplates(){
  const w=$("templates"); w.innerHTML="";
  TEMPLATES.forEach(t=>{
    const d=document.createElement("div"); d.className="tpl"+(selTpl===t?" sel":"");
    const cv=document.createElement("canvas"); cv.width=cv.height=64;
    const img=new Image();
    img.onload=()=>{ cv.getContext("2d").drawImage(img,0,0,64,64); };
    img.src=makeCover(t,64);
    d.appendChild(cv);
    const lb=document.createElement("small"); lb.textContent=t.title; d.appendChild(lb);
    d.onclick=()=>{
      selTpl=t; selColor=t.color; selPat=t.pattern;
      $("inTitle").value=t.title; $("inArtist").value=t.artist;
      clearTplSel(); d.classList.add("sel");
      buildModalPickers(); d.classList.add("sel");
    };
    w.appendChild(d);
  });
}
function openModal(al){
  S.editing=al||null;
  $("modalTitle").textContent=al?"EDIT ALBUM":"NEW ALBUM";
  $("inTitle").value=al?al.title:"";
  $("inArtist").value=al?al.artist:"";
  selColor=al?al.color:COLORS[Math.floor(Math.random()*COLORS.length)];
  selPat=al?al.pattern:PATTERNS[Math.floor(Math.random()*PATTERNS.length)];
  selTpl=null;
  buildModalPickers();
  $("modal").classList.add("open");
  setTimeout(()=>$("inTitle").focus(),50);
}
$("btnNewAlbum").onclick=()=>openModal(null);
$("btnEditAlbum").onclick=()=>{
  const al=S.albums.find(a=>a.id===S.currentAlbum);
  if(!al){ toast("select an album first!"); return; }
  openModal(al);
};
$("btnCancel").onclick=()=>$("modal").classList.remove("open");
$("modal").onclick=e=>{ if(e.target===$("modal")) $("modal").classList.remove("open"); };
$("btnSave").onclick=()=>{
  const title=$("inTitle").value.trim()||"untitled album";
  const artist=$("inArtist").value.trim()||"unknown";
  if(S.editing){
    Object.assign(S.editing,{title,artist,color:selColor,pattern:selPat});
    S.editing.cover=makeCover(S.editing);
    if(S.currentAlbum===S.editing.id) setVinyl(S.editing);
    toast("album updated.");
  } else {
    const al=newAlbum({title,artist,color:selColor,pattern:selPat});
    S.currentAlbum=al.id; setVinyl(al);
    toast(`"${title}" shelved. drop some songs on it!`);
  }
  save(); renderShelf(); renderTracklist();
  $("modal").classList.remove("open");
};

/* ================= PERSISTENCE ================= */
function save(){
  try{
    const data=S.albums.map(al=>({...al, tracks:al.tracks.map(t=>({name:t.name}))}));
    localStorage.setItem("pixelwax.albums", JSON.stringify(data));
    localStorage.setItem("pixelwax.current", S.currentAlbum||"");
  }catch(e){}
}
function restore(){
  try{
    const raw=localStorage.getItem("pixelwax.albums");
    if(!raw) return;
    JSON.parse(raw).forEach(a=>{ a.tracks=[]; a.cover=makeCover(a); S.albums.push(a); });
    S.currentAlbum=localStorage.getItem("pixelwax.current")||null;
    if(S.currentAlbum){ const al=S.albums.find(x=>x.id===S.currentAlbum); if(al) setVinyl(al); }
  }catch(e){}
}

/* ================= DEMO =================
   Optional: drop any audio file at this path and the PLAY button
   will spin it. The repo ships without one (see assets/README.md),
   so a missing file just shows a friendly toast. */
const DEMO_TRACK = "assets/demo-song.wav";

$("btnDemo").onclick=()=>{
  buildGraph(); if(actx.state==="suspended") actx.resume();
  audio.src=DEMO_TRACK;
  $("nowPlaying").textContent="♪ PIXELWAX house band — demo tune";
  const al=S.albums.find(a=>a.id===S.currentAlbum); if(al) setVinyl(al);
  play();
};

/* ================= DUST ================= */
for(let i=0;i<10;i++){
  const d=document.createElement("div"); d.className="dust";
  d.style.left=Math.random()*100+"%"; d.style.top=Math.random()*100+"%";
  d.style.opacity=.1+Math.random()*.25;
  $("tt").appendChild(d);
  (function drift(el){
    el.animate([
      {transform:"translate(0,0)"},
      {transform:`translate(${(Math.random()-0.5)*60}px, ${(Math.random()-0.5)*60}px)`}
    ], {duration:6000+Math.random()*8000, iterations:Infinity, direction:"alternate", easing:"ease-in-out"});
  })(d);
}

/* ================= CLOCK & KEYS ================= */
setInterval(()=>{ const d=new Date();
  $("clock").textContent=String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
},1000);
document.addEventListener("keydown",e=>{
  if(e.target.tagName==="INPUT") return;
  if(e.code==="Space"){ e.preventDefault(); S.playing?pause():play(); }
  if(e.code==="ArrowRight") loadTrack(S.currentTrack+1);
  if(e.code==="ArrowLeft") loadTrack(S.currentTrack-1);
});

/* ================= BOOT ================= */
buildThemePicker();
restore(); renderShelf(); renderTracklist(); syncUI();
