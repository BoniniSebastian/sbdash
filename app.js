(() => {

  const $ = id => document.getElementById(id);

  const wheel = $("wheel");
  const wheelRing = document.querySelector(".wheelRing");
  const wheelCenterText = $("wheelCenterText");
  const startIcon = $("startIcon");
  const sheetWrap = $("sheetWrap");
  const sheetTitle = $("sheetTitle");
  const sheetContent = $("sheetContent");
  const topDate = $("topDate");

  /* ===== Date ===== */
  function updateDate(){
    const now = new Date();
    topDate.textContent = now.toLocaleDateString("sv-SE", {
      weekday:"long",
      day:"2-digit",
      month:"long"
    });
  }
  updateDate();

  /* ===== Views ===== */
  const VIEWS = [
    { id:"calendar", label:"KALENDER", icon:"assets/ui/icon-calendar.svg" },
    { id:"prio",     label:"PRIOS",    icon:"assets/ui/icon-prio.svg" },
    { id:"weather",  label:"VÄDER",    icon:"assets/ui/icon-weather.svg" },
    { id:"news",     label:"NYHETER",  icon:"assets/ui/icon-news.svg" },
    { id:"lists",    label:"LISTOR",   icon:"assets/ui/icon-todo.svg" },
    { id:"ideas",    label:"IDÉER",    icon:"assets/ui/icon-ideas.svg" },
    { id:"timer",    label:"TIMER",    icon:"assets/ui/icon-pomodoro.svg" }
  ];

  let active = 0;
  const STEP = 360 / VIEWS.length;

  function updateView(){
    const v = VIEWS[active];

    wheelCenterText.textContent = v.label;
    startIcon.src = v.icon;
  }

  function setRotation(index){
    active = (index + VIEWS.length) % VIEWS.length;
    wheelRing.style.transform = `rotate(${active * STEP}deg)`;
    updateView();
  }

  /* ===== Wheel scroll ===== */
  wheel.addEventListener("wheel", e => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    setRotation(active + dir);
  });

  /* ===== Touch rotate ===== */
  let startY = 0;
  wheel.addEventListener("touchstart", e => {
    startY = e.touches[0].clientY;
  });

  wheel.addEventListener("touchend", e => {
    const delta = e.changedTouches[0].clientY - startY;
    if(Math.abs(delta) > 30){
      setRotation(active + (delta > 0 ? 1 : -1));
    }
  });

  /* ===== Open sheet ===== */
  wheel.addEventListener("click", () => {
    sheetWrap.classList.add("open");
    wheelCenterText.style.opacity = "0";

    const v = VIEWS[active];
    sheetTitle.textContent = v.label;
    sheetContent.innerHTML = `<p>Innehåll för ${v.label}</p>`;
  });

  sheetWrap.addEventListener("click", e => {
    if(e.target === sheetWrap){
      sheetWrap.classList.remove("open");
      wheelCenterText.style.opacity = "1";
    }
  });

  updateView();

})();