/* =========================
   SB Dash v7 (single panel)
   - Calendar + Prio inside Main
   - Body locked (app feel)
   - Dial switches views (live icon while rotating + wheel scroll)
   - Timer: start beside ring, reset under
   - Timer progress as neon border around Main panel
   ========================= */

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

  // ---------- Haptics ----------
  const canVibrate = !!navigator.vibrate;
  const tick = (ms = 8) => { if (canVibrate) navigator.vibrate(ms); };

  // ---------- Views ----------
  const VIEWS = ["calendar", "weather", "news", "todo", "ideas", "done", "prio", "pomodoro"];
  let currentIndex = 0;

  const track = $("viewTrack");
  const nav = $("underNav");

  const dialEl = $("dial");
  const dialRing = $("dialRing");
  const dialIcon = $("dialIcon");

  const ICONS = {
    calendar: "assets/ui/icon-news.svg",      // byt om du vill
    weather: "assets/ui/icon-weather.svg",
    news: "assets/ui/icon-news.svg",
    todo: "assets/ui/icon-todo.svg",
    ideas: "assets/ui/icon-ideas.svg",
    done: "assets/ui/icon-done.svg",
    prio: "assets/ui/icon-todo.svg",          // byt om du vill
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

  // ---------- Dial ----------
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
      if (dialIcon && ICONS[view]) dialIcon.src =
