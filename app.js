/* =========================================================
   SB Dash (Wheel + Sheet)
   Fixes:
   - Remove "Preview" text (topRight)
   - Swipe left to complete (robust)
   - Prio item tap -> glass modal with notes
   - Add button = "+"
   - Remove duplicate inner titles
   - Timer persists across views + progress ring around wheel (overlay)
   ========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- Elements ----------
  const wheel = $("wheel");
  const wheelRing = document.querySelector(".wheelRing");
  const wheelIcon = $("wheelIcon");

  const sheetWrap = $("sheetWrap");
  const sheet = $("sheet");
  const sheetTitle = $("sheetTitle");
  const sheetContent = $("sheetContent");

  const topDate = $("topDate");
  const topRight = document.querySelector(".topRight");

  // ---------- Date ----------
  if (topDate) {
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE", { weekday: "long" });
    const date = now.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
    topDate.textContent = `${weekday} ${date}`;
  }

  // ---------- Remove Preview ----------
  if (topRight) topRight.textContent = "";

  // ---------- Haptics ----------
  const canVibrate = !!navigator.vibrate;
  const tick = (ms = 8) => { if (canVibrate) navigator.vibrate(ms); };

  // ---------- Views ----------
  const VIEWS = [
    { id: "calendar", title: "Kalender", icon: "assets/ui/icon-calendar.svg" },
    { id: "prio",     title: "Aktiv prio", icon: "assets/ui/icon-prio.svg" },
    { id: "weather",  title: "Väder", icon: "assets/ui/icon-weather.svg" },
    { id: "news",     title: "Nyheter", icon: "assets/ui/icon-news.svg" },
    { id: "todo",     title: "Todo", icon: "assets/ui/icon-todo.svg" },
    { id: "ideas",    title: "Idéer", icon: "assets/ui/icon-ideas.svg" },
    { id: "done",     title: "Slutförda", icon: "assets/ui/icon-done.svg" },
    { id: "timer",    title: "Timer", icon: "assets/ui/icon-pomodoro.svg" }
  ];

  let activeIndex = 0;
  const STEP = 360 / VIEWS.length;
  let rotationDeg = 0;

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function pad2(n){ return String(n).padStart(2, "0"); }

  function setPreview(index, { silent = false } = {}) {
    activeIndex = (index + VIEWS.length) % VIEWS.length;
    const v = VIEWS[activeIndex];
    if (wheelIcon) wheelIcon.src = v.icon;
    if (!silent) tick(6);
  }

  function sectorFromDeg(deg) {
    const raw = Math.round(deg / STEP);
    const idx = ((raw % VIEWS.length) + VIEWS.length) % VIEWS.length;
    return idx;
  }

  function setRotation(deg, { silent = false } = {}) {
    rotationDeg = deg;
    if (wheelRing) wheelRing.style.transform = `rotate(${deg}deg)`;
    const idx = sectorFromDeg(deg);
    setPreview(idx, { silent });
  }

  function openSheet() {
    sheetWrap?.classList.add("open");
    renderView(VIEWS[activeIndex].id);
  }
  function closeSheet() {
    sheetWrap?.classList.remove("open");
  }

  // ---------- Sheet drag-to-close ----------
  let dragStartY = null;
  sheet?.addEventListener("pointerdown", (e) => {
    dragStartY = e.clientY;
    sheet.classList.add("dragging");
    sheet.setPointerCapture?.(e.pointerId);
  }, { passive: true });

  sheet?.addEventListener("pointermove", (e) => {
    if (dragStartY == null) return;
    const delta = e.clientY - dragStartY;
    if (delta > 0) {
      sheet.style.transform = `translateX(-50%) translateY(${delta}px)`;
      e.preventDefault?.();
    }
  }, { passive: false });

  sheet?.addEventListener("pointerup", () => {
    if (dragStartY == null) return;
    const delta = event?.clientY - dragStartY;
    if (delta > 120) closeSheet();
    sheet.style.transform = "";
    sheet.classList.remove("dragging");
    dragStartY = null;
  }, { passive: true });

  sheet?.addEventListener("pointercancel", () => {
    sheet.style.transform = "";
    sheet.classList.remove("dragging");
    dragStartY = null;
  }, { passive: true });

  // ---------- Wheel interaction ----------
  let isDragging = false;
  let startAngle = 0;
  let tapStartX = 0, tapStartY = 0;
  let didDrag = false;

  function angle(cx, cy, x, y) {
    return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
  }

  wheel?.addEventListener("pointerdown", (e) => {
    isDragging = true;
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
    if (!isDragging) return;

    const dx = e.clientX - tapStartX;
    const dy = e.clientY - tapStartY;
    if (!didDrag && Math.hypot(dx, dy) > 18) didDrag = true;

    if (didDrag) {
      const r = wheel.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      const deg = angle(cx, cy, e.clientX, e.clientY) - startAngle;
      setRotation(deg, { silent: true });
      e.preventDefault();
    }
  }, { passive: false });

  wheel?.addEventListener("pointerup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    wheel.releasePointerCapture?.(e.pointerId);

    const idx = sectorFromDeg(rotationDeg);
    const snapped = idx * STEP;
    setRotation(snapped, { silent: true });

    if (!didDrag) openSheet();
  }, { passive: true });

  wheel?.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = (activeIndex + dir + VIEWS.length) % VIEWS.length;
    setRotation(next * STEP);
  }, { passive: false });

  // ---------- Storage ----------
  const LS_KEY = "sbdash_wheel_store_v3";
  function loadStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const p = raw ? JSON.parse(raw) : {};
      return {
        prio: Array.isArray(p.prio) ? p.prio : [],
        todo: Array.isArray(p.todo) ? p.todo : [],
        ideas: Array.isArray(p.ideas) ? p.ideas : [],
        done: Array.isArray(p.done) ? p.done : [],
      };
    } catch {
      return { prio: [], todo: [], ideas: [], done: [] };
    }
  }
  const store = loadStore();
  const saveStore = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  const fmt = (ts) =>
    new Date(ts).toLocaleString("sv-SE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  // ---------- Modal (glass) ----------
  const modalWrap = document.createElement("div");
  modalWrap.id = "modalWrap";
  modalWrap.className = "modalWrap";
  modalWrap.innerHTML = `
    <div class="modalBackdrop" data-close="1"></div>
    <div class="modalCard" role="dialog" aria-modal="true">
      <div class="modalHeader">
        <div class="modalTitle" id="modalTitle">Aktiv prio</div>
        <button class="modalClose" id="modalCloseBtn" aria-label="Stäng">✕</button>
      </div>
      <div class="modalBody">
        <div class="modalMainText" id="modalMainText"></div>
        <textarea class="modalTextArea" id="modalTextArea" placeholder="Skriv mer…"></textarea>
      </div>
      <div class="modalFooter">
        <button class="miniBtn" id="modalSaveBtn">Spara</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalWrap);

  const modalMainTextEl = $("modalMainText");
  const modalTextAreaEl = $("modalTextArea");
  const modalCloseBtn = $("modalCloseBtn");
  const modalSaveBtn = $("modalSaveBtn");
  let modalOnSave = null;

  function openModal({ mainText, notes, onSave }) {
    if (modalMainTextEl) modalMainTextEl.textContent = mainText || "";
    if (modalTextAreaEl) {
      modalTextAreaEl.value = notes || "";
      setTimeout(() => modalTextAreaEl.focus(), 50);
    }
    modalOnSave = typeof onSave === "function" ? onSave : null;
    modalWrap.classList.add("open");
    tick(10);
  }
  function closeModal() {
    modalWrap.classList.remove("open");
    modalOnSave = null;
    tick(6);
  }
  modalWrap.addEventListener("click", (e) => {
    const t = e.target;
    if (t?.dataset?.close) closeModal();
  });
  modalCloseBtn?.addEventListener("click", closeModal);
  modalSaveBtn?.addEventListener("click", () => {
    const val = modalTextAreaEl ? modalTextAreaEl.value : "";
    modalOnSave?.(val);
    closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalWrap.classList.contains("open")) closeModal();
  });

  // ---------- Swipe (robust) ----------
  function attachSwipe(li, onComplete) {
    const content = li.querySelector(".swipeContent");
    if (!content) return;

    let dragging = false;
    let pointerId = null;
    let startX = 0, startY = 0;
    let curX = 0;
    let locked = false;
    let mode = null; // "h" or "v"

    const setX = (x, animate) => {
      curX = x;
      content.style.transition = animate ? "transform 180ms ease" : "none";
      content.style.transform = `translateX(${x}px)`;
    };

    const reset = () => setX(0, true);

    content.addEventListener("pointerdown", (e) => {
      dragging = true;
      locked = false;
      mode = null;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      setX(0, true);
      content.setPointerCapture?.(pointerId);
    }, { passive: true });

    content.addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerId !== pointerId) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!locked) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          locked = true;
          mode = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
          if (mode === "v") {
            dragging = false;
            pointerId = null;
            reset();
            return;
          }
        } else return;
      }

      if (mode !== "h") return;
      if (dx > 0) return; // only left

      e.preventDefault();
      const max = -Math.min(260, li.clientWidth * 0.92);
      setX(Math.max(dx, max), false);
    }, { passive: false });

    const finish = (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;

      const abs = Math.abs(curX);
      const need = li.clientWidth * 0.45;

      if (abs >= need) {
        setX(-li.clientWidth, true);
        setTimeout(() => onComplete?.(), 140);
      } else {
        reset();
      }

      pointerId = null;
      mode = null;
    };

    content.addEventListener("pointerup", finish, { passive: true });
    content.addEventListener("pointercancel", finish, { passive: true });
  }

  function mkSwipeItem({ text, meta }, onComplete, onClick) {
    const li = document.createElement("li");
    li.className = "swipeItem";

    // under finns kvar som yta men UTAN text
    const under = document.createElement("div");
    under.className = "swipeUnder";

    const content = document.createElement("div");
    content.className = "swipeContent";

    const left = document.createElement("div");
    left.className = "swipeLeft";

    const t = document.createElement("div");
    t.className = "swipeText";
    t.textContent = text;

    left.appendChild(t);

    const right = document.createElement("div");
    right.className = "swipeRight";

    const m = document.createElement("div");
    m.className = "miniMeta";
    m.textContent = meta || "";

    right.appendChild(m);

    content.appendChild(left);
    content.appendChild(right);

    li.appendChild(under);
    li.appendChild(content);

    attachSwipe(li, onComplete);

    if (onClick) content.addEventListener("click", () => onClick());

    return li;
  }

  // ---------- TIMER (global, continues across views) ----------
  const TIMER = {
    total: 5 * 60,
    left: 5 * 60,
    running: false,
    t0: 0,
    pausedLeft: 5 * 60,
    raf: 0
  };

  function setTimerMinutes(min) {
    const m = Number(min);
    if (!Number.isFinite(m) || m <= 0) return;

    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);

    TIMER.total = Math.round(m * 60);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;

    updateWheelTimerProgress();
    refreshTimerUIIfOpen();
  }

  function resetTimer() {
    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;
    updateWheelTimerProgress();
    refreshTimerUIIfOpen();
  }

  function startPauseTimer() {
    if (TIMER.running) {
      TIMER.running = false;
      TIMER.pausedLeft = TIMER.left;
      cancelAnimationFrame(TIMER.raf);
      refreshTimerUIIfOpen();
      return;
    }

    if (TIMER.left <= 0) {
      TIMER.left = TIMER.total;
      TIMER.pausedLeft = TIMER.left;
    }

    TIMER.running = true;
    TIMER.t0 = performance.now();
    tick(10);

    cancelAnimationFrame(TIMER.raf);
    TIMER.raf = requestAnimationFrame(timerLoop);
    refreshTimerUIIfOpen();
  }

  function timerLoop() {
    if (!TIMER.running) return;

    const elapsed = (performance.now() - TIMER.t0) / 1000;
    TIMER.left = Math.max(0, Math.floor(TIMER.pausedLeft - elapsed));

    updateWheelTimerProgress();
    refreshTimerUIIfOpen(true);

    if (TIMER.left <= 0) {
      TIMER.running = false;
      cancelAnimationFrame(TIMER.raf);
      if (canVibrate) navigator.vibrate([20, 40, 20]);
      refreshTimerUIIfOpen();
      return;
    }

    TIMER.raf = requestAnimationFrame(timerLoop);
  }

  // ---------- Wheel timer ring overlay (FIXED: append INSIDE wheel) ----------
  const wheelSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wheelSvg.setAttribute("class", "wheelTimerSvg");
  wheelSvg.innerHTML = `
    <circle id="wheelTimerBg"></circle>
    <circle id="wheelTimerProg"></circle>
  `;
  // ✅ append inside .wheel so it overlays and never becomes a second block below
  wheel?.appendChild(wheelSvg);

  function updateWheelTimerProgress() {
    const bg = $("wheelTimerBg");
    const prog = $("wheelTimerProg");
    if (!wheel || !wheelSvg || !bg || !prog) return;

    const size = wheel.getBoundingClientRect().width;
    const r = (size / 2) - 5; // lite innanför kanten
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

  window.addEventListener("resize", () => updateWheelTimerProgress());
  updateWheelTimerProgress();

  // ---------- Calendar ----------
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
      <div class="miniHint" style="margin-top:10px;">
        (iPhone Safari kan kräva cookies för Google iframe.)
      </div>
    `;
  }

  // ---------- Prio ----------
  function renderPrio() {
    sheetTitle.textContent = "Aktiv prio";

    sheetContent.innerHTML = `
      <div class="miniForm">
        <input id="prioInput" class="miniInput" type="text" placeholder="Lägg till superprio…" maxlength="160">
        <button id="prioAddBtn" class="miniBtn miniBtnIcon" aria-label="Lägg till">+</button>
      </div>
      <ul id="prioList" class="miniList"></ul>
      <div class="miniHint">Svep vänster för slutförd</div>
    `;

    const prioInput = $("prioInput");
    const prioAddBtn = $("prioAddBtn");
    const prioList = $("prioList");

    const add = () => {
      const t = (prioInput.value || "").trim();
      if (!t) return;
      store.prio.unshift({ id: uid(), text: t, notes: "", createdAt: Date.now() });
      saveStore();
      prioInput.value = "";
      draw();
    };

    const completeById = (id) => {
      const i = store.prio.findIndex(x => x.id === id);
      if (i === -1) return;
      const item = store.prio.splice(i, 1)[0];
      store.done.unshift({ ...item, origin: "prio", doneAt: Date.now() });
      saveStore();
      draw();
    };

    const editById = (id) => {
      const item = store.prio.find(x => x.id === id);
      if (!item) return;
      openModal({
        mainText: item.text,
        notes: item.notes || "",
        onSave: (val) => {
          item.notes = val || "";
          saveStore();
        }
      });
    };

    const draw = () => {
      prioList.innerHTML = "";
      if (!store.prio.length) {
        prioList.innerHTML = `<li class="miniHint">Inget i Aktiv prio just nu.</li>`;
        return;
      }
      for (const item of store.prio) {
        prioList.appendChild(
          mkSwipeItem(
            { text: item.text, meta: fmt(item.createdAt) },
            () => completeById(item.id),
            () => editById(item.id)
          )
        );
      }
    };

    prioAddBtn.addEventListener("click", add);
    prioInput.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });

    draw();
  }

  // ---------- Weather ----------
  async function loadWeather() {
    const lat = 59.3293, lon = 18.0686;
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&current=temperature_2m,wind_speed_10m,weather_code` +
      `&timezone=Europe%2FStockholm`;

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("weather failed");
    const data = await r.json();
    return data?.current || null;
  }

  function iconForCode(code) {
    if (code === 0) return "☀️";
    if (code === 1 || code === 2) return "🌤️";
    if (code === 3) return "☁️";
    if (code === 45 || code === 48) return "🌫️";
    if ([51,53,55,61,63,65,80,81,82].includes(code)) return "🌧️";
    if ([71,73,75].includes(code)) return "🌨️";
    if ([95,96,99].includes(code)) return "⛈️";
    return "⛅️";
  }

  function textForCode(code) {
    const m = {
      0: "Klart", 1: "Mestadels klart", 2: "Delvis molnigt", 3: "Mulet",
      45: "Dimma", 48: "Isdimma",
      51: "Duggregn (lätt)", 53: "Duggregn", 55: "Duggregn (kraftigt)",
      61: "Regn (lätt)", 63: "Regn", 65: "Regn (kraftigt)",
      71: "Snö (lätt)", 73: "Snö", 75: "Snö (kraftigt)",
      80: "Skurar (lätta)", 81: "Skurar", 82: "Skurar (kraftiga)",
      95: "Åska", 96: "Åska + hagel", 99: "Åska + hagel",
    };
    return m[code] || `Väderkod ${code}`;
  }

  function renderWeather() {
    sheetTitle.textContent = "Väder";
    sheetContent.innerHTML = `
      <div class="card" style="padding:14px;">
        <div style="display:flex; gap:12px; align-items:center;">
          <div id="wIcon" style="font-size:34px;">⛅️</div>
          <div>
            <div id="wTemp" style="font-size:34px; font-weight:900;">—°</div>
            <div id="wDesc" class="miniHint" style="margin-top:4px;">Laddar…</div>
          </div>
        </div>
        <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
          <div class="itemRow" style="flex:1 1 140px;">
            <div class="itemText">Vind</div>
            <div class="itemMeta" id="wWind">—</div>
          </div>
          <div class="itemRow" style="flex:1 1 140px;">
            <div class="itemText">Uppdaterad</div>
            <div class="itemMeta" id="wUpd">—</div>
          </div>
        </div>
        <div class="miniActions">
          <button class="miniBtn" id="wRefresh">Uppdatera</button>
        </div>
      </div>
    `;

    const wIcon = $("wIcon");
    const wTemp = $("wTemp");
    const wDesc = $("wDesc");
    const wWind = $("wWind");
    const wUpd  = $("wUpd");
    const wRefresh = $("wRefresh");

    const draw = async () => {
      try {
        if (wDesc) wDesc.textContent = "Laddar…";
        const cur = await loadWeather();
        if (!cur) throw new Error("no current");

        const t = Math.round(cur.temperature_2m);
        const w = Math.round(cur.wind_speed_10m);
        const code = cur.weather_code;

        if (wIcon) wIcon.textContent = iconForCode(code);
        if (wTemp) wTemp.textContent = `${t}°`;
        if (wDesc) wDesc.textContent = textForCode(code);
        if (wWind) wWind.textContent = `${w} m/s`;
        if (wUpd) wUpd.textContent = new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
      } catch {
        if (wDesc) wDesc.textContent = "Kunde inte ladda väder.";
      }
    };

    wRefresh?.addEventListener("click", draw);
    draw();
  }

  // ---------- News ----------
  const RSS_NEWS = "https://news.google.com/rss?hl=sv&gl=SE&ceid=SE:sv";
  const NEWS_CACHE_KEY = "sbdash_news_cache_wheel_v1";

  const PROXIES = [(u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`];

  async function fetchText(url) {
    let last;
    for (const p of PROXIES) {
      try {
        const r = await fetch(p(url), { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        return await r.text();
      } catch (e) { last = e; }
    }
    throw last || new Error("proxy failed");
  }

  function parseRss(xml, max = 12) {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return Array.from(doc.querySelectorAll("item")).slice(0, max).map(it => ({
      title: it.querySelector("title")?.textContent?.trim() || "Nyhet",
      link: it.querySelector("link")?.textContent?.trim() || "#",
      pubDate: it.querySelector("pubDate")?.textContent?.trim() || ""
    }));
  }

  function saveCache(items) {
    try { localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), items })); } catch {}
  }
  function loadCache() {
    try { return JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || "null"); } catch { return null; }
  }

  function renderNews() {
    sheetTitle.textContent = "Nyheter";
    sheetContent.innerHTML = `
      <div class="miniHint" id="newsMeta">Laddar…</div>
      <ul class="miniList" id="newsList" style="margin-top:12px;"></ul>
      <div class="miniActions">
        <button class="miniBtn" id="newsRefresh">Uppdatera</button>
      </div>
    `;

    const newsMeta = $("newsMeta");
    const newsList = $("newsList");
    const newsRefresh = $("newsRefresh");

    const draw = (items, metaText) => {
      if (newsMeta) newsMeta.textContent = metaText || "";
      if (!newsList) return;
      newsList.innerHTML = "";

      if (!items?.length) {
        newsList.innerHTML = `<li class="miniHint">Inget att visa just nu.</li>`;
        return;
      }

      for (const it of items) {
        const li = document.createElement("li");
        li.className = "itemRow";

        const left = document.createElement("div");
        left.className = "itemText";
        left.style.whiteSpace = "normal";
        left.style.lineHeight = "1.25";

        const a = document.createElement("a");
        a.href = it.link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = it.title;
        a.style.color = "var(--text)";
        a.style.textDecoration = "none";
        a.style.fontWeight = "900";
        a.style.display = "block";

        left.appendChild(a);

        const right = document.createElement("div");
        right.className = "itemMeta";
        if (it.pubDate) {
          const d = new Date(it.pubDate);
          right.textContent = isNaN(d.getTime())
            ? ""
            : d.toLocaleString("sv-SE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        }

        li.appendChild(left);
        li.appendChild(right);
        newsList.appendChild(li);
      }
    };

    const load = async () => {
      try {
        draw([], "Laddar…");
        const xml = await fetchText(RSS_NEWS);
        const items = parseRss(xml, 12);
        draw(items, `Uppdaterad: ${new Date().toLocaleString("sv-SE")}`);
        saveCache(items);
      } catch {
        const c = loadCache();
        if (c?.items?.length) {
          draw(c.items, `Visar cache (senast: ${new Date(c.updatedAt).toLocaleString("sv-SE")})`);
        } else {
          draw([], "Nyheter kunde inte laddas just nu.");
        }
      }
    };

    newsRefresh?.addEventListener("click", load);
    load();
  }

  // ---------- Todo / Ideas / Done ----------
  function renderSimpleList({ title, key, inputPlaceholder, hint, allowModal = false }) {
    sheetTitle.textContent = title;

    sheetContent.innerHTML = `
      <div class="miniForm">
        <input id="${key}Input" class="miniInput" type="text" placeholder="${inputPlaceholder}" maxlength="160">
        <button id="${key}AddBtn" class="miniBtn miniBtnIcon" aria-label="Lägg till">+</button>
      </div>
      <ul id="${key}List" class="miniList"></ul>
      <div class="miniHint">${hint}</div>
    `;

    const input = $(`${key}Input`);
    const addBtn = $(`${key}AddBtn`);
    const list = $(`${key}List`);

    const add = () => {
      const t = (input.value || "").trim();
      if (!t) return;
      const obj = { id: uid(), text: t, createdAt: Date.now() };
      store[key].unshift(obj);
      saveStore();
      input.value = "";
      draw();
    };

    const completeById = (id) => {
      const i = store[key].findIndex(x => x.id === id);
      if (i === -1) return;
      const item = store[key].splice(i, 1)[0];
      store.done.unshift({ ...item, origin: key, doneAt: Date.now() });
      saveStore();
      draw();
    };

    const draw = () => {
      list.innerHTML = "";
      if (!store[key].length) {
        list.innerHTML = `<li class="miniHint">Inget att visa.</li>`;
        return;
      }
      for (const item of store[key]) {
        list.appendChild(
          mkSwipeItem(
            { text: item.text, meta: fmt(item.createdAt) },
            () => completeById(item.id),
            allowModal ? () => openModal({
              mainText: item.text,
              notes: item.notes || "",
              onSave: (val) => { item.notes = val || ""; saveStore(); }
            }) : null
          )
        );
      }
    };

    addBtn.addEventListener("click", add);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });

    draw();
  }

  function renderTodo() {
    return renderSimpleList({
      title: "Todo",
      key: "todo",
      inputPlaceholder: "Skriv en uppgift…",
      hint: "Svep vänster för slutförd"
    });
  }

  function renderIdeas() {
    return renderSimpleList({
      title: "Idéer",
      key: "ideas",
      inputPlaceholder: "Skriv en idé…",
      hint: "Svep vänster för slutförd"
    });
  }

  function renderDone() {
    sheetTitle.textContent = "Slutförda";

    sheetContent.innerHTML = `
      <ul id="doneList" class="miniList"></ul>
      <div class="miniActions">
        <button id="doneClearBtn" class="miniBtn">Rensa slutförda</button>
      </div>
      <div class="miniHint">Tryck ↩︎ för att återställa</div>
    `;

    const doneList = $("doneList");
    const doneClearBtn = $("doneClearBtn");

    const restore = (id) => {
      const i = store.done.findIndex(x => x.id === id);
      if (i === -1) return;
      const item = store.done.splice(i, 1)[0];
      const origin = item.origin || "todo";
      const restored = { id: item.id, text: item.text, createdAt: item.createdAt || Date.now() };
      if (origin === "prio") restored.notes = item.notes || "";

      if (origin === "prio") store.prio.unshift(restored);
      else if (origin === "ideas") store.ideas.unshift(restored);
      else store.todo.unshift(restored);

      saveStore();
      draw();
    };

    const draw = () => {
      doneList.innerHTML = "";
      if (!store.done.length) {
        doneList.innerHTML = `<li class="miniHint">Inget slutfört ännu.</li>`;
        return;
      }

      for (const item of store.done) {
        const li = document.createElement("li");
        li.className = "itemRow";

        const left = document.createElement("div");
        left.style.display = "flex";
        left.style.alignItems = "center";
        left.style.gap = "10px";
        left.style.minWidth = "0";

        const back = document.createElement("button");
        back.className = "miniBtn";
        back.textContent = "↩︎";
        back.style.padding = "8px 10px";
        back.addEventListener("click", () => restore(item.id));

        const txt = document.createElement("div");
        txt.className = "itemText";
        txt.textContent = item.text;

        left.appendChild(back);
        left.appendChild(txt);

        const right = document.createElement("div");
        right.className = "itemMeta";
        right.textContent = item.doneAt ? fmt(item.doneAt) : "";

        li.appendChild(left);
        li.appendChild(right);
        doneList.appendChild(li);
      }
    };

    doneClearBtn.addEventListener("click", () => {
      store.done = [];
      saveStore();
      draw();
    });

    draw();
  }

  // ---------- Timer view (controls only; ring is on wheel) ----------
  let timerUiEls = null;

  function timerText() {
    const safeLeft = Number.isFinite(TIMER.left) ? Math.max(0, TIMER.left) : 0;
    const mm = Math.floor(safeLeft / 60);
    const ss = safeLeft % 60;
    return `${pad2(mm)}:${pad2(ss)}`;
  }

  function refreshTimerUIIfOpen(fromLoop = false) {
    if (!timerUiEls) return;
    const { tTime, tState, tStartBtn } = timerUiEls;
    if (tTime) tTime.textContent = timerText();
    if (tState) {
      if (!TIMER.running && TIMER.left === TIMER.total) tState.textContent = "Redo";
      else if (TIMER.running && TIMER.left > 0) tState.textContent = "Fokus…";
      else if (!TIMER.running && TIMER.left > 0) tState.textContent = "Pausad";
      else tState.textContent = "KLAR";
    }
    if (tStartBtn) tStartBtn.textContent = TIMER.running ? "Paus" : "Start";
    if (!fromLoop) updateWheelTimerProgress();
  }

  function renderTimer() {
    sheetTitle.textContent = "Timer";

    sheetContent.innerHTML = `
      <div class="card" style="padding:16px;">
        <div style="display:flex; flex-direction:column; align-items:center; text-align:center;">
          <div id="tTime" style="font-size:46px; font-weight:900;">${timerText()}</div>
          <div id="tState" class="miniHint" style="margin-top:6px;">Redo</div>

          <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; justify-content:center;">
            <button class="miniBtn" id="tStartBtn">Start</button>
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

    const tTime = $("tTime");
    const tState = $("tState");
    const tStartBtn = $("tStartBtn");
    const tResetBtn = $("tResetBtn");
    const tBtns = sheetContent.querySelectorAll("[data-tmin]");

    timerUiEls = { tTime, tState, tStartBtn };

    tStartBtn?.addEventListener("click", () => { startPauseTimer(); });
    tResetBtn?.addEventListener("click", () => { resetTimer(); });

    tBtns.forEach(btn => btn.addEventListener("click", () => setTimerMinutes(btn.dataset.tmin)));

    refreshTimerUIIfOpen();
  }

  // ---------- Main render switch ----------
  function renderView(id) {
    if (!sheetTitle || !sheetContent) return;

    sheetWrap?.classList.add("open");

    // timer ui refs reset unless timer view
    if (id !== "timer") timerUiEls = null;

    switch (id) {
      case "calendar": return renderCalendar();
      case "prio":     return renderPrio();
      case "weather":  return renderWeather();
      case "news":     return renderNews();
      case "todo":     return renderTodo();
      case "ideas":    return renderIdeas();
      case "done":     return renderDone();
      case "timer":    return renderTimer();
      default:
        sheetTitle.textContent = "Preview";
        sheetContent.innerHTML = `<div class="miniHint">Okänd vy.</div>`;
    }
  }

  // ---------- Init ----------
  setRotation(0, { silent: true });
  setPreview(0, { silent: true });
  closeSheet();
  updateWheelTimerProgress();
})();
