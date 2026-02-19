Här är hela app.js (ersätt allt i din app.js med detta):

/* =========================
   SB Dash – app.js (FULL)
   - Wheel navigation + sheet BEHIND wheel (wheel always usable)
   - Center text stays visible even when sheet open
   - Start icon below preview (big/frost look via CSS)
   - Weather (Open-Meteo)
   - News (Google News RSS) via proxy fallback + cache-bust + local cache
   - Timer: 1/5/10/15/30 starts instantly + Reset (ring on wheel)
   - Lists/Ideas/Prio: checkbox completes, row opens modal
   - Lists modal: checklist with reorder done->bottom
   - + New view: Stocks (icon-stocks.svg)
   ========================= */

(() => {
  const $ = (id) => document.getElementById(id);

  /* =========================
     ELEMENTS
  ========================= */
  const wheel = $("wheel");
  const wheelRing = document.querySelector(".wheelRing");
  const wheelCenterText = $("wheelCenterText");

  const sheetWrap = $("sheetWrap");
  const sheet = $("sheet");
  const sheetTitle = $("sheetTitle");
  const sheetContent = $("sheetContent");
  const sheetCloseBtn = $("sheetCloseBtn");

  const topDate = $("topDate");
  const startPrioCountEl = $("startPrioCount");
  const startIconEl = $("startIcon");

  // Preview (behind wheel)
  const previewTitle = $("previewTitle");
  const previewBody = $("previewBody");

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function pad2(n){ return String(n).padStart(2, "0"); }

  /* =========================
     HAPTICS
  ========================= */
  const canVibrate = !!navigator.vibrate;
  const tick = (ms=8) => { if(canVibrate) navigator.vibrate(ms); };

  /* =========================
     STORAGE
  ========================= */
  const LS_KEY = "sbdash_store_v5";

  function loadStore(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : { prio:[], lists:[], ideas:[], done:[] };
    }catch{
      return { prio:[], lists:[], ideas:[], done:[] };
    }
  }
  const store = loadStore();
  const saveStore = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  const fmt = (ts) =>
    new Date(ts).toLocaleString("sv-SE", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });

  /* =========================
     DATE
  ========================= */
  function updateTopDate(){
    if(!topDate) return;
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE", { weekday:"long" });
    const date = now.toLocaleDateString("sv-SE", { day:"2-digit", month:"long", year:"numeric" });
    topDate.textContent = `${weekday} ${date}`;
  }
  updateTopDate();
  setInterval(updateTopDate, 60_000);

  function updateStartPrioCount(){
    if(!startPrioCountEl) return;
    const c = Array.isArray(store.prio) ? store.prio.length : 0;
    startPrioCountEl.textContent = `Aktiva prios: ${c}`;
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
    { id:"lists",    label:"LISTOR",   icon:"assets/ui/icon-todo.svg" },
    { id:"ideas",    label:"IDÉER",    icon:"assets/ui/icon-ideas.svg" },
    { id:"stocks",   label:"AKTIER",   icon:"assets/ui/icon-stocks.svg" },
    { id:"timer",    label:"TIMER",    icon:"assets/ui/icon-pomodoro.svg" },
  ];

  let activeIndex = 0;
  const STEP = 360 / VIEW_DEFS.length;
  let rotationDeg = 0;

  function setWheelLabel(text){
    if(wheelCenterText) wheelCenterText.textContent = text || "—";
  }
  function setStartIcon(src){
    if(startIconEl && src) startIconEl.src = src;
  }
  function sectorFromDeg(deg){
    const raw = Math.round(deg / STEP);
    return ((raw % VIEW_DEFS.length) + VIEW_DEFS.length) % VIEW_DEFS.length;
  }

  /* =========================
     PREVIEW (behind wheel)
  ========================= */
  let lastWeather = null;
  let lastNews = [];

  function listProgress(item){
    if(!Array.isArray(item.checklist) || item.checklist.length === 0) return "";
    const total = item.checklist.length;
    const done = item.checklist.filter(x => x.done).length;
    return `${done}/${total}`;
  }

  function setPreview(id){
    const v = VIEW_DEFS.find(x => x.id === id);
    if(previewTitle) previewTitle.textContent = v ? v.label : "Preview";

    let html = "";

    if(id === "calendar"){
      html = `<div class="miniHint">Tryck på hjulet för att öppna kalendern.</div>`;
    }

    if(id === "weather"){
      if(lastWeather?.current){
        const t = Math.round(lastWeather.current.temperature_2m);
        const w = Math.round(lastWeather.current.wind_speed_10m);
        const tmax = Math.round(lastWeather.daily?.temperature_2m_max?.[0] ?? t);
        const tmin = Math.round(lastWeather.daily?.temperature_2m_min?.[0] ?? t);
        html = `
          <div style="display:flex; justify-content:space-between; gap:10px; font-weight:900;">
            <div>${t}°</div><div>${w} m/s</div>
          </div>
          <div class="miniHint" style="margin-top:8px;">Idag: ${tmin}°–${tmax}°</div>
          <div class="miniHint" style="margin-top:6px;">Tryck för prognos</div>
        `;
      }else{
        html = `<div class="miniHint">Tryck för att ladda väder.</div>`;
      }
    }

    if(id === "news"){
      if(lastNews.length){
        html = lastNews.slice(0,3).map(n => `
          <div style="margin-top:8px; font-weight:900; line-height:1.15;">• ${n.title}</div>
        `).join("");
        html += `<div class="miniHint" style="margin-top:10px;">Tryck för fler</div>`;
      }else{
        html = `<div class="miniHint">Tryck för att ladda nyheter.</div>`;
      }
    }

    if(id === "prio"){
      const c = store.prio?.length || 0;
      const first = store.prio?.[0]?.text;
      html = `
        <div style="font-weight:900;">Aktiva prios: ${c}</div>
        ${first ? `<div class="miniHint" style="margin-top:8px;">Nästa: ${first}</div>` : `<div class="miniHint" style="margin-top:8px;">Inga prios ännu</div>`}
      `;
    }

    if(id === "lists"){
      const c = store.lists?.length || 0;
      const first = store.lists?.[0];
      const stat = first ? listProgress(first) : "";
      html = `
        <div style="font-weight:900;">Listor: ${c}</div>
        ${first ? `<div class="miniHint" style="margin-top:8px;">${first.text}${stat ? ` • ${stat}` : ""}</div>` : `<div class="miniHint" style="margin-top:8px;">Skapa en lista (t.ex. packlista)</div>`}
      `;
    }

    if(id === "ideas"){
      const c = store.ideas?.length || 0;
      const first = store.ideas?.[0]?.text;
      html = `
        <div style="font-weight:900;">Idéer: ${c}</div>
        ${first ? `<div class="miniHint" style="margin-top:8px;">Senast: ${first}</div>` : `<div class="miniHint" style="margin-top:8px;">Inga idéer ännu</div>`}
      `;
    }

    if(id === "stocks"){
      html = `
        <div style="font-weight:900;">Aktier</div>
        <div class="miniHint" style="margin-top:8px;">(kommer) Favoriter / watchlist</div>
      `;
    }

    if(id === "timer"){
      html = `
        <div style="font-weight:900;">${timerText()}</div>
        <div class="miniHint" style="margin-top:8px;">Tryck för 1/5/10/15/30</div>
      `;
    }

    if(previewBody) previewBody.innerHTML = html;
  }

  function setActiveByIndex(idx){
    activeIndex = (idx + VIEW_DEFS.length) % VIEW_DEFS.length;
    const v = VIEW_DEFS[activeIndex];
    setWheelLabel(v.label);
    setStartIcon(v.icon);
    setPreview(v.id);
  }

  // throttle render when sheet open and wheel rotates a lot
  let renderT = 0;
  function renderIfOpenThrottled(id){
    if(!sheetWrap?.classList.contains("open")) return;
    clearTimeout(renderT);
    renderT = setTimeout(() => renderView(id), 90);
  }

  function setRotation(deg){
    rotationDeg = deg;
    if(wheelRing) wheelRing.style.transform = `rotate(${deg}deg)`;
    const idx = sectorFromDeg(deg);
    setActiveByIndex(idx);
    renderIfOpenThrottled(VIEW_DEFS[idx].id);
  }

  /* =========================
     SHEET OPEN/CLOSE
  ========================= */
  function openSheet(){
    sheetWrap?.classList.add("open");
    sheetWrap?.setAttribute("aria-hidden","false");
    document.body.classList.add("sheetOpen");
  }

  function closeSheet(){
    sheetWrap?.classList.remove("open");
    sheetWrap?.setAttribute("aria-hidden","true");
    document.body.classList.remove("sheetOpen");
  }

  sheetCloseBtn?.addEventListener("click", closeSheet);

  /* drag-to-close (only on sheet) */
  let sheetDragStartY = null;

  sheet?.addEventListener("pointerdown", (e) => {
    sheetDragStartY = e.clientY;
    sheet.setPointerCapture?.(e.pointerId);
  }, { passive:true });

  sheet?.addEventListener("pointermove", (e) => {
    if(sheetDragStartY == null) return;
    const delta = e.clientY - sheetDragStartY;
    if(delta > 0){
      sheet.style.transform = `translateY(${delta}px)`;
      e.preventDefault();
    }
  }, { passive:false });

  sheet?.addEventListener("pointerup", (e) => {
    if(sheetDragStartY == null) return;
    const delta = e.clientY - sheetDragStartY;
    if(delta > 120) closeSheet();
    sheet.style.transform = "";
    sheetDragStartY = null;
  }, { passive:true });

  sheet?.addEventListener("pointercancel", () => {
    sheet.style.transform = "";
    sheetDragStartY = null;
  }, { passive:true });

  /* =========================
     WHEEL interaction
  ========================= */
  let dragging = false;
  let startAngle = 0;
  let tapStartX = 0, tapStartY = 0;
  let didDrag = false;
  let lastSector = 0;

  function angle(cx, cy, x, y){
    return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
  }

  wheel?.addEventListener("pointerdown", (e) => {
    dragging = true;
    didDrag = false;
    tapStartX = e.clientX;
    tapStartY = e.clientY;

    const r = wheel.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    startAngle = angle(cx, cy, e.clientX, e.clientY) - rotationDeg;

    wheel.setPointerCapture?.(e.pointerId);
  }, { passive:true });

  wheel?.addEventListener("pointermove", (e) => {
    if(!dragging) return;

    const dx = e.clientX - tapStartX;
    const dy = e.clientY - tapStartY;
    if(!didDrag && Math.hypot(dx, dy) > 14) didDrag = true;

    if(didDrag){
      const r = wheel.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const deg = angle(cx, cy, e.clientX, e.clientY) - startAngle;

      setRotation(deg);

      const s = sectorFromDeg(deg);
      if(s !== lastSector){
        lastSector = s;
        tick(8);
      }

      e.preventDefault();
    }
  }, { passive:false });

  wheel?.addEventListener("pointerup", () => {
    if(!dragging) return;
    dragging = false;

    const idx = sectorFromDeg(rotationDeg);
    setRotation(idx * STEP);
    lastSector = idx;

    // tap opens sheet
    if(!didDrag){
      openSheet();
      renderView(VIEW_DEFS[activeIndex].id);
    }
  }, { passive:true });

  wheel?.addEventListener("pointercancel", () => { dragging = false; }, { passive:true });

  wheel?.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = (activeIndex + dir + VIEW_DEFS.length) % VIEW_DEFS.length;
    setRotation(next * STEP);
    tick(8);
  }, { passive:false });

  /* =========================
     TIMER + wheel ring SVG + pulse
  ========================= */
  const TIMER = {
    total: 5 * 60,
    left:  5 * 60,
    running: false,
    t0: 0,
    pausedLeft: 5 * 60,
    raf: 0
  };

  // pulse overlay
  const pulse = document.createElement("div");
  pulse.className = "timerPulse";
  wheel?.appendChild(pulse);

  const wheelSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wheelSvg.setAttribute("class", "wheelTimerSvg");
  wheelSvg.innerHTML = `
    <circle id="wheelTimerBg"></circle>
    <circle id="wheelTimerProg"></circle>
  `;
  wheel?.appendChild(wheelSvg);

  function updateWheelTimerProgress(){
    const bg = document.getElementById("wheelTimerBg");
    const prog = document.getElementById("wheelTimerProg");
    if(!wheel || !wheelSvg || !bg || !prog) return;

    const size = wheel.getBoundingClientRect().width;
    const r = (size / 2) - 10;
    const cx = size / 2;
    const cy = size / 2;

    wheelSvg.setAttribute("viewBox", `0 0 ${size} ${size}`);

    bg.setAttribute("cx", cx);
    bg.setAttribute("cy", cy);
    bg.setAttribute("r", r);

    prog.setAttribute("cx", cx);
    prog.setAttribute("cy", cy);
    prog.setAttribute("r", r);

    const C = 2 * Math.PI * r;
    bg.style.strokeDasharray = String(C);
    bg.style.strokeDashoffset = "0";
    prog.style.strokeDasharray = String(C);

    const pct = TIMER.total ? (TIMER.left / TIMER.total) : 0;
    // countdown direction
    prog.style.strokeDashoffset = String(-C * (1 - clamp01(pct)));

    if(pct > 0.40) prog.style.stroke = "rgba(0,209,255,.92)";
    else if(pct > 0.15) prog.style.stroke = "rgba(255,165,0,.92)";
    else prog.style.stroke = "rgba(255,70,70,.92)";
  }
  window.addEventListener("resize", updateWheelTimerProgress);

  function timerText(){
    const safe = Math.max(0, TIMER.left);
    const mm = Math.floor(safe / 60);
    const ss = safe % 60;
    return `${pad2(mm)}:${pad2(ss)}`;
  }

  function setTimerMinutesAndStart(min){
    const m = Number(min);
    if(!Number.isFinite(m) || m <= 0) return;

    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);

    TIMER.total = Math.round(m * 60);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;

    TIMER.running = true;
    TIMER.t0 = performance.now();
    document.body.classList.add("timerRunning");
    cancelAnimationFrame(TIMER.raf);
    TIMER.raf = requestAnimationFrame(timerLoop);

    updateWheelTimerProgress();
    setPreview(VIEW_DEFS[activeIndex].id);
  }

  function resetTimer(){
    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;
    document.body.classList.remove("timerRunning");
    updateWheelTimerProgress();
    setPreview(VIEW_DEFS[activeIndex].id);
  }

  function timerLoop(){
    if(!TIMER.running) return;

    const elapsed = (performance.now() - TIMER.t0) / 1000;
    TIMER.left = Math.max(0, Math.floor(TIMER.pausedLeft - elapsed));

    updateWheelTimerProgress();
    if(VIEW_DEFS[activeIndex].id === "timer") {
      const tTime = $("tTime");
      if(tTime) tTime.textContent = timerText();
    }
    setPreview(VIEW_DEFS[activeIndex].id);

    if(TIMER.left <= 0){
      TIMER.running = false;
      cancelAnimationFrame(TIMER.raf);
      document.body.classList.remove("timerRunning");
      if(canVibrate) navigator.vibrate([20, 40, 20, 60, 20]);
      updateWheelTimerProgress();
      return;
    }
    TIMER.raf = requestAnimationFrame(timerLoop);
  }

  function renderTimer(){
    sheetTitle.textContent = "Timer";
    sheetContent.innerHTML = `
      <div class="card">
        <div style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px;">
          <div id="tTime" style="font-size:52px; font-weight:900; letter-spacing:.6px;">${timerText()}</div>
          <div class="miniHint">${TIMER.running ? "Fokus…" : (TIMER.left === TIMER.total ? "Redo" : (TIMER.left > 0 ? "Pausad" : "KLAR"))}</div>
        </div>

        <div class="timerBtns" style="margin-top:14px;">
          <button class="timerBtn" data-min="1">1</button>
          <button class="timerBtn" data-min="5">5</button>
          <button class="timerBtn" data-min="10">10</button>
          <button class="timerBtn" data-min="15">15</button>
          <button class="timerBtn" data-min="30">30</button>
          <button class="timerBtn timerBtnReset" id="tReset">Reset</button>
        </div>
      </div>
      <div class="miniHint">Hjulets ring visar nedräkning.</div>
    `;

    sheetContent.querySelectorAll("[data-min]").forEach(btn => {
      btn.addEventListener("click", () => setTimerMinutesAndStart(btn.dataset.min));
    });
    $("tReset")?.addEventListener("click", resetTimer);

    updateWheelTimerProgress();
  }

  /* =========================
     MODAL (notes + checklist for Listor)
  ========================= */
  function openModal(item, type){
    const wrap = document.createElement("div");
    wrap.style.position = "fixed";
    wrap.style.inset = "0";
    wrap.style.zIndex = "999";
    wrap.innerHTML = `
      <div style="position:absolute; inset:0; background:rgba(0,0,0,.55); backdrop-filter: blur(6px);"></div>
      <div style="position:absolute; left:18px; right:18px; top:90px; max-width:720px; margin:0 auto;
                  background: rgba(10,18,26,.92); border:1px solid rgba(255,255,255,.10); border-radius:18px;
                  box-shadow:0 22px 70px rgba(0,0,0,.55); overflow:hidden;">
        <div style="display:flex; align-items:center; justify-content:space-between; padding:14px; border-bottom:1px solid rgba(255,255,255,.08);">
          <div style="font-weight:900;">Detaljer</div>
          <button id="mClose" style="width:34px;height:34px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.12);color:#fff;">✕</button>
        </div>
        <div style="padding:14px;">
          <div id="mTitle" style="font-weight:900; margin-bottom:10px;"></div>
          <textarea id="mNote" class="miniInput" style="width:100%; height:120px;" placeholder="Skriv mer…"></textarea>

          <div id="subWrap" style="display:none; margin-top:12px;">
            <div style="font-weight:900; margin-bottom:8px;">Checklist</div>
            <div class="miniForm">
              <input id="subInput" class="miniInput" placeholder="Lägg till sak…" />
              <button id="subAdd" class="miniBtn miniBtnIcon">+</button>
            </div>
            <ul id="subList" class="miniList"></ul>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    wrap.querySelector("#mTitle").textContent = item.text;
    const ta = wrap.querySelector("#mNote");
    ta.value = item.note || "";

    const close = () => wrap.remove();
    wrap.querySelector("#mClose").onclick = close;
    wrap.firstElementChild.onclick = close;

    ta.addEventListener("input", () => {
      item.note = ta.value || "";
      saveStore();
      setPreview(VIEW_DEFS[activeIndex].id);
      if(sheetWrap?.classList.contains("open")) renderView(VIEW_DEFS[activeIndex].id);
    });

    if(type === "lists"){
      const subWrap = wrap.querySelector("#subWrap");
      subWrap.style.display = "block";

      if(!Array.isArray(item.checklist)) item.checklist = [];
      const input = wrap.querySelector("#subInput");
      const addBtn = wrap.querySelector("#subAdd");
      const listEl = wrap.querySelector("#subList");

      const add = () => {
        const t = (input.value || "").trim();
        if(!t) return;
        item.checklist.unshift({ id: uid(), text: t, done: false, createdAt: Date.now() });
        input.value = "";
        saveStore();
        draw();
      };

      addBtn.addEventListener("click", add);
      input.addEventListener("keydown", (e) => { if(e.key === "Enter") add(); });

      const toggle = (id) => {
        const i = item.checklist.findIndex(x => x.id === id);
        if(i === -1) return;
        item.checklist[i].done = !item.checklist[i].done;

        item.checklist.sort((a,b) => (a.done === b.done) ? (b.createdAt - a.createdAt) : (a.done ? 1 : -1));

        saveStore();
        draw();
        setPreview("lists");
        if(sheetWrap?.classList.contains("open") && VIEW_DEFS[activeIndex].id === "lists") renderView("lists");
      };

      function draw(){
        listEl.innerHTML = "";
        item.checklist.forEach(st => {
          const li = document.createElement("li");
          li.className = "miniRow";
          li.style.alignItems = "center";
          li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
              <input class="checkBox" type="checkbox" />
              <div style="font-weight:900; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>
            </div>
          `;
          const cb = li.querySelector("input");
          cb.checked = !!st.done;
          cb.addEventListener("change", () => toggle(st.id));
          li.querySelector("div div").textContent = st.text;
          listEl.appendChild(li);
        });
      }

      draw();
      setTimeout(() => input.focus(), 120);
    } else {
      setTimeout(() => ta.focus(), 80);
    }
  }

  /* =========================
     LIST ITEM ROW
  ========================= */
  function mkCheckItem({ item, meta, stat }, onComplete, onOpen){
    const li = document.createElement("li");
    li.className = "checkItem";

    const row = document.createElement("div");
    row.className = "checkRow";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "checkBox";

    const mid = document.createElement("div");
    mid.className = "checkMid";

    const t = document.createElement("div");
    t.className = "checkText";
    t.textContent = item.text;

    mid.appendChild(t);

    const right = document.createElement("div");
    right.className = "checkRight";

    const metaEl = document.createElement("div");
    metaEl.className = "miniMeta";
    metaEl.textContent = meta || "";

    right.appendChild(metaEl);

    if(stat){
      const statEl = document.createElement("div");
      statEl.className = "checkStat";
      statEl.textContent = stat;
      right.appendChild(statEl);
    }

    row.appendChild(cb);
    row.appendChild(mid);
    row.appendChild(right);

    li.appendChild(row);

    cb.addEventListener("change", () => {
      if(!cb.checked) return;
      cb.disabled = true;
      setTimeout(() => onComplete?.(), 140);
    });

    row.addEventListener("click", (e) => {
      if(e.target === cb) return;
      onOpen?.();
    });

    return li;
  }

  function renderList(type, label, allowModal){
    sheetTitle.textContent = label;

    sheetContent.innerHTML = `
      <div class="miniForm">
        <input id="input" class="miniInput" placeholder="${type === "lists" ? "Ny lista..." : "Skriv..."}" />
        <button id="add" class="miniBtn miniBtnIcon">+</button>
      </div>
      <ul id="list" class="miniList"></ul>
      <div class="miniHint">Bocka = slutför • Tryck på raden = öppna</div>
    `;

    const input = $("input");
    const addBtn = $("add");
    const listEl = $("list");

    const add = () => {
      const t = (input.value || "").trim();
      if(!t) return;

      const obj = { id: uid(), text: t, createdAt: Date.now(), note: "" };
      if(type === "lists") obj.checklist = [];

      store[type].unshift(obj);
      saveStore();
      input.value = "";
      if(type === "prio") updateStartPrioCount();
      draw();
      setPreview(VIEW_DEFS[activeIndex].id);
    };

    addBtn.addEventListener("click", add);
    input.addEventListener("keydown", (e) => { if(e.key === "Enter") add(); });

    function complete(id){
      const i = store[type].findIndex(x => x.id === id);
      if(i === -1) return;

      const item = store[type].splice(i, 1)[0];
      store.done.unshift({ ...item, origin: type, doneAt: Date.now() });
      saveStore();

      if(type === "prio") updateStartPrioCount();
      draw();
      setPreview(VIEW_DEFS[activeIndex].id);
    }

    function draw(){
      listEl.innerHTML = "";
      store[type].forEach((item) => {
        const stat = (type === "lists") ? listProgress(item) : "";
        listEl.appendChild(
          mkCheckItem(
            { item, meta: fmt(item.createdAt), stat },
            () => complete(item.id),
            allowModal ? () => openModal(item, type) : null
          )
        );
      });

      if(!store[type].length){
        listEl.innerHTML = `<li class="miniHint">Tomt här just nu.</li>`;
      }
    }

    draw();
  }

  /* =========================
     CALENDAR
  ========================= */
  const CAL_SRC =
    "https://calendar.google.com/calendar/embed?src=ZXJpY3Nzb25ib25pbmlAZ21haWwuY29t&mode=AGENDA&ctz=Europe%2FStockholm&hl=sv&bgcolor=%230b1118&showTitle=0&showTabs=0&showNav=0&showPrint=0&showCalendars=0&showDate=0";

  function renderCalendar(){
    sheetTitle.textContent = "Kalender";
    sheetContent.innerHTML = `
      <div class="card">
        <div class="calScale">
          <iframe class="calFrame" src="${CAL_SRC}" scrolling="yes"></iframe>
        </div>
      </div>
      <div class="miniHint" style="margin-top:10px;">(iPhone Safari kan kräva cookies för Google iframe.)</div>
    `;
  }

  /* =========================
     WEATHER
  ========================= */
  async function renderWeather(){
    sheetTitle.textContent = "Väder";
    sheetContent.innerHTML = `
      <div class="card">
        <div id="wNow" style="font-weight:900;">Laddar…</div>
        <div id="wSub" class="miniHint" style="margin-top:8px;"></div>
      </div>
    `;

    const lat = 59.3293, lon = 18.0686;
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&forecast_days=2` +
      `&timezone=Europe%2FStockholm`;

    try{
      const r = await fetch(url, { cache:"no-store" });
      const data = await r.json();
      lastWeather = data;

      const t = Math.round(data.current.temperature_2m);
      const w = Math.round(data.current.wind_speed_10m);
      const tmax = Math.round(data.daily.temperature_2m_max?.[0] ?? t);
      const tmin = Math.round(data.daily.temperature_2m_min?.[0] ?? t);

      $("wNow").textContent = `${t}° • ${w} m/s`;
      $("wSub").textContent = `Idag: ${tmin}°–${tmax}°`;

      setPreview("weather");
    }catch{
      const el = $("wNow");
      if(el) el.textContent = "Kunde inte hämta väder.";
    }
  }

  /* =========================
     NEWS (fast + robust)
  ========================= */
  const RSS_URL_BASE = "https://news.google.com/rss?hl=sv&gl=SE&ceid=SE:sv";
  const NEWS_CACHE_KEY = "sbdash_news_cache_v2";

  const PROXIES = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://r.jina.ai/http://${u.replace(/^https?:\/\//, "")}`,
    (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  ];

  async function fetchTextWithFallback(url){
    let lastErr = null;
    for(const mk of PROXIES){
      try{
        const proxyUrl = mk(url);
        const res = await fetch(proxyUrl, { cache:"no-store" });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const txt = await res.text();

        if(proxyUrl.includes("/get?url=")){
          const obj = JSON.parse(txt);
          if(obj?.contents) return obj.contents;
          throw new Error("No contents in allorigins get");
        }
        return txt;
      }catch(err){
        lastErr = err;
      }
    }
    throw (lastErr || new Error("All proxies failed"));
  }

  function parseRss(xmlText, max = 10){
    const xml = new DOMParser().parseFromString(xmlText, "text/xml");
    const items = Array.from(xml.querySelectorAll("item")).slice(0, max);
    return items.map((item) => ({
      title: item.querySelector("title")?.textContent?.trim() || "Nyhet",
      link: item.querySelector("link")?.textContent?.trim() || "#",
      pubDate: item.querySelector("pubDate")?.textContent?.trim() || "",
    }));
  }

  function saveNewsCache(items){
    try{
      localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), items }));
    }catch{}
  }
  function loadNewsCache(){
    try{
      return JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || "null");
    }catch{
      return null;
    }
  }

  function renderNewsList(items, metaText){
    const newsList = document.getElementById("newsList");
    const newsMeta = document.getElementById("newsMeta");
    if(!newsList || !newsMeta) return;

    newsMeta.textContent = metaText || "";
    newsList.innerHTML = "";

    if(!items?.length){
      newsList.innerHTML = `<li class="miniHint">Inget att visa just nu.</li>`;
      return;
    }

    for(const it of items){
      const li = document.createElement("li");
      li.className = "miniRow";

      const left = document.createElement("div");
      left.className = "miniRowLeft";

      const a = document.createElement("a");
      a.href = it.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = it.title;
      a.style.color = "var(--text)";
      a.style.textDecoration = "none";
      a.style.fontWeight = "900";
      a.style.fontSize = "12px";
      a.style.whiteSpace = "nowrap";
      a.style.overflow = "hidden";
      a.style.textOverflow = "ellipsis";

      left.appendChild(a);

      const right = document.createElement("div");
      right.className = "miniMeta";

      if(it.pubDate){
        const d = new Date(it.pubDate);
        if(!isNaN(d.getTime())){
          right.textContent = d.toLocaleString("sv-SE", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
        }
      }

      li.appendChild(left);
      li.appendChild(right);
      newsList.appendChild(li);
    }
  }

  let newsLoading = false;

  async function loadNews(){
    const newsList = document.getElementById("newsList");
    const newsMeta = document.getElementById("newsMeta");
    if(!newsList || !newsMeta) return;

    if(newsLoading) return;
    newsLoading = true;

    newsMeta.textContent = "Laddar…";
    newsList.innerHTML = "";

    try{
      const url = `${RSS_URL_BASE}&_=${Date.now()}`; // cache-bust
      const xmlText = await fetchTextWithFallback(url);

      const items = parseRss(xmlText, 10);

      // filter older than 7 days (but if all old, show anyway)
      const now = Date.now();
      const fresh = items.filter(it => {
        const t = it.pubDate ? new Date(it.pubDate).getTime() : 0;
        return t && (now - t) < (7 * 24 * 60 * 60 * 1000);
      });
      const finalItems = fresh.length ? fresh : items;

      lastNews = finalItems;
      saveNewsCache(finalItems);

      const stamp = new Date().toLocaleString("sv-SE", { hour:"2-digit", minute:"2-digit" });
      renderNewsList(finalItems, `Uppdaterad: ${stamp}${fresh.length ? "" : " (äldre batch)"}`);

      setPreview("news");
    }catch{
      const c = loadNewsCache();
      if(c?.items?.length){
        lastNews = c.items;
        renderNewsList(
          c.items,
          `Visar cache (senast: ${new Date(c.updatedAt).toLocaleString("sv-SE", { hour:"2-digit", minute:"2-digit" })})`
        );
        setPreview("news");
      }else{
        renderNewsList([], "Kunde inte ladda nyheter.");
      }
    }finally{
      newsLoading = false;
    }
  }

  function renderNews(){
    sheetTitle.textContent = "Nyheter";
    sheetContent.innerHTML = `
      <div class="card">
        <ul id="newsList" class="miniList"></ul>
        <div id="newsMeta" class="miniHint" style="margin-top:10px;">Laddar…</div>
      </div>
    `;
    loadNews();
  }

  setInterval(() => {
    if(document.getElementById("newsList") && document.getElementById("newsMeta")){
      loadNews();
    }
  }, 10 * 60 * 1000);

  /* =========================
     STOCKS (placeholder)
  ========================= */
  function renderStocks(){
    sheetTitle.textContent = "Aktier";
    sheetContent.innerHTML = `
      <div class="card">
        <div style="font-weight:900;">Aktier</div>
        <div class="miniHint" style="margin-top:10px;">Nästa steg: watchlist + prisfeed.</div>
      </div>
    `;
  }

  /* =========================
     VIEW SWITCH
  ========================= */
  function renderView(id){
    if(id === "calendar") return renderCalendar();
    if(id === "prio")     return renderList("prio", "Aktiv prio", true);
    if(id === "weather")  return renderWeather();
    if(id === "news")     return renderNews();
    if(id === "lists")    return renderList("lists", "Listor", true);
    if(id === "ideas")    return renderList("ideas", "Idéer", true);
    if(id === "stocks")   return renderStocks();
    if(id === "timer")    return renderTimer();
  }

  /* =========================
     INIT
  ========================= */
  setRotation(0);
  setActiveByIndex(0);
  updateWheelTimerProgress();
  setPreview("calendar");

})();