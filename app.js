/* SB Dash v3 — all-in-one update (8 views + dial live icon + haptics + sport/ib rss + pomodoro ring) */
(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- Utils ----------
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtDMHM = (d) =>
    d.toLocaleString("sv-SE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const canVibrate = !!navigator.vibrate;
  const tickVibe = () => { if (canVibrate) navigator.vibrate(8); };
  const doneVibe = () => { if (canVibrate) navigator.vibrate([20, 40, 20]); };

  // ---------- Date in topbar (center, no pill) ----------
  const todayText = $("todayText");
  if (todayText) {
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE", { weekday: "long" });
    const date = now.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
    todayText.textContent = `${weekday} ${date}`;
  }

  // ---------- Views ----------
  const VIEWS = ["weather","news","innebandy","sport","todo","ideas","done","pomodoro"];
  let currentIndex = 0;

  const track = $("viewTrack");
  const nav = $("underNav");

  const dialEl = $("dial");
  const dialRing = $("dialRing");
  const dialIcon = $("dialIcon");

  const ICONS = {
    weather: "assets/ui/icon-weather.svg",
    news: "assets/ui/icon-news.svg",
    innebandy: "assets/ui/icon-innebandy.svg",
    sport: "assets/ui/icon-sport.svg",
    todo: "assets/ui/icon-todo.svg",
    ideas: "assets/ui/icon-ideas.svg",
    done: "assets/ui/icon-done.svg",
    pomodoro: "assets/ui/icon-pomodoro.svg",
  };

  function setViewByIndex(idx, {silent=false}={}) {
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

  // Wheel switch (desktop) on main panel only
  const mainPanel = document.querySelector(".mainPanel");
  let wheelCooldown = false;
  if (mainPanel) {
    mainPanel.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (wheelCooldown) return;
      wheelCooldown = true;
      setViewByIndex(currentIndex + (e.deltaY > 0 ? 1 : -1));
      setTimeout(() => (wheelCooldown = false), 260);
    }, { passive:false });
  }

  // ---------- Dial rotation with live icon + haptic tick ----------
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
    // map rotation -> nearest view sector
    const raw = Math.round(deg / STEP);
    return ((raw % VIEWS.length) + VIEWS.length) % VIEWS.length;
  }

  function liveUpdateFromRotation() {
    const s = sectorFromRotation(currentRotation);
    if (s !== lastSector) {
      lastSector = s;
      // live icon update while dragging
      const view = VIEWS[s];
      if (dialIcon && ICONS[view]) dialIcon.src = ICONS[view];
      tickVibe();
    }
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
    liveUpdateFromRotation();
  }

  function onUp(e) {
    if (!isDragging) return;
    isDragging = false;
    e.preventDefault();

    const finalIndex = sectorFromRotation(currentRotation);
    setViewByIndex(finalIndex, {silent:true});
    syncRotationToIndex();
    tickVibe();
  }

  if (dialEl) {
    dialEl.addEventListener("pointerdown", onDown, { passive:false });
    window.addEventListener("pointermove", onMove, { passive:false });
    window.addEventListener("pointerup", onUp, { passive:false });
    window.addEventListener("pointercancel", onUp, { passive:false });
  }

  // ---------- Storage ----------
  const LS_KEY = "sbdash_v3_store";
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

  // ---------- Origin-aware Done ----------
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
    };

    const onUp = (e) => {
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

    el.addEventListener("pointerdown", onDown, { passive:true });
    el.addEventListener("pointermove", onMove, { passive:false });
    el.addEventListener("pointerup", onUp, { passive:true });
    el.addEventListener("pointercancel", onUp, { passive:true });
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

  // ---------- TODO ----------
  const todoInput = $("todoInput");
