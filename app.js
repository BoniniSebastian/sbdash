/* =========================
   SB Dash – app.js (FULL)
   - Wheel navigation + sheet behind wheel (wheel still usable when open)
   - Preview card behind wheel
   - Big frosted start icon under preview
   - Calendar full-bleed in sheet
   - News (Google News RSS) via proxy fallback + cache-bust + local cache
   - Lists/Ideas/Prio + modal details + checklist for lists
   - Timer 1/5/10/15/30 with ring + pulse
   - New view: Stocks (icon-stocks.svg)
   ========================= */

(() => {
  const $ = (id) => document.getElementById(id);

  /* =========================
     ELEMENTS
  ========================= */
  const wheel = $("wheel");
  const wheelRing = document.querySelector(".wheelRing");
  const wheelCenterText = $("wheelCenterText");
  const wheelWrap = $("wheelWrap");

  const sheetWrap = $("sheetWrap");
  const sheet = $("sheet");
  const sheetTitle = $("sheetTitle");
  const sheetContent = $("sheetContent");
  const sheetCloseBtn = $("sheetCloseBtn");

  const topDate = $("topDate");
  const topPrioMini = $("topPrioMini");

  const previewTitle = $("previewTitle");
  const previewBody = $("previewBody");

  const startIcon = $("startIcon");

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function pad2(n){ return String(n).padStart(2, "0"); }

  /* =========================
     STORAGE
  ========================= */
  const LS_KEY = "sbdash_store_v4";

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

  function updatePrioCount(){
    const c = Array.isArray(store.prio) ? store.prio.length : 0;
    if(topPrioMini) topPrioMini.textContent = `Aktiva prios: ${c}`;
  }
  updatePrioCount();

  /* =========================
     VIEWS
  ========================= */
  const VIEW_DEFS = [
    { id:"calendar", label:"KALENDER", icon:"assets/ui/icon-calendar.svg" },
    { id:"prio",     label:"PRIOS",    icon:"assets/ui/icon-prio.svg" },
    { id:"weather",  label:"VÄDER",    icon:"assets/ui/icon-weather.svg" },
    { id:"news",     label:"NYHETER",  icon:"assets/ui/icon-news.svg" },
    { id:"stocks",   label:"AKTIER",   icon:"assets/ui/icon-stocks.svg" },
    { id:"lists",    label:"LISTOR",   icon:"assets/ui/icon-todo.svg" },
    { id:"ideas",    label:"IDÉER",    icon:"assets/ui/icon-ideas.svg" },
    { id:"timer",    label:"TIMER",    icon:"assets/ui/icon-pomodoro.svg" },
  ];

  let activeIndex = 0;
  const STEP = 360 / VIEW_DEFS.length;
  let rotationDeg = 0;

  function sectorFromDeg(deg){
    const raw = Math.round(deg / STEP);
    return ((raw % VIEW_DEFS.length) + VIEW_DEFS.length) % VIEW_DEFS.length;
  }

  function setWheelText(text){
    if(wheelCenterText) wheelCenterText.textContent = text || "—";
  }

  function setStartIcon(src){
    if(startIcon && src) startIcon.src = src;
  }

  /* =========================
     PREVIEW
  ========================= */
  let lastWeather = null;
  let lastNews = [];

  function listProgress(item){
    if(!Array.isArray(item.checklist) || item.checklist.length === 0) return "";
    const total = item.checklist.length;
    const done = item.checklist.filter(x => x.done).length;
    return `${done}/${total}`;
  }

  function renderPreview(viewId){
    const v = VIEW_DEFS.find(x => x.id === viewId);
    if(previewTitle) previewTitle.textContent = v ? v.label : "Preview";

    let html = "";
    if(viewId === "calendar"){
      html = `<div class="miniHint">Tryck på hjulet för att öppna kalendern.</div>`;
    }
    if(viewId === "prio"){
      const c = store.prio?.length || 0;
      const first = store.prio?.[0]?.text;
      html = `
        <div style="font-weight:950;">Aktiva prios: ${c}</div>
        ${first ? `<div class="miniHint" style="margin-top:6px;">Nästa: ${first}</div>` : `<div class="miniHint" style="margin-top:6px;">Inga prios ännu</div>`}
      `;
    }
    if(viewId === "weather"){
      if(lastWeather?.current){
        const t = Math.round(lastWeather.current.temperature_2m);
        const w = Math.round(lastWeather.current.wind_speed_10m);
        html = `
          <div style="display:flex; justify-content:space-between; gap:10px; font-weight:950;">
            <div>${t}°</div><div>${w} m/s</div>
          </div>
          <div class="miniHint" style="margin-top:8px;">Tryck för prognos</div>
        `;
      }else{
        html = `<div class="miniHint">Tryck för att ladda väder.</div>`;
      }
    }
    if(viewId === "news"){
      if(lastNews.length){
        html = lastNews.slice(0,3).map(n => `
          <div style="margin-top:8px; font-weight:950; line-height:1.15;">• ${n.title}</div>
        `).join("");
        html += `<div class="miniHint" style="margin-top:10px;">Tryck för fler</div>`;
      }else{
        html = `<div class="miniHint">Tryck för att ladda nyheter.</div>`;
      }
    }
    if(viewId === "stocks"){
      html = `<div class="miniHint">Aktier-sidan är redo (nästa steg: koppla data/portfölj).</div>`;
    }
    if(viewId === "lists"){
      const c = store.lists?.length || 0;
      const first = store.lists?.[0];
      const stat = first ? listProgress(first) : "";
      html = `
        <div style="font-weight:950;">Listor: ${c}</div>
        ${first ? `<div class="miniHint" style="margin-top:6px;">${first.text}${stat ? ` • ${stat}` : ""}</div>` : `<div class="miniHint" style="margin-top:6px;">Skapa en lista (t.ex. packlista)</div>`}
      `;
    }
    if(viewId === "ideas"){
      const c = store.ideas?.length || 0;
      const first = store.ideas?.[0]?.text;
      html = `
        <div style="font-weight:950;">Idéer: ${c}</div>
        ${first ? `<div class="miniHint" style="margin-top:6px;">Senast: ${first}</div>` : `<div class="miniHint" style="margin-top:6px;">Inga idéer ännu</div>`}
      `;
    }
    if(viewId === "timer"){
      html = `
        <div style="font-weight:950;">${timerText()}</div>
        <div class="miniHint" style="margin-top:8px;">Tryck för 1/5/10/15/30</div>
      `;
    }

    if(previewBody) previewBody.innerHTML = html;
  }

  function applyActive(index){
    activeIndex = (index + VIEW_DEFS.length) % VIEW_DEFS.length;
    const v = VIEW_DEFS[activeIndex];
    setWheelText(v.label);
    setStartIcon(v.icon);
    renderPreview(v.id);
  }

  // throttle render when sheet open and wheel rotates a lot
  let renderT = 0;
  function renderIfOpenThrottled(id){
    if(!document.body.classList.contains("sheetOpen")) return;
    clearTimeout(renderT);
    renderT = setTimeout(() => renderView(id), 90);
  }

  function setRotation(deg){
    rotationDeg = deg;
    if(wheelRing) wheelRing.style.transform = `rotate(${deg}deg)`;
    const idx = sectorFromDeg(deg);
    applyActive(idx);
    renderIfOpenThrottled(VIEW_DEFS[idx].id);
  }

  /* =========================
     SHEET OPEN/CLOSE
  ========================= */
  function openSheet(){
    document.body.classList.add("sheetOpen");
    if(sheetWrap){
      sheetWrap.setAttribute("aria-hidden","false");
    }
  }
  function closeSheet(){
    document.body.classList.remove("sheetOpen");
    if(sheetWrap){
      sheetWrap.setAttribute("aria-hidden","true");
    }
  }

  sheetCloseBtn?.addEventListener("click", closeSheet);

  // ESC close (desktop)
  window.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeSheet();
  });

  /* drag-to-close (small) */
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

  sheet?.addEventListener("pointerup", () => {
    if(sheetDragStartY == null) return;
    const delta = parseFloat((sheet.style.transform || "").replace(/[^\d.-]/g,"")) || 0;
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
    if(!didDrag && Math.hypot(dx, dy) > 18) didDrag = true;

    if(didDrag){
      const r = wheel.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const deg = angle(cx, cy, e.clientX, e.clientY) - startAngle;
      setRotation(deg);
      e.preventDefault();
    }
  }, { passive:false });

  wheel?.addEventListener("pointerup", () => {
    if(!dragging) return;
    dragging = false;

    const idx = sectorFromDeg(rotationDeg);
    setRotation(idx * STEP);

    // tap opens sheet
    if(!didDrag){
      openSheet();
      renderView(VIEW_DEFS[activeIndex].id);
    }
  }, { passive:true });

  wheel?.addEventListener("pointercancel", () => { dragging = false; }, { passive:true });

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
  const canVibrate = !!navigator.vibrate;

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
    renderPreview("timer");
  }

  function resetTimer(){
    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;
    document.body.classList.remove("timerRunning");
    updateWheelTimerProgress();
    renderPreview("timer");
  }

  function timerLoop(){
    if(!TIMER.running) return;

    const elapsed = (performance.now() - TIMER.t0) / 1000;
    TIMER.left = Math.max(0, Math.floor(TIMER.pausedLeft - elapsed));

    updateWheelTimerProgress();

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
      <div class="card" style="padding:16px;">
        <div style="text-align:center; font-weight:950; font-size:54px; letter-spacing:.6px;">${timerText()}</div>
        <div class="miniHint" style="text-align:center; margin-top:6px;">Tryck för 1/5/10/15/30</div>

        <div class="timerBtns" style="margin-top:14px;">
          <button class="timerBtn" data-min="1">1</button>
          <button class="timerBtn" data-min="5">5</button>
          <button class="timerBtn" data-min="10">10</button>
          <button class="timerBtn" data-min="15">15</button>
          <button class="timerBtn" data-min="30">30</button>
          <button class="timerBtn timerBtnReset" id="tReset">Reset</button>
        </div>
      </div>
    `;

    sheetContent.querySelectorAll("[data-min]").forEach(btn => {
      btn.addEventListener("click", () => setTimerMinutesAndStart(btn.dataset.min));
    });
    $("tReset")?.addEventListener("click", resetTimer);

    updateWheelTimerProgress();
  }

  /* =========================
     MODAL (Detaljer) + checklist i Listor
  ========================= */
  function openModal(item, type){
    const wrap = document.createElement("div");
    wrap.className = "modalWrap";
    wrap.innerHTML = `
      <div class="modalBackdrop"></div>
      <div class="modalCard">
        <div class="modalHeader">
          <div class="modalTitle">Detaljer</div>
          <button class="modalClose">✕</button>
        </div>
        <div class="modalBody">
          <div class="modalMainText"></div>
          <textarea class="modalTextArea" placeholder="Skriv mer…"></textarea>

          <div class="subTaskBlock" style="margin-top:14px; display:none;">
            <div class="miniHint" style="margin-bottom:10px; font-weight:900; color:rgba(255,255,255,.78);">Checklist</div>

            <div class="miniForm">
              <input class="miniInput" id="subTaskInput" placeholder="Lägg till sak…" />
              <button class="miniBtn" id="subTaskAdd">+</button>
            </div>

            <ul class="miniList" id="subTaskList"></ul>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    wrap.querySelector(".modalMainText").textContent = item.text;

    const ta = wrap.querySelector(".modalTextArea");
    ta.value = item.note || "";

    const close = () => wrap.remove();
    wrap.querySelector(".modalBackdrop").onclick = close;
    wrap.querySelector(".modalClose").onclick = close;

    ta.addEventListener("input", () => {
      item.note = ta.value || "";
      saveStore();
      renderPreview(VIEW_DEFS[activeIndex].id);
      if(document.body.classList.contains("sheetOpen")) renderView(VIEW_DEFS[activeIndex].id);
    });

    if(type === "lists"){
      const block = wrap.querySelector(".subTaskBlock");
      block.style.display = "block";

      if(!Array.isArray(item.checklist)) item.checklist = [];

      const input = wrap.querySelector("#subTaskInput");
      const addBtn = wrap.querySelector("#subTaskAdd");
      const listEl = wrap.querySelector("#subTaskList");

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
        renderPreview("lists");
        if(document.body.classList.contains("sheetOpen") && VIEW_DEFS[activeIndex].id === "lists") renderView("lists");
      };

      function draw(){
        listEl.innerHTML = "";
        item.checklist.forEach(st => {
          const li = document.createElement("li");
          li.className = "subTaskRow" + (st.done ? " done" : "");
          li.innerHTML = `
            <input class="subTaskCb" type="checkbox" />
            <div class="subTaskText"></div>
          `;
          const cb = li.querySelector("input");
          cb.checked = !!st.done;
          cb.addEventListener("change", () => toggle(st.id));
          li.querySelector(".subTaskText").textContent = st.text;
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
     LISTS (prio/lists/ideas)
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
        <button id="add" class="miniBtn">+</button>
      </div>
      <ul id="list" class="miniList"></ul>
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
      if(type === "prio") updatePrioCount();
      draw();
      renderPreview(VIEW_DEFS[activeIndex].id);
    };

    addBtn.addEventListener("click", add);
    input.addEventListener("keydown", (e) => { if(e.key === "Enter") add(); });

    function complete(id){
      const i = store[type].findIndex(x => x.id === id);
      if(i === -1) return;

      const item = store[type].splice(i, 1)[0];
      store.done.unshift({ ...item, origin: type, doneAt: Date.now() });
      saveStore();

      if(type === "prio") updatePrioCount();
      draw();
      renderPreview(VIEW_DEFS[activeIndex].id);
    }

    function draw(){
      listEl.innerHTML = "";
      (store[type] || []).forEach((item) => {
        const stat = (type === "lists") ? listProgress(item) : "";
        listEl.appendChild(
          mkCheckItem(
            { item, meta: fmt(item.createdAt), stat },
            () => complete(item.id),
            allowModal ? () => openModal(item, type) : null
          )
        );
      });
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
      <iframe class="calFrame" src="${CAL_SRC}" scrolling="yes" loading="lazy"></iframe>
      <div class="miniHint" style="margin-top:10px;">(iPhone Safari kan kräva cookies för Google iframe.)</div>
    `;
  }

  /* =========================
     WEATHER
  ========================= */
  async function renderWeather(){
    sheetTitle.textContent = "Väder";
    sheetContent.innerHTML = `
      <div class="card" style="padding:14px;">
        <div id="wNow" style="font-weight:950; font-size:26px;">Laddar…</div>
        <div id="wSub" class="miniHint" style="margin-top:8px;"></div>
      </div>
    `;

    const lat = 59.3293, lon = 18.0686;
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&timezone=Europe%2FStockholm`;

    try{
      const r = await fetch(url, { cache:"no-store" });
      const data = await r.json();
      lastWeather = data;

      const t = Math.round(data.current.temperature_2m);
      const w = Math.round(data.current.wind_speed_10m);
      const tmax = Math.round(data.daily.temperature_2m_max?.[0] ?? 0);
      const tmin = Math.round(data.daily.temperature_2m_min?.[0] ?? 0);

      $("wNow").textContent = `${t}° • ${w} m/s`;
      $("wSub").textContent = `Idag: ${tmin}°–${tmax}°`;

      renderPreview("weather");
    }catch{
      const el = $("wNow");
      if(el) el.textContent = "Kunde inte hämta väder.";
    }
  }

  /* =========================
     NEWS (fast)
  ========================= */
  const RSS_URL_BASE = "https://news.google.com/rss?hl=sv&gl=SE&ceid=SE:sv";
  const NEWS_CACHE_KEY = "sbdash_news_cache_v2";

  const PROXIES = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://r.jina.ai/http://${u.replace(/^https?:\/\//, "")}`,
  ];

  async function fetchTextWithFallback(url){
    let lastErr = null;
    for(const mk of PROXIES){
      try{
        const proxyUrl = mk(url);
        const res = await fetch(proxyUrl, { cache:"no-store" });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
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
          right.textContent = d.toLocaleString("sv-SE", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
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
      lastNews = items;
      saveNewsCache(items);

      const stamp = new Date().toLocaleString("sv-SE", { hour:"2-digit", minute:"2-digit" });
      renderNewsList(items, `Uppdaterad: ${stamp}`);
      renderPreview("news");
    }catch{
      const c = loadNewsCache();
      if(c?.items?.length){
        lastNews = c.items;
        renderNewsList(c.items, `Visar cache (senast: ${new Date(c.updatedAt).toLocaleString("sv-SE", { hour:"2-digit", minute:"2-digit" })})`);
        renderPreview("news");
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
      <ul id="newsList" class="miniList"></ul>
      <div id="newsMeta" class="miniHint" style="margin-top:8px;">Laddar…</div>
    `;
    loadNews();
  }

  // auto-refresh var 10:e minut (om nyhetssidan är öppen)
  setInterval(() => {
    if(document.body.classList.contains("sheetOpen") && document.getElementById("newsList")){
      loadNews();
    }
  }, 10 * 60 * 1000);

  /* =========================
     STOCKS (placeholder)
  ========================= */
  function renderStocks(){
    sheetTitle.textContent = "Aktier";
    sheetContent.innerHTML = `
      <div class="card" style="padding:14px;">
        <div style="font-weight:950; font-size:16px;">Aktier</div>
        <div class="miniHint" style="margin-top:8px;">
          Nästa steg: välj vad du vill visa här (Avanza-länkar, watchlist, index, nyckeltal).
        </div>
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
    if(id === "stocks")   return renderStocks();
    if(id === "lists")    return renderList("lists", "Listor", true);
    if(id === "ideas")    return renderList("ideas", "Idéer", true);
    if(id === "timer")    return renderTimer();
  }

  /* =========================
     INIT
  ========================= */
  setRotation(0);
  applyActive(0);
  updateWheelTimerProgress();
  renderPreview("calendar");
})();