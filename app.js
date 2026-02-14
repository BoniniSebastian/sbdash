/* SB Dash v4 — remove innebandy + sport, keep live dial icon + tick vibration, stable views */
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

  // ---------- Haptics (iPad kan ignorera) ----------
  const canVibrate = !!navigator.vibrate;
  const tick = (ms=8) => { if (canVibrate) navigator.vibrate(ms); };

  // ---------- Views (6) ----------
  const VIEWS = ["weather", "news", "todo", "ideas", "done", "pomodoro"];
  let currentIndex = 0;

  const track = $("viewTrack");
  const nav = $("underNav");

  const dialEl = $("dial");
  const dialRing = $("dialRing");
  const dialIcon = $("dialIcon");

  const ICONS = {
    weather: "assets/ui/icon-weather.svg",
    news: "assets/ui/icon-news.svg",
    todo: "assets/ui/icon-todo.svg",
    ideas: "assets/ui/icon-ideas.svg",
    done: "assets/ui/icon-done.svg",
    pomodoro: "assets/ui/icon-pomodoro.svg",
  };

  function setViewByIndex(idx, { silent=false } = {}) {
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

  // Desktop wheel: change view (prevents page scroll)
  const mainPanel = document.querySelector(".mainPanel");
  let wheelCooldown = false;
  if (mainPanel) {
    mainPanel.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (wheelCooldown) return;
      wheelCooldown = true;
      setViewByIndex(currentIndex + (e.deltaY > 0 ? 1 : -1));
      setTimeout(() => (wheelCooldown = false), 240);
    }, { passive:false });
  }

  // ---------- Dial live icon while rotating ----------
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
      const view = VIEWS[s];
      if (dialIcon && ICONS[view]) dialIcon.src = ICONS[view]; // live change
      tick(8);
    }
  }

  function onUp(e) {
    if (!isDragging) return;
    isDragging = false;
    e.preventDefault();

    const finalIndex = sectorFromRotation(currentRotation);
    setViewByIndex(finalIndex, { silent:true });
    syncRotationToIndex();
    tick(10);
  }

  if (dialEl) {
    dialEl.addEventListener("pointerdown", onDown, { passive:false });
    window.addEventListener("pointermove", onMove, { passive:false });
    window.addEventListener("pointerup", onUp, { passive:false });
    window.addEventListener("pointercancel", onUp, { passive:false });
  }

  // ---------- Storage ----------
  const LS_KEY = "sbdash_v4_store";
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
  const uid = () => (crypto.randomUUID ? crypto.random
