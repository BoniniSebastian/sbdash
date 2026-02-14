/* SB Dash v7 — iPhone portrait layout + Settings modal (City + Calendar ID) + Calendar auto-refresh 3 min */
(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- Date ----------
  const todayText = $("todayText");
  if (todayText) {
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE", { weekday: "long" });
    const date = now.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
    todayText.textContent = `${weekday} ${date}`;
  }

  // ---------- Haptics (iOS kan ignorera) ----------
  const canVibrate = !!navigator.vibrate;
  const tick = (ms = 8) => { if (canVibrate) navigator.vibrate(ms); };

  // ---------- Storage keys ----------
  const LS_APP = "sbdash_v7_store";
  const LS_CITY_NAME = "sbdash_city_name";
  const LS_CITY_LAT  = "sbdash_city_lat";
  const LS_CITY_LON  = "sbdash_city_lon";
  const LS_CAL_ID    = "sbdash_calendar_id";

  // Defaults
  const DEFAULT_CITY_NAME = "Stockholm";
  const DEFAULT_CITY_LAT = 59.3293;
  const DEFAULT_CITY_LON = 18.0686;

  const DEFAULT_CAL_ID = "ericssonbonini@gmail.com"; // <-- byt om du vill

  // ---------- App store ----------
  function load() {
    try {
      const raw = localStorage.getItem(LS_APP);
      const p = raw ? JSON.parse(raw) : {};
      return {
        todo: Array.isArray(p.todo) ? p.todo : [],
        done: Array.isArray(p.done) ? p.done : [],
        ideas: Array.isArray(p.ideas) ? p.ideas : [],
        super: Array.isArray(p.super) ? p.super : [],
      };
    } catch {
      return { todo: [], done: [], ideas: [], super: [] };
    }
  }
  const store = load();
  const save = () => localStorage.setItem(LS_APP, JSON.stringify(store));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const fmt = (ts) =>
    new Date(ts).toLocaleString("sv-SE", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });

  // ---------- Views ----------
  const VIEWS = ["prio", "todo", "ideas", "done", "news", "weather", "pomodoro"];
  let currentIndex = 0;

  const track = $("viewTrack");
  const nav = $("underNav");

  const dialEl = $("dial");
  const dialRing = $("dialRing");
  const dialIcon = $("dialIcon");

  // Vi använder samma ikon som TODO för prio (du sa inga nya ikoner)
  const ICONS = {
    prio: "assets/ui/icon-todo.svg",
    todo: "assets/ui/icon-todo.svg",
    ideas: "assets/ui/icon-ideas.svg",
    done: "assets/ui/icon-done.svg",
    news: "assets/ui/icon-news.svg",
    weather: "assets/ui/icon-weather.svg",
    pomodoro: "assets/ui/icon-pomodoro.svg",
  };

  function setViewByIndex(idx, { silent = false } = {}) {
    currentIndex = (idx + VIEWS.length) % VIEWS.length;
    const view = VIEWS[currentIndex];

    if (track) track.style.transform = `translateX(-${currentIndex * 100}%)`;

    if (nav) {
      [...nav.querySelectorAll(".navBtn")].forEach((b) =>
        b.classList.toggle("active", b.dataset.view === view)
      );
    }

    if (dialIcon && ICONS[view]) dialIcon.src = ICONS[view];

    if (!silent) syncRotationToIndex();
  }

  function setViewByName(view) {
    const i = VIEWS.indexOf(view);
    if (i !== -1) setViewByIndex(i);
  }

  if (nav) {
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest(".navBtn");
      if (!btn) return;
      setViewByName(btn.dataset.view);
    });
  }

  // ---------- Dial rotation + live icon + tick ----------
  let isDragging = false;
  let startAngle = 0;
  let currentRotation = 0;
  const STEP = 360 / VIEWS.length;
  let lastSector = 0;

  const angle = (cx, cy, mx, my) => Math.atan2(my - cy, mx - cx) * (180 / Math.PI);

  function setRotation(deg) {
    currentRotation = deg;
    if (dialRing) dialRing.style.transform = `rotate(${deg}deg)`;
  }

  function sectorFromRotation(deg) {
    const raw = Math.round(deg / STEP);
    return ((raw % VIEWS.length) + VIEWS.length) % VIEWS.length;
  }

  function syncRotationToIndex() {
    setRotation(currentIndex * STEP);
    lastSector = currentIndex;
  }

  function onDown(e) {
    if (!dialEl) return;
    isDragging = true;
    dialEl.setPointerCapture?.(e.pointerId);
    e.preventDefault();

    const r = dialEl.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    startAngle = angle(cx, cy, e.clientX, e.clientY) - currentRotation;
  }

  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    const r = dialEl.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    setRotation(angle(cx, cy, e.clientX, e.clientY) - startAngle);

    const s = sectorFromRotation(currentRotation);
    if (s !== lastSector) {
      lastSector = s;
      const v = VIEWS[s];
      if (dialIcon && ICONS[v]) dialIcon.src = ICONS[v];
      tick(8);
    }
  }

  function onUp(e) {
    if (!isDragging) return;
    isDragging = false;
    e.preventDefault();

    const finalIndex = sectorFromRotation(currentRotation);
    setViewByIndex(finalIndex, { silent: true });
    syncRotationToIndex();
    tick(10);
  }

  if (dialEl) {
    dialEl.addEventListener("pointerdown", onDown, { passive: false });
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: false });
    window.addEventListener("pointercancel", onUp, { passive: false });
  }

  // ---------- Calendar ----------
  function buildCalSrc(calId) {
    const src = encodeURIComponent((calId || DEFAULT_CAL_ID).trim());
    return `https://calendar.google.com/calendar/embed?src=${src}&mode=AGENDA&ctz=Europe%2FStockholm&hl=sv&bgcolor=%230b1118&showTitle=0&showTabs=0&showNav=0&showPrint=0&showCalendars=0&showDate=0`;
  }

  function applyCalendarFromSettings() {
    const calFrame = $("calFrame");
    if (!calFrame) return;

    const saved = (localStorage.getItem(LS_CAL_ID) || "").trim();
    calFrame.src = buildCalSrc(saved || DEFAULT_CAL_ID);
  }

  // Auto refresh every 3 minutes
  let calRefreshTimer = null;
  const CAL_REFRESH_MS = 3 * 60 * 1000;

  function startCalendarAutoRefresh() {
    const calFrame = $("calFrame");
    if (!calFrame) return;

    if (calRefreshTimer) clearInterval(calRefreshTimer);

    calRefreshTimer = setInterval(() => {
      if (document.hidden) return;
      calFrame.src = calFrame.src;
    }, CAL_REFRESH_MS);
  }

  // ---------- Settings modal ----------
  const openSettingsBtn = $("openSettingsBtn");
  const settingsOverlay = $("settingsOverlay");
  const settingsCloseBtn = $("settingsCloseBtn");
  const settingsCity = $("settingsCity");
  const settingsCalId = $("settingsCalId");
  const settingsHint = $("settingsHint");
  const settingsSaveBtn = $("settingsSaveBtn");
  const settingsResetBtn = $("settingsResetBtn");

  function openSettings() {
    if (settingsCity) settingsCity.value = (localStorage.getItem(LS_CITY_NAME) || DEFAULT_CITY_NAME);
    if (settingsCalId) settingsCalId.value = (localStorage.getItem(LS_CAL_ID) || DEFAULT_CAL_ID);
    if (settingsHint) settingsHint.textContent = "Sparas lokalt på den här enheten.";
    settingsOverlay?.classList.add("show");
    setTimeout(() => settingsCity?.focus(), 50);
  }

  function closeSettings() {
    settingsOverlay?.classList.remove("show");
  }

  async function geocodeCity(name) {
    const q = (name || "").trim();
    if (!q) return null;

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=sv&format=json`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("Geocode failed");
    const data = await r.json();
    const hit = data?.results?.[0];
    if (!hit) return null;

    return {
      name: hit.name,
      lat: hit.latitude,
      lon: hit.longitude
    };
  }

  async function saveSettings() {
    const cityName = (settingsCity?.value || "").trim();
    const calId = (settingsCalId?.value || "").trim();

    // Calendar
    if (calId) localStorage.setItem(LS_CAL_ID, calId);

    // City -> lat/lon
    if (cityName) {
      if (settingsHint) settingsHint.textContent = "Söker stad…";
      const geo = await geocodeCity(cityName);
      if (!geo) {
        if (settingsHint) settingsHint.textContent = "Hittade inte staden. Testa t.ex. 'Stockholm'.";
        return;
      }
      localStorage.setItem(LS_CITY_NAME, geo.name);
      localStorage.setItem(LS_CITY_LAT, String(geo.lat));
      localStorage.setItem(LS_CITY_LON, String(geo.lon));
    }

    // Apply
    applyCalendarFromSettings();
    startCalendarAutoRefresh();
    loadWeather();

    if (settingsHint) settingsHint.textContent = "Sparat ✅";
    setTimeout(closeSettings, 450);
  }

  function resetSettings() {
    localStorage.setItem(LS_CITY_NAME, DEFAULT_CITY_NAME);
    localStorage.setItem(LS_CITY_LAT, String(DEFAULT_CITY_LAT));
    localStorage.setItem(LS_CITY_LON, String(DEFAULT_CITY_LON));
    localStorage.setItem(LS_CAL_ID, DEFAULT_CAL_ID);

    applyCalendarFromSettings();
    startCalendarAutoRefresh();
    loadWeather();

    if (settingsHint) settingsHint.textContent = "Återställt ✅";
  }

  openSettingsBtn?.addEventListener("click", openSettings);
  settingsCloseBtn?.addEventListener("click", closeSettings);
  settingsOverlay?.addEventListener("click", (e) => { if (e.target === settingsOverlay) closeSettings(); });
  settingsSaveBtn?.addEventListener("click", () => saveSettings().catch(() => {
    if (settingsHint) settingsHint.textContent = "Kunde inte spara (nätverk?).";
  }));
  settingsResetBtn?.addEventListener("click", resetSettings);

  // ---------- Done origin-aware ----------
  function toDone(fromList, item) {
    const clean = { id: item.id, text: item.text, createdAt: item.createdAt || Date.now() };
    store.done.unshift({ ...clean, doneAt: Date.now(), origin: fromList });
  }

  function restoreFromDone(id) {
    const i = store.done.findIndex((x) => x.id === id);
    if (i === -1) return;
    const item = store.done.splice(i, 1)[0];
    const { doneAt, origin, ...rest } = item;

    const o = origin || "todo";
    if (o === "super") store.super.unshift(rest);
    else if (o === "ideas") store.ideas.unshift(rest);
    else store.todo.unshift(rest);

    save();
    renderAll();
  }

  // ---------- Swipe helper ----------
  function attachSwipe(el, onComplete) {
    const content = el.querySelector(".swipeContent");
    if (!content) return;

    let dragging = false;
    let pointerId = null;
    let startX = 0, startY = 0;
    let curX = 0;
    let locked = false;
    const threshold = 0.55;

    const setX = (x, animate) => {
      curX = x;
      content.style.transition = animate ? "transform 180ms ease" : "none";
      content.style.transform = `translateX(${x}px)`;
    };

    el.addEventListener("pointerdown", (e) => {
      dragging = true;
      locked = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      setX(0, true);
      content.setPointerCapture?.(pointerId);
    }, { passive:true });

    el.addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerId !== pointerId) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!locked) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          locked = true;
          if (Math.abs(dy) > Math.abs(dx)) {
            dragging = false;
            pointerId = null;
            setX(0, true);
            return;
          }
        } else return;
      }

      if (dx > 0) return; // only right->left
      e.preventDefault();

      const max = -Math.min(220, el.clientWidth * 0.9);
      setX(Math.max(dx, max), false);
    }, { passive:false });

    const finish = (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;

      const abs = Math.abs(curX);
      const need = el.clientWidth * threshold;

      if (abs >= need) {
        setX(-el.clientWidth, true);
        setTimeout(() => onComplete?.(), 140);
      } else {
        setX(0, true);
      }
      pointerId = null;
    };

    el.addEventListener("pointerup", finish, { passive:true });
    el.addEventListener("pointercancel", finish, { passive:true });
  }

  function mkSwipeItem({ text, meta }, onComplete, onClick) {
    const li = document.createElement("li");
    li.className = "swipeItem";

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

    if (onClick) {
      content.style.cursor = "pointer";
      content.addEventListener("click", () => onClick());
    }
    return li;
  }

  // ---------- PRIO (desktop + mobile) ----------
  const prioCount = $("prioCount");
  const mobilePrioCount = $("mobilePrioCount");

  const prioInput = $("prioInput");
  const prioAddBtn = $("prioAddBtn");
  const prioList = $("prioList");

  const prioInputMobile = $("prioInputMobile");
  const prioAddBtnMobile = $("prioAddBtnMobile");
  const prioListMobile = $("prioListMobile");

  // Prio modal
  const prioModalOverlay = $("prioModalOverlay");
  const prioModalCloseBtn = $("prioModalCloseBtn");
  const prioModalEdit = $("prioModalEdit");
  const prioModalDoneBtn = $("prioModalDoneBtn");

  let prioModalActiveId = null;
  let prioEditTimer = null;

  function openPrioModal(item) {
    prioModalActiveId = item.id;
    if (prioModalEdit) prioModalEdit.value = item.text || "";
    prioModalOverlay?.classList.add("show");
    setTimeout(() => prioModalEdit?.focus(), 50);
  }
  function closePrioModal() {
    prioModalActiveId = null;
    prioModalOverlay?.classList.remove("show");
  }

  prioModalOverlay?.addEventListener("click", (e) => { if (e.target === prioModalOverlay) closePrioModal(); });
  prioModalCloseBtn?.addEventListener("click", closePrioModal);

  function savePrioModalEdit() {
    if (!prioModalActiveId) return;
    const i = store.super.findIndex((x) => x.id === prioModalActiveId);
    if (i === -1) return;
    store.super[i].text = (prioModalEdit?.value || "").trim();
    save();
    renderPrio();
  }

  prioModalEdit?.addEventListener("input", () => {
    clearTimeout(prioEditTimer);
    prioEditTimer = setTimeout(savePrioModalEdit, 240);
  });

  function addPrio(text) {
    const t = (text || "").trim();
    if (!t) return;
    store.super.unshift({ id: uid(), text: t, createdAt: Date.now() });
    save();
    renderPrio();
  }

  function completePrioById(id) {
    const i = store.super.findIndex((x) => x.id === id);
    if (i === -1) return;
    const item = store.super.splice(i, 1)[0];
    toDone("super", item);
    save();
    renderPrio();
    renderDone();
  }

  prioModalDoneBtn?.addEventListener("click", () => {
    if (!prioModalActiveId) return closePrioModal();
    completePrioById(prioModalActiveId);
    closePrioModal();
  });

  function renderPrio() {
    const n = store.super.length;
    if (prioCount) prioCount.textContent = String(n);
    if (mobilePrioCount) mobilePrioCount.textContent = String(n);

    const renderList = (ul) => {
      if (!ul) return;
      ul.innerHTML = "";
      if (!store.super.length) {
        ul.innerHTML = `<li class="miniHint">Inget i Aktiv prio just nu.</li>`;
        return;
      }
      for (const item of store.super) {
        ul.appendChild(
          mkSwipeItem(
            { text: item.text, meta: fmt(item.createdAt) },
            () => completePrioById(item.id),
            () => openPrioModal(item)
          )
        );
      }
    };

    renderList(prioList);
    renderList(prioListMobile);
  }

  prioAddBtn?.addEventListener("click", () => {
    addPrio(prioInput?.value);
    if (prioInput) prioInput.value = "";
    prioInput?.focus();
  });
  prioInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addPrio(prioInput.value);
      prioInput.value = "";
    }
  });

  prioAddBtnMobile?.addEventListener("click", () => {
    addPrio(prioInputMobile?.value);
    if (prioInputMobile) prioInputMobile.value = "";
    prioInputMobile?.focus();
  });
  prioInputMobile?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addPrio(prioInputMobile.value);
      prioInputMobile.value = "";
    }
  });

  // ---------- TODO ----------
  const todoInput = $("todoInput");
  const todoAddBtn = $("todoAddBtn");
  const todoList = $("todoList");

  function addTodo(text) {
    const t = (text || "").trim();
    if (!t) return;
    store.todo.unshift({ id: uid(), text: t, createdAt: Date.now() });
    save();
    renderTodo();
  }

  function completeTodoById(id) {
    const i = store.todo.findIndex((x) => x.id === id);
    if (i === -1) return;
    const item = store.todo.splice(i, 1)[0];
    toDone("todo", item);
    save();
    renderTodo();
    renderDone();
  }

  function renderTodo() {
    if (!todoList) return;
    todoList.innerHTML = "";
    if (!store.todo.length) {
      todoList.innerHTML = `<li class="miniHint">Inga uppgifter just nu.</li>`;
      return;
    }
    for (const item of store.todo) {
      todoList.appendChild(
        mkSwipeItem({ text: item.text, meta: fmt(item.createdAt) }, () => completeTodoById(item.id), null)
      );
    }
  }

  todoAddBtn?.addEventListener("click", () => {
    addTodo(todoInput?.value);
    if (todoInput) todoInput.value = "";
    todoInput?.focus();
  });
  todoInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addTodo(todoInput.value);
      todoInput.value = "";
    }
  });

  // ---------- IDEAS ----------
  const ideaInput = $("ideaInput");
  const ideaAddBtn = $("ideaAddBtn");
  const ideasList = $("ideasList");

  function addIdea(text) {
    const t = (text || "").trim();
    if (!t) return;
    store.ideas.unshift({ id: uid(), text: t, createdAt: Date.now() });
    save();
    renderIdeas();
  }

  function archiveIdeaById(id) {
    const i = store.ideas.findIndex((x) => x.id === id);
    if (i === -1) return;
    const item = store.ideas.splice(i, 1)[0];
    toDone("ideas", item);
    save();
    renderIdeas();
    renderDone();
  }

  function renderIdeas() {
    if (!ideasList) return;
    ideasList.innerHTML = "";
    if (!store.ideas.length) {
      ideasList.innerHTML = `<li class="miniHint">Inga idéer sparade ännu.</li>`;
      return;
    }
    for (const item of store.ideas) {
      ideasList.appendChild(
        mkSwipeItem({ text: item.text, meta: fmt(item.createdAt) }, () => archiveIdeaById(item.id), null)
      );
    }
  }

  ideaAddBtn?.addEventListener("click", () => {
    addIdea(ideaInput?.value);
    if (ideaInput) ideaInput.value = "";
    ideaInput?.focus();
  });
  ideaInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addIdea(ideaInput.value);
      ideaInput.value = "";
    }
  });

  // ---------- DONE ----------
  const doneList = $("doneList");
  const doneClearBtn = $("doneClearBtn");

  function renderDone() {
    if (!doneList) return;
    doneList.innerHTML = "";

    if (!store.done.length) {
      doneList.innerHTML = `<li class="miniHint">Inget slutfört ännu.</li>`;
      return;
    }

    for (const item of store.done) {
      const li = document.createElement("li");
      li.className = "miniRow";

      const left = document.createElement("div");
      left.className = "miniRowLeft";

      const back = document.createElement("button");
      back.className = "miniBtn ghost";
      back.textContent = "↩︎";
      back.style.padding = "6px 10px";
      back.style.fontSize = "12px";
      back.addEventListener("click", () => restoreFromDone(item.id));

      const txt = document.createElement("div");
      txt.className = "miniText";
      txt.textContent = item.text;

      left.appendChild(back);
      left.appendChild(txt);

      const right = document.createElement("div");
      right.className = "miniMeta";
      right.textContent = fmt(item.doneAt);

      li.appendChild(left);
      li.appendChild(right);
      doneList.appendChild(li);
    }
  }

  doneClearBtn?.addEventListener("click", () => {
    store.done = [];
    save();
    renderDone();
  });

  // ---------- NEWS ----------
  const RSS_NEWS = "https://news.google.com/rss?hl=sv&gl=SE&ceid=SE:sv";
  const newsListEl = $("newsList");
  const newsMetaEl = $("newsMeta");
  const newsPullHint = $("newsPullHint");
  const newsPage = $("newsPage");
  const NEWS_CACHE_KEY = "sbdash_news_cache_v7";

  const PROXIES = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://r.jina.ai/http://${u.replace(/^https?:\/\//, "")}`,
    (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  ];

  async function fetchTextFallback(url) {
    let last;
    for (const p of PROXIES) {
      try {
        const u = p(url);
        const r = await fetch(u, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const t = await r.text();
        if (u.includes("/get?url=")) {
          const obj = JSON.parse(t);
          if (obj?.contents) return obj.contents;
          throw new Error("No contents");
        }
        return t;
      } catch (e) { last = e; }
    }
    throw last || new Error("All proxies failed");
  }

  function saveCache(key, items) {
    try { localStorage.setItem(key, JSON.stringify({ updatedAt: Date.now(), items })); } catch {}
  }
  function loadCache(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
  }

  function parseRss(xml, max = 10) {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return Array.from(doc.querySelectorAll("item"))
      .slice(0, max)
      .map((it) => ({
        title: it.querySelector("title")?.textContent?.trim() || "Nyhet",
        link: it.querySelector("link")?.textContent?.trim() || "#",
        pubDate: it.querySelector("pubDate")?.textContent?.trim() || "",
      }));
  }

  function renderNews(items, metaText) {
    if (!newsListEl || !newsMetaEl) return;
    newsMetaEl.textContent = metaText || "";
    newsListEl.innerHTML = "";

    if (!items?.length) {
      newsListEl.innerHTML = `<li class="miniHint">Inget att visa just nu.</li>`;
      return;
    }

    for (const it of items) {
      const pubDate = it.pubDate ? new Date(it.pubDate) : null;

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
      a.style.overflow = "hidden";
      a.style.textOverflow = "ellipsis";
      a.style.whiteSpace = "nowrap";
      left.appendChild(a);

      const right = document.createElement("div");
      right.className = "miniMeta";
      right.textContent =
        pubDate && !isNaN(pubDate.getTime())
          ? pubDate.toLocaleString("sv-SE", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })
          : "";

      li.appendChild(left);
      li.appendChild(right);
      newsListEl.appendChild(li);
    }
  }

  let newsLoading = false;
  async function loadNews() {
    if (newsLoading) return;
    newsLoading = true;
    if (newsMetaEl) newsMetaEl.textContent = "Laddar…";

    try {
      const xml = await fetchTextFallback(RSS_NEWS);
      const items = parseRss(xml, 10);
      renderNews(items, `Uppdaterad: ${new Date().toLocaleString("sv-SE")}`);
      saveCache(NEWS_CACHE_KEY, items);
    } catch {
      const c = loadCache(NEWS_CACHE_KEY);
      if (c?.items?.length) {
        renderNews(c.items, `Visar cache (senast: ${new Date(c.updatedAt).toLocaleString("sv-SE")})`);
      } else {
        renderNews([], "Nyheter kunde inte laddas just nu.");
      }
    } finally {
      newsLoading = false;
      if (newsPullHint) newsPullHint.textContent = "Dra ned för att uppdatera";
    }
  }

  function attachPullToRefresh(pageEl, hintEl, onRefresh) {
    if (!pageEl) return;
    let startY = 0;
    let pulling = false;

    pageEl.addEventListener("touchstart", (e) => {
      if (pageEl.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    }, { passive:true });

    pageEl.addEventListener("touchmove", (e) => {
      if (!pulling) return;
      if (pageEl.scrollTop > 0) return;

      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) return;

      if (dy > 10) e.preventDefault();
      if (hintEl) hintEl.textContent = dy > 70 ? "Släpp för att uppdatera" : "Dra ned för att uppdatera";
    }, { passive:false });

    pageEl.addEventListener("touchend", (e) => {
      if (!pulling) return;
      pulling = false;

      const endY = (e.changedTouches?.[0]?.clientY ?? startY);
      const dy = endY - startY;

      if (pageEl.scrollTop === 0 && dy > 70) {
        if (hintEl) hintEl.textContent = "Uppdaterar…";
        onRefresh();
      } else {
        if (hintEl) hintEl.textContent = "Dra ned för att uppdatera";
      }
    }, { passive:true });
  }
  attachPullToRefresh(newsPage, newsPullHint, loadNews);

  // ---------- Weather ----------
const weatherIconEl = $("weatherIcon");
const weatherTempEl = $("weatherTemp");
const weatherDescEl = $("weatherDesc");
const weatherWindEl = $("weatherWind");
const weatherPlaceEl = $("weatherPlace");
const weatherUpdatedEl = $("weatherUpdated");
const weatherRefreshBtn = $("weatherRefreshBtn");
const tomIconEl = $("tomIcon");
const tomTextEl = $("tomText");

const WEATHER_CACHE_KEY = "sbdash_weather_cache_v4";

function iconForCode(code) {
  if (code === 0) return "☀️";
  if (code === 1 || code === 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75].includes(code)) return "🌨️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "⛅️";
}
function textForCode(code) {
  const m = {
    0: "Klart",
    1: "Mestadels klart",
    2: "Delvis molnigt",
    3: "Mulet",
    45: "Dimma",
    48: "Isdimma",
    51: "Duggregn (lätt)",
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

function saveWeatherCache(payload) {
  try { localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload)); } catch {}
}
function loadWeatherCache() {
  try { return JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || "null"); } catch { return null; }
}

