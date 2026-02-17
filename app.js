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

  // Start overlay (only prio count now)
  const startPrioCountEl = $("startPrioCount");
  const centerLabelEl = $("centerLabel");

  if (topRight) topRight.textContent = "";

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
    new Date(ts).toLocaleString("sv-SE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  /* =========================
     TOP DATE (keep)
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
     START PRIO COUNT (centered under topbar)
  ========================= */
  function updateStartPrioCount() {
    if (!startPrioCountEl) return;
    const c = Array.isArray(store.prio) ? store.prio.length : 0;
    startPrioCountEl.textContent = `Aktiva prios: ${c}`;
  }
  updateStartPrioCount();

  /* =========================
     VIEWS (DONE removed from wheel)
  ========================= */
  const VIEW_DEFS = [
    { id: "calendar", label: "KALENDER", icon: "assets/ui/icon-calendar.svg" },
    { id: "prio",     label: "AKTIV PRIO", icon: "assets/ui/icon-prio.svg" },
    { id: "weather",  label: "VÄDER", icon: "assets/ui/icon-weather.svg" },
    { id: "news",     label: "NYHETER", icon: "assets/ui/icon-news.svg" },
    { id: "todo",     label: "ATT GÖRA", icon: "assets/ui/icon-todo.svg" },
    { id: "ideas",    label: "IDÉER", icon: "assets/ui/icon-ideas.svg" },
    { id: "timer",    label: "TIMER", icon: "assets/ui/icon-pomodoro.svg" },
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
    const idx = ((raw % VIEW_DEFS.length) + VIEW_DEFS.length) % VIEW_DEFS.length;
    return idx;
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
     SHEET OPEN/CLOSE + swipe-to-close restore
  ========================= */
  function openSheet() {
    sheetWrap?.classList.add("open");
  }
  function closeSheet() {
    sheetWrap?.classList.remove("open");
    // show center label always in start view
    if (centerLabelEl) centerLabelEl.style.opacity = "1";
  }

  // Drag down to close (restored)
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

  wheel?.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;

    const idx = sectorFromDeg(rotationDeg);
    setRotation(idx * STEP);

    // tap => open sheet
    if (!didDrag) {
      openSheet();
      renderView(VIEW_DEFS[activeIndex].id);
      if (centerLabelEl) centerLabelEl.style.opacity = "0";
    }
  }, { passive: true });

  wheel?.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = (activeIndex + dir + VIEW_DEFS.length) % VIEW_DEFS.length;
    setRotation(next * STEP);
  }, { passive: false });

  // Click fallback
  wheel?.addEventListener("click", () => {
    openSheet();
    renderView(VIEW_DEFS[activeIndex].id);
    if (centerLabelEl) centerLabelEl.style.opacity = "0";
  });

  /* =========================
     SWIPE (you said it works now)
  ========================= */
  function attachSwipe(li, onComplete) {
    const content = li.querySelector(".swipeContent");
    if (!content) return;

    let startX = 0;
    let curX = 0;
    let dragging = false;

    content.addEventListener("pointerdown", (e) => {
      startX = e.clientX;
      curX = 0;
      dragging = true;
      content.style.transition = "none";
      content.setPointerCapture?.(e.pointerId);
    }, { passive: true });

    content.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (dx < 0) {
        curX = dx;
        content.style.transform = `translateX(${dx}px)`;
      }
    }, { passive: true });

    content.addEventListener("pointerup", () => {
      dragging = false;
      const need = Math.max(90, li.clientWidth * 0.35);

      content.style.transition = "transform 180ms ease";
      if (Math.abs(curX) >= need) {
        content.style.transform = "translateX(-120%)";
        setTimeout(() => onComplete?.(), 140);
      } else {
        content.style.transform = "translateX(0)";
      }
      curX = 0;
    }, { passive: true });

    content.addEventListener("pointercancel", () => {
      dragging = false;
      content.style.transition = "transform 180ms ease";
      content.style.transform = "translateX(0)";
      curX = 0;
    }, { passive: true });
  }

  function mkSwipeItem({ text, meta }, onComplete, onClick) {
    const li = document.createElement("li");
    li.className = "swipeItem";

    const content = document.createElement("div");
    content.className = "swipeContent";

    content.innerHTML = `
      <div class="swipeLeft"><div class="swipeText"></div></div>
      <div class="swipeRight"><div class="miniMeta"></div></div>
    `;
    content.querySelector(".swipeText").textContent = text;
    content.querySelector(".miniMeta").textContent = meta || "";

    li.appendChild(content);
    attachSwipe(li, onComplete);

    if (onClick) content.addEventListener("click", onClick);
    return li;
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
     LISTS + ENTER to add (restored)
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
      const obj = { id: uid(), text: t, createdAt: Date.now() };
      store[type].unshift(obj);
      saveStore();
      input.value = "";
      updateStartPrioCount();
      draw();
    };

    addBtn.addEventListener("click", add);

    // ✅ ENTER to add
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") add();
    });

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
          mkSwipeItem(
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
     CALENDAR (FIX: real embed URL restored)
     (your earlier working CAL_SRC style)
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
     WEATHER (keep your compact + more data version later)
     For now: basic but reliable
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

    const nowHtml = `
      <div>${Math.round(data.current.temperature_2m)}°</div>
      <div>${Math.round(data.current.wind_speed_10m)} m/s</div>
      <div>${Math.round(data.current.relative_humidity_2m)}%</div>
    `;
    $("wNow").innerHTML = nowHtml;

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

  /* =========================
     TIMER (RESTORED, no "kommer snart")
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

  function timerText() {
    const safe = Math.max(0, TIMER.left);
    const mm = Math.floor(safe / 60);
    const ss = safe % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  function setTimerMinutes(min) {
    const m = Number(min);
    if (!Number.isFinite(m) || m <= 0) return;
    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);
    TIMER.total = Math.round(m * 60);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;
    renderTimerUIOnly();
  }

  function resetTimer() {
    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;
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

    renderTimerUIOnly(true);

    if (TIMER.left <= 0) {
      TIMER.running = false;
      cancelAnimationFrame(TIMER.raf);
      if (canVibrate) navigator.vibrate([20, 40, 20]);
      renderTimerUIOnly();
      return;
    }
    TIMER.raf = requestAnimationFrame(timerLoop);
  }

  function renderTimerUIOnly(fromLoop = false) {
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
  }

  /* =========================
     VIEW SWITCH
  ========================= */
  function renderView(id) {
    if (id === "prio") return renderList("prio", "Aktiv prio", true);
    if (id === "todo") return renderList("todo", "Att göra", false);
    if (id === "ideas") return renderList("ideas", "Idéer", false);
    if (id === "calendar") return renderCalendar();
    if (id === "weather") return renderWeather();
    if (id === "news") {
      sheetTitle.textContent = "Nyheter";
      sheetContent.innerHTML = `<div class="miniHint">Kommer snart.</div>`;
      return;
    }
    if (id === "timer") return renderTimer();
  }

  /* =========================
     INIT
  ========================= */
  setRotation(0);
  setPreview(0);
  // Ensure center label is visible in start view
  if (centerLabelEl) centerLabelEl.style.opacity = "1";
})();
