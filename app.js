(() => {
  const $ = (id) => document.getElementById(id);

  /* =========================
     ELEMENTS
  ========================= */
  const wheel = $("wheel");
  const wheelRing = document.querySelector(".wheelRing");
  const wheelIcon = $("wheelIcon");

  const sheetWrap = $("sheetWrap");
  const sheet = $("sheet");
  const sheetTitle = $("sheetTitle");
  const sheetContent = $("sheetContent");

  const topDate = $("topDate");
  const startPrioCountEl = $("startPrioCount");
  const centerLabelEl = $("centerLabel");

  function clamp01(x){ return Math.max(0, Math.min(1,x)); }
  function pad2(n){ return String(n).padStart(2,"0"); }

  /* =========================
     STORAGE
  ========================= */
  const LS_KEY = "sbdash_store_v3";

  function loadStore(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : { prio:[], todo:[], ideas:[], done:[] };
    }catch{
      return { prio:[], todo:[], ideas:[], done:[] };
    }
  }

  const store = loadStore();
  const saveStore = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
  const uid = () => crypto.randomUUID?.() ?? Date.now()+""+Math.random();

  const fmt = (ts) =>
    new Date(ts).toLocaleString("sv-SE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});

  /* =========================
     DATE
  ========================= */
  function updateTopDate(){
    if(!topDate) return;
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE",{weekday:"long"});
    const date = now.toLocaleDateString("sv-SE",{day:"2-digit",month:"long",year:"numeric"});
    topDate.textContent = `${weekday} ${date}`;
  }
  updateTopDate();
  setInterval(updateTopDate,60000);

  function updateStartPrioCount(){
    if(!startPrioCountEl) return;
    startPrioCountEl.textContent = `Aktiva prios: ${store.prio.length}`;
  }
  updateStartPrioCount();

  /* =========================
     VIEWS
  ========================= */
  const VIEW_DEFS = [
    { id:"calendar", label:"KALENDER", icon:"assets/ui/icon-calendar.svg" },
    { id:"prio",     label:"PRIOS",    icon:"assets/ui/icon-prio.svg" },
    { id:"weather",  label:"VÄDER",    icon:"assets/ui/icon-weather.svg" },
    { id:"news",     label:"NYHETER",  icon:"assets/ui/icon-news.svg" },
    { id:"todo",     label:"TODO",     icon:"assets/ui/icon-todo.svg" },
    { id:"ideas",    label:"IDÉER",    icon:"assets/ui/icon-ideas.svg" },
    { id:"timer",    label:"TIMER",    icon:"assets/ui/icon-pomodoro.svg" },
  ];

  let activeIndex = 0;
  const STEP = 360 / VIEW_DEFS.length;
  let rotationDeg = 0;

  function setCenterLabel(text){
    if(centerLabelEl) centerLabelEl.textContent = text;
  }

  function sectorFromDeg(deg){
    const raw = Math.round(deg / STEP);
    return ((raw % VIEW_DEFS.length)+VIEW_DEFS.length)%VIEW_DEFS.length;
  }

  function setPreview(index){
    activeIndex = (index + VIEW_DEFS.length)%VIEW_DEFS.length;
    const v = VIEW_DEFS[activeIndex];
    if(wheelIcon) wheelIcon.src = v.icon;
    setCenterLabel(v.label);
  }

  function setRotation(deg){
    rotationDeg = deg;
    if(wheelRing) wheelRing.style.transform = `rotate(${deg}deg)`;

    const idx = sectorFromDeg(deg);
    setPreview(idx);

    if(sheetWrap?.classList.contains("open")){
      renderView(VIEW_DEFS[idx].id);
    }
  }

  /* =========================
     SHEET
  ========================= */
  function openSheet(){
    sheetWrap?.classList.add("open");
    document.body.classList.add("sheetOpen");
    if(centerLabelEl) centerLabelEl.style.opacity="0";
  }

  function closeSheet(){
    sheetWrap?.classList.remove("open");
    document.body.classList.remove("sheetOpen");
    if(centerLabelEl) centerLabelEl.style.opacity="1";
  }

  /* =========================
     WHEEL
  ========================= */
  let dragging=false;
  let startAngle=0;
  let tapStartX=0,tapStartY=0;
  let didDrag=false;

  function angle(cx,cy,x,y){
    return Math.atan2(y-cy,x-cx)*(180/Math.PI);
  }

  wheel?.addEventListener("pointerdown",(e)=>{
    dragging=true;
    didDrag=false;
    tapStartX=e.clientX;
    tapStartY=e.clientY;

    const r=wheel.getBoundingClientRect();
    const cx=r.left+r.width/2;
    const cy=r.top+r.height/2;
    startAngle=angle(cx,cy,e.clientX,e.clientY)-rotationDeg;

    wheel.setPointerCapture?.(e.pointerId);
  });

  wheel?.addEventListener("pointermove",(e)=>{
    if(!dragging) return;

    const dx=e.clientX-tapStartX;
    const dy=e.clientY-tapStartY;
    if(!didDrag && Math.hypot(dx,dy)>18) didDrag=true;

    if(didDrag){
      const r=wheel.getBoundingClientRect();
      const cx=r.left+r.width/2;
      const cy=r.top+r.height/2;
      const deg=angle(cx,cy,e.clientX,e.clientY)-startAngle;
      setRotation(deg);
      e.preventDefault();
    }
  });

  wheel?.addEventListener("pointerup",()=>{
    if(!dragging) return;
    dragging=false;

    const idx=sectorFromDeg(rotationDeg);
    setRotation(idx*STEP);

    if(!didDrag){
      openSheet();
      renderView(VIEW_DEFS[activeIndex].id);
    }
  });

  wheel?.addEventListener("wheel",(e)=>{
    e.preventDefault();
    const dir=e.deltaY>0?1:-1;
    const next=(activeIndex+dir+VIEW_DEFS.length)%VIEW_DEFS.length;
    setRotation(next*STEP);
  },{passive:false});

  wheel?.addEventListener("click",()=>{
    openSheet();
    renderView(VIEW_DEFS[activeIndex].id);
  });

  /* =========================
     TIMER (unchanged core)
  ========================= */
  const TIMER={
    total:5*60,
    left:5*60,
    running:false,
    t0:0,
    pausedLeft:5*60,
    raf:0
  };

  function timerText(){
    const safe=Math.max(0,TIMER.left);
    const mm=Math.floor(safe/60);
    const ss=safe%60;
    return `${pad2(mm)}:${pad2(ss)}`;
  }

  function renderTimer(){
    sheetTitle.textContent="Timer";
    sheetContent.innerHTML=`
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:46px;font-weight:900">${timerText()}</div>
      </div>
    `;
  }

  /* =========================
     BASIC VIEWS
  ========================= */
  function renderCalendar(){
    sheetTitle.textContent="Kalender";
    sheetContent.innerHTML=`<div class="card">Kalender här</div>`;
  }

  function renderWeather(){
    sheetTitle.textContent="Väder";
    sheetContent.innerHTML=`<div class="card">Väder här</div>`;
  }

  function renderNews(){
    sheetTitle.textContent="Nyheter";
    sheetContent.innerHTML=`<div class="card">Nyheter här</div>`;
  }

  function renderList(type,label){
    sheetTitle.textContent=label;
    sheetContent.innerHTML=`<div class="card">${label}</div>`;
  }

  function renderView(id){
    if(id==="calendar") return renderCalendar();
    if(id==="prio") return renderList("prio","Aktiv prio");
    if(id==="weather") return renderWeather();
    if(id==="news") return renderNews();
    if(id==="todo") return renderList("todo","TODO");
    if(id==="ideas") return renderList("ideas","Idéer");
    if(id==="timer") return renderTimer();
  }

  /* =========================
     INIT
  ========================= */
  setRotation(0);
})();
