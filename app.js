/* SB Dash v1 — swipe lists + origin restore + weather tomorrow + news favicons */
(() => {
  const $ = (id) => document.getElementById(id);

  // ---------------- Dates ----------------
  const todayText = $("todayText");
  if (todayText) {
    const d = new Date();
    const w = d.toLocaleDateString("sv-SE", { weekday: "long" });
    const dt = d.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
    todayText.textContent = `${w} ${dt}`;
  }

  // ---------------- Views ----------------
  const VIEWS = ["weather", "news", "todo", "ideas", "done"];
  let currentIndex = 0;

  const track = $("viewTrack");
  const nav = $("underNav");
  const dialIcon = document.querySelector(".dialIcon");

  const ICONS = {
    weather: "assets/ui/icon-weather.svg",
    news: "assets/ui/icon-news.svg",
    todo: "assets/ui/icon-todo.svg",
    ideas: "assets/ui/icon-ideas.svg",
    done: "assets/ui/icon-done.svg",
  };

  function setViewByIndex(idx) {
    currentIndex = (idx + VIEWS.length) % VIEWS.length;
    const view = VIEWS[currentIndex];

    if (track) track.style.transform = `translateX(-${currentIndex * 100}%)`;

    if (nav) {
      [...nav.querySelectorAll(".navBtn")].forEach((b) =>
        b.classList.toggle("active", b.dataset.view === view)
      );
    }

    if (dialIcon && ICONS[view]) dialIcon.src = ICONS[view];
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

  // Desktop: wheel switches pages over main panel
  const mainPanel = document.querySelector(".mainPanel");
  let wheelCooldown = false;
  if (mainPanel) {
    mainPanel.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (wheelCooldown) return;
        wheelCooldown = true;
        setViewByIndex(currentIndex + (e.deltaY > 0 ? 1 : -1));
        setTimeout(() => (wheelCooldown = false), 320);
      },
      { passive: false }
    );
  }

  // ---------------- Storage ----------------
  const LS_KEY = "sbdash_v2";
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
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
  const save = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const fmt = (ts) =>
    new Date(ts).toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

  // ---------------- Swipe helper ----------------
  function attachSwipe(el, onComplete) {
    const content = el.querySelector(".swipeContent");
    if (!content) return;

    let dragging = false;
    let pointerId = null;
    let startX = 0, startY = 0;
    let curX = 0;
    let locked = false; // once we decide horiz/vert

    const threshold = 0.55; // ~60% swipe

    const setX = (x, animate) => {
      curX = x;
      content.style.transition = animate ? "transform 180ms ease" : "none";
      content.style.transform = `translateX(${x}px)`;
    };

    const onDown = (e) => {
      dragging = true;
      locked = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      setX(0, true);
      content.setPointerCapture?.(pointerId);
    };

    const onMove = (e) => {
      if (!dragging || e.pointerId !== pointerId) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!locked) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          // lock direction
          locked = true;
          // if mostly vertical → don't swipe
          if (Math.abs(dy) > Math.abs(dx)) {
            dragging = false;
            pointerId = null;
            setX(0, true);
            return;
          }
        } else {
          return;
        }
      }

      // only allow right-to-left
      if (dx > 0) return;

      e.preventDefault();
      const max = -Math.min(220, el.clientWidth * 0.9);
      const next = Math.max(dx, max);
      setX(next, false);
    };

    const onUp = (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;

      const abs = Math.abs(curX);
      const need = el.clientWidth * threshold;

      if (abs >= need) {
        // swipe complete
        const off = -el.clientWidth;
        setX(off, true);
        setTimeout(() => onComplete?.(), 140);
      } else {
        setX(0, true);
      }

      pointerId = null;
    };

    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointermove", onMove, { passive: false });
    el.addEventListener("pointerup", onUp, { passive: true });
    el.addEventListener("pointercancel", onUp, { passive: true });
  }

  function mkSwipeItem({ text, meta }, onComplete, onClick) {
    const li = document.createElement("li");
    li.className = "swipeItem";

    const under = document.createElement("div");
    under.className = "swipeUnder";
    under.textContent = "SLUTFÖR";

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
      content.addEventListener("click", (e) => {
        // prevent click when user is swiping a bit
        if (Math.abs(curSwipeX(content)) > 6) return;
        onClick(e);
      });
    }

    return li;
  }

  function curSwipeX(contentEl) {
    const tr = contentEl.style.transform || "";
    const m = tr.match(/translateX\(([-0-9.]+)px\)/);
    return m ? Number(m[1]) : 0;
  }

  // ---------------- Origin-aware Done ----------------
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

  // ---------------- Todo ----------------
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
      const li = mkSwipeItem(
        { text: item.text, meta: fmt(item.createdAt) },
        () => completeTodoById(item.id),
        null
      );
      todoList.appendChild(li);
    }
  }

  if (todoAddBtn && todoInput) {
    todoAddBtn.addEventListener("click", () => {
      addTodo(todoInput.value);
      todoInput.value = "";
      todoInput.focus();
    });
    todoInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        addTodo(todoInput.value);
        todoInput.value = "";
      }
    });
  }

  // ---------------- Ideas (swipe = archive to done) ----------------
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
      const li = mkSwipeItem(
        { text: item.text, meta: fmt(item.createdAt) },
        () => archiveIdeaById(item.id),
        null
      );
      ideasList.appendChild(li);
    }
  }

  if (ideaAddBtn && ideaInput) {
    ideaAddBtn.addEventListener("click", () => {
      addIdea(ideaInput.value);
      ideaInput.value = "";
      ideaInput.focus();
    });
    ideaInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        addIdea(ideaInput.value);
        ideaInput.value = "";
      }
    });
  }

  // ---------------- Aktiv prio + modal ----------------
  const prioInput = $("prioInput");
  const prioAddBtn = $("prioAddBtn");
  const prioList = $("prioList");
  const prioCount = $("prioCount");

  const modalOverlay = $("modalOverlay");
  const modalBody = $("modalBody");
  const modalCloseBtn = $("modalCloseBtn");
  const modalOkBtn = $("modalOkBtn");
  const modalDoneBtn = $("modalDoneBtn");

  let modalActiveId = null;

  function openModalForPrio(item) {
    modalActiveId = item.id;
    if (modalBody) modalBody.textContent = item.text;
    if (modalOverlay) modalOverlay.classList.add("show");
  }
  function closeModal() {
    modalActiveId = null;
    if (modalOverlay) modalOverlay.classList.remove("show");
  }

  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (modalOkBtn) modalOkBtn.addEventListener("click", closeModal);

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

  if (modalDoneBtn) {
    modalDoneBtn.addEventListener("click", () => {
      if (!modalActiveId) return closeModal();
      completePrioById(modalActiveId);
      closeModal();
    });
  }

  function renderPrio() {
    if (prioCount) prioCount.textContent = String(store.super.length);
    if (!prioList) return;
    prioList.innerHTML = "";

    if (!store.super.length) {
      prioList.innerHTML = `<li class="miniHint">Inget i Aktiv prio just nu.</li>`;
      return;
    }

    for (const item of store.super) {
      const li = mkSwipeItem(
        { text: item.text, meta: fmt(item.createdAt) },
        () => completePrioById(item.id),
        () => openModalForPrio(item)
      );
      prioList.appendChild(li);
    }
  }

  if (prioAddBtn && prioInput) {
    prioAddBtn.addEventListener("click", () => {
      addPrio(prioInput.value);
      prioInput.value = "";
      prioInput.focus();
    });
    prioInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        addPrio(prioInput.value);
        prioInput.value = "";
      }
    });
  }

  // ---------------- Done ----------------
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
      li.className = "swipeItem";

      const under = document.createElement("div");
      under.className = "swipeUnder";
      under.textContent = "ÅTERSTÄLL";

      const content = document.createElement("div");
      content.className = "swipeContent";

      const left = document.createElement("div");
      left.className = "swipeLeft";

      const back = document.createElement("button");
      back.className = "miniBtn ghost";
      back.textContent = "↩︎";
      back.style.padding = "6px 10px";
      back.style.fontSize = "12px";
      back.addEventListener("click", () => restoreFromDone(item.id));

      const txt = document.createElement("div");
      txt.className = "swipeText";
      txt.textContent = item.text;

      left.appendChild(back);
      left.appendChild(txt);

      const right = document.createElement("div");
      right.className = "swipeRight";

      const meta = document.createElement("div");
      meta.className = "miniMeta";
      meta.textContent = fmt(item.doneAt);

      right.appendChild(meta);

      content.appendChild(left);
      content.appendChild(right);

      li.appendChild(under);
      li.appendChild(content);

      doneList.appendChild(li);
    }
  }

  if (doneClearBtn) {
    doneClearBtn.addEventListener("click", () => {
      store.done = [];
      save();
      renderDone();
    });
  }

  // ---------------- News (RSS + favicon) ----------------
  const RSS_URL = "https://news.google.com/rss?hl=sv&gl=SE&ceid=SE:sv";
  const NEWS_MAX = 12;
  const newsListEl = $("newsList");
  const newsMetaEl = $("newsMeta");
  const newsRefreshBtn = $("newsRefreshBtn");
  const NEWS_CACHE_KEY = "sbdash_news_cache_v2";

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
      } catch (e) {
        last = e;
      }
    }
    throw last || new Error("All proxies failed");
  }

  function parseRss(xml) {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return Array.from(doc.querySelectorAll("item"))
      .slice(0, NEWS_MAX)
      .map((it) => ({
        title: it.querySelector("title")?.textContent?.trim() || "Nyhet",
        link: it.querySelector("link")?.textContent?.trim() || "#",
        pubDate: it.querySelector("pubDate")?.textContent?.trim() || "",
      }));
  }

  function domainFromUrl(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function renderNews(items, metaText) {
    if (!newsListEl || !newsMetaEl) return;
    newsMetaEl.textContent = metaText || "";
    newsListEl.innerHTML = "";

    if (!items?.length) {
      newsListEl.innerHTML = `<li class="miniHint">Inga nyheter just nu.</li>`;
      return;
    }

    for (const it of items) {
      const pubDate = it.pubDate ? new Date(it.pubDate) : null;
      const domain = domainFromUrl(it.link);
      const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : "";

      const li = document.createElement("li");
      li.className = "swipeItem";

      const under = document.createElement("div");
      under.className = "swipeUnder";
      under.textContent = "";

      const content = document.createElement("div");
      content.className = "swipeContent";

      const left = document.createElement("div");
      left.className = "newsRow";

      const img = document.createElement("img");
      img.className = "favicon";
      if (faviconUrl) img.src = faviconUrl;
      img.alt = domain || "Nyhet";
      left.appendChild(img);

      const a = document.createElement("a");
      a.className = "newsLink";
      a.href = it.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = it.title;

      left.appendChild(a);

      const right = document.createElement("div");
      right.className = "swipeRight";

      const meta = document.createElement("div");
      meta.className = "miniMeta";
      meta.textContent =
        pubDate && !isNaN(pubDate.getTime())
          ? pubDate.toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
          : "";

      right.appendChild(meta);

      content.appendChild(left);
      content.appendChild(right);

      li.appendChild(under);
      li.appendChild(content);
      newsListEl.appendChild(li);
    }
  }

  function saveNewsCache(items) {
    try {
      localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), items }));
    } catch {}
  }

  function loadNewsCache() {
    try {
      return JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || "null");
    } catch {
      return null;
    }
  }

  async function loadNews() {
    if (!newsListEl || !newsMetaEl) return;
    newsMetaEl.textContent = "Laddar senaste…";
    newsListEl.innerHTML = "";

    try {
      const xml = await fetchTextFallback(RSS_URL);
      const items = parseRss(xml);
      renderNews(items, `Uppdaterad: ${new Date().toLocaleString("sv-SE")}`);
      saveNewsCache(items);
    } catch {
      const c = loadNewsCache();
      if (c?.items?.length) {
        renderNews(c.items, `Visar cache (senast: ${new Date(c.updatedAt).toLocaleString("sv-SE")})`);
      } else {
        renderNews([], "Nyheter kunde inte laddas just nu.");
      }
    }
  }

  if (newsRefreshBtn) newsRefreshBtn.addEventListener("click", loadNews);

  // ---------------- Weather (current + tomorrow) ----------------
  const weatherIconEl = $("weatherIcon");
  const weatherTempEl = $("weatherTemp");
  const weatherDescEl = $("weatherDesc");
  const weatherWindEl = $("weatherWind");
  const weatherPlaceEl = $("weatherPlace");
  const weatherUpdatedEl = $("weatherUpdated");
  const weatherRefreshBtn = $("weatherRefreshBtn");
  const tomIconEl = $("tomIcon");
  const tomTextEl = $("tomText");

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
      0:"Klart",
      1:"Mestadels klart",
      2:"Delvis molnigt",
      3:"Mulet",
      45:"Dimma",
      48:"Isdimma",
      51:"Duggregn (lätt)",
      53:"Duggregn",
      55:"Duggregn (kraftigt)",
      61:"Regn (lätt)",
      63:"Regn",
      65:"Regn (kraftigt)",
      71:"Snö (lätt)",
      73:"Snö",
      75:"Snö (kraftigt)",
      80:"Skurar (lätta)",
      81:"Skurar",
      82:"Skurar (kraftiga)",
      95:"Åska",
      96:"Åska + hagel (lätt)",
      99:"Åska + hagel"
    };
    return m[code] || `Väderkod ${code}`;
  }

  async function fetchWeather(lat, lon, label) {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&current=temperature_2m,wind_speed_10m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&forecast_days=2` +
      `&timezone=Europe%2FStockholm`;

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("Weather fetch failed");
    const data = await r.json();

    const cur = data.current;
    const t = Math.round(cur.temperature_2m);
    const w = Math.round(cur.wind_speed_10m);
    const code = cur.weather_code;

    if (weatherIconEl) weatherIconEl.textContent = iconForCode(code);
    if (weatherTempEl) weatherTempEl.textContent = `${t}°`;
    if (weatherDescEl) weatherDescEl.textContent = textForCode(code);
    if (weatherWindEl) weatherWindEl.textContent = `${w} m/s`;
    if (weatherPlaceEl) weatherPlaceEl.textContent = label;
    if (weatherUpdatedEl) {
      weatherUpdatedEl.textContent = new Date().toLocaleString("sv-SE", {
        hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
      });
    }

    // Tomorrow (index 1)
    const d = data.daily;
    if (d && d.time && d.time.length >= 2) {
      const tmax = Math.round(d.temperature_2m_max[1]);
      const tmin = Math.round(d.temperature_2m_min[1]);
      const c2 = d.weather_code[1];
      if (tomIconEl) tomIconEl.textContent = iconForCode(c2);
      if (tomTextEl) tomTextEl.textContent = `${textForCode(c2)} • ${tmin}°–${tmax}°`;
    }
  }

  function loadWeather() {
    if (weatherDescEl) weatherDescEl.textContent = "Laddar…";

    const fallback = () =>
      fetchWeather(59.3293, 18.0686, "Stockholm").catch(() => {
        if (weatherDescEl) weatherDescEl.textContent = "Kunde inte ladda väder.";
      });

    if (!navigator.geolocation) return fallback();

    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, "Din plats").catch(fallback),
      fallback,
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 30 * 60 * 1000 }
    );
  }

  if (weatherRefreshBtn) weatherRefreshBtn.addEventListener("click", loadWeather);

  // ---------------- Dial ----------------
  const dialEl = document.querySelector(".dial");
  const dialRing = document.querySelector(".dialRing");

  let isDragging = false;
  let startAngle = 0;
  let currentRotation = 0;
  const STEP = 360 / VIEWS.length;

  const angle = (cx, cy, mx, my) => Math.atan2(my - cy, mx - cx) * (180 / Math.PI);

  function setRotation(deg) {
    currentRotation = deg;
    if (dialRing) dialRing.style.transform = `rotate(${deg}deg)`;
  }
  function syncRotationToIndex() {
    setRotation(currentIndex * STEP);
  }

  const originalSet = setViewByIndex;
  setViewByIndex = (idx) => {
    originalSet(idx);
    syncRotationToIndex();
  };

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
  }

  function onUp(e) {
    if (!isDragging) return;
    isDragging = false;
    e.preventDefault();

    const snapped = Math.round(currentRotation / STEP);
    const finalIndex = ((snapped % VIEWS.length) + VIEWS.length) % VIEWS.length;

    originalSet(finalIndex);
    syncRotationToIndex();
  }

  if (dialEl) {
    dialEl.addEventListener("pointerdown", onDown, { passive: false });
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: false });
    window.addEventListener("pointercancel", onUp, { passive: false });
  }

  // ---------------- Render all + init ----------------
  function renderAll() {
    renderTodo();
    renderIdeas();
    renderPrio();
    renderDone();
  }

  // init
  renderAll();
  setViewByIndex(0);
  syncRotationToIndex();

  loadWeather();
  setInterval(loadWeather, 30 * 60 * 1000);

  loadNews();
  setInterval(loadNews, 10 * 60 * 1000);
})();