function setWeatherUI({ t, w, code, placeLabel, updatedTs, tomCode, tomMin, tomMax }) {
  if (weatherIconEl) weatherIconEl.textContent = iconForCode(code);
  if (weatherTempEl) weatherTempEl.textContent = `${t}°`;
  if (weatherDescEl) weatherDescEl.textContent = textForCode(code);
  if (weatherWindEl) weatherWindEl.textContent = `${w} m/s`;
  if (weatherPlaceEl) weatherPlaceEl.textContent = placeLabel;

  if (weatherUpdatedEl) {
    weatherUpdatedEl.textContent = new Date(updatedTs).toLocaleString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  }

  if (tomIconEl) tomIconEl.textContent = iconForCode(tomCode);
  if (tomTextEl) tomTextEl.textContent = `${textForCode(tomCode)} • ${tomMin}°–${tomMax}°`;
}

// Rimlighetsfilter (så vi aldrig visar tokvärden)
function clampReasonableTempC(t) {
  // Sverige: vi tillåter stort spann, men stoppar absurda fel
  if (typeof t !== "number" || Number.isNaN(t)) return null;
  if (t > 35 || t < -40) return null;
  return t;
}

async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    `&current=temperature_2m,wind_speed_10m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&forecast_days=2` +
    `&temperature_unit=celsius` +           // <-- tvinga Celsius
    `&wind_speed_unit=ms` +
    `&timezone=Europe%2FStockholm`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("Weather fetch failed");
  return r.json();
}

