}
attachPullToRefresh(newsPage, newsPullHint, loadNews);

  // ---------- WEATHER ----------
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
  // ---------- Weather ----------
const weatherIconEl = $("weatherIcon");
const weatherTempEl = $("weatherTemp");
const weatherDescEl = $("weatherDesc");
const weatherWindEl = $("weatherWind");
const weatherPlaceEl = $("weatherPlace");
const weatherUpdatedEl = $("weatherUpdated");
const weatherRefreshBtn = $("weatherRefreshBtn");
const tomIconEl = $("tomIcon");
const tomTextEl = $("tomText");

const WEATHER_CACHE_KEY = "sbdash_weather_cache_v4";

function iconForCode(code) {
  if (code === 0) return "☀️";
  if (code === 1 || code === 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75].includes(code)) return "🌨️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "⛅️";
}
function textForCode(code) {
  const m = {
    0: "Klart",
    1: "Mestadels klart",
    2: "Delvis molnigt",
    3: "Mulet",
    45: "Dimma",
    48: "Isdimma",
    51: "Duggregn (lätt)",
    53: "Duggregn",
    55: "Duggregn (kraftigt)",
    61: "Regn (lätt)",
    63: "Regn",
    65: "Regn (kraftigt)",
    71: "Snö (lätt)",
    73: "Snö",
    75: "Snö (kraftigt)",
    80: "Skurar (lätta)",
    81: "Skurar",
    82: "Skurar (kraftiga)",
    95: "Åska",
    96: "Åska + hagel",
    99: "Åska + hagel",
  };
  return m[code] || `Väderkod ${code}`;
}

function saveWeatherCache(payload) {
  try { localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload)); } catch {}
}
function loadWeatherCache() {
  try { return JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || "null"); } catch { return null; }
}

function setWeatherUI({ t, w, code, placeLabel, updatedTs, tomCode, tomMin, tomMax }) {
  if (weatherIconEl) weatherIconEl.textContent = iconForCode(code);
  if (weatherTempEl) weatherTempEl.textContent = `${t}°`;
  if (weatherDescEl) weatherDescEl.textContent = textForCode(code);
  if (weatherWindEl) weatherWindEl.textContent = `${w} m/s`;
  if (weatherPlaceEl) weatherPlaceEl.textContent = placeLabel;

  if (weatherUpdatedEl) {
    weatherUpdatedEl.textContent = new Date(updatedTs).toLocaleString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
}

  function textForCode(code) {
    const m = {
      0:"Klart",1:"Mestadels klart",2:"Delvis molnigt",3:"Mulet",
      45:"Dimma",48:"Isdimma",
      51:"Duggregn (lätt)",53:"Duggregn",55:"Duggregn (kraftigt)",
      61:"Regn (lätt)",63:"Regn",65:"Regn (kraftigt)",
      71:"Snö (lätt)",73:"Snö",75:"Snö (kraftigt)",
      80:"Skurar (lätta)",81:"Skurar",82:"Skurar (kraftiga)",
      95:"Åska",96:"Åska + hagel",99:"Åska + hagel"
    };
    return m[code] || `Väderkod ${code}`;
  }
  if (tomIconEl) tomIconEl.textContent = iconForCode(tomCode);
  if (tomTextEl) tomTextEl.textContent = `${textForCode(tomCode)} • ${tomMin}°–${tomMax}°`;
}

// Rimlighetsfilter (så vi aldrig visar tokvärden)
function clampReasonableTempC(t) {
  // Sverige: vi tillåter stort spann, men stoppar absurda fel
  if (typeof t !== "number" || Number.isNaN(t)) return null;
  if (t > 35 || t < -40) return null;
  return t;
}

async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    `&current=temperature_2m,wind_speed_10m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&forecast_days=2` +
    `&temperature_unit=celsius` +           // <-- tvinga Celsius
    `&wind_speed_unit=ms` +
    `&timezone=Europe%2FStockholm`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("Weather fetch failed");
  return r.json();
}

