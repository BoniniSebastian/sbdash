(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- Elements ----------
  const sheetWrap = $("sheetWrap");
  const sheet = $("sheet");
  const sheetTitle = $("sheetTitle");
  const sheetContent = $("sheetContent");

  const wheel = $("wheel");
  const wheelRing = document.querySelector(".wheelRing");
  const wheelIcon = $("wheelIcon");

  const topDate = $("topDate");

  // ---------- Date ----------
  function setDate() {
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE", { weekday: "long" });
    const date = now.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
    if (topDate) topDate.textContent = `${weekday} ${date}`;
  }
  setDate();

  // ---------- Haptics ----------
  const canVibrate = !!navigator.vibrate;
  const tick = (ms = 8) => {
    if (canVibrate) navigator.vibrate(ms);
  };

  // ---------- Views ----------
  const VIEWS = [
    { key: "calendar", icon: "icon-calendar.svg", title: "Kalender" },
    { key: "prio",     icon: "icon-prio.svg",     title: "Aktiv prio" },
    { key: "weather",  icon: "icon-weather.svg",  title: "Väder" },
    { key: "news",     icon: "icon-news.svg",     title: "Nyheter" },
    { key: "todo",     icon: "icon-todo.svg",     title: "Todo" },
    { key: "ideas",    icon: "icon-ideas.svg",    title: "Idéer" },
    { key: "done",     icon: "icon-done.svg",     title: "Done" },
    { key: "timer",    icon: "icon-pomodoro.svg", title: "Timer" },
  ];

  let currentIndex = 0;

  // ---------- Helpers ----------
  const LS_KEY = "sbdash_mobile_store_v2";
  const store = (() => {
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
  })();

  const save = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const fmt = (ts) =>
    new Date(ts).toLocaleString("sv-SE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  function openSheet() {
    sheetWrap?.classList.add("open");
  }
  function closeSheet() {
    sheetWrap?.classList.remove("open");
    if (sheet) {
      sheet.style.transform = "";
      sheet.classList.remove("dragging");
    }
    dragStart = null;
  }
  function isOpen() {
    return !!sheetWrap?.classList.contains("open");
  }

  // ---------- Render view ----------
  function setWheelIcon() {
    const view = VIEWS[currentIndex];
    if (!view) return;
    if (wheelIcon) wheelIcon.src = `assets/ui/${view.icon}`;
  }

  function renderCalendar() {
    sheetContent.innerHTML = `
      <div class="blockTitle">Kalender</div>
      <div class="card">
        <div class="calScale">
          <iframe class="calFrame"
            src="https://calendar.google.com/calendar/embed?src=ZXJpY3Nzb25ib25pbmlAZ21haWwuY29t&mode=AGENDA&ctz=Europe%2FStockholm&hl=sv&showTitle=0&showTabs=0&showNav=0&showPrint=0&showCalendars=0&showDate=0"
            frameborder="0" scrolling="no"></iframe>
        </div>
      </div>
      <div class="miniHint" style="margin-top:10px;">
        (iPhone Safari kan kräva cookies för Google iframe.)
      </div>
    `;
  }

  function renderList({ title, inputId, btnId, listId, placeholder, onAdd, items, renderRow }) {
    sheetContent.innerHTML = `
      <div class="blockTitle">${title}</div>
      <div class="miniForm">
        <input id="${inputId}" class="miniInput" placeholder="${placeholder}" maxlength="160" />
        <button id="${btnId}" class="miniBtn">+ Lägg</button>
      </div>
      <ul id="${listId}" class="miniList"></ul>
      <div class="miniHint">Enter = lägg till • Swipe höger→vänster = slutför</div>
    `;

    const input = $(inputId);
    const btn = $(btnId);
    const list = $(listId);

    const add = () => {
      const t = (input?.value || "").trim();
      if (!t) return;
      onAdd(t);
      input.value = "";
      input.focus();
    };

    btn?.addEventListener("click", add);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") add();
    });

    // render items
    list.innerHTML = "";
    if (!items.length) {
      list.innerHTML = `<li class="miniHint">Inget här ännu.</li>`;
      return;
    }
    for (const it of items) list.appendChild(renderRow(it));
  }

  function toDone(origin, item) {
    store.done.unshift({ id: item.id, text: item.text, createdAt: item.createdAt, doneAt: Date.now(), origin });
  }

  function restoreFromDone(id) {
    const i = store.done.findIndex((x) => x.id === id);
    if (i === -1) return;
    const it = store.done.splice(i, 1)[0];
    const origin = it.origin || "todo";
    const restored = { id: it.id, text: it.text, createdAt: it.createdAt || Date.now() };
    if (origin === "prio") store.prio.unshift(restored);
    else if (origin === "ideas") store.ideas.unshift(restored);
    else store.todo.unshift(restored);
    save();
    renderView();
  }

  // ---------- Swipe helper ----------
  function attachSwipe(li, onComplete) {
    let startX = 0, startY = 0, curX = 0, dragging = false, locked = false;

    const content = li.querySelector(".swipeContent");
    const setX = (x, animate) => {
      curX = x;
      content.style.transition = animate ? "transform 180ms ease" : "none";
      content.style.transform = `translateX(${x}px)`;
    };

    li.addEventListener("pointerdown", (e) => {
      dragging = true; locked = false;
      startX = e.clientX; startY = e.clientY;
      setX(0, true);
      content.setPointerCapture?.(e.pointerId);
    }, { passive: true });

    li.addEventListener("pointermove", (e) => {
      if (!dragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!locked) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          locked = true;
          if (Math.abs(dy) > Math.abs(dx)) {
            dragging = false;
            setX(0, true);
            return;
          }
        } else return;
      }

      if (dx > 0) return;
      e.preventDefault();

      const max = -Math.min(240, li.clientWidth * 0.9);
      setX(Math.max(dx, max), false);
    }, { passive: false });

    const finish = () => {
      if (!dragging) return;
      dragging = false;

      const abs = Math.abs(curX);
      const need = li.clientWidth * 0.55;

      if (abs >= need) {
        setX(-li.clientWidth, true);
        setTimeout(() => onComplete?.(), 120);
      } else {
        setX(0, true);
      }
    };

    li.addEventListener("pointerup", finish, { passive: true });
    li.addEventListener("pointercancel", finish, { passive: true });
  }

  function mkSwipeRow(text, meta, onComplete, extraLeftHTML = "") {
    const li = document.createElement("li");
    li.className = "swipeItem";
    li.innerHTML = `
      <div class="swipeUnder"></div>
      <div class="swipeContent">
        <div class="swipeLeft">
          ${extraLeftHTML}
          <div class="swipeText"></div>
        </div>
        <div class="swipeRight">
          <div class="miniMeta">${meta || ""}</div>
        </div>
      </div>
    `;
    li.querySelector(".swipeText").textContent = text;
    attachSwipe(li, onComplete);
    return li;
  }

  // ---------- Views content ----------
  function renderPrio() {
    renderList({
      title: "Aktiv prio",
      inputId: "prioInput",
      btnId: "prioAddBtn",
      listId: "prioList",
      placeholder: "Skriv superprio…",
      onAdd: (t) => {
        store.prio.unshift({ id: uid(), text: t, createdAt: Date.now() });
        save();
        renderView();
      },
      items: store.prio,
      renderRow: (it) => mkSwipeRow(it.text, fmt(it.createdAt), () => {
        const i = store.prio.findIndex(x => x.id === it.id);
        if (i !== -1) {
          const item = store.prio.splice(i, 1)[0];
          toDone("prio", item);
          save();
          renderView();
        }
      })
    });
  }

  function renderTodo() {
    renderList({
      title: "Todo",
      inputId: "todoInput",
      btnId: "todoAddBtn",
      listId: "todoList",
      placeholder: "Skriv en uppgift…",
      onAdd: (t) => {
        store.todo.unshift({ id: uid(), text: t, createdAt: Date.now() });
        save();
        renderView();
      },
      items: store.todo,
      renderRow: (it) => mkSwipeRow(it.text, fmt(it.createdAt), () => {
        const i = store.todo.findIndex(x => x.id === it.id);
        if (i !== -1) {
          const item = store.todo.splice(i, 1)[0];
          toDone("todo", item);
          save();
          renderView();
        }
      })
    });
  }

  function renderIdeas() {
    renderList({
      title: "Idéer",
      inputId: "ideaInput",
      btnId: "ideaAddBtn",
      listId: "ideasList",
      placeholder: "Skriv en idé…",
      onAdd: (t) => {
        store.ideas.unshift({ id: uid(), text: t, createdAt: Date.now() });
        save();
        renderView();
      },
      items: store.ideas,
      renderRow: (it) => mkSwipeRow(it.text, fmt(it.createdAt), () => {
        const i = store.ideas.findIndex(x => x.id === it.id);
        if (i !== -1) {
          const item = store.ideas.splice(i, 1)[0];
          toDone("ideas", item);
          save();
          renderView();
        }
      })
    });
  }

  function renderDone() {
    sheetContent.innerHTML = `
      <div class="blockTitle">Done</div>
      <ul id="doneList" class="miniList"></ul>
      <div class="miniActions">
        <button id="doneClearBtn" class="miniBtn">Rensa</button>
      </div>
      <div class="miniHint">Tryck ↩︎ för att återställa</div>
    `;
    const list = $("doneList");
    list.innerHTML = "";

    if (!store.done.length) {
      list.innerHTML = `<li class="miniHint">Inget slutfört ännu.</li>`;
      return;
    }

    for (const it of store.done) {
      const li = document.createElement("li");
      li.className = "itemRow";
      li.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <button class="miniBtn" style="padding:6px 10px;font-size:12px;">↩︎</button>
          <div class="itemText">${it.text}</div>
        </div>
        <div class="itemMeta">${fmt(it.doneAt)}</div>
      `;
      li.querySelector("button").addEventListener("click", () => restoreFromDone(it.id));
      list.appendChild(li);
    }

    $("doneClearBtn").addEventListener("click", () => {
      store.done = [];
      save();
      renderView();
    });
  }

  // ---------- Weather (Open-Meteo) ----------
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
      0:"Klart", 1:"Mestadels klart", 2:"Delvis molnigt", 3:"Mulet",
      45:"Dimma", 48:"Isdimma",
      51:"Duggregn (lätt)", 53:"Duggregn", 55:"Duggregn (kraftigt)",
      61:"Regn (lätt)", 63:"Regn", 65:"Regn (kraftigt)",
      71:"Snö (lätt)", 73:"Snö", 75:"Snö (kraftigt)",
      80:"Skurar (lätta)", 81:"Skurar", 82:"Skurar (kraftiga)",
      95:"Åska", 96:"Åska + hagel", 99:"Åska + hagel"
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

    const d = data.daily;
    const tmax = d?.temperature_2m_max?.[1] ?? null;
    const tmin = d?.temperature_2m_min?.[1] ?? null;
    const c2 = d?.weather_code?.[1] ?? null;

    sheetContent.innerHTML = `
      <div class="blockTitle">Väder</div>
      <div class="card" style="padding:16px">
        <div style="display:flex;gap:12px;align-items:center;">
          <div style="font-size:34px">${iconForCode(code)}</div>
          <div>
            <div style="font-size:38px;font-weight:900;line-height:1">${t}°</div>
            <div style="color:rgba(255,255,255,.65);font-weight:900">${textForCode(code)}</div>
            <div class="miniHint" style="margin-top:6px;">${label} • Vind ${w} m/s</div>
          </div>
        </div>
        <div class="miniHint" style="margin-top:12px;">
          Uppdaterad: ${new Date().toLocaleString("sv-SE", { hour:"2-digit", minute:"2-digit", day:"2-digit", month:"2-digit" })}
        </div>
        ${tmax !== null && tmin !== null && c2 !== null ? `
          <div class="miniHint" style="margin-top:10px;">
            Imorgon: ${iconForCode(c2)} ${textForCode(c2)} • ${Math.round(tmin)}°–${Math.round(tmax)}°
          </div>
        ` : ``}
        <div class="miniActions" style="margin-top:12px;">
          <button id="weatherRefreshBtn" class="miniBtn">Uppdatera</button>
        </div>
      </div>
    `;

    $("weatherRefreshBtn")?.addEventListener("click", () => loadWeather());
  }

  function loadWeather() {
    const fallback = () =>
      fetchWeather(59.3293, 18.0686, "Stockholm").catch(() => {
        sheetContent.innerHTML = `<div class="blockTitle">Väder</div><div class="miniHint">Kunde inte ladda väder.</div>`;
      });

    if (!navigator.geolocation) return fallback();

    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, "Din plats").catch(fallback),
      fallback,
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 30 * 60 * 1000 }
    );
  }

  // ---------- News (RSS) ----------
  const RSS_NEWS = "https://news.google.com/rss?hl=sv&gl=SE&ceid=SE:sv";
  const NEWS_CACHE_KEY = "sbdash_news_cache_mobile_v2";

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

  function saveCache(items) {
    try { localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), items })); } catch {}
  }
  function loadCache() {
    try { return JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || "null"); } catch { return null; }
  }

  function parseRss(xml, max = 12) {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return Array.from(doc.querySelectorAll("item"))
      .slice(0, max)
      .map((it) => ({
        title: it.querySelector("title")?.textContent?.trim() || "Nyhet",
        link: it.querySelector("link")?.textContent?.trim() || "#",
        pubDate: it.querySelector("pubDate")?.textContent?.trim() || "",
      }));
  }

  async function loadNews() {
    sheetContent.innerHTML = `<div class="blockTitle">Nyheter</div><div class="miniHint">Laddar…</div>`;
    try {
      const xml = await fetchTextFallback(RSS_NEWS);
      const items = parseRss(xml, 12);
      saveCache(items);
      renderNews(items, `Uppdaterad: ${new Date().toLocaleString("sv-SE")}`);
    } catch {
      const c = loadCache();
      if (c?.items?.length) {
        renderNews(c.items, `Visar cache (senast: ${new Date(c.updatedAt).toLocaleString("sv-SE")})`);
      } else {
        renderNews([], "Nyheter kunde inte laddas just nu.");
      }
    }
  }

  function renderNews(items, metaText) {
    sheetContent.innerHTML = `
      <div class="blockTitle">Nyheter</div>
      <div class="miniHint">${metaText || ""}</div>
      <ul class="miniList" id="newsList" style="margin-top:12px;"></ul>
      <div class="miniActions">
        <button id="newsRefreshBtn" class="miniBtn">Uppdatera</button>
      </div>
    `;
    const list = $("newsList");
    if (!items?.length) {
      list.innerHTML = `<li class="miniHint">Inget att visa.</li>`;
    } else {
      for (const it of items) {
        const pubDate = it.pubDate ? new Date(it.pubDate) : null;
        const li = document.createElement("li");
        li.className = "itemRow";
        li.innerHTML = `
          <div class="itemText" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${it.title}
          </div>
          <div class="itemMeta">${pubDate && !isNaN(pubDate) ? pubDate.toLocaleString("sv-SE", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : ""}</div>
        `;
        li.addEventListener("click", () => window.open(it.link, "_blank", "noopener,noreferrer"));
        list.appendChild(li);
      }
    }

    $("newsRefreshBtn")?.addEventListener("click", loadNews);
  }

  // ---------- Timer (Pomodoro ring) ----------
  let total = 5 * 60;
  let left = total;
  let running = false;
  let t0 = 0;
  let pausedLeft = left;
  let raf = 0;

  const pad2 = (n) => String(n).padStart(2, "0");

  function renderTimerUI() {
    const mm = Math.floor(left / 60);
    const ss = left % 60;

    sheetContent.innerHTML = `
      <div class="blockTitle">Timer</div>

      <div class="card" style="padding:16px;max-width:520px;">
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
          <div style="position:relative;width:260px;height:260px;">
            <svg style="width:100%;height:100%;" viewBox="0 0 240 240" aria-hidden="true">
              <defs>
                <filter id="pomoGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <circle cx="120" cy="120" r="92" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="16"
                transform="rotate(-90 120 120)"></circle>
              <circle id="pomoProg" cx="120" cy="120" r="92" fill="none" stroke="rgba(0,209,255,.88)"
                stroke-width="16" stroke-linecap="round" filter="url(#pomoGlow)"
                transform="rotate(-90 120 120)"></circle>
            </svg>

            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;">
              <div id="pomoTime" style="font-size:40px;font-weight:900;letter-spacing:-.5px;">${pad2(mm)}:${pad2(ss)}</div>
              <div id="pomoSub" style="margin-top:6px;font-size:12px;color:rgba(255,255,255,.55);font-weight:900;">
                ${!running && left===total ? "Redo" : (running ? "Fokus…" : (left>0 ? "Pausad" : "KLAR"))}
              </div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <button id="pomoStartBtn" class="miniBtn">${running ? "Paus" : "Start"}</button>
            <button id="pomoResetBtn" class="miniBtn">Reset</button>
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
          <button class="miniBtn" data-min="5">5</button>
          <button class="miniBtn" data-min="10">10</button>
          <button class="miniBtn" data-min="15">15</button>
        </div>

        <div class="miniHint" style="margin-top:10px;">Ring: cyan → orange → röd när tiden går ner</div>
      </div>
    `;

    const prog = $("pomoProg");
    const C = 2 * Math.PI * 92;
    if (prog) {
      prog.style.strokeDasharray = String(C);
      const pct = total ? Math.max(0, Math.min(1, left / total)) : 0;
      prog.style.strokeDashoffset = String(C * (1 - pct));

      if (pct > 0.40) prog.style.stroke = "rgba(0,209,255,.88)";
      else if (pct > 0.15) prog.style.stroke = "rgba(255,165,0,.88)";
      else prog.style.stroke = "rgba(255,70,70,.88)";
    }

    $("pomoStartBtn")?.addEventListener("click", startPauseTimer);
    $("pomoResetBtn")?.addEventListener("click", resetTimer);
    sheetContent.querySelectorAll("[data-min]")?.forEach(btn => {
      btn.addEventListener("click", () => setMinutes(Number(btn.dataset.min)));
    });
  }

  function loopTimer() {
    if (!running) return;
    const elapsed = (performance.now() - t0) / 1000;
    left = Math.max(0, Math.floor(pausedLeft - elapsed));

    renderTimerUI();

    if (left <= 0) {
      running = false;
      if (canVibrate) navigator.vibrate([20, 40, 20]);
      return;
    }
    raf = requestAnimationFrame(loopTimer);
  }

  function startPauseTimer() {
    if (running) {
      running = false;
      pausedLeft = left;
      cancelAnimationFrame(raf);
      renderTimerUI();
      return;
    }

    if (left <= 0) { left = total; pausedLeft = left; }
    running = true;
    t0 = performance.now();
    tick(10);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loopTimer);
    renderTimerUI();
  }

  function setMinutes(min) {
    running = false;
    cancelAnimationFrame(raf);
    total = Math.round(min * 60);
    left = total;
    pausedLeft = left;
    renderTimerUI();
    tick(8);
  }

  function resetTimer() {
    running = false;
    cancelAnimationFrame(raf);
    left = total;
    pausedLeft = left;
    renderTimerUI();
    tick(8);
  }

  // ---------- renderView main ----------
  function renderView() {
    const view = VIEWS[currentIndex];
    if (!view) return;

    if (sheetTitle) sheetTitle.textContent = view.title;
    setWheelIcon();

    if (!sheetContent) return;

    switch (view.key) {
      case "calendar": renderCalendar(); break;
      case "prio":     renderPrio(); break;
      case "weather":  loadWeather(); break;
      case "news":     loadNews(); break;
      case "todo":     renderTodo(); break;
      case "ideas":    renderIdeas(); break;
      case "done":     renderDone(); break;
      case "timer":    renderTimerUI(); break;
      default:
        sheetContent.innerHTML = `<div class="miniHint">Okänd vy</div>`;
    }
  }

  // ---------- Wheel behavior (glid + inertia) ----------
  let isDragging = false;
  let startAngle = 0;
  let startRotation = 0;
  let rotation = 0;
  let lastT = 0;
  let lastRot = 0;
  let vel = 0;
  let rafInertia = 0;

  const STEP = 360 / VIEWS.length;

  function stopInertia() {
    cancelAnimationFrame(rafInertia);
    rafInertia = 0;
  }

  function indexFromRotation(deg) {
    const raw = Math.round(deg / STEP);
    return ((raw % VIEWS.length) + VIEWS.length) % VIEWS.length;
  }

  function setRotation(deg, { silent = false } = {}) {
    rotation = deg;
    if (wheelRing) wheelRing.style.transform = `rotate(${deg}deg)`;

    const idx = indexFromRotation(rotation);
    if (idx !== currentIndex) {
      currentIndex = idx;
      setWheelIcon();
      if (isOpen()) renderView(); // byt sida live när rutan är öppen
      if (!silent) tick(6);
    }
  }

  function snapToIndex(idx) {
    currentIndex = idx;
    renderView();
    setRotation(idx * STEP, { silent: true });
    tick(10);
  }

  function getAngle(e) {
    const r = wheel.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
  }

  function startInertia() {
    stopInertia();
    const friction = 0.92;

    const step = () => {
      vel *= friction;
      if (Math.abs(vel) < 0.12) {
        snapToIndex(indexFromRotation(rotation));
        return;
      }
      setRotation(rotation + vel);
      rafInertia = requestAnimationFrame(step);
    };

    rafInertia = requestAnimationFrame(step);
  }

  let tapStartX = 0, tapStartY = 0, tapMoved = false;

  function onDown(e) {
    if (!wheel) return;
    tapMoved = false;
    tapStartX = e.clientX; tapStartY = e.clientY;

    stopInertia();
    isDragging = true;
    wheel.setPointerCapture?.(e.pointerId);

    startAngle = getAngle(e);
    startRotation = rotation;

    lastT = performance.now();
    lastRot = rotation;
    vel = 0;

    e.preventDefault();
  }

  function onMove(e) {
    if (!isDragging) return;

    const dx = e.clientX - tapStartX;
    const dy = e.clientY - tapStartY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) tapMoved = true;

    const a = getAngle(e);
    let delta = a - startAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // “Rätt håll”: dra ned på höger sida = samma känsla som scroll ned
    setRotation(startRotation + delta);

    const t = performance.now();
    const dt = Math.max(8, t - lastT);
    vel = ((rotation - lastRot) / dt) * 16;
    vel = Math.max(-14, Math.min(14, vel));
    lastT = t;
    lastRot = rotation;

    e.preventDefault();
  }

  function onUp(e) {
    if (!isDragging) return;
    isDragging = false;
    e.preventDefault();

    if (!tapMoved) {
      // tap öppnar rutan
      if (!isOpen()) openSheet();
      renderView();
      return;
    }

    startInertia();
  }

  function onWheel(e) {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    setRotation(rotation + dir * STEP);
    if (isOpen()) renderView();
  }

  wheel?.addEventListener("pointerdown", onDown, { passive: false });
  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp, { passive: false });
  window.addEventListener("pointercancel", onUp, { passive: false });
  wheel?.addEventListener("wheel", onWheel, { passive: false });

  // ---------- Sheet drag to close (fix cancel) ----------
  let dragStart = null;

  sheet?.addEventListener("pointerdown", (e) => {
    if (!isOpen()) return;
    dragStart = e.clientY;
    sheet.classList.add("dragging");
    sheet.setPointerCapture?.(e.pointerId);
  }, { passive: true });

  sheet?.addEventListener("pointermove", (e) => {
    if (dragStart === null) return;
    const delta = e.clientY - dragStart;

    if (delta > 0) {
      sheet.style.transform = `translateX(-50%) translateY(${delta}px)`;
    }
  }, { passive: true });

  const endDrag = (e) => {
    if (dragStart === null) return;
    const delta = e.clientY - dragStart;

    if (delta > 120) {
      closeSheet();
    } else {
      sheet.style.transform = "";
    }

    sheet.classList.remove("dragging");
    dragStart = null;
  };

  sheet?.addEventListener("pointerup", endDrag, { passive: true });
  sheet?.addEventListener("pointercancel", () => {
    sheet.style.transform = "";
    sheet.classList.remove("dragging");
    dragStart = null;
  }, { passive: true });
  sheet?.addEventListener("lostpointercapture", () => {
    sheet.style.transform = "";
    sheet.classList.remove("dragging");
    dragStart = null;
  }, { passive: true });

  // ---------- Init ----------
  // start: sheet stängd, men wheel preview synlig
  setRotation(0, { silent: true });
  setWheelIcon();
  closeSheet();
})();
