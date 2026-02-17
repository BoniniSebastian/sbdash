(() => {
  const $ = (id) => document.getElementById(id);

  /* =========================
     START VIEW ELEMENTS
  ========================= */
  const startInfo = $("startInfo");
  const startTimeEl = $("startTime");
  const startDayEl = $("startDay");
  const startDateEl = $("startDate");
  const startPrioCountEl = $("startPrioCount");
  const centerLabelEl = $("centerLabel");

  /* =========================
     TOP ELEMENTS
  ========================= */
  const topDate = $("topDate");
  const topRight = document.querySelector(".topRight");
  if (topRight) topRight.textContent = ""; // remove Preview

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
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "");

  const fmt = (ts) =>
    new Date(ts).toLocaleString("sv-SE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  /* =========================
     DATE/TIME UPDATES
  ========================= */
  function updateTopDate() {
    if (!topDate) return;
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE", { weekday: "long" });
    const date = now.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
    topDate.textContent = `${weekday} ${date}`;
  }

  function updateStartInfo() {
    const now = new Date();

    if (startTimeEl) startTimeEl.textContent = now.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    if (startDayEl) startDayEl.textContent = now.toLocaleDateString("sv-SE", { weekday: "long" });
    if (startDateEl) startDateEl.textContent = now.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });

    if (startPrioCountEl) {
      const c = Array.isArray(store.prio) ? store.prio.length : 0;
      startPrioCountEl.textContent = `Aktiva prios: ${c}`;
    }
  }

  updateTopDate();
  updateStartInfo();
  setInterval(updateStartInfo, 1000 * 15); // var 15:e sekund räcker
  setInterval(updateTopDate, 1000 * 60);  // var minut

  /* =========================
     WHEEL + SHEET
  ========================= */
  const wheel = $("wheel");
  const wheelRing = document.querySelector(".wheelRing");
  const wheelIcon = $("wheelIcon");

  const sheetWrap = $("sheetWrap");
  const sheetTitle = $("sheetTitle");
  const sheetContent = $("sheetContent");

  // Views (DONE removed from wheel)
  const VIEW_DEFS = [
    { id: "calendar", title: "KALENDER", icon: "assets/ui/icon-calendar.svg" },
    { id: "prio", title: "AKTIV PRIO", icon: "assets/ui/icon-prio.svg" },
    { id: "weather", title: "VÄDER", icon: "assets/ui/icon-weather.svg" },
    { id: "news", title: "NYHETER", icon: "assets/ui/icon-news.svg" },
    { id: "todo", title: "ATT GÖRA", icon: "assets/ui/icon-todo.svg" },
    { id: "ideas", title: "IDÉER", icon: "assets/ui/icon-ideas.svg" },
    { id: "timer", title: "TIMER", icon: "assets/ui/icon-pomodoro.svg" },
  ];

  let activeIndex = 0;
  const STEP = 360 / VIEW_DEFS.length;
  let rotationDeg = 0;

  function setCenterLabel(text) {
    if (!centerLabelEl) return;
    centerLabelEl.textContent = text || "";
  }

  function setPreview(index, { silent = false } = {}) {
    activeIndex = (index + VIEW_DEFS.length) % VIEW_DEFS.length;
    const v = VIEW_DEFS[activeIndex];

    if (wheelIcon) wheelIcon.src = v.icon;
    setCenterLabel(v.title);
  }

  function sectorFromDeg(deg) {
    const raw = Math.round(deg / STEP);
    const idx = ((raw % VIEW_DEFS.length) + VIEW_DEFS.length) % VIEW_DEFS.length;
    return idx;
  }

  function setRotation(deg) {
    rotationDeg = deg;
    if (wheelRing) wheelRing.style.transform = `rotate(${deg}deg)`;
    const idx = sectorFromDeg(deg);
    setPreview(idx, { silent: true });
  }

  function openSheet() {
    sheetWrap?.classList.add("open");
    if (startInfo) startInfo.style.opacity = "0";
    if (centerLabelEl) centerLabelEl.style.opacity = "0";
    renderView(VIEW_DEFS[activeIndex].id);
  }

  function closeSheet() {
    sheetWrap?.classList.remove("open");
    if (startInfo) startInfo.style.opacity = "1";
    if (centerLabelEl) centerLabelEl.style.opacity = "1";
  }

  // click to open
  wheel?.addEventListener("click", openSheet);

  // drag rotate (simple)
  let dragging = false;
  let startAngle = 0;
  let startX = 0;
  let startY = 0;
  let didDrag = false;

  function angle(cx, cy, x, y) {
    return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
  }

  wheel?.addEventListener("pointerdown", (e) => {
    dragging = true;
    didDrag = false;
    startX = e.clientX;
    startY = e.clientY;

    const r = wheel.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    startAngle = angle(cx, cy, e.clientX, e.clientY) - rotationDeg;

    wheel.setPointerCapture?.(e.pointerId);
  }, { passive: true });

  wheel?.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
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

    // snap
    const idx = sectorFromDeg(rotationDeg);
    setRotation(idx * STEP);

    if (!didDrag) openSheet();
  }, { passive: true });

  /* =========================
     SWIPE (stable)
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
     HEADER RIGHT: "Visa slutförda" + icon
  ========================= */
  function setSheetTitleWithDone(label) {
    if (!sheetTitle) return;
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
     LISTS
  ========================= */
  function renderList(type, label) {
    setSheetTitleWithDone(label);

    sheetContent.innerHTML = `
      <div class="miniForm">
        <input id="input" class="miniInput" placeholder="Skriv..." />
        <button id="add" class="miniBtn miniBtnIcon">+</button>
      </div>
      <ul id="list" class="miniList"></ul>
    `;

    const input = $("input");
    const add = $("add");
    const list = $("list");

    add.onclick = () => {
      const t = (input.value || "").trim();
      if (!t) return;
      store[type].unshift({ id: uid(), text: t, createdAt: Date.now() });
      saveStore();
      input.value = "";
      updateStartInfo();
      draw();
    };

    function complete(id) {
      const i = store[type].findIndex((x) => x.id === id);
      if (i === -1) return;
      const item = store[type].splice(i, 1)[0];
      store.done.unshift({ ...item, origin: type, doneAt: Date.now() });
      saveStore();
      updateStartInfo();
      draw();
    }

    function draw() {
      list.innerHTML = "";
      store[type].forEach((item) => {
        list.appendChild(
          mkSwipeItem(
            { text: item.text, meta: fmt(item.createdAt) },
            () => complete(item.id),
            () => openModal(item)
          )
        );
      });
    }

    draw();
  }

  function renderDone() {
    if (sheetTitle) sheetTitle.textContent = "Slutförda";
    sheetContent.innerHTML = `<ul id="doneList" class="miniList"></ul>`;
    const list = $("doneList");

    store.done.forEach((item) => {
      const li = document.createElement("li");
      li.className = "itemRow";
      li.innerHTML = `
        <div class="itemText">${item.text}</div>
        <div class="itemMeta">${fmt(item.doneAt)}</div>
      `;
      list.appendChild(li);
    });
  }

  /* =========================
     CALENDAR (taller)
  ========================= */
  function renderCalendar() {
    if (sheetTitle) sheetTitle.textContent = "Kalender";
    sheetContent.innerHTML = `
      <div class="card">
        <div class="calScale">
          <iframe class="calFrame"
            src="https://calendar.google.com/calendar/embed?mode=AGENDA&ctz=Europe%2FStockholm&hl=sv"
            frameborder="0"></iframe>
        </div>
      </div>
    `;
  }

  /* =========================
     WEATHER (compact + more)
  ========================= */
  async function renderWeather() {
    if (sheetTitle) sheetTitle.textContent = "Väder";
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
      `&hourly=temperature_2m,precipitation_probability,wind_speed_10m` +
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

    $("wForecast").innerHTML = temps
      .map((t, i) => {
        return `
          <div class="wxMini">
            <div class="wxMiniTop">+${i}h</div>
            <div class="wxMiniTemp">${Math.round(t)}°</div>
            <div class="wxMiniPop">${pop[i]}%</div>
          </div>
        `;
      })
      .join("");
  }

  /* =========================
     VIEW SWITCH
  ========================= */
  function renderView(id) {
    if (id === "prio") return renderList("prio", "Aktiv prio");
    if (id === "todo") return renderList("todo", "Att göra");
    if (id === "ideas") return renderList("ideas", "Idéer");
    if (id === "calendar") return renderCalendar();
    if (id === "weather") return renderWeather();
    if (id === "news") { if (sheetTitle) sheetTitle.textContent = "Nyheter"; sheetContent.innerHTML = `<div class="miniHint">Kommer snart.</div>`; return; }
    if (id === "timer") { if (sheetTitle) sheetTitle.textContent = "Timer"; sheetContent.innerHTML = `<div class="miniHint">Kommer snart.</div>`; return; }
  }

  // init wheel preview
  setRotation(0);
  setPreview(0);

})();
