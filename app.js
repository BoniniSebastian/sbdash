Här är hela app.js igen (komplett fil). Ersätt allt i din nuvarande app.js med detta:

/* =========================
   SB Dash – app.js (FULL)
   - Wheel navigation + full-height sheet (behind wheel)
   - Preview card (start) + big frosted icon under preview
   - Live wheel sync while rotating (sheet follows wheel instantly)
   - News (Google News RSS) via cache-first + background refresh + proxy fallback
   - Weather (Open-Meteo) richer card
   - Done with restore-to-origin
   - Timer with fullscreen Siri-like pulse + alarm at end
   - Stocks page placeholder (for TradingView widget later)
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
  const topPrioCount = $("topPrioCount");

  const previewTitle = $("previewTitle");
  const previewBody = $("previewBody");
  const startIcon = $("startIcon");

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function pad2(n) { return String(n).padStart(2, "0"); }

  /* =========================
     STORAGE
  ========================= */
  const LS_KEY = "sbdash_store_v5";
  const NEWS_CACHE_KEY = "sbdash_news_cache_v2";

  function loadStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const d = raw ? JSON.parse(raw) : null;
      return {
        prio: Array.isArray(d?.prio) ? d.prio : [],
        lists: Array.isArray(d?.lists) ? d.lists : [],
        ideas: Array.isArray(d?.ideas) ? d.ideas : [],
        done: Array.isArray(d?.done) ? d.done : [],
      };
    } catch {
      return { prio: [], lists: [], ideas: [], done: [] };
    }
  }
  const store = loadStore();
  const saveStore = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  const fmt = (ts) =>
    new Date(ts).toLocaleString("sv-SE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  function updateTopDate() {
    if (!topDate) return;
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE", { weekday: "long" });
    const date = now.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
    topDate.textContent = `${weekday} ${date}`;
  }
  updateTopDate();
  setInterval(updateTopDate, 60_000);

  function updatePrioCount() {
    const c = store.prio.length;
    if (topPrioCount) topPrioCount.textContent = String(c);
  }
  updatePrioCount();

  /* =========================
     VIEWS
  ========================= */
  const VIEW_DEFS = [
    { id: "calendar", label: "KALENDER", icon: "assets/ui/icon-calendar.svg" },
    { id: "prio",     label: "PRIOS",    icon: "assets/ui/icon-prio.svg" },
    { id: "weather",  label: "VÄDER",    icon: "assets/ui/icon-weather.svg" },
    { id: "news",     label: "NYHETER",  icon: "assets/ui/icon-news.svg" },
    { id: "lists",    label: "LISTOR",   icon: "assets/ui/icon-todo.svg" },
    { id: "ideas",    label: "IDÉER",    icon: "assets/ui/icon-ideas.svg" },
    { id: "done",     label: "SLUTFÖRDA",icon: "assets/ui/icon-done.svg" },
    { id: "stocks",   label: "AKTIER",   icon: "assets/ui/icon-stocks.svg" },
    { id: "timer",    label: "TIMER",    icon: "assets/ui/icon-pomodoro.svg" },
  ];

  let activeIndex = 0;
  const STEP = 360 / VIEW_DEFS.length;
  let rotationDeg = 0;

  function sectorFromDeg(deg) {
    const raw = Math.round(deg / STEP);
    return ((raw % VIEW_DEFS.length) + VIEW_DEFS.length) % VIEW_DEFS.length;
  }

  function setWheelCenterText(text) {
    if (wheelCenterText) wheelCenterText.textContent = text || "—";
  }

  function setStartIcon(src) {
    if (startIcon && src) startIcon.src = src;
  }

  /* =========================
     PREVIEW (start)
  ========================= */
  let lastNews = [];
  let lastWeather = null;

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function wxText(code) {
    const m = {
      0: "Klart",
      1: "Mestadels klart",
      2: "Delvis molnigt",
      3: "Mulet",
      45: "Dimma",
      48: "Isdimma",
      51: "Duggregn",
      53: "Duggregn",
      55: "Duggregn (kraftigt)",
      61: "Regn (lätt)",
      63: "Regn",
      65: "Regn (kraftigt)",
      71: "Snö (lätt)",
      73: "Snö",
      75: "Snö (kraftigt)",
      80: "Skurar (lätta)",
      81: "Skurar",
      82: "Skurar (kraftiga)",
      95: "Åska",
      96: "Åska + hagel",
      99: "Åska + hagel",
    };
    return m[code] || `Väderkod ${code}`;
  }

  function timerText() {
    const safe = Math.max(0, TIMER.left);
    const mm = Math.floor(safe / 60);
    const ss = safe % 60;
    return `${pad2(mm)}:${pad2(ss)}`;
  }

  function previewHtmlFor(id) {
    if (id === "calendar") {
      return `<div class="miniHint">Tryck på hjulet för att öppna kalendern.</div>`;
    }

    if (id === "news") {
      if (lastNews?.length) {
        const top3 = lastNews
          .slice(0, 3)
          .map(n => `<div style="margin-top:8px; font-weight:900; line-height:1.15;">• ${escapeHtml(n.title)}</div>`)
          .join("");
        return top3 + `<div class="miniHint" style="margin-top:10px;">Tryck för fler</div>`;
      }
      return `<div class="miniHint">Laddar nyheter…</div>`;
    }

    if (id === "weather") {
      if (lastWeather?.current) {
        const t = Math.round(lastWeather.current.temperature_2m);
        const w = Math.round(lastWeather.current.wind_speed_10m);
        return `
          <div style="display:flex; justify-content:space-between; gap:10px; font-weight:900;">
            <div>${t}°</div><div>${w} m/s</div>
          </div>
          <div class="miniHint" style="margin-top:8px;">Tryck för detaljer</div>
        `;
      }
      return `<div class="miniHint">Tryck för att ladda väder.</div>`;
    }

    if (id === "prio") {
      const c = store.prio.length;
      const first = store.prio[0]?.text;
      return `<div style="font-weight:900;">Aktiva prios: ${c}</div>` +
        (first ? `<div class="miniHint" style="margin-top:8px;">Nästa: ${escapeHtml(first)}</div>` : `<div class="miniHint" style="margin-top:8px;">Inga prios ännu</div>`);
    }

    if (id === "timer") {
      return `<div style="font-weight:900;">${timerText()}</div><div class="miniHint" style="margin-top:8px;">Tryck för 1/5/10/15/30</div>`;
    }

    if (id === "stocks") {
      return `<div class="miniHint">Placeholder – vi kan lägga TradingView widget här sen.</div>`;
    }

    if (id === "done") {
      return `<div style="font-weight:900;">Slutförda: ${store.done.length}</div><div class="miniHint" style="margin-top:8px;">Tryck för lista + återställ</div>`;
    }

    if (id === "lists") return `<div style="font-weight:900;">Listor: ${store.lists.length}</div>`;
    if (id === "ideas") return `<div style="font-weight:900;">Idéer: ${store.ideas.length}</div>`;

    return `<div class="miniHint">Tryck för att öppna.</div>`;
  }

  function renderPreview(id) {
    if (!previewTitle || !previewBody) return;
    const v = VIEW_DEFS.find(x => x.id === id);
    previewTitle.textContent = v ? v.label : "Preview";
    previewBody.innerHTML = previewHtmlFor(id);
  }

  /* =========================
     OPEN / CLOSE SHEET
  ========================= */
  function openSheet() {
    document.body.classList.add("sheetOpen");
    sheetWrap?.setAttribute("aria-hidden", "false");
  }

  function closeSheet() {
    document.body.classList.remove("sheetOpen");
    sheetWrap?.setAttribute("aria-hidden", "true");
  }

  sheetCloseBtn?.addEventListener("click", closeSheet);

  // drag-to-close (down)
  let sheetDragStartY = null;
  sheet?.addEventListener("pointerdown", (e) => {
    sheetDragStartY = e.clientY;
    sheet.setPointerCapture?.(e.pointerId);
  }, { passive: true });

  sheet?.addEventListener("pointermove", (e) => {
    if (sheetDragStartY == null) return;
    const delta = e.clientY - sheetDragStartY;
    if (delta > 0) {
      sheet.style.transform = `translateY(${delta}px)`;
      e.preventDefault();
    }
  }, { passive: false });

  sheet?.addEventListener("pointerup", (e) => {
    if (sheetDragStartY == null) return;
    const delta = e.clientY - sheetDragStartY;
    sheet.style.transform = "";
    sheetDragStartY = null;
    if (delta > 160) closeSheet();
  }, { passive: true });

  sheet?.addEventListener("pointercancel", () => {
    sheet.style.transform = "";
    sheetDragStartY = null;
  }, { passive: true });

  /* =========================
     WHEEL INTERACTION (LIVE SYNC)
  ========================= */
  let dragging = false;
  let startAngle = 0;
  let tapStartX = 0, tapStartY = 0;
  let didDrag = false;

  function angle(cx, cy, x, y) {
    return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
  }

  function setRotation(deg) {
    rotationDeg = deg;
    if (wheelRing) wheelRing.style.transform = `rotate(${deg}deg)`;

    const idx = sectorFromDeg(deg);
    if (idx !== activeIndex) {
      activeIndex = idx;
      const v = VIEW_DEFS[activeIndex];
      setWheelCenterText(v.label);
      setStartIcon(v.icon);
      renderPreview(v.id);

      if (document.body.classList.contains("sheetOpen")) {
        renderView(v.id, { fast: true });
      }
    } else {
      // still keep text/icon updated
      const v = VIEW_DEFS[activeIndex];
      setWheelCenterText(v.label);
    }
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
    if (!didDrag && Math.hypot(dx, dy) > 16) didDrag = true;

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
      renderView(VIEW_DEFS[activeIndex].id, { fast: true });
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
    renderView(VIEW_DEFS[activeIndex].id, { fast: true });
  });

  /* =========================
     TIMER (wheel ring svg + fullscreen pulse)
  ========================= */
  const TIMER = {
    total: 5 * 60,
    left:  5 * 60,
    running: false,
    t0: 0,
    pausedLeft: 5 * 60,
    raf: 0
  };

  const wheelSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wheelSvg.setAttribute("class", "wheelTimerSvg");
  wheelSvg.innerHTML = `<circle id="wheelTimerBg"></circle><circle id="wheelTimerProg"></circle>`;
  wheel?.appendChild(wheelSvg);

  function updateWheelTimerProgress() {
    const bg = document.getElementById("wheelTimerBg");
    const prog = document.getElementById("wheelTimerProg");
    if (!wheel || !bg || !prog) return;

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

    if (pct > 0.40) prog.style.stroke = "rgba(0,209,255,.92)";
    else if (pct > 0.15) prog.style.stroke = "rgba(255,165,0,.92)";
    else prog.style.stroke = "rgba(255,70,70,.92)";
  }
  window.addEventListener("resize", updateWheelTimerProgress);

  function ensureFullscreenPulse(on) {
    const id = "timerPulseFullscreen";
    let el = document.getElementById(id);
    if (on) {
      if (!el) {
        el = document.createElement("div");
        el.id = id;
        el.className = "timerPulseFullscreen";
        document.body.appendChild(el);
      }
    } else {
      el?.remove();
    }
  }

  function alarm() {
    const audio = document.getElementById("alarmAudio");
    if (audio?.querySelector("source")) {
      audio.currentTime = 0;
      audio.play().catch(() => beepFallback());
      return;
    }
    beepFallback();
  }

  function beepFallback() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 900);
    } catch {}
  }

  function setTimerMinutesAndStart(min) {
    const m = Number(min);
    if (!Number.isFinite(m) || m <= 0) return;

    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);

    TIMER.total = Math.round(m * 60);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;

    TIMER.running = true;
    TIMER.t0 = performance.now();

    document.body.classList.add("timerRunning");
    ensureFullscreenPulse(true);

    cancelAnimationFrame(TIMER.raf);
    TIMER.raf = requestAnimationFrame(timerLoop);

    updateWheelTimerProgress();
    renderPreview("timer");
  }

  function resetTimer() {
    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;

    document.body.classList.remove("timerRunning");
    ensureFullscreenPulse(false);

    updateWheelTimerProgress();
    renderPreview("timer");
  }

  function timerLoop() {
    if (!TIMER.running) return;

    const elapsed = (performance.now() - TIMER.t0) / 1000;
    TIMER.left = Math.max(0, Math.floor(TIMER.pausedLeft - elapsed));

    updateWheelTimerProgress();
    renderPreview("timer");

    if (TIMER.left <= 0) {
      TIMER.running = false;
      cancelAnimationFrame(TIMER.raf);

      document.body.classList.remove("timerRunning");
      ensureFullscreenPulse(false);

      updateWheelTimerProgress();
      alarm();
      renderPreview("timer");
      return;
    }

    TIMER.raf = requestAnimationFrame(timerLoop);
  }

  /* =========================
     DONE (restore-to-origin)
  ========================= */
  function toDone(origin, item) {
    store.done.unshift({
      id: item.id,
      text: item.text,
      createdAt: item.createdAt || Date.now(),
      note: item.note || "",
      checklist: Array.isArray(item.checklist) ? item.checklist : undefined,
      origin,
      doneAt: Date.now()
    });
  }

  function restoreFromDone(id) {
    const i = store.done.findIndex(x => x.id === id);
    if (i === -1) return;
    const item = store.done.splice(i, 1)[0];
    const { origin, doneAt, ...rest } = item;

    if (origin === "prio") store.prio.unshift(rest);
    else if (origin === "ideas") store.ideas.unshift(rest);
    else if (origin === "lists") store.lists.unshift(rest);
    else store.lists.unshift(rest);

    saveStore();
    updatePrioCount();
    renderPreview(VIEW_DEFS[activeIndex].id);
    if (document.body.classList.contains("sheetOpen")) renderView(VIEW_DEFS[activeIndex].id, { fast: true });
  }

  /* =========================
     MODAL (explicit dark bg to avoid white artifacts)
  ========================= */
  function openModal(item, type) {
    const wrap = document.createElement("div");
    wrap.className = "modalWrap open";
    wrap.innerHTML = `
      <div class="modalBackdrop" style="position:fixed; inset:0; background:rgba(0,0,0,.55); backdrop-filter: blur(10px); z-index:999;"></div>
      <div class="modalCard" style="position:fixed; left:14px; right:14px; top:120px; bottom:140px; border-radius:24px; background:rgba(10,15,20,.78); border:1px solid rgba(255,255,255,.10); box-shadow:0 18px 60px rgba(0,0,0,.6); z-index:1000; overflow:hidden;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 14px; border-bottom:1px solid rgba(255,255,255,.08);">
          <div style="font-weight:900; letter-spacing:.10em; text-transform:uppercase; font-size:13px;">Detaljer</div>
          <button class="modalClose" style="width:40px; height:40px; border-radius:14px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.25); color:rgba(255,255,255,.9);">✕</button>
        </div>
        <div style="padding:14px; height:calc(100% - 70px); overflow:auto; -webkit-overflow-scrolling:touch;">
          <div style="font-weight:900; margin-bottom:10px;">${escapeHtml(item.text)}</div>
          <textarea class="modalTextArea" style="width:100%; min-height:160px; border-radius:18px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.20); color:rgba(255,255,255,.92); padding:12px; outline:none; font-size:16px;" placeholder="Skriv mer…"></textarea>

          ${type === "lists" ? `
            <div style="margin-top:14px; font-weight:900;">Checklist</div>
            <div style="display:flex; gap:10px; margin-top:10px;">
              <input class="miniInput" id="subTaskInput" placeholder="Lägg till sak…" />
              <button class="miniBtn" id="subTaskAdd">+</button>
            </div>
            <ul id="subTaskList" class="miniList" style="margin-top:10px;"></ul>
          ` : ``}
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const ta = wrap.querySelector(".modalTextArea");
    ta.value = item.note || "";

    const close = () => wrap.remove();
    wrap.querySelector(".modalBackdrop").onclick = close;
    wrap.querySelector(".modalClose").onclick = close;

    ta.addEventListener("input", () => {
      item.note = ta.value || "";
      saveStore();
      renderPreview(VIEW_DEFS[activeIndex].id);
    });

    if (type === "lists") {
      if (!Array.isArray(item.checklist)) item.checklist = [];
      const input = wrap.querySelector("#subTaskInput");
      const addBtn = wrap.querySelector("#subTaskAdd");
      const listEl = wrap.querySelector("#subTaskList");

      const sortChecklist = () => {
        item.checklist.sort((a, b) => (a.done === b.done) ? (b.createdAt - a.createdAt) : (a.done ? 1 : -1));
      };

      const draw = () => {
        sortChecklist();
        listEl.innerHTML = "";
        item.checklist.forEach(st => {
          const li = document.createElement("li");
          li.className = "checkItem";
          li.innerHTML = `
            <div class="checkRow" style="cursor:default;">
              <input class="checkBox" type="checkbox" ${st.done ? "checked" : ""}/>
              <div class="checkMid"><div class="checkText">${escapeHtml(st.text)}</div></div>
              <div class="checkRight"><div class="miniMeta">${fmt(st.createdAt)}</div></div>
            </div>
          `;
          const cb = li.querySelector("input");
          cb.addEventListener("change", () => {
            st.done = !!cb.checked;
            saveStore();
            draw();
          });
          listEl.appendChild(li);
        });
      };

      const add = () => {
        const t = (input.value || "").trim();
        if (!t) return;
        item.checklist.unshift({ id: uid(), text: t, done: false, createdAt: Date.now() });
        input.value = "";
        saveStore();
        draw();
      };

      addBtn.addEventListener("click", add);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });

      draw();
      setTimeout(() => input.focus(), 80);
    } else {
      setTimeout(() => ta.focus(), 80);
    }
  }

  function mkRow({ item, meta, stat }, onComplete, onOpen) {
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

    if (stat) {
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
      if (!cb.checked) return;
      cb.disabled = true;
      setTimeout(() => onComplete?.(), 120);
    });

    row.addEventListener("click", (e) => {
      if (e.target === cb) return;
      onOpen?.();
    });

    return li;
  }

  function listProgress(item) {
    if (!Array.isArray(item.checklist) || item.checklist.length === 0) return "";
    const total = item.checklist.length;
    const done = item.checklist.filter(x => x.done).length;
    return `${done}/${total}`;
  }

  function renderList(type, label, allowModal) {
    sheetTitle.textContent = label;
    sheetContent.innerHTML = `
      <div class="miniForm">
        <input id="input" class="miniInput" placeholder="${type === "lists" ? "Ny lista..." : "Skriv..."}" maxlength="160"/>
        <button id="add" class="miniBtn">+</button>
      </div>
      <ul id="list" class="miniList"></ul>
      <div class="miniHint" style="margin-top:10px;">Tryck på rad = detaljer • Bock = slutför</div>
    `;

    const input = $("input");
    const addBtn = $("add");
    const listEl = $("list");

    const add = () => {
      const t = (input.value || "").trim();
      if (!t) return;

      const obj = { id: uid(), text: t, createdAt: Date.now(), note: "" };
      if (type === "lists") obj.checklist = [];

      store[type].unshift(obj);
      saveStore();
      input.value = "";
      updatePrioCount();
      draw();
      renderPreview(VIEW_DEFS[activeIndex].id);
    };

    addBtn.addEventListener("click", add);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });

    function complete(id) {
      const i = store[type].findIndex(x => x.id === id);
      if (i === -1) return;
      const item = store[type].splice(i, 1)[0];
      toDone(type, item);
      saveStore();
      updatePrioCount();
      draw();
      renderPreview(VIEW_DEFS[activeIndex].id);
    }

    function draw() {
      listEl.innerHTML = "";
      store[type].forEach((item) => {
        const stat = (type === "lists") ? listProgress(item) : "";
        listEl.appendChild(
          mkRow(
            { item, meta: fmt(item.createdAt), stat },
            () => complete(item.id),
            allowModal ? () => openModal(item, type) : null
          )
        );
      });
      if (!store[type].length) {
        listEl.innerHTML = `<li class="miniHint">Inget här ännu.</li>`;
      }
    }

    draw();
  }

  function renderDone() {
    sheetTitle.textContent = "Slutförda";
    sheetContent.innerHTML = `
      <ul id="doneList" class="miniList"></ul>
      <div class="miniHint" style="margin-top:10px;">Tryck på en slutförd rad för att återställa till rätt lista.</div>
    `;

    const listEl = $("doneList");
    if (!store.done.length) {
      listEl.innerHTML = `<li class="miniHint">Inget slutfört ännu.</li>`;
      return;
    }

    store.done.forEach((item) => {
      const li = document.createElement("li");
      li.className = "miniRow doneItem";
      li.innerHTML = `
        <div class="miniRowLeft" style="font-weight:900; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.text)}</div>
        <div class="miniMeta">${fmt(item.doneAt)}</div>
      `;
      li.addEventListener("click", () => restoreFromDone(item.id));
      listEl.appendChild(li);
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
      <div class="calScale">
        <iframe class="calFrame" src="${CAL_SRC}" scrolling="yes"></iframe>
        <div class="calOverlay" aria-hidden="true"></div>
      </div>
      <div class="miniHint" style="margin-top:10px;">Google iframe går inte att tvinga till “riktig dark mode” alltid – overlay dämpar.</div>
    `;
  }

  /* =========================
     WEATHER
  ========================= */
  async function renderWeather() {
    sheetTitle.textContent = "Väder";
    sheetContent.innerHTML = `
      <div class="weatherBlock">
        <div id="wxNow" class="weatherRow">Laddar…</div>
        <div id="wxMore" class="miniHint"></div>
        <div style="margin-top:12px; font-weight:900;">Imorgon</div>
        <div id="wxTom" class="miniHint" style="margin-top:6px;">—</div>
      </div>
    `;

    const lat = 59.3293, lon = 18.0686;
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,wind_speed_10m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&forecast_days=2` +
      `&timezone=Europe%2FStockholm`;

    try {
      const r = await fetch(url, { cache: "no-store" });
      const data = await r.json();
      lastWeather = data;

      const t = Math.round(data.current.temperature_2m);
      const w = Math.round(data.current.wind_speed_10m);
      const code = data.current.weather_code;

      const tmax = Math.round(data.daily.temperature_2m_max[0]);
      const tmin = Math.round(data.daily.temperature_2m_min[0]);

      const tomMax = Math.round(data.daily.temperature_2m_max[1]);
      const tomMin = Math.round(data.daily.temperature_2m_min[1]);
      const tomCode = data.daily.weather_code[1];

      $("wxNow").innerHTML = `<div>Nu: <b>${t}°</b></div><div>Vind: <b>${w} m/s</b></div>`;
      $("wxMore").innerHTML = `Idag: <b>${tmin}°</b> – <b>${tmax}°</b> • ${wxText(code)}`;
      $("wxTom").innerHTML = `${wxText(tomCode)} • ${tomMin}° – ${tomMax}°`;

      renderPreview("weather");
    } catch {
      const el = $("wxNow");
      if (el) el.textContent = "Kunde inte hämta väder.";
    }
  }

  /* =========================
     NEWS (cache-first + bg refresh)
  ========================= */
  const RSS_URL_BASE = "https://news.google.com/rss?hl=sv&gl=SE&ceid=SE:sv";

  const PROXIES = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://r.jina.ai/http://${u.replace(/^https?:\/\//, "")}`,
    (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  ];

  function saveNewsCache(items) {
    try { localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), items })); } catch {}
  }
  function loadNewsCache() {
    try { return JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || "null"); } catch { return null; }
  }

  async function fetchTextWithFallback(url) {
    let lastErr = null;
    for (const mk of PROXIES) {
      try {
        const proxyUrl = mk(url);
        const res = await fetch(proxyUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const txt = await res.text();

        if (proxyUrl.includes("/get?url=")) {
          const obj = JSON.parse(txt);
          if (obj?.contents) return obj.contents;
          throw new Error("No contents in allorigins get");
        }
        return txt;
      } catch (e) { lastErr = e; }
    }
    throw (lastErr || new Error("All proxies failed"));
  }

  function parseRss(xmlText, max = 10) {
    const xml = new DOMParser().parseFromString(xmlText, "text/xml");
    const items = Array.from(xml.querySelectorAll("item")).slice(0, max);
    return items.map((item) => ({
      title: item.querySelector("title")?.textContent?.trim() || "Nyhet",
      link: item.querySelector("link")?.textContent?.trim() || "#",
      pubDate: item.querySelector("pubDate")?.textContent?.trim() || "",
    }));
  }

  function renderNewsList(items, metaText) {
    const newsList = document.getElementById("newsList");
    const newsMeta = document.getElementById("newsMeta");
    if (!newsList || !newsMeta) return;

    newsMeta.textContent = metaText || "";
    newsList.innerHTML = "";

    if (!items?.length) {
      newsList.innerHTML = `<li class="miniHint">Inget att visa just nu.</li>`;
      return;
    }

    items.forEach((it) => {
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
      if (it.pubDate) {
        const d = new Date(it.pubDate);
        if (!isNaN(d.getTime())) {
          right.textContent = d.toLocaleString("sv-SE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        }
      }

      li.appendChild(left);
      li.appendChild(right);
      newsList.appendChild(li);
    });
  }

  let newsLoading = false;

  async function refreshNewsBackground() {
    if (newsLoading) return;
    newsLoading = true;

    try {
      const url = `${RSS_URL_BASE}&_=${Date.now()}`;
      const xmlText = await fetchTextWithFallback(url);
      const items = parseRss(xmlText, 12);

      const now = Date.now();
      const fresh = items.filter(it => {
        const t = it.pubDate ? new Date(it.pubDate).getTime() : 0;
        return t && (now - t) < (72 * 60 * 60 * 1000);
      });
      const finalItems = fresh.length ? fresh : items;

      lastNews = finalItems;
      saveNewsCache(finalItems);

      if (document.getElementById("newsList") && document.getElementById("newsMeta")) {
        renderNewsList(finalItems, `Uppdaterad: ${new Date().toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`);
      }

      renderPreview("news");
    } catch {
      // ignore; cache already shown
    } finally {
      newsLoading = false;
    }
  }

  function loadNewsCacheFirst() {
    const c = loadNewsCache();
    if (c?.items?.length) {
      lastNews = c.items;
      renderPreview("news");
    }
  }

  function renderNews({ fast = false } = {}) {
    sheetTitle.textContent = "Nyheter";
    sheetContent.innerHTML = `
      <ul id="newsList" class="miniList"></ul>
      <div id="newsMeta" class="miniHint" style="margin-top:8px;">Laddar…</div>
    `;

    const c = loadNewsCache();
    if (c?.items?.length) {
      lastNews = c.items;
      renderNewsList(c.items, `Cache: ${new Date(c.updatedAt).toLocaleString("sv-SE", { hour:"2-digit", minute:"2-digit" })}`);
      refreshNewsBackground();
      return;
    }

    if (!fast) refreshNewsBackground();
    else setTimeout(refreshNewsBackground, 0);
  }

  setInterval(refreshNewsBackground, 10 * 60 * 1000);

  /* =========================
     STOCKS (placeholder)
  ========================= */
  function renderStocks() {
    sheetTitle.textContent = "Aktier";
    sheetContent.innerHTML = `
      <div class="miniHint">Här kan vi lägga TradingView widgets (t.ex. Ticker Tape / Market Overview / Symbol Overview).</div>
      <div class="miniHint" style="margin-top:10px;">Säg vilka tickers du vill ha (t.ex. TSLA, NVDA, SPX, XAUUSD) så bygger jag widgeten.</div>
    `;
  }

  /* =========================
     TIMER VIEW
  ========================= */
  function renderTimer() {
    sheetTitle.textContent = "Timer";
    sheetContent.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px; align-items:center;">
        <div style="font-size:52px; font-weight:900; letter-spacing:.06em;">${timerText()}</div>
        <div class="timerBtns">
          <button class="timerBtn" data-min="1">1</button>
          <button class="timerBtn" data-min="5">5</button>
          <button class="timerBtn" data-min="10">10</button>
          <button class="timerBtn" data-min="15">15</button>
          <button class="timerBtn" data-min="30">30</button>
          <button class="timerBtn timerBtnReset" id="tReset">Reset</button>
        </div>
        <div class="miniHint">När timer går: Siri-lik puls över hela skärmen</div>
      </div>
    `;

    sheetContent.querySelectorAll("[data-min]").forEach(btn => {
      btn.addEventListener("click", () => setTimerMinutesAndStart(btn.dataset.min));
    });
    $("tReset")?.addEventListener("click", resetTimer);
  }

  /* =========================
     VIEW SWITCH
  ========================= */
  function renderView(id, { fast = false } = {}) {
    if (id === "calendar") return renderCalendar();
    if (id === "prio")     return renderList("prio", "Prios", true);
    if (id === "weather")  return renderWeather();
    if (id === "news")     return renderNews({ fast });
    if (id === "lists")    return renderList("lists", "Listor", true);
    if (id === "ideas")    return renderList("ideas", "Idéer", true);
    if (id === "done")     return renderDone();
    if (id === "stocks")   return renderStocks();
    if (id === "timer")    return renderTimer();
  }

  /* =========================
     INIT
  ========================= */
  // initial wheel state
  setRotation(0);
  updateWheelTimerProgress();

  // preload news into preview (cache first) + background refresh
  loadNewsCacheFirst();
  refreshNewsBackground();

  // initial preview
  renderPreview(VIEW_DEFS[0].id);

})();