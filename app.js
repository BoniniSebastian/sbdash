/* SB Dash (compact single-file) */

(() => {
  // ---------- Dates ----------
  const $ = (id) => document.getElementById(id);
  const nowPretty = () => {
    const d = new Date();
    const w = d.toLocaleDateString("sv-SE", { weekday: "long" });
    const dt = d.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
    return `${w} ${dt}`;
  };
  const todayText = $("todayText");
  if (todayText) todayText.textContent = nowPretty();

  // ---------- Views ----------
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

  const setViewByIndex = (idx) => {
    currentIndex = (idx + VIEWS.length) % VIEWS.length;
    const view = VIEWS[currentIndex];

    if (track) track.style.transform = `translateX(-${currentIndex * 100}%)`;

    if (nav) {
      [...nav.querySelectorAll(".navBtn")].forEach((b) =>
        b.classList.toggle("active", b.dataset.view === view)
      );
    }

    if (dialIcon && ICONS[view]) dialIcon.src = ICONS[view];
  };

  const setViewByName = (view) => {
    const i = VIEWS.indexOf(view);
    if (i !== -1) setViewByIndex(i);
  };

  if (nav) {
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest(".navBtn");
      if (!btn) return;
      setViewByName(btn.dataset.view);
    });
  }

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

  // ---------- Storage ----------
  const LS_KEY = "sbdash_v1";
  const load = () => {
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
  };
  const store = load();
  const save = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const fmt = (ts) =>
    new Date(ts).toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

  // ---------- Shared render helpers ----------
  const makeBtn = (txt, title, onClick) => {
    const b = document.createElement("button");
    b.className = "miniIconBtn";
    b.textContent = txt;
    if (title) b.title = title;
    b.addEventListener("click", onClick);
    return b;
  };

  const renderList = (ul, items, { emptyText, leftBuilder, rightBuilder }) => {
    if (!ul) return;
    ul.innerHTML = "";
    if (!items.length) {
      ul.innerHTML = `<li class="miniHint">${emptyText}</li>`;
      return;
    }

    for (const item of items) {
      const li = document.createElement("li");
      li.className = "miniRow";

      const left = document.createElement("div");
      left.className = "miniRowLeft";
      leftBuilder(left, item);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "10px";
      rightBuilder(right, item);

      li.appendChild(left);
      li.appendChild(right);
      ul.appendChild(li);
    }
  };

  const removeFrom = (listName, id) => {
    store[listName] = store[listName].filter((x) => x.id !== id);
    save();
    renderAll();
  };

  // ---------- TODO / DONE ----------
  const todoInput = $("todoInput");
  const todoAddBtn = $("todoAddBtn");
  const todoList = $("todoList");

  const doneList = $("doneList");
  const doneClearBtn = $("doneClearBtn");

  const addTodo = (text) => {
    const t = (text || "").trim();
    if (!t) return;
    store.todo.unshift({ id: uid(), text: t, createdAt: Date.now() });
    save();
    renderTodo();
  };

  const completeTodo = (id) => {
    const i = store.todo.findIndex((x) => x.id === id);
    if (i === -1) return;
    const item = store.todo.splice(i, 1)[0];
    store.done.unshift({ ...item, doneAt: Date.now() });
    save();
    renderTodo();
    renderDone();
  };

  const restoreDone = (id) => {
    const i = store.done.findIndex((x) => x.id === id);
    if (i === -1) return;
    const item = store.done.splice(i, 1)[0];
    const { doneAt, ...rest } = item;
    store.todo.unshift(rest);
    save();
    renderTodo();
    renderDone();
  };

  const promoteTodoToPrio = (id) => {
    const i = store.todo.findIndex((x) => x.id === id);
    if (i === -1) return;
    const item = store.todo.splice(i, 1)[0];
    store.super.unshift({ id: item.id, text: item.text, createdAt: item.createdAt });
    save();
    renderTodo();
    renderPrio();
  };

  const renderTodo = () => {
    renderList(todoList, store.todo, {
      emptyText: "Inga uppgifter just nu.",
      leftBuilder: (left, item) => {
        left.appendChild(makeBtn("✓", "Markera som slutförd", () => completeTodo(item.id)));
        left.appendChild(makeBtn("🔥", "Flytta till Aktiv prio", () => promoteTodoToPrio(item.id)));

        const txt = document.createElement("div");
        txt.className = "miniText";
        txt.textContent = item.text;
        left.appendChild(txt);
      },
      rightBuilder: (right, item) => {
        const meta = document.createElement("div");
        meta.className = "miniMeta";
        meta.textContent = fmt(item.createdAt);
        right.appendChild(meta);
        right.appendChild(makeBtn("🗑️", "Ta bort", () => removeFrom("todo", item.id)));
      },
    });
  };

  const renderDone = () => {
    renderList(doneList, store.done, {
      emptyText: "Inget slutfört ännu.",
      leftBuilder: (left, item) => {
        left.appendChild(makeBtn("↩︎", "Flytta tillbaka till Att göra", () => restoreDone(item.id)));
        const txt = document.createElement("div");
        txt.className = "miniText";
        txt.textContent = item.text;
        left.appendChild(txt);
      },
      rightBuilder: (right, item) => {
        const meta = document.createElement("div");
        meta.className = "miniMeta";
        meta.textContent = fmt(item.doneAt);
        right.appendChild(meta);
        right.appendChild(makeBtn("🗑️", "Ta bort", () => removeFrom("done", item.id)));
      },
    });
  };

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

  if (doneClearBtn) {
    doneClearBtn.addEventListener("click", () => {
      store.done = [];
      save();
      renderDone();
    });
  }

  // ---------- IDEAS ----------
  const ideaInput = $("ideaInput");
  const ideaAddBtn = $("ideaAddBtn");
  const ideasList = $("ideasList");

  const addIdea = (text) => {
    const t = (text || "").trim();
    if (!t) return;
    store.ideas.unshift({ id: uid(), text: t, createdAt: Date.now() });
    save();
    renderIdeas();
  };

  const renderIdeas = () => {
    renderList(ideasList, store.ideas, {
      emptyText: "Inga idéer sparade ännu.",
      leftBuilder: (left, item) => {
        const txt = document.createElement("div");
        txt.className = "miniText";
        txt.textContent = item.text;
        left.appendChild(txt);
      },
      rightBuilder: (right, item) => {
        const meta = document.createElement("div");
        meta.className = "miniMeta";
        meta.textContent = fmt(item.createdAt);
        right.appendChild(meta);
        right.appendChild(makeBtn("🗑️", "Ta bort", () => removeFrom("ideas", item.id)));
      },
    });
  };

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

  // ---------- PRIO ----------
  const prioInput = $("prioInput");
  const prioAddBtn = $("prioAddBtn");
  const prioList = $("prioList");
  const prioCount = $("prioCount");

  const addPrio = (text) => {
    const t = (text || "").trim();
    if (!t) return;
    store.super.unshift({ id: uid(), text: t, createdAt: Date.now() });
    save();
    renderPrio();
  };

  const completePrio = (id) => {
    const i = store.super.findIndex((x) => x.id === id);
    if (i === -1) return;
    const item = store.super.splice(i, 1)[0];
    store.done.unshift({ ...item, doneAt: Date.now() });
    save();
    renderPrio();
    renderDone();
  };

  const renderPrio = () => {
    if (prioCount) prioCount.textContent = String(store.super.length);
    renderList(prioList, store.super, {
      emptyText: "Inget i Aktiv prio just nu.",
      leftBuilder: (left, item) => {
        left.appendChild(makeBtn("✓", "Klarmarkera (till Slutförda)", () => completePrio(item.id)));
        const txt = document.createElement("div");
        txt.className = "miniText";
        txt.textContent = item.text;
        left.appendChild(txt);
      },
      rightBuilder: (right, item) => {
        const meta = document.createElement("div");
        meta.className = "miniMeta";
        meta.textContent = fmt(item.createdAt);
        right.appendChild(meta);
        right.appendChild(makeBtn("🗑️", "Ta bort", () => removeFrom("super", item.id)));
      },
    });
  };

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

  const renderAll = () => {
    renderTodo();
    renderDone();
    renderIdeas();
    renderPrio();
  };

  // continue in DEL 2...
  window.__SB__ = { setViewByIndex, setViewByName, VIEWS, get currentIndex(){ return currentIndex; }, set currentIndex(v){ currentIndex=v; } };
})();
(() => {
  const $ = (id) => document.getElementById(id);
  const SB = window.__SB__;

  // ---------- NEWS (stable RSS with cache + fallbacks) ----------
  const RSS_URL = "https://news.google.com/rss?hl=sv&gl=SE&ceid=SE:sv";
  const NEWS_MAX = 10;

  const newsListEl = $("newsList");
  const newsMetaEl = $("newsMeta");
  const newsRefreshBtn = $("newsRefreshBtn");
  const NEWS_CACHE_KEY = "sbdash_news_cache_v1";

  const PROXIES = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://r.jina.ai/http://${u.replace(/^https?:\/\//, "")}`,
    (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`
  ];

  const fetchTextFallback = async (url) => {
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
  };

  const parseRss = (xml) => {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return Array.from(doc.querySelectorAll("item")).slice(0, NEWS_MAX).map(it => ({
      title: it.querySelector("title")?.textContent?.trim() || "Nyhet",
      link: it.querySelector("link")?.textContent?.trim() || "#",
      pubDate: it.querySelector("pubDate")?.textContent?.trim() || ""
    }));
  };

  const renderNews = (items, metaText) => {
    if (!newsListEl || !newsMetaEl) return;
    newsMetaEl.textContent = metaText || "";
    newsListEl.innerHTML = "";

    if (!items?.length) {
      newsListEl.innerHTML = `<li class="miniHint">Inga nyheter just nu.</li>`;
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

      left.appendChild(a);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "10px";

      const meta = document.createElement("div");
      meta.className = "miniMeta";
      meta.textContent = pubDate && !isNaN(pubDate.getTime())
        ? pubDate.toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
        : "";

      right.appendChild(meta);
      li.appendChild(left);
      li.appendChild(right);
      newsListEl.appendChild(li);
    }
  };

  const saveNewsCache = (items) => {
    try {
      localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), items }));
    } catch {}
  };
  const loadNewsCache = () => {
    try { return JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || "null"); } catch { return null; }
  };

  const loadNews = async () => {
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
  };

  if (newsRefreshBtn) newsRefreshBtn.addEventListener("click", loadNews);
  loadNews();
  setInterval(loadNews, 10 * 60 * 1000);

  // ---------- WEATHER (Open-Meteo, no key) ----------
  const weatherTempEl = $("weatherTemp");
  const weatherDescEl = $("weatherDesc");
  const weatherWindEl = $("weatherWind");
  const weatherPlaceEl = $("weatherPlace");
  const weatherUpdatedEl = $("weatherUpdated");
  const weatherRefreshBtn = $("weatherRefreshBtn");

  const codeText = (c) => ({
    0:"Klart",1:"Mestadels klart",2:"Delvis molnigt",3:"Mulet",45:"Dimma",48:"Isdimma",
    51:"Duggregn (lätt)",53:"Duggregn",55:"Duggregn (kraftigt)",
    61:"Regn (lätt)",63:"Regn",65:"Regn (kraftigt)",
    71:"Snö (lätt)",73:"Snö",75:"Snö (kraftigt)",
    80:"Skurar (lätta)",81:"Skurar",82:"Skurar (kraftiga)",
    95:"Åska",96:"Åska + hagel (lätt)",99:"Åska + hagel"
  }[c] || `Väderkod ${c}`);

  const fetchWeather = async (lat, lon, label) => {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&current=temperature_2m,wind_speed_10m,weather_code` +
      `&timezone=Europe%2FStockholm`;

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("Weather fetch failed");
    const data = await r.json();

    const cur = data.current;
    const t = Math.round(cur.temperature_2m);
    const w = Math.round(cur.wind_speed_10m);
    const code = cur.weather_code;

    if (weatherTempEl) weatherTempEl.textContent = `${t}°`;
    if (weatherDescEl) weatherDescEl.textContent = codeText(code);
    if (weatherWindEl) weatherWindEl.textContent = `${w} m/s`;
    if (weatherPlaceEl) weatherPlaceEl.textContent = label;
    if (weatherUpdatedEl) {
      weatherUpdatedEl.textContent = new Date().toLocaleString("sv-SE", { hour:"2-digit", minute:"2-digit", day:"2-digit", month:"2-digit" });
    }
  };

  const loadWeather = () => {
    if (weatherDescEl) weatherDescEl.textContent = "Laddar…";
    const fallback = () => fetchWeather(59.3293, 18.0686, "Stockholm").catch(() => {
      if (weatherDescEl) weatherDescEl.textContent = "Kunde inte ladda väder.";
    });

    if (!navigator.geolocation) return fallback();

    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, "Din plats").catch(fallback),
      fallback,
      { enableHighAccuracy:false, timeout:7000, maximumAge:30*60*1000 }
    );
  };

  if (weatherRefreshBtn) weatherRefreshBtn.addEventListener("click", loadWeather);
  loadWeather();
  setInterval(loadWeather, 30 * 60 * 1000);

  // ---------- DIAL (pointer/touch safe) ----------
  const dialEl = document.querySelector(".dial");
  const dialRing = document.querySelector(".dialRing");

  let isDragging = false;
  let startAngle = 0;
  let currentRotation = 0;
  const STEP = 360 / SB.VIEWS.length;

  const angle = (cx, cy, mx, my) => Math.atan2(my - cy, mx - cx) * (180 / Math.PI);
  const setRotation = (deg) => {
    currentRotation = deg;
    if (dialRing) dialRing.style.transform = `rotate(${deg}deg)`;
  };
  const sync = () => setRotation(SB.currentIndex * STEP);

  const originalSet = SB.setViewByIndex;
  SB.setViewByIndex = (idx) => { originalSet(idx); sync(); };

  const onDown = (e) => {
    if (!dialEl) return;
    isDragging = true;
    dialEl.setPointerCapture?.(e.pointerId);
    e.preventDefault();

    const r = dialEl.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    startAngle = angle(cx, cy, e.clientX, e.clientY) - currentRotation;
  };

  const onMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();

    const r = dialEl.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    setRotation(angle(cx, cy, e.clientX, e.clientY) - startAngle);
  };

  const onUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    e.preventDefault();

    const snapped = Math.round(currentRotation / STEP);
    const finalIndex = ((snapped % SB.VIEWS.length) + SB.VIEWS.length) % SB.VIEWS.length;
    originalSet(finalIndex);
    sync();
  };

  if (dialEl) {
    dialEl.addEventListener("pointerdown", onDown, { passive:false });
    window.addEventListener("pointermove", onMove, { passive:false });
    window.addEventListener("pointerup", onUp, { passive:false });
    window.addEventListener("pointercancel", onUp, { passive:false });
  }

  // ---------- Init ----------
  // Render lists from DEL 1
  const triggerRender = () => {
    // DEL 1 put renderAll inside closure; easiest: just trigger by toggling storage change.
    // Instead, we rely on DEL 1 initial calls having run before this block executes.
  };

  // Set first view + sync dial
  SB.setViewByIndex(0);
  sync();
})();
