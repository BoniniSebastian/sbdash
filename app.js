(() => {
  const $ = (id) => document.getElementById(id);

  // ---------------- Date ----------------
  const todayText = $("todayText");
  if (todayText) {
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE", { weekday: "long" });
    const date = now.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
    todayText.textContent = `${weekday} ${date}`;
  }

  // ---------------- Dial (wheel) ----------------
  const dial = $("dial");
  const dialRing = $("dialRing");
  const dialIcon = $("dialIcon");

  // Demo icons just to prove live swap works.
  // Du kan koppla detta senare till vyer.
  const ICONS = [
    "assets/ui/icon-calendar.svg",
    "assets/ui/icon-weather.svg",
    "assets/ui/icon-news.svg",
    "assets/ui/icon-todo.svg",
    "assets/ui/icon-ideas.svg",
    "assets/ui/icon-done.svg",
    "assets/ui/icon-pomodoro.svg",
  ];

  let rotation = 0;              // degrees
  let isDragging = false;
  let startPointerAngle = 0;
  let startRotation = 0;

  // inertia
  let lastMoveT = 0;
  let lastMoveRot = 0;
  let vel = 0;
  let raf = 0;

  const clampVel = (v) => Math.max(-14, Math.min(14, v));

  function setRotation(deg) {
    rotation = deg;
    if (dialRing) dialRing.style.transform = `rotate(${deg}deg)`;

    // live icon swap (snurra => byt)
    const idx = ((Math.round(deg / 45) % ICONS.length) + ICONS.length) % ICONS.length;
    if (dialIcon) dialIcon.src = ICONS[idx];
  }

  function getAngleFromPointer(e) {
    const r = dial.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const a = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    return a;
  }

  function stopInertia() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function startInertia() {
    stopInertia();
    const friction = 0.92;

    const step = () => {
      vel *= friction;
      if (Math.abs(vel) < 0.12) return;

      setRotation(rotation + vel);
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
  }

  function onPointerDown(e) {
    if (!dial) return;
    isDragging = true;
    stopInertia();

    dial.setPointerCapture?.(e.pointerId);

    startPointerAngle = getAngleFromPointer(e);
    startRotation = rotation;

    lastMoveT = performance.now();
    lastMoveRot = rotation;
    vel = 0;

    // hindra scroll bara när du tar i hjulet
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const a = getAngleFromPointer(e);
    let delta = a - startPointerAngle;

    // normalisera delta så den inte hoppar vid -180/180
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // Viktigt: invertera för "rätt känsla"
    // Drag ned på högersidan => ringen ska rotera medurs (känns som SB Dash)
    const next = startRotation + delta;

    setRotation(next);

    // velocity för inertia
    const t = performance.now();
    const dt = Math.max(8, t - lastMoveT);
    const dRot = rotation - lastMoveRot;
    vel = clampVel((dRot / dt) * 16);

    lastMoveT = t;
    lastMoveRot = rotation;

    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;

    // inertia kick
    startInertia();

    e.preventDefault();
  }

  // Desktop wheel on dial
  function onWheel(e) {
    // Bara om musen är över hjulet
    e.preventDefault();
    e.stopPropagation();

    // scroll ned => medurs
    const delta = e.deltaY * 0.25;
    setRotation(rotation + delta);
  }

  if (dial) {
    dial.addEventListener("pointerdown", onPointerDown, { passive: false });
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerUp, { passive: false });

    dial.addEventListener("wheel", onWheel, { passive: false });
  }

  // initial
  setRotation(0);

  // ---------------- Prio placeholder ----------------
  const prioList = $("prioList");
  if (prioList) {
    prioList.innerHTML = `
      <div style="opacity:.7; font-size:12px; line-height:1.4">
        (Aktiv prio kopplas in i nästa steg. Just nu testar vi layout + scroll + hjul.)
      </div>
    `;
  }
})();