async function loadWeather() {
  if (weatherDescEl) weatherDescEl.textContent = "Laddar…";

  const nowTs = Date.now();

  // 1) Försök geolocation
  const tryGeo = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("no geolocation"));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 7000,
        maximumAge: 30 * 60 * 1000,
      });
    });

  try {
    let lat = 59.3293, lon = 18.0686;
    let placeLabel = "Stockholm (fallback)";

    try {
      const pos = await tryGeo();
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
      placeLabel = "Din plats";
    } catch {
      // geo fail => Stockholm fallback
    }

    const data = await fetchWeather(lat, lon);

    const cur = data.current || {};
    const daily = data.daily || {};

    const rawT = Math.round(cur.temperature_2m);
    const rawW = Math.round(cur.wind_speed_10m);
    const code = Number(cur.weather_code);

    const safeT = clampReasonableTempC(rawT);
    if (safeT === null) throw new Error("unreasonable temp");

    // Imorgon
    const tomCode = Number(daily.weather_code?.[1] ?? code);
    const tomMax = Math.round(daily.temperature_2m_max?.[1] ?? safeT);
    const tomMin = Math.round(daily.temperature_2m_min?.[1] ?? safeT);

    const payload = {
      t: safeT,
      w: Number.isFinite(rawW) ? rawW : 0,
      code: Number.isFinite(code) ? code : 3,
      placeLabel,
      updatedTs: nowTs,
      tomCode: Number.isFinite(tomCode) ? tomCode : 3,
      tomMin: Number.isFinite(tomMin) ? tomMin : safeT,
      tomMax: Number.isFinite(tomMax) ? tomMax : safeT,
    };

    setWeatherUI(payload);
    saveWeatherCache(payload);
  } catch (e) {
    // 2) Om något strular: visa cache
    const c = loadWeatherCache();
    if (c) {
      setWeatherUI({ ...c, placeLabel: (c.placeLabel || "Senaste") + " • cache" });
    } else {
      if (weatherDescEl) weatherDescEl.textContent = "Kunde inte ladda väder.";
      if (weatherTempEl) weatherTempEl.textContent = "--°";
      if (weatherPlaceEl) weatherPlaceEl.textContent = "—";
      if (weatherIconEl) weatherIconEl.textContent = "⛅️";
    }
  }
}

