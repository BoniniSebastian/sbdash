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

  // Optional (om du har preview i HTML/CSS – annars ignoreras)
  const previewWrap = $("previewWrap");
  const previewTitle = $("previewTitle");
  const previewBody = $("previewBody");

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function pad2(n) { return String(n).padStart(2, "0"); }
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  /* =========================
     STORAGE
  ========================= */
  const LS_KEY = "sbdash_store_v4";

  function loadStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function defaultStore() {
    return {
      prio: [],
      lists: [],      // (tidigare TODO)
      ideas: [],
      done: [],
    };
  }

  const store = loadStore() || defaultStore();
  const saveStore = () => localStorage.setItem(LS_KEY, JSON.stringify(store));

  const fmt = (ts) =>
    new Date(ts).toLocaleString("sv-SE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  /* =========================
     TOP DATE
  ========================= */
  function updateTopDate() {
    if (!topDate) return;
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE", { weekday: "long" });
    const date = now.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
    topDate.textContent = `${weekday} ${date}`;
  }
  updateTopDate();
  setInterval(updateTopDate, 60_000);

  function updateStartPrioCount() {
    if (!startPrioCountEl) return;
    const c = Array.isArray(store.prio) ? store.prio.length : 0;
    startPrioCountEl.textContent = `Aktiva prios: ${c}`;
  }
  updateStartPrioCount();

  /* =========================
     VIEWS
  ========================= */
  const VIEW_DEFS = [
    { id: "calendar", label: "KALENDER", icon: "assets/ui/icon-calendar.svg" },
    { id: "prio",     label: "PRIOS",    icon: "assets/ui/icon-prio.svg" },
    { id: "weather",  label: "VÄDER",    icon: "assets/ui/icon-weather.svg" },
    { id: "news",     label: "NYHETER",  icon: "assets/ui/icon-news.svg" },
    { id: "lists",    label: "LISTOR",   icon: "assets/ui/icon-todo.svg" },   // TODO -> LISTOR
    { id: "ideas",    label: "IDÉER",    icon: "assets/ui/icon-ideas.svg" },
    { id: "timer",    label: "TIMER",    icon: "assets/ui/icon-pomodoro.svg" },
  ];

  let activeIndex = 0;
  const STEP = 360 / VIEW_DEFS.length;
  let rotationDeg = 0;

  function setCenterLabel(text) {
    if (!centerLabelEl) return;
    centerLabelEl.textContent = text || "";
  }

  function sectorFromDeg(deg) {
    const raw = Math.round(deg / STEP);
    return ((raw % VIEW_DEFS.length) + VIEW_DEFS.length) % VIEW_DEFS.length;
  }

  function setPreview(index) {
    activeIndex = (index + VIEW_DEFS.length) % VIEW_DEFS.length;
    const v = VIEW_DEFS[activeIndex];
    if (wheelIcon) wheelIcon.src = v.icon;
    setCenterLabel(v.label);

    // Optional preview (om du kör previewWrap)
    if (previewWrap && previewTitle && previewBody && !sheetWrap?.classList.contains("open")) {
      previewTitle.textContent = v.label;
      previewBody.innerHTML = previewSnippet(v.id);
    }
  }

  // Om sheet är öppet -> byt view LIVE när hjulet vrids
  function setRotation(deg) {
    rotationDeg = deg;
    if (wheelRing) wheelRing.style.transform = `rotate(${deg}deg)`;

    const idx = sectorFromDeg(deg);
    setPreview(idx);

    if (sheetWrap?.classList.contains("open")) {
      renderView(VIEW_DEFS[idx].id);
    }
  }

  function previewSnippet(id) {
    if (id === "calendar") return `<div class="miniHint">Kalender (Agenda)</div>`;
    if (id === "prio")     return `<div class="miniHint">${store.prio.length} aktiva prios</div>`;
    if (id === "lists")    return `<div class="miniHint">${store.lists.length} listor</div>`;
    if (id === "ideas")    return `<div class="miniHint">${store.ideas.length} idéer</div>`;
    if (id === "timer")    return `<div class="miniHint">Tryck för att starta 1/5/10/15/30</div>`;
    if (id === "news")     return `<div class="miniHint">Senaste rubriker</div>`;
    if (id === "weather")  return `<div class="miniHint">Väder just nu + prognos</div>`;
    return `<div class="miniHint">…</div>`;
  }

  /* =========================
     SHEET OPEN/CLOSE
  ========================= */
  function openSheet() {
    sheetWrap?.classList.add("open");
    document.body.classList.add("sheetOpen");
    if (centerLabelEl) centerLabelEl.style.opacity = "0";
  }

  function closeSheet() {
    sheetWrap?.classList.remove("open");
    document.body.classList.remove("sheetOpen");
    if (centerLabelEl) centerLabelEl.style.opacity = "1";
  }

  // Drag-to-close (sheet)
  let sheetDragStartY = null;

  sheet?.addEventListener("pointerdown", (e) => {
    sheetDragStartY = e.clientY;
    sheet.classList.add("dragging");
    sheet.setPointerCapture?.(e.pointerId);
  }, { passive: true });

  sheet?.addEventListener("pointermove", (e) => {
    if (sheetDragStartY == null) return;
    const delta = e.clientY - sheetDragStartY;
    if (delta > 0) {
      sheet.style.transform = `translateX(-50%) translateY(${delta}px)`;
      e.preventDefault();
    }
  }, { passive: false });

  sheet?.addEventListener("pointerup", (e) => {
    if (sheetDragStartY == null) return;
    const delta = e.clientY - sheetDragStartY;
    if (delta > 120) closeSheet();
    sheet.style.transform = "";
    sheet.classList.remove("dragging");
    sheetDragStartY = null;
  }, { passive: true });

  sheet?.addEventListener("pointercancel", () => {
    sheet.style.transform = "";
    sheet.classList.remove("dragging");
    sheetDragStartY = null;
  }, { passive: true });

  /* =========================
     WHEEL interaction
  ========================= */
  let dragging = false;
  let startAngle = 0;
  let tapStartX = 0, tapStartY = 0;
  let didDrag = false;

  function angle(cx, cy, x, y) {
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
  }, { passive: true });

  wheel?.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    const dx = e.clientX - tapStartX;
    const dy = e.clientY - tapStartY;
    if (!didDrag && Math.hypot(dx, dy) > 18) didDrag = true;

    if (didDrag) {
      const r = wheel.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const deg = angle(cx, cy, e.clientX, e.clientY) - startAngle;
      setRotation(deg);
      e.preventDefault();
    }
  }, { passive: false });

  wheel?.addEventListener("pointerup", () => {
    if (!dragging) return;
    dragging = false;

    const idx = sectorFromDeg(rotationDeg);
    setRotation(idx * STEP);

    // Tap utan drag -> öppna sheet
    if (!didDrag) {
      openSheet();
      renderView(VIEW_DEFS[activeIndex].id);
    }
  }, { passive: true });

  wheel?.addEventListener("pointercancel", () => { dragging = false; }, { passive: true });

  // Mouse wheel (desktop) -> byter view
  wheel?.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = (activeIndex + dir + VIEW_DEFS.length) % VIEW_DEFS.length;
    setRotation(next * STEP);
  }, { passive: false });

  /* =========================
     TIMER + wheel ring SVG
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

  const wheelSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wheelSvg.setAttribute("class", "wheelTimerSvg");
  wheelSvg.innerHTML = `
    <circle id="wheelTimerBg"></circle>
    <circle id="wheelTimerProg"></circle>
  `;
  wheel?.appendChild(wheelSvg);

  function updateWheelTimerProgress() {
    const bg = document.getElementById("wheelTimerBg");
    const prog = document.getElementById("wheelTimerProg");
    if (!wheel || !wheelSvg || !bg || !prog) return;

    const size = wheel.getBoundingClientRect().width;
    const r = (size / 2) - 6;
    const cx = size / 2;
    const cy = size / 2;

    wheelSvg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    bg.setAttribute("cx", cx); bg.setAttribute("cy", cy); bg.setAttribute("r", r);
    prog.setAttribute("cx", cx); prog.setAttribute("cy", cy); prog.setAttribute("r", r);

    const C = 2 * Math.PI * r;
    bg.style.strokeDasharray = String(C);
    bg.style.strokeDashoffset = "0";

    prog.style.strokeDasharray = String(C);

    // Countdown: pct går från 1 -> 0, ring ska “tömmas” med tiden
    const pct = TIMER.total ? (TIMER.left / TIMER.total) : 0;
    prog.style.strokeDashoffset = String(C * (1 - clamp01(pct)));

    if (pct > 0.40) prog.style.stroke = "rgba(0,209,255,.95)";
    else if (pct > 0.15) prog.style.stroke = "rgba(255,165,0,.95)";
    else prog.style.stroke = "rgba(255,70,70,.95)";

    // Neon-puls när timer går
    wheel.classList.toggle("timerPulse", !!TIMER.running);
  }
  window.addEventListener("resize", updateWheelTimerProgress);

  function timerText() {
    const safe = Math.max(0, TIMER.left);
    const mm = Math.floor(safe / 60);
    const ss = safe % 60;
    return `${pad2(mm)}:${pad2(ss)}`;
  }

  function setTimerMinutesAndStart(min) {
    const m = Number(min);
    if (!Number.isFinite(m) || m <= 0) return;

    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);

    TIMER.total = Math.round(m * 60);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;

    // start direkt
    TIMER.running = true;
    TIMER.t0 = performance.now();
    cancelAnimationFrame(TIMER.raf);
    TIMER.raf = requestAnimationFrame(timerLoop);

    updateWheelTimerProgress();
    renderTimerUIOnly();
  }

  function resetTimer() {
    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;
    updateWheelTimerProgress();
    renderTimerUIOnly();
  }

  function timerLoop() {
    if (!TIMER.running) return;

    const elapsed = (performance.now() - TIMER.t0) / 1000;
    TIMER.left = Math.max(0, Math.floor(TIMER.pausedLeft - elapsed));

    updateWheelTimerProgress();
    renderTimerUIOnly();

    if (TIMER.left <= 0) {
      TIMER.running = false;
      cancelAnimationFrame(TIMER.raf);
      if (canVibrate) navigator.vibrate([20, 40, 20, 80, 20]);
      updateWheelTimerProgress();
      renderTimerUIOnly();
      return;
    }
    TIMER.raf = requestAnimationFrame(timerLoop);
  }

  function renderTimerUIOnly() {
    const tTime = $("tTime");
    const tState = $("tState");
    if (tTime) tTime.textContent = timerText();

    if (tState) {
      if (!TIMER.running && TIMER.left === TIMER.total) tState.textContent = "Redo";
      else if (TIMER.running && TIMER.left > 0) tState.textContent = "Fokus…";
      else if (!TIMER.running && TIMER.left > 0) tState.textContent = "Pausad";
      else tState.textContent = "KLAR";
    }
  }

  function renderTimer() {
    sheetTitle.textContent = "Timer";
    sheetContent.innerHTML = `
      <div class="card" style="padding:16px;">
        <div style="display:flex; flex-direction:column; align-items:center; text-align:center;">
          <div id="tTime" style="font-size:52px; font-weight:900; letter-spacing:1px;">${timerText()}</div>
          <div id="tState" class="miniHint" style="margin-top:6px;">Redo</div>

          <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; justify-content:center;">
            <button class="miniBtn tQuick" data-tmin="1">1</button>
            <button class="miniBtn tQuick" data-tmin="5">5</button>
            <button class="miniBtn tQuick" data-tmin="10">10</button>
            <button class="miniBtn tQuick" data-tmin="15">15</button>
            <button class="miniBtn tQuick" data-tmin="30">30</button>
            <button class="miniBtn" id="tResetBtn" style="background: rgba(255,255,255,.06);">Reset</button>
          </div>

          <div class="miniHint" style="margin-top:10px; opacity:.7;">
            Tryck på 1/5/10/15/30 för att starta direkt
          </div>
        </div>
      </div>
    `;

    $("tResetBtn")?.addEventListener("click", resetTimer);
    sheetContent.querySelectorAll(".tQuick").forEach(btn => {
      btn.addEventListener("click", () => setTimerMinutesAndStart(btn.dataset.tmin));
    });

    updateWheelTimerProgress();
    renderTimerUIOnly();
  }

  /* =========================
     MODAL for item details + sub tasks
  ========================= */
  function openItemModal(listType, itemId) {
    const arr = store[listType];
    const item = arr.find(x => x.id === itemId);
    if (!item) return;

    // Ensure structure
    if (!Array.isArray(item.subtasks)) item.subtasks = [];
    if (typeof item.note !== "string") item.note = "";

    const wrap = document.createElement("div");
    wrap.className = "modalWrap open";
    wrap.innerHTML = `
      <div class="modalBackdrop"></div>
      <div class="modalCard">
        <div class="modalHeader">
          <div class="modalTitle"></div>
          <button class="modalClose">✕</button>
        </div>

        <div class="modalBody">
          <div class="modalMainText"></div>

          <div style="margin-top:10px;">
            <div class="miniHint" style="margin-bottom:6px;">Anteckning</div>
            <textarea class="modalTextArea" placeholder="Skriv mer…"></textarea>
          </div>

          <div style="margin-top:14px;">
            <div class="miniHint" style="margin-bottom:6px;">Checklist</div>
            <div class="miniForm" style="margin:0;">
              <input class="miniInput" id="subInput" placeholder="Lägg till punkt…" />
              <button class="miniBtn miniBtnIcon" id="subAdd">+</button>
            </div>
            <div id="subList" style="margin-top:10px; display:flex; flex-direction:column; gap:10px;"></div>
          </div>
        </div>

        <div class="modalFooter">
          <button class="miniBtn" id="saveModal">Spara</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const titleEl = wrap.querySelector(".modalTitle");
    const mainEl = wrap.querySelector(".modalMainText");
    const ta = wrap.querySelector(".modalTextArea");
    const subInput = wrap.querySelector("#subInput");
    const subAdd = wrap.querySelector("#subAdd");
    const subList = wrap.querySelector("#subList");

    titleEl.textContent = "Detaljer";
    mainEl.textContent = item.text;
    ta.value = item.note || "";

    const close = () => wrap.remove();
    wrap.querySelector(".modalBackdrop").onclick = close;
    wrap.querySelector(".modalClose").onclick = close;

    function renderSubtasks() {
      // Sort: undone first, done last
      const undone = item.subtasks.filter(s => !s.done);
      const done = item.subtasks.filter(s => s.done);
      const ordered = [...undone, ...done];

      subList.innerHTML = "";
      ordered.forEach(st => {
        const row = document.createElement("label");
        row.className = "checkRow";
        row.style.border = "1px solid rgba(255,255,255,.10)";
        row.style.background = "rgba(255,255,255,.03)";
        row.style.borderRadius = "14px";
        row.style.padding = "12px 12px";

        row.innerHTML = `
          <input type="checkbox" class="checkBox" ${st.done ? "checked" : ""} />
          <div class="checkMid">
            <div class="checkText" style="${st.done ? "text-decoration:line-through; opacity:.65;" : ""}"></div>
          </div>
          <div class="checkRight">
            <div class="miniMeta">${st.done ? "klar" : ""}</div>
          </div>
        `;
        row.querySelector(".checkText").textContent = st.text;

        const cb = row.querySelector(".checkBox");
        cb.addEventListener("change", () => {
          st.done = !!cb.checked;
          saveStore();
          renderSubtasks();
          // uppdatera progress i listan direkt om sheet är öppen
          if (sheetWrap?.classList.contains("open")) renderView(VIEW_DEFS[activeIndex].id);
        });

        subList.appendChild(row);
      });
    }

    subAdd.addEventListener("click", () => {
      const t = (subInput.value || "").trim();
      if (!t) return;
      item.subtasks.unshift({ id: uid(), text: t, done: false });
      subInput.value = "";
      saveStore();
      renderSubtasks();
      if (sheetWrap?.classList.contains("open")) renderView(VIEW_DEFS[activeIndex].id);
    });

    subInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") subAdd.click();
    });

    wrap.querySelector("#saveModal").onclick = () => {
      item.note = ta.value || "";
      saveStore();
      close();
    };

    renderSubtasks();
    setTimeout(() => ta.focus(), 60);
  }

  /* =========================
     HEADER "Visa slutförda"
  ========================= */
  function setSheetTitleWithDone(label) {
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
     LIST ITEM ROW (checkbox completes, row opens modal)
  ========================= */
  function progressText(item) {
    const subs = Array.isArray(item.subtasks) ? item.subtasks : [];
    if (!subs.length) return "";
    const done = subs.filter(s => s.done).length;
    return `${done}/${subs.length}`;
  }

  function mkListRow({ text, meta, progress }, onComplete, onOpen) {
    const li = document.createElement("li");
    li.className = "checkItem";

    const row = document.createElement("div");
    row.className = "checkRow";
    row.style.userSelect = "none";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "checkBox";
    cb.setAttribute("aria-label", "Slutför");

    const mid = document.createElement("div");
    mid.className = "checkMid";

    const t = document.createElement("div");
    t.className = "checkText";
    t.textContent = text;

    mid.appendChild(t);

    const right = document.createElement("div");
    right.className = "checkRight";

    const p = document.createElement("div");
    p.className = "miniMeta";
    p.textContent = progress || "";

    const m = document.createElement("div");
    m.className = "miniMeta";
    m.textContent = meta || "";

    right.appendChild(p);
    right.appendChild(m);

    row.appendChild(cb);
    row.appendChild(mid);
    row.appendChild(right);
    li.appendChild(row);

    // ✅ Only checkbox completes
    cb.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    cb.addEventListener("change", () => {
      if (!cb.checked) return;
      cb.disabled = true;
      li.classList.add("isCompleting");
      setTimeout(() => onComplete?.(), 190);
    });

    // ✅ Row opens modal (not completing)
    row.addEventListener("click", (e) => {
      if (e.target === cb) return;
      onOpen?.();
    });

    return li;
  }

  function renderList(type, label, allowModal) {
    setSheetTitleWithDone(label);

    const placeholder =
      type === "lists" ? "Ny lista..." :
      type === "prio"  ? "Ny prio..." :
      type === "ideas" ? "Ny idé..."  :
      "Skriv...";

    sheetContent.innerHTML = `
      <div class="miniForm">
        <input id="input" class="miniInput" placeholder="${placeholder}" />
        <button id="add" class="miniBtn miniBtnIcon">+</button>
      </div>
      <ul id="list" class="miniList"></ul>
    `;

    const input = $("input");
    const addBtn = $("add");
    const listEl = $("list");

    const add = () => {
      const t = (input.value || "").trim();
      if (!t) return;

      store[type].unshift({
        id: uid(),
        text: t,
        createdAt: Date.now(),
        note: "",
        subtasks: [],   // ✅ checklist i modal
      });

      saveStore();
      input.value = "";
      updateStartPrioCount();
      draw();
    };

    addBtn.addEventListener("click", add);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });

    function complete(id) {
      const i = store[type].findIndex(x => x.id === id);
      if (i === -1) return;

      const item = store[type].splice(i, 1)[0];
      store.done.unshift({ ...item, origin: type, doneAt: Date.now() });
      saveStore();
      updateStartPrioCount();
      draw();
    }

    function draw() {
      listEl.innerHTML = "";

      store[type].forEach(item => {
        listEl.appendChild(
          mkListRow(
            { text: item.text, meta: fmt(item.createdAt), progress: progressText(item) },
            () => complete(item.id),
            allowModal ? () => openItemModal(type, item.id) : null
          )
        );
      });
    }

    draw();
  }

  function renderDone() {
    sheetTitle.textContent = "Slutförda";
    sheetContent.innerHTML = `<ul id="doneList" class="miniList"></ul>`;
    const list = $("doneList");

    store.done.forEach((item) => {
      const li = document.createElement("li");
      li.className = "checkItem";
      li.innerHTML = `
        <div class="checkRow" style="cursor:default;">
          <div class="checkMid">
            <div class="checkText" style="text-decoration:line-through; opacity:.75;"></div>
          </div>
          <div class="checkRight">
            <div class="miniMeta"></div>
          </div>
        </div>
      `;
      li.querySelector(".checkText").textContent = item.text;
      li.querySelector(".miniMeta").textContent = fmt(item.doneAt);
      list.appendChild(li);
    });
  }

  /* =========================
     CALENDAR
  ========================= */
  const CAL_SRC =
    "https://calendar.google.com/calendar/embed?src=ZXJpY3Nzb25ib25pbmlAZ21haWwuY29t&mode=AGENDA&ctz=Europe%2FStockholm&hl=sv&bgcolor=%230b1118&showTitle=0&showTabs=0&showNav=0&showPrint=0&showCalendars=0&showDate=0";

  function renderCalendar() {
    sheetTitle.textContent = "Kalender";
    sheetContent.innerHTML = `
      <div class="card" style="padding:14px;">
        <div class="calScale">
          <iframe class="calFrame" src="${CAL_SRC}" frameborder="0" scrolling="no"></iframe>
        </div>
      </div>
      <div class="miniHint" style="margin-top:10px;">(iPhone Safari kan kräva cookies för Google iframe.)</div>
    `;
  }

  /* =========================
     WEATHER
  ========================= */
  async function renderWeather() {
    sheetTitle.textContent = "Väder";
    sheetContent.innerHTML = `
      <div class="card weatherCard">
        <div class="weatherNow" id="wNow">Laddar…</div>
        <div class="weatherForecast" id="wForecast"></div>
      </div>

      <div class="miniHint" style="margin-top:10px; opacity:.7;">
        Prognos: temperatur + nederbördsrisk (nästa 6h)
      </div>
    `;

    // Stockholm default (du kan ändra)
    const lat = 59.3293, lon = 18.0686;
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,wind_speed_10m,relative_humidity_2m` +
      `&hourly=temperature_2m,precipitation_probability` +
      `&timezone=Europe%2FStockholm`;

    try {
      const r = await fetch(url, { cache: "no-store" });
      const data = await r.json();

      const nowEl = $("wNow");
      if (nowEl) {
        nowEl.innerHTML = `
          <div>${Math.round(data.current.temperature_2m)}°</div>
          <div>${Math.round(data.current.wind_speed_10m)} m/s</div>
          <div>${Math.round(data.current.relative_humidity_2m)}%</div>
        `;
      }

      const temps = data.hourly.temperature_2m.slice(0, 6);
      const pop = data.hourly.precipitation_probability.slice(0, 6);

      const fc = $("wForecast");
      if (fc) {
        fc.innerHTML = temps.map((t, i) => `
          <div class="wxMini">
            <div class="wxMiniTop">+${i}h</div>
            <div class="wxMiniTemp">${Math.round(t)}°</div>
            <div class="wxMiniPop">${Math.round(pop[i] ?? 0)}%</div>
          </div>
        `).join("");
      }
    } catch {
      const nowEl = $("wNow");
      if (nowEl) nowEl.textContent = "Kunde inte hämta väder.";
    }
  }

  /* =========================
     NEWS (RSS via proxies)
  ========================= */
  async function renderNews() {
    sheetTitle.textContent = "Nyheter";
    sheetContent.innerHTML = `
      <div class="card" style="padding:14px;">
        <div class="miniHint" id="newsStatus">Laddar…</div>
        <div id="newsList" class="newsList" style="margin-top:10px;"></div>
      </div>
      <div class="miniHint" style="margin-top:10px; opacity:.7;">
        Om det står “proxy/CORS” är det externa RSS-proxies som strular (inte din kod).
      </div>
    `;

    const feeds = [
      { name: "SVT Nyheter", url: "https://www.svt.se/nyheter/rss.xml" },
      { name: "Omni",       url: "https://omni.se/rss" },
    ];

    const proxies = [
      // ofta stabil
      (u) => `https://r.jina.ai/http://${u.replace(/^https?:\/\//, "")}`,
      // fallback
      (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    ];

    async function fetchViaProxies(url) {
      let lastErr = null;
      for (const p of proxies) {
        try {
          const r = await fetch(p(url), { cache: "no-store" });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return await r.text();
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr || new Error("Proxy failed");
    }

    function parseRss(xmlText, sourceName) {
      const doc = new DOMParser().parseFromString(xmlText, "text/xml");
      const items = [...doc.querySelectorAll("item")].slice(0, 12);
      return items.map((it) => ({
        source: sourceName,
        title: (it.querySelector("title")?.textContent || "").trim(),
        link:  (it.querySelector("link")?.textContent || "").trim(),
        date:  new Date(it.querySelector("pubDate")?.textContent || Date.now()),
      })).filter(x => x.title && x.link);
    }

    const statusEl = $("newsStatus");
    const listEl = $("newsList");

    try {
      const results = await Promise.allSettled(
        feeds.map(async f => {
          const txt = await fetchViaProxies(f.url);
          return parseRss(txt, f.name);
        })
      );

      const okCount = results.filter(r => r.status === "fulfilled" && r.value.length).length;
      const merged = results
        .filter(r => r.status === "fulfilled")
        .flatMap(r => r.value)
        .sort((a, b) => b.date - a.date)
        .slice(0, 18);

      if (!merged.length) {
        if (statusEl) statusEl.textContent = `Kan inte läsa nyheter just nu (0/${feeds.length} källor).`;
        return;
      }

      if (statusEl) statusEl.textContent = `Senaste: ${merged.length} artiklar (${okCount}/${feeds.length} källor)`;

      if (listEl) {
        listEl.innerHTML = merged.map(n => `
          <a class="newsItem" href="${n.link}" target="_blank" rel="noopener">
            <div class="newsTitle">${n.title}</div>
            <div class="newsMeta">${n.source} • ${n.date.toLocaleString("sv-SE",{ hour:"2-digit", minute:"2-digit", day:"2-digit", month:"2-digit" })}</div>
          </a>
        `).join("");
      }
    } catch {
      if (statusEl) statusEl.textContent = "Kan inte läsa nyheter (proxy/CORS).";
    }
  }

  /* =========================
     VIEW SWITCH
  ========================= */
  function renderView(id) {
    if (id === "calendar") return renderCalendar();
    if (id === "prio")     return renderList("prio",  "Aktiv prio", true);
    if (id === "weather")  return renderWeather();
    if (id === "news")     return renderNews();
    if (id === "lists")    return renderList("lists", "Listor", true);
    if (id === "ideas")    return renderList("ideas", "Idéer", true);
    if (id === "timer")    return renderTimer();
  }

  /* =========================
     INIT
  ========================= */
  setRotation(0);
  updateWheelTimerProgress();

  // Startläge: om du vill att sheet ska vara stängd och bara öppnas på tap -> inget mer.
  // (Vill du testa auto-open: openSheet(); renderView(VIEW_DEFS[0].id); )
})();
