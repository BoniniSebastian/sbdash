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
  const sheetCloseBtn = $("sheetCloseBtn");
  const sheetSub = $("sheetSub");

  const track = $("viewTrack");

  const dial = $("dial");
  const dialRing = $("dialRing");
  const dialIcon = $("dialIcon");
  const dialEmoji = $("dialEmoji");

  // ---------- Views ----------
  const VIEWS = [
    { id: "calendar", label: "Kalender", icon: "assets/ui/icon-calendar.svg", emoji: "📅" },
    { id: "prio",     label: "Aktiv prio", icon: "assets/ui/icon-prio.svg", emoji: "🔥" },
    { id: "weather",  label: "Väder", icon: "assets/ui/icon-weather.svg", emoji: "☀️" },
  ];

  // Start: stängd ruta, men vi har en aktiv “preview”
  const STEP = 360 / VIEWS.length;
  let activeIndex = 0;

  // ---------- Helpers ----------
  const canVibrate = !!navigator.vibrate;
  const tick = (ms = 8) => { if (canVibrate) navigator.vibrate(ms); };

  function isSheetOpen() {
    return sheetWrap?.classList.contains("open");
  }

  function openSheet() {
    if (!sheetWrap) return;
    sheetWrap.classList.add("open");
    sheetWrap.setAttribute("aria-hidden", "false");
    // när sheet öppnas: rendera den aktiva viewn direkt
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

    // prova ladda svg – om den failar visar vi emoji
    if (dialIcon) {
      dialIcon.style.display = "block";
      dialIcon.src = v.icon;

      dialIcon.onerror = () => {
        dialIcon.style.display = "none";
        if (dialEmoji) {
          dialEmoji.textContent = v.emoji || "●";
          dialEmoji.style.display = "block";
        }
      };

      // om den lyckas: göm emoji
      dialIcon.onload = () => {
        if (dialEmoji) dialEmoji.style.display = "none";
        dialIcon.style.display = "block";
      };
    } else {
      if (dialEmoji) {
        dialEmoji.textContent = v.emoji || "●";
        dialEmoji.style.display = "block";
      }
    }
  }

  function applyView(index, { moveTrack = false } = {}) {
    activeIndex = ((index % VIEWS.length) + VIEWS.length) % VIEWS.length;
    const v = VIEWS[activeIndex];

    // header/sub
    if (sheetSub) sheetSub.textContent = `Preview: ${v.label}`;

    // dial icon
    setDialIcon(activeIndex);

    // om sheet är öppet (eller om moveTrack tvingas): byt sida i tracken
    if (moveTrack || isSheetOpen()) {
      setTrackTo(activeIndex);
    }
  }

  // init preview
  applyView(activeIndex);

  // ---------- Dial rotation / smooth drag ----------
  let isDragging = false;
  let startPointerAngle = 0;
  let startRotation = 0;
  let rotation = 0;

  // inertia
  let lastT = 0;
  let lastRot = 0;
  let vel = 0;
  let raf = 0;

  function stopInertia() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function startInertia() {
    stopInertia();
    const friction = 0.92;

    const step = () => {
      vel *= friction;
      if (Math.abs(vel) < 0.12) {
        // snap till närmsta view
        const idx = nearestIndexFromRotation(rotation);
        snapToIndex(idx);
        return;
      }
      rotation += vel;
      renderRotation(rotation);
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
  }

  function renderRotation(deg) {
    rotation = deg;
    if (dialRing) dialRing.style.transform = `rotate(${deg}deg)`;

    // live preview by rotation
    const idx = nearestIndexFromRotation(rotation);
    if (idx !== activeIndex) {
      applyView(idx);
      tick(6);
    }
  }

  function nearestIndexFromRotation(deg) {
    const raw = Math.round(deg / STEP);
    return ((raw % VIEWS.length) + VIEWS.length) % VIEWS.length;
  }

  function snapToIndex(idx) {
    applyView(idx, { moveTrack: true });
    const target = idx * STEP;
    rotation = target;
    if (dialRing) dialRing.style.transform = `rotate(${target}deg)`;
    tick(10);
  }

  function getAngleFromPointer(e) {
    const r = dial.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
  }

  // CLICK vs DRAG (så vi kan trycka för att öppna)
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

    // KÄNSLA: samma som SB Dash (drag på höger sida nedåt => medurs)
    const next = startRotation + delta;

    renderRotation(next);

    // inertia velocity
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

    // om det var ett "tryck" (ingen drag): öppna sheet
    if (!moved) {
      if (!isSheetOpen()) {
        openSheet();
      } else {
        // sheet redan öppen -> inget extra, du scrollar bara för att byta view
      }
      return;
    }

    // annars inertia + snap
    startInertia();
  }

  // Desktop wheel on dial
  function onWheel(e) {
    // wheel ska bara påverka hjulet när man scrollar på hjulet
    e.preventDefault();
    e.stopPropagation();

    // scroll ned => medurs (känsla)
    const delta = e.deltaY * 0.25;
    renderRotation(rotation + delta);
  }

  if (dial) {
    dial.addEventListener("pointerdown", onPointerDown, { passive: false });
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerUp, { passive: false });

    dial.addEventListener("wheel", onWheel, { passive: false });
  }

  // ---------- Close button ----------
  if (sheetCloseBtn) sheetCloseBtn.addEventListener("click", closeSheet);

  // ---------- Start closed ----------
  closeSheet();
})();