if (weatherRefreshBtn) weatherRefreshBtn.addEventListener("click", loadWeather);
  // ---------- POMODORO ----------
  const pomoProg = $("pomoProg");
  const pomoTime = $("pomoTime");
  const pomoSub = $("pomoSub");
  const pomoStartBtn = $("pomoStartBtn");
  const pomoResetBtn = $("pomoResetBtn");
  const pomoBtns = document.querySelectorAll("[data-pomo]");

  const R = 92;
  const C = 2 * Math.PI * R;

  if (pomoProg) {
    pomoProg.style.strokeDasharray = String(C);
    pomoProg.style.strokeDashoffset = "0";
  }

  let total = 5 * 60;
  let left = total;
  let running = false;
  let t0 = 0;
  let pausedLeft = left;
  let raf = 0;

  const pad2 = (n) => String(n).padStart(2, "0");

  // FIX: rätt riktning
  const setStroke = (pct) => {
    if (!pomoProg) return;
    pomoProg.style.strokeDashoffset = String(-C * (1 - pct));
  };

  const setColor = (pct) => {
    if (!pomoProg) return;
    if (pct > 0.40) pomoProg.style.stroke = "rgba(0,209,255,.88)";
    else if (pct > 0.15) pomoProg.style.stroke = "rgba(255,165,0,.88)";
    else pomoProg.style.stroke = "rgba(255,70,70,.88)";
  };

  function renderPomo() {
    const mm = Math.floor(left / 60);
    const ss = left % 60;
    if (pomoTime) pomoTime.textContent = `${pad2(mm)}:${pad2(ss)}`;

    const pct = total ? left / total : 0;
    const p = Math.max(0, Math.min(1, pct));
    setStroke(p);
    setColor(p);

    if (pomoSub) {
      if (!running && left === total) pomoSub.textContent = "Redo";
      else if (running) pomoSub.textContent = "Fokus…";
      else if (!running && left > 0) pomoSub.textContent = "Pausad";
      else pomoSub.textContent = "KLAR";
    }
  }

  function loop() {
    if (!running) return;
    const elapsed = (performance.now() - t0) / 1000;
    left = Math.max(0, Math.round(pausedLeft - elapsed));
    renderPomo();
    if (left <= 0) {
      running = false;
      if (pomoStartBtn) pomoStartBtn.textContent = "Start";
      if (canVibrate) navigator.vibrate([20,40,20]);
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function startPause() {
    if (running) {
      running = false;
      if (pomoStartBtn) pomoStartBtn.textContent = "Start";
      pausedLeft = left;
      renderPomo();
      return;
    }
    if (left <= 0) { left = total; pausedLeft = left; }
    running = true;
    if (pomoStartBtn) pomoStartBtn.textContent = "Paus";
    t0 = performance.now();
    tick(10);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function setMinutes(min) {
    running = false;
    cancelAnimationFrame(raf);
    if (pomoStartBtn) pomoStartBtn.textContent = "Start";
    total = min * 60;
    left = total;
    pausedLeft = left;
    renderPomo();
    tick(8);
  }

  function resetPomo() {
    running = false;
    cancelAnimationFrame(raf);
    if (pomoStartBtn) pomoStartBtn.textContent = "Start";
    left = total;
    pausedLeft = left;
    renderPomo();
    tick(8);
  }

  pomoStartBtn?.addEventListener("click", startPause);
  pomoResetBtn?.addEventListener("click", resetPomo);
  pomoBtns.forEach((btn) => btn.addEventListener("click", () => setMinutes(Number(btn.dataset.pomo))));

  // ---------- Init ----------
  function renderAll() {
    renderPrio();
    renderTodo();
    renderIdeas();
    renderDone();
    renderPomo();
  }

  function renderPomo() { renderPomo(); } // placeholder to keep structure (overwritten below)
  // (fix: above line would recurse if left; so we DO NOT use it.)
  // We'll just call renderPomo() directly where needed.

  // Render functions already defined above except pomo; call direct:
  function renderAllSafe() {
    renderPrio();
    renderTodo();
    renderIdeas();
    renderDone();
    renderPomo();
  }

  // Start
  setViewByIndex(0);
  syncRotationToIndex();

  applyCalendarFromSettings();
  startCalendarAutoRefresh();

  loadWeather();
  setInterval(loadWeather, 30 * 60 * 1000);

  loadNews();
  setInterval(loadNews, 10 * 60 * 1000);

  renderAllSafe();
  renderPomo();
})();
