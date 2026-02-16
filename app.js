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

  // ---------- Elements ----------
  const sheetWrap = $("sheetWrap");
  const sheet = $("sheet");
  const sheetSub = $("sheetSub");
  const track = $("viewTrack");

  const dial = $("dial");
  const dialRing = $("dialRing");
  const dialIcon = $("dialIcon");
  const dialEmoji = $("dialEmoji");

  // Handle (måste finnas i HTML: id="sheetHandle")
  const sheetHandle = $("sheetHandle");

  // ---------- Views (ALLA) ----------
  const VIEWS = [
    { id: "calendar",  label: "Kalender", icon: "assets/ui/icon-calendar.svg", emoji: "📅" },
    { id: "weather",   label: "Väder",    icon: "assets/ui/icon-weather.svg", emoji: "☀️" },
    { id: "news",      label: "Nyheter",  icon: "assets/ui/icon-news.svg", emoji: "📰" },
    { id: "todo",      label: "Todo",     icon: "assets/ui/icon-todo.svg", emoji: "✅" },
    { id: "ideas",     label: "Idéer",    icon: "assets/ui/icon-ideas.svg", emoji: "💡" },
    { id: "done",      label: "Done",     icon: "assets/ui/icon-done.svg", emoji: "🏁" },
    { id: "pomodoro",  label: "Timer",    icon: "assets/ui/icon-pomodoro.svg", emoji: "⏱️" },
    { id: "prio",      label: "Aktiv prio", icon: "assets/ui/icon-prio.svg", emoji: "🔥" },
  ];

  const STEP = 360 / VIEWS.length;
  let activeIndex = 0;

  const canVibrate = !!navigator.vibrate;
  const tick = (ms = 8) => { if (canVibrate) navigator.vibrate(ms); };

  function isSheetOpen() {
    return sheetWrap?.classList.contains("open");
  }
  function openSheet() {
    if (!sheetWrap) return;
    sheetWrap.classList.add("open");
    sheetWrap.setAttribute("aria-hidden", "false");
    applyView(activeIndex, { moveTrack: true });
  }
  function closeSheet() {
    if (!sheetWrap) return;
    sheetWrap.classList.remove("open");
    sheetWrap.setAttribute("aria-hidden", "true");
  }

  function setTrackTo(index) {
    if (!track) return;
    track.style.transform = `translateX(-${index * 100}%)`;
  }

  function setDialIcon(index) {
    const v = VIEWS[index];
    if (!v) return;

    if (!dialIcon) return;

    dialIcon.style.display = "block";
    dialIcon.src = v.icon;

    dialIcon.onerror = () => {
      dialIcon.style.display = "none";
      if (dialEmoji) {
        dialEmoji.textContent = v.emoji || "●";
        dialEmoji.style.display = "block";
      }
    };
    dialIcon.onload = () => {
      if (dialEmoji) dialEmoji.style.display = "none";
      dialIcon.style.display = "block";
    };
  }

  function applyView(index, { moveTrack = false } = {}) {
    activeIndex = ((index % VIEWS.length) + VIEWS.length) % VIEWS.length;
    const v = VIEWS[activeIndex];

    if (sheetSub) sheetSub.textContent = `Preview: ${v.label}`;
    setDialIcon(activeIndex);

    if (moveTrack || isSheetOpen()) setTrackTo(activeIndex);
  }

  // ---------- Rotation (smooth) ----------
  let isDragging = false;
  let startPointerAngle = 0;
  let startRotation = 0;
  let rotation = 0;

  let lastT = 0;
  let lastRot = 0;
  let vel = 0;
  let raf = 0;

  function stopInertia() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function nearestIndexFromRotation(deg) {
    const raw = Math.round(deg / STEP);
    return ((raw % VIEWS.length) + VIEWS.length) % VIEWS.length;
  }

  function renderRotation(deg) {
    rotation = deg;
    if (dialRing) dialRing.style.transform = `rotate(${deg}deg)`;

    const idx = nearestIndexFromRotation(rotation);
    if (idx !== activeIndex) {
      applyView(idx);
      tick(6);
    }
  }

  function snapToIndex(idx) {
    applyView(idx, { moveTrack: true });
    const target = idx * STEP;
    rotation = target;
    if (dialRing) dialRing.style.transform = `rotate(${target}deg)`;
    tick(10);
  }

  function startInertia() {
    stopInertia();
    const friction = 0.92;

    const step = () => {
      vel *= friction;
      if (Math.abs(vel) < 0.12) {
        snapToIndex(nearestIndexFromRotation(rotation));
        return;
      }
      rotation += vel;
      renderRotation(rotation);
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
  }

  function getAngleFromPointer(e) {
    const r = dial.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
  }

  let downX = 0, downY = 0, moved = false;

  function onPointerDown(e) {
    if (!dial) return;

    moved = false;
    downX = e.clientX;
    downY = e.clientY;

    stopInertia();
    isDragging = true;

    dial.setPointerCapture?.(e.pointerId);

    startPointerAngle = getAngleFromPointer(e);
    startRotation = rotation;

    lastT = performance.now();
    lastRot = rotation;
    vel = 0;

    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;

    const a = getAngleFromPointer(e);
    let delta = a - startPointerAngle;

    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    renderRotation(startRotation + delta);

    const t = performance.now();
    const dt = Math.max(8, t - lastT);
    vel = ((rotation - lastRot) / dt) * 16;
    vel = Math.max(-14, Math.min(14, vel));
    lastT = t;
    lastRot = rotation;

    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    e.preventDefault();

    if (!moved) {
      if (!isSheetOpen()) openSheet();
      return;
    }

    startInertia();
  }

  function onWheel(e) {
    e.preventDefault();
    e.stopPropagation();
    renderRotation(rotation + e.deltaY * 0.25);
  }

  if (dial) {
    dial.addEventListener("pointerdown", onPointerDown, { passive: false });
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerUp, { passive: false });

    dial.addEventListener("wheel", onWheel, { passive: false });
  }

  // ---------- Slide-to-close (drag handle) ----------
  if (sheetHandle && sheet) {
    let startY = 0;
    let startBottom = 0;
    let dragging = false;

    const getBottom = () => {
      const b = parseFloat(getComputedStyle(sheet).bottom);
      return Number.isFinite(b) ? b : 90;
    };

    sheetHandle.addEventListener("pointerdown", (e) => {
      dragging = true;
      startY = e.clientY;
      startBottom = getBottom();
      sheetHandle.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }, { passive: false });

    sheetHandle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;

      // dra ned = öka bottom mindre? vi flyttar sheet ned genom translateY
      const t = Math.max(0, dy);
      sheet.style.transform = `translateX(-50%) translateY(${t}px)`;
      e.preventDefault();
    }, { passive: false });

    sheetHandle.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;

      const dy = e.clientY - startY;
      if (dy > 120) {
        // close
        sheet.style.transform = `translateX(-50%) translateY(0px)`;
        closeSheet();
      } else {
        // snap back
        sheet.style.transform = `translateX(-50%) translateY(0px)`;
      }
      e.preventDefault();
    }, { passive: false });
  }

  // ---------- Init ----------
  applyView(0, { moveTrack: true });
  closeSheet();
})();
