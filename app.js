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

  const previewWrap = $("previewWrap");
  const previewTitle = $("previewTitle");
  const previewBody = $("previewBody");

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
    { id:"timer",    label:"TIMER",    icon:"assets/ui/icon-pomodoro.svg" },
  ];

  let activeIndex = 0;
  const STEP = 360 / VIEW_DEFS.length;
  let rotationDeg = 0;

  function setCenterLabel(text){
    if(centerLabelEl) centerLabelEl.textContent = text || "";
  }

  function sectorFromDeg(deg){
    const raw = Math.round(deg / STEP);
    return ((raw % VIEW_DEFS.length) + VIEW_DEFS.length) % VIEW_DEFS.length;
  }

  function setPreview(index){
    activeIndex = (index + VIEW_DEFS.length) % VIEW_DEFS.length;
    const v = VIEW_DEFS[activeIndex];
    if(wheelIcon) wheelIcon.src = v.icon;
    setCenterLabel(v.label);
    renderPreview(v.id);
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
    setPreview(idx);
    renderIfOpenThrottled(VIEW_DEFS[idx].id);
  }

  /* =========================
     SHEET OPEN/CLOSE
  ========================= */
  function openSheet(){
    sheetWrap?.classList.add("open");
    document.body.classList.add("sheetOpen");
    if(centerLabelEl) centerLabelEl.style.opacity = "0";
  }

  function closeSheet(){
    sheetWrap?.classList.remove("open");
    document.body.classList.remove("sheetOpen");
    if(centerLabelEl) centerLabelEl.style.opacity = "1";
  }

  /* drag-to-close */
  let sheetDragStartY = null;

  sheet?.addEventListener("pointerdown", (e) => {
    sheetDragStartY = e.clientY;
    sheet.setPointerCapture?.(e.pointerId);
  }, { passive:true });

  sheet?.addEventListener("pointermove", (e) => {
    if(sheetDragStartY == null) return;
    const delta = e.clientY - sheetDragStartY;
    if(delta > 0){
      sheet.style.transform = `translateX(-50%) translateY(${delta}px)`;
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

  wheel?.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = (activeIndex + dir + VIEW_DEFS.length) % VIEW_DEFS.length;
    setRotation(next * STEP);
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
    const r = (size / 2) - 8;
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

    // ✅ countdown direction (reverse) via negative dashoffset
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

    // stop current
    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);

    TIMER.total = Math.round(m * 60);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;

    // start immediately
    TIMER.running = true;
    TIMER.t0 = performance.now();
    document.body.classList.add("timerRunning");
    cancelAnimationFrame(TIMER.raf);
    TIMER.raf = requestAnimationFrame(timerLoop);

    updateWheelTimerProgress();
    renderTimerUIOnly();
  }

  function resetTimer(){
    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;
    document.body.classList.remove("timerRunning");
    updateWheelTimerProgress();
    renderTimerUIOnly();
  }

  function timerLoop(){
    if(!TIMER.running) return;

    const elapsed = (performance.now() - TIMER.t0) / 1000;
    TIMER.left = Math.max(0, Math.floor(TIMER.pausedLeft - elapsed));

    updateWheelTimerProgress();
    renderTimerUIOnly();

    if(TIMER.left <= 0){
      TIMER.running = false;
      cancelAnimationFrame(TIMER.raf);
      document.body.classList.remove("timerRunning");
      if(canVibrate) navigator.vibrate([20, 40, 20, 60, 20]);
      updateWheelTimerProgress();
      renderTimerUIOnly();
      return;
    }

    TIMER.raf = requestAnimationFrame(timerLoop);
  }

  function renderTimerUIOnly(){
    const tTime = $("tTime");
    const tState = $("tState");
    if(tTime) tTime.textContent = timerText();

    if(tState){
      if(!TIMER.running && TIMER.left === TIMER.total) tState.textContent = "Redo";
      else if(TIMER.running && TIMER.left > 0) tState.textContent = "Fokus…";
      else if(!TIMER.running && TIMER.left > 0) tState.textContent = "Pausad";
      else tState.textContent = "KLAR";
    }
  }

  function renderTimer(){
    sheetTitle.textContent = "Timer";
    sheetContent.innerHTML = `
      <div class="timerBar">
        <div style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px;">
          <div id="tTime" style="font-size:52px; font-weight:900; letter-spacing:.6px;">${timerText()}</div>
          <div id="tState" class="miniHint">Redo</div>
        </div>

        <div class="timerBtns" style="margin-top:12px;">
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
    renderTimerUIOnly();
  }

  /* =========================
     MODAL (notes + sub tasks for Listor)
  ========================= */
  function openModal(item, type){
    const wrap = document.createElement("div");
    wrap.className = "modalWrap open";
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

          <div class="subTaskBlock" style="display:none;">
            <div class="subTaskHeader">Checklist</div>

            <div class="subTaskForm">
              <input class="miniInput" id="subTaskInput" placeholder="Lägg till sak…" />
              <button class="miniBtn miniBtnIcon" id="subTaskAdd">+</button>
            </div>

            <ul class="subTaskList" id="subTaskList"></ul>
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

    // autosave note
    ta.addEventListener("input", () => {
      item.note = ta.value || "";
      saveStore();
      renderPreview(VIEW_DEFS[activeIndex].id);
      if(sheetWrap?.classList.contains("open")) renderView(VIEW_DEFS[activeIndex].id);
    });

    // list checklists
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

        // move done to bottom, undone to top
        item.checklist.sort((a,b) => (a.done === b.done) ? (b.createdAt - a.createdAt) : (a.done ? 1 : -1));

        saveStore();
        draw();
        renderPreview("lists");
        if(sheetWrap?.classList.contains("open") && VIEW_DEFS[activeIndex].id === "lists") renderView("lists");
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
     HEADER "Visa slutförda"
  ========================= */
  function setSheetTitleWithDone(label){
    sheetTitle.innerHTML = `
      <span>${label}</span>
      <span class="doneHeaderBtn" id="openDone">
        <span class="doneHeaderText">Visa slutförda</span>
        <img class="doneHeaderIcon" src="assets/ui/icon-done.svg" alt="done" />
      </span>
    `;
    $("openDone")?.addEventListener("click", renderDone);
  }

  /* =========================
     LIST ITEM ROW
     - checkbox = complete
     - rest click = modal
  ========================= */
  function listProgress(item){
    if(!Array.isArray(item.checklist) || item.checklist.length === 0) return "";
    const total = item.checklist.length;
    const done = item.checklist.filter(x => x.done).length;
    return `${done}/${total}`;
  }

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
      li.classList.add("isCompleting");
      setTimeout(() => onComplete?.(), 190);
    });

    // click rest opens modal (not checkbox)
    row.addEventListener("click", (e) => {
      if(e.target === cb) return;
      onOpen?.();
    });

    return li;
  }

  function renderList(type, label, allowModal){
    setSheetTitleWithDone(label);

    sheetContent.innerHTML = `
      <div class="miniForm">
        <input id="input" class="miniInput" placeholder="${type === "lists" ? "Ny lista..." : "Skriv..."}" />
        <button id="add" class="miniBtn miniBtnIcon">+</button>
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
      if(type === "prio") updateStartPrioCount();
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

      if(type === "prio") updateStartPrioCount();
      draw();
      renderPreview(VIEW_DEFS[activeIndex].id);
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
    }

    draw();
  }

  function renderDone(){
    sheetTitle.textContent = "Slutförda";
    sheetContent.innerHTML = `<ul id="doneList" class="miniList"></ul>`;
    const listEl = $("doneList");

    (store.done || []).forEach((item) => {
      const li = document.createElement("li");
      li.className = "checkItem";
      li.innerHTML = `
        <div class="checkRow" style="cursor:default;">
          <div class="checkMid">
            <div class="checkText"></div>
          </div>
          <div class="checkRight">
            <div class="miniMeta"></div>
          </div>
        </div>
      `;
      li.querySelector(".checkText").textContent = item.text;
      li.querySelector(".miniMeta").textContent = fmt(item.doneAt);
      listEl.appendChild(li);
    });
  }

  /* =========================
     CALENDAR
  ========================= */
  const CAL_SRC =
    "https://calendar.google.com/calendar/embed?src=ZXJpY3Nzb25ib25pbmlAZ21haWwuY29t&mode=AGENDA&ctz=Europe%2FStockholm&hl=sv&bgcolor=%230b1118&showTitle=0&showTabs=0&showNav=0&showPrint=0&showCalendars=0&showDate=0";

  function renderCalendar(){
    sheetTitle.textContent = "Kalender";
    sheetContent.innerHTML = `
      <div class="card" style="padding:14px;">
        <div class="calScale">
          <iframe class="calFrame" src="${CAL_SRC}" scrolling="no"></iframe>
        </div>
      </div>
      <div class="miniHint" style="margin-top:10px;">(iPhone Safari kan kräva cookies för Google iframe.)</div>
    `;
  }

  /* =========================
     WEATHER
  ========================= */
  let lastWeather = null;

  async function renderWeather(){
    sheetTitle.textContent = "Väder";
    sheetContent.innerHTML = `
      <div class="card weatherCard">
        <div class="weatherNow" id="wNow">Laddar…</div>
        <div class="weatherSub" id="wSub"></div>
        <div class="weatherForecast" id="wForecast"></div>
      </div>
    `;

    const lat = 59.3293, lon = 18.0686;
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,wind_speed_10m,relative_humidity_2m` +
      `&hourly=temperature_2m,precipitation_probability` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=Europe%2FStockholm`;

    try{
      const r = await fetch(url, { cache:"no-store" });
      const data = await r.json();
      lastWeather = data;

      $("wNow").innerHTML = `
        <div>${Math.round(data.current.temperature_2m)}°</div>
        <div>${Math.round(data.current.wind_speed_10m)} m/s</div>
        <div>${Math.round(data.current.relative_humidity_2m)}%</div>
      `;

      const tmax = Math.round(data.daily.temperature_2m_max?.[0] ?? 0);
      const tmin = Math.round(data.daily.temperature_2m_min?.[0] ?? 0);
      const popm = Math.round(data.daily.precipitation_probability_max?.[0] ?? 0);

      $("wSub").innerHTML = `
        <div>Idag: ${tmin}° / ${tmax}°</div>
        <div>Regn max: ${popm}%</div>
      `;

      const temps = data.hourly.temperature_2m.slice(0, 6);
      const pop = data.hourly.precipitation_probability.slice(0, 6);

      $("wForecast").innerHTML = temps.map((t, i) => `
        <div class="wxMini">
          <div class="wxMiniTop">+${i}h</div>
          <div class="wxMiniTemp">${Math.round(t)}°</div>
          <div class="wxMiniPop">${Math.round(pop[i] ?? 0)}%</div>
        </div>
      `).join("");
    }catch{
      $("wNow").textContent = "Kunde inte hämta väder.";
    }
  }

  /* =========================
     NEWS (RSS via proxies)
  ========================= */
  let lastNews = [];

  async function renderNews(){
    sheetTitle.textContent = "Nyheter";
    sheetContent.innerHTML = `
      <div class="card" style="padding:14px;">
        <div class="miniHint" id="newsStatus">Laddar…</div>
        <div id="newsList" class="newsList" style="margin-top:10px;"></div>
      </div>
    `;

    const feeds = [
      { name: "SVT Nyheter", url: "https://www.svt.se/nyheter/rss.xml" },
      { name: "Omni",        url: "https://omni.se/rss" },
    ];

    const proxies = [
      (u) => `https://r.jina.ai/http://${u.replace(/^https?:\/\//, "")}`,
      (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    ];

    async function fetchViaProxies(url){
      let lastErr = null;
      for(const p of proxies){
        try{
          const r = await fetch(p(url), { cache:"no-store" });
          if(!r.ok) throw new Error(`HTTP ${r.status}`);
          return await r.text();
        }catch(e){
          lastErr = e;
        }
      }
      throw lastErr || new Error("Proxy failed");
    }

    function parseAny(xmlText, sourceName){
      const doc = new DOMParser().parseFromString(xmlText, "text/xml");

      const rssItems = [...doc.querySelectorAll("item")];
      const atomEntries = [...doc.querySelectorAll("entry")];

      const rows = (rssItems.length ? rssItems : atomEntries).slice(0, 12).map((it) => {
        const title = (it.querySelector("title")?.textContent || "").trim();
        let link = "";

        // RSS
        const l1 = it.querySelector("link")?.textContent?.trim();
        if(l1) link = l1;

        // Atom link href
        const href = it.querySelector("link")?.getAttribute?.("href");
        if(href) link = href;

        const pd = it.querySelector("pubDate")?.textContent || it.querySelector("updated")?.textContent || "";
        const date = new Date(pd || Date.now());

        return { source: sourceName, title, link, date };
      }).filter(x => x.title && x.link);

      return rows;
    }

    const statusEl = $("newsStatus");
    const listEl = $("newsList");

    try{
      const results = await Promise.allSettled(
        feeds.map(async f => parseAny(await fetchViaProxies(f.url), f.name))
      );

      const okCount = results.filter(r => r.status === "fulfilled" && r.value.length).length;
      const merged = results
        .filter(r => r.status === "fulfilled")
        .flatMap(r => r.value)
        .sort((a,b) => b.date - a.date)
        .slice(0, 18);

      lastNews = merged;

      if(!merged.length){
        if(statusEl) statusEl.textContent = `Kan inte läsa nyheter just nu (0/${feeds.length} källor).`;
        return;
      }

      if(statusEl) statusEl.textContent = `Senaste: ${merged.length} artiklar (${okCount}/${feeds.length} källor)`;

      if(listEl){
        listEl.innerHTML = merged.map(n => `
          <a class="newsItem" href="${n.link}" target="_blank" rel="noopener">
            <div class="newsTitle">${n.title}</div>
            <div class="newsMeta">${n.source} • ${n.date.toLocaleString("sv-SE",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}</div>
          </a>
        `).join("");
      }

      renderPreview("news");
    }catch{
      if(statusEl) statusEl.textContent = "Kan inte läsa nyheter (proxy/CORS).";
    }
  }

  /* =========================
     PREVIEW renderer
  ========================= */
  function renderPreview(viewId){
    if(!previewTitle || !previewBody) return;

    const v = VIEW_DEFS.find(x => x.id === viewId) || VIEW_DEFS[0];
    previewTitle.textContent = v.label;

    if(viewId === "prio"){
      previewBody.innerHTML = `
        Aktiva prios: <b>${(store.prio || []).length}</b><br/>
        ${store.prio?.[0]?.text ? `Senast: ${store.prio[0].text}` : "Inga prios ännu"}
      `;
      return;
    }

    if(viewId === "lists"){
      const count = (store.lists || []).length;
      const top = store.lists?.[0];
      const stat = top ? listProgress(top) : "";
      previewBody.innerHTML = `
        Antal: <b>${count}</b><br/>
        ${top ? `Senast: ${top.text} ${stat ? `(${stat})` : ""}` : "Inga listor ännu"}
      `;
      return;
    }

    if(viewId === "ideas"){
      const count = (store.ideas || []).length;
      const top = store.ideas?.[0];
      previewBody.innerHTML = `
        Antal: <b>${count}</b><br/>
        ${top ? `Senast: ${top.text}` : "Inga idéer ännu"}
      `;
      return;
    }

    if(viewId === "weather"){
      if(lastWeather?.current){
        const t = Math.round(lastWeather.current.temperature_2m);
        const w = Math.round(lastWeather.current.wind_speed_10m);
        previewBody.innerHTML = `Just nu: <b>${t}°</b> • Vind: <b>${w} m/s</b><br/>Tryck för detaljer.`;
      }else{
        previewBody.innerHTML = `Tryck för att hämta väder.`;
      }
      return;
    }

    if(viewId === "news"){
      if(lastNews?.length){
        previewBody.innerHTML = `Senaste: <b>${lastNews[0].source}</b><br/>${lastNews[0].title}`;
      }else{
        previewBody.innerHTML = `Tryck för att hämta nyheter.`;
      }
      return;
    }

    if(viewId === "calendar"){
      previewBody.innerHTML = `Öppna agenda och dagens planering.`;
      return;
    }

    if(viewId === "timer"){
      previewBody.innerHTML = `Snabbstart: 1 • 5 • 10 • 15 • 30<br/>Reset om du vill nollställa.`;
      return;
    }

    previewBody.textContent = "";
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
    if(id === "timer")    return renderTimer();
  }

  /* =========================
     INIT
  ========================= */
  // preload preview with current view
  setRotation(0);
  setPreview(0);
  updateWheelTimerProgress();
  renderPreview("calendar");

  // if you want: tap outside sheet closes (optional)
  // sheetWrap?.addEventListener("click", (e)=>{ if(e.target === sheetWrap) closeSheet(); });
})();