async function loadWeather() {
  if (weatherDescEl) weatherDescEl.textContent = "Laddar…";

  const nowTs = Date.now();

  // 1) Försök geolocation
  const tryGeo = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("no geolocation"));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 7000,
        maximumAge: 30 * 60 * 1000,
      });
    });

  function getSavedCity() {
    const name = (localStorage.getItem(LS_CITY_NAME) || "").trim() || DEFAULT_CITY_NAME;
    const lat = Number(localStorage.getItem(LS_CITY_LAT));
    const lon = Number(localStorage.getItem(LS_CITY_LON));
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { name, lat, lon };
    return { name: DEFAULT_CITY_NAME, lat: DEFAULT_CITY_LAT, lon: DEFAULT_CITY_LON };
  }
  try {
    let lat = 59.3293, lon = 18.0686;
    let placeLabel = "Stockholm (fallback)";

  async function fetchWeather(lat, lon, label) {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&current=temperature_2m,wind_speed_10m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&forecast_days=2` +
      `&timezone=Europe%2FStockholm`;
    try {
      const pos = await tryGeo();
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
      placeLabel = "Din plats";
    } catch {
      // geo fail => Stockholm fallback
    }

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("Weather fetch failed");
    const data = await r.json();
    const data = await fetchWeather(lat, lon);

    const cur = data.current;
    const t = Math.round(cur.temperature_2m);
    const w = Math.round(cur.wind_speed_10m);
    const code = cur.weather_code;

    if (weatherIconEl) weatherIconEl.textContent = iconForCode(code);
    if (weatherTempEl) weatherTempEl.textContent = `${t}°`;
    if (weatherDescEl) weatherDescEl.textContent = textForCode(code);
    if (weatherWindEl) weatherWindEl.textContent = `${w} m/s`;
    if (weatherPlaceEl) weatherPlaceEl.textContent = label;
    if (weatherUpdatedEl) weatherUpdatedEl.textContent = new Date().toLocaleString("sv-SE", {
      hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
    });
    const cur = data.current || {};
    const daily = data.daily || {};

    const d = data.daily;
    if (d?.time?.length >= 2) {
      const tmax = Math.round(d.temperature_2m_max[1]);
      const tmin = Math.round(d.temperature_2m_min[1]);
      const c2 = d.weather_code[1];
      if (tomIconEl) tomIconEl.textContent = iconForCode(c2);
      if (tomTextEl) tomTextEl.textContent = `${textForCode(c2)} • ${tmin}°–${tmax}°`;
    }
  }
    const rawT = Math.round(cur.temperature_2m);
    const rawW = Math.round(cur.wind_speed_10m);
    const code = Number(cur.weather_code);

    const safeT = clampReasonableTempC(rawT);
    if (safeT === null) throw new Error("unreasonable temp");

    // Imorgon
    const tomCode = Number(daily.weather_code?.[1] ?? code);
    const tomMax = Math.round(daily.temperature_2m_max?.[1] ?? safeT);
    const tomMin = Math.round(daily.temperature_2m_min?.[1] ?? safeT);

  function loadWeather() {
    if (weatherDescEl) weatherDescEl.textContent = "Laddar…";
    const city = getSavedCity();
    fetchWeather(city.lat, city.lon, city.name).catch(() => {
    const payload = {
      t: safeT,
      w: Number.isFinite(rawW) ? rawW : 0,
      code: Number.isFinite(code) ? code : 3,
      placeLabel,
      updatedTs: nowTs,
      tomCode: Number.isFinite(tomCode) ? tomCode : 3,
      tomMin: Number.isFinite(tomMin) ? tomMin : safeT,
      tomMax: Number.isFinite(tomMax) ? tomMax : safeT,
    };

    setWeatherUI(payload);
    saveWeatherCache(payload);
  } catch (e) {
    // 2) Om något strular: visa cache
    const c = loadWeatherCache();
    if (c) {
      setWeatherUI({ ...c, placeLabel: (c.placeLabel || "Senaste") + " • cache" });
    } else {
if (weatherDescEl) weatherDescEl.textContent = "Kunde inte ladda väder.";
    });
      if (weatherTempEl) weatherTempEl.textContent = "--°";
      if (weatherPlaceEl) weatherPlaceEl.textContent = "—";
      if (weatherIconEl) weatherIconEl.textContent = "⛅️";
    }
}
}

  weatherRefreshBtn?.addEventListener("click", loadWeather);

if (weatherRefreshBtn) weatherRefreshBtn.addEventListener("click", loadWeather);
// ---------- POMODORO ----------
const pomoProg = $("pomoProg");
const pomoTime = $("pomoTime");
