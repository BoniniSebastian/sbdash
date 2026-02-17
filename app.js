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
  const topRight = document.querySelector(".topRight");

  const startPrioCountEl = $("startPrioCount");
  const centerLabelEl = $("centerLabel");

  if (topRight) topRight.textContent = "";

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function pad2(n) { return String(n).padStart(2, "0"); }

  /* =========================
     STORAGE
  ========================= */
  const LS_KEY = "sbdash_store_v3";

  function loadStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : { prio: [], todo: [], ideas: [], done: [] };
    } catch {
      return { prio: [], todo: [], ideas: [], done: [] };
    }
  }

  const store = loadStore();
  const saveStore = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  const fmt = (ts) =>
    new Date(ts).toLocaleString("sv-SE", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
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

  /* =========================
     START PRIO COUNT
  ========================= */
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
    { id: "calendar", label: "KALENDER",   icon: "assets/ui/icon-calendar.svg" },
    { id: "prio",     label: "AKTIV PRIO", icon: "assets/ui/icon-prio.svg" },
    { id: "weather",  label: "VÄDER",      icon: "assets/ui/icon-weather.svg" },
    { id: "news",     label: "NYHETER",    icon: "assets/ui/icon-news.svg" },
    { id: "todo",     label: "TODO",       icon: "assets/ui/icon-todo.svg" },
    { id: "ideas",    label: "IDÉER",      icon: "assets/ui/icon-ideas.svg" },
    { id: "timer",    label: "TIMER",      icon: "assets/ui/icon-pomodoro.svg" },
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
  }

  function setRotation(deg) {
    rotationDeg = deg;
    if (wheelRing) wheelRing.style.transform = `rotate(${deg}deg)`;
    setPreview(sectorFromDeg(deg));
  }

  /* =========================
     SHEET OPEN/CLOSE
     (Premium wheel toggle via body.sheetOpen)
  ========================= */
  function openSheet() {
    sheetWrap?.classList.add("open");
    document.body.classList.add("sheetOpen");   // ✅ premium wheel
    if (centerLabelEl) centerLabelEl.style.opacity = "0";
  }

  function closeSheet() {
    sheetWrap?.classList.remove("open");
    document.body.classList.remove("sheetOpen"); // ✅ premium wheel
    if (centerLabelEl) centerLabelEl.style.opacity = "1";
  }

  /* =========================
     SHEET drag-to-close
  ========================= */
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
      e.preventDefault?.();
    }
  }, { passive: false });

  sheet?.addEventListener("pointerup", () => {
    if (sheetDragStartY == null) return;
    const delta = event.clientY - sheetDragStartY;
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

    if (!didDrag) {
      openSheet();
      renderView(VIEW_DEFS[activeIndex].id);
    }
  }, { passive: true });

  wheel?.addEventListener("pointercancel", () => { dragging = false; }, { passive: true });

  wheel?.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = (activeIndex + dir + VIEW_DEFS.length) % VIEW_DEFS.length;
    setRotation(next * STEP);
  }, { passive: false });

  wheel?.addEventListener("click", () => {
    openSheet();
    renderView(VIEW_DEFS[activeIndex].id);
  });

  /* =========================
     TIMER + wheel ring SVG
  ========================= */
  const TIMER = {
    total: 5 * 60,
    left: 5 * 60,
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
    const r = (size / 2) - 5;
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
    prog.style.strokeDashoffset = String(C * (1 - clamp01(pct)));

    if (pct > 0.40) prog.style.stroke = "rgba(0,209,255,.90)";
    else if (pct > 0.15) prog.style.stroke = "rgba(255,165,0,.90)";
    else prog.style.stroke = "rgba(255,70,70,.90)";
  }
  window.addEventListener("resize", updateWheelTimerProgress);

  function timerText() {
    const safe = Math.max(0, TIMER.left);
    const mm = Math.floor(safe / 60);
    const ss = safe % 60;
    return `${pad2(mm)}:${pad2(ss)}`;
  }

  function setTimerMinutes(min) {
    const m = Number(min);
    if (!Number.isFinite(m) || m <= 0) return;

    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);
    TIMER.total = Math.round(m * 60);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;
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

  function startPauseTimer() {
    if (TIMER.running) {
      TIMER.running = false;
      TIMER.pausedLeft = TIMER.left;
      cancelAnimationFrame(TIMER.raf);
      renderTimerUIOnly();
      return;
    }

    if (TIMER.left <= 0) {
      TIMER.left = TIMER.total;
      TIMER.pausedLeft = TIMER.left;
    }

    TIMER.running = true;
    TIMER.t0 = performance.now();
    cancelAnimationFrame(TIMER.raf);
    TIMER.raf = requestAnimationFrame(timerLoop);
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
      if (canVibrate) navigator.vibrate([20, 40, 20]);
      updateWheelTimerProgress();
      renderTimerUIOnly();
      return;
    }
    TIMER.raf = requestAnimationFrame(timerLoop);
  }

  function renderTimerUIOnly() {
    const tTime = $("tTime");
    const tState = $("tState");
    const tStartBtn = $("tStartBtn");

    if (tTime) tTime.textContent = timerText();
    if (tStartBtn) tStartBtn.textContent = TIMER.running ? "Paus" : "Start";

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
          <div id="tTime" style="font-size:46px; font-weight:900;">${timerText()}</div>
          <div id="tState" class="miniHint" style="margin-top:6px;">Redo</div>

          <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; justify-content:center;">
            <button class="miniBtn" id="tStartBtn">${TIMER.running ? "Paus" : "Start"}</button>
            <button class="miniBtn" id="tResetBtn" style="background: rgba(255,255,255,.06);">Reset</button>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:12px;">
            <button class="miniBtn" data-tmin="1"  style="background: rgba(255,255,255,.06);">1</button>
            <button class="miniBtn" data-tmin="5"  style="background: rgba(255,255,255,.06);">5</button>
            <button class="miniBtn" data-tmin="10" style="background: rgba(255,255,255,.06);">10</button>
            <button class="miniBtn" data-tmin="15" style="background: rgba(255,255,255,.06);">15</button>
            <button class="miniBtn" data-tmin="30" style="background: rgba(255,255,255,.06);">30</button>
          </div>
        </div>
      </div>
    `;

    $("tStartBtn")?.addEventListener("click", startPauseTimer);
    $("tResetBtn")?.addEventListener("click", resetTimer);
    sheetContent.querySelectorAll("[data-tmin]").forEach(btn => {
      btn.addEventListener("click", () => setTimerMinutes(btn.dataset.tmin));
    });

    updateWheelTimerProgress();
    renderTimerUIOnly();
  }

  /* =========================
     MODAL (prio notes)
  ========================= */
  function openModal(item) {
    const wrap = document.createElement("div");
    wrap.className = "modalWrap open";
    wrap.innerHTML = `
      <div class="modalBackdrop"></div>
      <div class="modalCard">
        <div class="modalHeader">
          <div class="modalTitle">Anteckning</div>
          <button class="modalClose">✕</button>
        </div>
        <div class="modalBody">
          <div class="modalMainText"></div>
          <textarea class="modalTextArea" placeholder="Skriv mer…"></textarea>
        </div>
        <div class="modalFooter">
          <button class="miniBtn">Spara</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    wrap.querySelector(".modalMainText").textContent = item.text;
    const ta = wrap.querySelector(".modalTextArea");
    ta.value = item.note || "";
    setTimeout(() => ta.focus(), 60);

    const close = () => wrap.remove();
    wrap.querySelector(".modalBackdrop").onclick = close;
    wrap.querySelector(".modalClose").onclick = close;

    wrap.querySelector(".miniBtn").onclick = () => {
      item.note = ta.value || "";
      saveStore();
      close();
    };
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
     CHECKBOX ROW ITEM (fade-out)
  ========================= */
  function mkCheckItem({ text, meta }, onComplete, onClick) {
    const li = document.createElement("li");
    li.className = "checkItem";

    const row = document.createElement("label");
    row.className = "checkRow";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "checkBox";

    const mid = document.createElement("div");
    mid.className = "checkMid";

    const t = document.createElement("div");
    t.className = "checkText";
    t.textContent = text;

    mid.appendChild(t);

    const right = document.createElement("div");
    right.className = "checkRight";

    const m = document.createElement("div");
    m.className = "miniMeta";
    m.textContent = meta || "";

    right.appendChild(m);

    row.appendChild(cb);
    row.appendChild(mid);
    row.appendChild(right);

    li.appendChild(row);

    cb.addEventListener("change", () => {
      if (!cb.checked) return;
      cb.disabled = true;
      li.classList.add("isCompleting");
      setTimeout(() => onComplete?.(), 190);
    });

    if (onClick) {
      row.addEventListener("click", (e) => {
        if (e.target === cb) return;
        onClick();
      });
    }

    return li;
  }

  /* =========================
     LISTS + ENTER
  ========================= */
  function renderList(type, label, allowModal) {
    setSheetTitleWithDone(label);

    sheetContent.innerHTML = `
      <div class="miniForm">
        <input id="input" class="miniInput" placeholder="Skriv..." />
        <button id="add" class="miniBtn miniBtnIcon">+</button>
      </div>
      <ul id="list" class="miniList"></ul>
    `;

    const input = $("input");
    const addBtn = $("add");
    const list = $("list");

    const add = () => {
      const t = (input.value || "").trim();
      if (!t) return;

      store[type].unshift({ id: uid(), text: t, createdAt: Date.now() });
      saveStore();
      input.value = "";
      updateStartPrioCount();
      draw();
    };

    addBtn.addEventListener("click", add);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });

    function complete(id) {
      const i = store[type].findIndex((x) => x.id === id);
      if (i === -1) return;

      const item = store[type].splice(i, 1)[0];
      store.done.unshift({ ...item, origin: type, doneAt: Date.now() });
      saveStore();
      updateStartPrioCount();
      draw();
    }

    function draw() {
      list.innerHTML = "";
      store[type].forEach((item) => {
        list.appendChild(
          mkCheckItem(
            { text: item.text, meta: fmt(item.createdAt) },
            () => complete(item.id),
            allowModal ? () => openModal(item) : null
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
      li.className = "itemRow";
      li.innerHTML = `
        <div class="itemText"></div>
        <div class="itemMeta"></div>
      `;
      li.querySelector(".itemText").textContent = item.text;
      li.querySelector(".itemMeta").textContent = fmt(item.doneAt);
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
      <div class="card">
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
    `;

    const lat = 59.3293, lon = 18.0686;
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,wind_speed_10m,relative_humidity_2m` +
      `&hourly=temperature_2m,precipitation_probability` +
      `&timezone=Europe%2FStockholm`;

    const r = await fetch(url, { cache: "no-store" });
    const data = await r.json();

    $("wNow").innerHTML = `
      <div>${Math.round(data.current.temperature_2m)}°</div>
      <div>${Math.round(data.current.wind_speed_10m)} m/s</div>
      <div>${Math.round(data.current.relative_humidity_2m)}%</div>
    `;

    const temps = data.hourly.temperature_2m.slice(0, 6);
    const pop = data.hourly.precipitation_probability.slice(0, 6);

    $("wForecast").innerHTML = temps.map((t, i) => `
      <div class="wxMini">
        <div class="wxMiniTop">+${i}h</div>
        <div class="wxMiniTemp">${Math.round(t)}°</div>
        <div class="wxMiniPop">${pop[i]}%</div>
      </div>
    `).join("");
  }

  function renderNews() {
    sheetTitle.textContent = "Nyheter";
    sheetContent.innerHTML = `<div class="miniHint">Kommer snart.</div>`;
  }

  /* =========================
     VIEW SWITCH
  ========================= */
  function renderView(id) {
    if (id === "calendar") return renderCalendar();
    if (id === "prio")     return renderList("prio", "Aktiv prio", true);
    if (id === "weather")  return renderWeather();
    if (id === "news")     return renderNews();
    if (id === "todo")     return renderList("todo", "TODO", false);
    if (id === "ideas")    return renderList("ideas", "Idéer", false);
    if (id === "timer")    return renderTimer();
  }

  /* =========================
     INIT
  ========================= */
  setRotation(0);
  setPreview(0);
  updateWheelTimerProgress();
})();
