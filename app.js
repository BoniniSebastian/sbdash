(() => {
  const CALENDAR_EMBED_URL = 'https://calendar.google.com/calendar/embed?src=ZXJpY3Nzb25ib25pbmlAZ21haWwuY29t&mode=AGENDA&ctz=Europe%2FStockholm&hl=sv&bgcolor=%23ffffff&showTitle=0&showTabs=0&showNav=0&showPrint=0&showCalendars=0&showDate=0';
  const DEFAULT_LOCATION = { name: 'Stockholm', lat: 59.3293, lon: 18.0686 };
  const WEATHER_URL = (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FStockholm&forecast_days=6`;
  const STORAGE_KEYS = {
    tasks: 'glassdash_tasks_v1',
    note: 'glassdash_note_v1',
    matches: 'glassdash_matches_v1',
    route: 'glassdash_route_v1',
  };

  const TV_SCRIPT = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  const TRACKED_QUOTES = [
    { id: 'metal_gold', label: 'XAU/USD', name: 'Guld', tv: 'OANDA:XAUUSD' },
    { id: 'metal_silver', label: 'XAG/USD', name: 'Silver', tv: 'OANDA:XAGUSD' },
    { id: 'oil', label: 'USOIL', name: 'Olja', tv: 'TVC:USOIL' },
    { id: 'eurusd', label: 'EUR/USD', name: 'EURUSD', tv: 'FX:EURUSD' },
    { id: 'nas', label: 'US100', name: 'Nasdaq 100', tv: 'OANDA:NAS100USD' },
    { id: 'eth', label: 'ETH', name: 'Ethereum', tv: 'BINANCE:ETHUSDT' },
    { id: 'btc', label: 'BTC', name: 'Bitcoin', tv: 'BINANCE:BTCUSDT' },
    { id: 'sol', label: 'SOL', name: 'Solana', tv: 'BINANCE:SOLUSDT' },
    { id: 'aapl', label: 'AAPL', name: 'Apple', tv: 'NASDAQ:AAPL' },
    { id: 'tsla', label: 'TSLA', name: 'Tesla', tv: 'NASDAQ:TSLA' },
    { id: 'nvda', label: 'NVDA', name: 'NVIDIA', tv: 'NASDAQ:NVDA' },
    { id: 'amd', label: 'AMD', name: 'AMD', tv: 'NASDAQ:AMD' },
  ];
  const STOCK_SYMBOL_BUTTONS = ['metal_gold', 'metal_silver', 'oil', 'nas', 'eth', 'eurusd'];
  let activeChartSymbol = 'metal_gold';

  const weatherState = {
    location: DEFAULT_LOCATION,
    data: null,
    loading: true,
    error: '',
  };

  const state = {
    tasks: loadJSON(STORAGE_KEYS.tasks, [
      { id: uid(), text: 'Skissa nästa version', done: false, subtasks: [{ id: uid(), text: 'Fler brickor', done: false }] },
      { id: uid(), text: 'Lägg in ikoner i Assets', done: false, subtasks: [] },
    ]),
    note: loadJSON(STORAGE_KEYS.note, { text: '', updatedAt: '' }),
    matches: loadJSON(STORAGE_KEYS.matches, [
      { id: uid(), date: 'Lör 10:00', title: 'Borta vs Huddinge', collect: '09:15', place: 'Björkängshallen', team: 'Pojkar 13', players: 'Milo', status: 'Kallad' },
    ]),
    route: loadJSON(STORAGE_KEYS.route, {
      day: 'Torsdag',
      steps: [
        { id: uid(), time: '08:00', title: 'Vi åker hemifrån', duration: '' },
        { id: uid(), time: '10:30', title: 'Laddstopp i Katrineholm', duration: '30' },
        { id: uid(), time: '11:00', title: 'Kör vidare', duration: '' },
        { id: uid(), time: '13:00', title: 'Lunch i Linköping', duration: '45' },
        { id: uid(), time: '13:45', title: 'Kör vidare', duration: '' },
        { id: uid(), time: '16:00', title: 'Framme', duration: '' },
      ],
    }),
  };

  const els = {
    tileGrid: document.getElementById('tileGrid'),
    overlay: document.getElementById('moduleOverlay'),
    moduleBody: document.getElementById('moduleBody'),
    moduleTitle: document.getElementById('moduleTitle'),
    moduleKicker: document.getElementById('moduleKicker'),
    moduleIcon: document.getElementById('moduleIcon'),
    closeBtn: document.getElementById('closeModuleBtn'),
    refreshAllBtn: document.getElementById('refreshAllBtn'),
  };

  const tiles = [
    { id: 'tasks', color: '#73d7ff', icon: 'Assets/tasks.png', emoji: '✓', title: 'Tasks', renderTile: renderTasksTile, renderModule: renderTasksModule, initModule: initTasksModule },
    { id: 'calendar', color: '#6ba3ff', icon: '📅', emoji: '📅', title: 'Kalender', renderTile: renderCalendarTile, renderModule: renderCalendarModule, initModule: initCalendarModule },
    { id: 'weather', color: '#88fff0', icon: '⛅', emoji: '⛅', title: 'Väder', renderTile: renderWeatherTile, renderModule: renderWeatherModule, initModule: initWeatherModule },
    { id: 'govee', color: '#ffc364', icon: 'Assets/govee.png', emoji: '💡', title: 'Govee', renderTile: renderGoveeTile, renderModule: renderGoveeModule, initModule: initGoveeModule },
    { id: 'notes', color: '#f28fff', icon: 'Assets/anteckningar.png', emoji: '📝', title: 'Anteckningar', renderTile: renderNotesTile, renderModule: renderNotesModule, initModule: initNotesModule },
    { id: 'stocks', color: '#8affb2', icon: '📈', emoji: '📈', title: 'Aktier', renderTile: renderStocksTile, renderModule: renderStocksModule, initModule: initStocksModule },
    { id: 'matches', color: '#ff8bb3', icon: '🏑', emoji: '🏑', title: 'Matcher', renderTile: renderMatchesTile, renderModule: renderMatchesModule, initModule: initMatchesModule },
    { id: 'logistics', color: '#ffd16e', icon: 'Assets/logistik.png', emoji: '🛣️', title: 'Logistik', renderTile: renderLogisticsTile, renderModule: renderLogisticsModule, initModule: initLogisticsModule },
  ];

  let activeTileId = null;

  function init() {
    renderTiles();
    bindGlobalEvents();
    bootWeather();
  }

  function bindGlobalEvents() {
    els.closeBtn.addEventListener('click', closeModule);
    els.overlay.addEventListener('click', (e) => {
      if (e.target === els.overlay) closeModule();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.overlay.classList.contains('isOpen')) closeModule();
    });
    els.refreshAllBtn.addEventListener('click', async () => {
      weatherState.loading = true;
      renderTiles();
      await bootWeather(true);
      if (activeTileId === 'weather') openModule('weather');
      if (activeTileId === 'stocks') openModule('stocks');
    });
  }

  function renderTiles() {
    els.tileGrid.innerHTML = tiles.map(tile => {
      return `<article class="tile" style="--tile:${tile.color}">
        <div class="tileAccent" style="background:${tile.color}"></div>
        <div class="tileGlow" style="background:radial-gradient(circle, ${hexToRgba(tile.color,.95)}, transparent 68%)"></div>
        <button type="button" class="tileBtn" data-open-tile="${tile.id}">
          <div class="tileInner">
            <div class="tileIcon">${renderIcon(tile.icon, tile.emoji)}</div>
            <div class="tilePreview">${tile.renderTile()}</div>
          </div>
        </button>
      </article>`;
    }).join('');

    els.tileGrid.querySelectorAll('[data-open-tile]').forEach(btn => {
      btn.addEventListener('click', () => openModule(btn.dataset.openTile));
    });
  }

  function openModule(tileId) {
    const tile = tiles.find(t => t.id === tileId);
    if (!tile) return;
    activeTileId = tileId;
    els.moduleTitle.textContent = tile.title;
    els.moduleKicker.textContent = 'modul';
    els.moduleIcon.innerHTML = renderIcon(tile.icon, tile.emoji);
    els.moduleBody.innerHTML = tile.renderModule();
    els.overlay.classList.add('isOpen');
    els.overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    tile.initModule?.();
  }

  function closeModule() {
    activeTileId = null;
    els.overlay.classList.remove('isOpen');
    els.overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    els.moduleBody.innerHTML = '';
  }

  function renderIcon(srcOrEmoji, emoji) {
    if (typeof srcOrEmoji === 'string' && srcOrEmoji.startsWith('Assets/')) {
      return `<img src="${srcOrEmoji}" alt="" onerror="this.outerHTML='<span class=iconEmoji>${emoji}</span>'">`;
    }
    return `<span class="iconEmoji">${srcOrEmoji || emoji}</span>`;
  }

  function renderTasksTile() {
    const open = state.tasks.filter(t => !t.done).length;
    const totalSubs = state.tasks.reduce((sum, t) => sum + (t.subtasks?.length || 0), 0);
    const next = state.tasks.find(t => !t.done);
    return `
      <div class="tileRows">
        <div class="rowMini"><span class="tileLabelCount">${open} kvar</span><span>${state.tasks.length} totalt</span></div>
        <div class="rowMini"><span>${next ? escapeHtml(next.text) : 'Allt klart'}</span><span>${totalSubs} delmål</span></div>
      </div>
      <div class="tileMeta"><div><div class="tileStat">Tasks</div><div class="tileSub">snabbt läge</div></div></div>`;
  }

  function renderCalendarTile() {
    return `
      <div class="tileRows">
        <div class="eventMini"><span>Nästa 5</span><span>Agenda</span></div>
        <div class="eventMini"><span>Google Kalender</span><span>live</span></div>
      </div>
      <div class="tileMeta"><div><div class="tileStat">Kalender</div><div class="tileSub">publik agenda</div></div></div>`;
  }

  function renderWeatherTile() {
    if (weatherState.loading) return `<div class="loadingText">Hämtar väder…</div><div class="tileMeta"><div><div class="tileStat">Väder</div><div class="tileSub">${weatherState.location.name}</div></div></div>`;
    if (weatherState.error || !weatherState.data?.current) return `<div class="mutedText">Kunde inte läsa väder</div><div class="tileMeta"><div><div class="tileStat">Väder</div><div class="tileSub">försök igen</div></div></div>`;
    const c = weatherState.data.current;
    return `
      <div class="weatherMini"><span>${weatherEmoji(c.weather_code)} ${weatherText(c.weather_code)}</span><span>${Math.round(c.temperature_2m)}°</span></div>
      <div class="weatherMini"><span>Känns som ${Math.round(c.apparent_temperature)}°</span><span>${Math.round(c.wind_speed_10m)} m/s</span></div>
      <div class="tileMeta"><div><div class="tileStat">${weatherState.location.name}</div><div class="tileSub">nu</div></div></div>`;
  }

  function renderGoveeTile() {
    return `
      <div class="tileRows">
        <div class="rowMini"><span>Scener</span><span>redo</span></div>
        <div class="rowMini"><span>On/off • ljusstyrka</span><span>v2</span></div>
      </div>
      <div class="tileMeta"><div><div class="tileStat">Govee</div><div class="tileSub">ui klart</div></div></div>`;
  }

  function renderNotesTile() {
    const text = state.note.text?.trim() || 'Tom anteckning just nu.';
    return `
      <div class="noteMini">${escapeHtml(text)}</div>
      <div class="tileMeta"><div><div class="tileStat">Anteckningar</div><div class="tileSub">autosave</div></div></div>`;
  }

  function renderStocksTile() {
    const top = TRACKED_QUOTES.slice(0, 4);
    return `
      <div class="stockMiniGrid">
        ${top.map((item, i) => `
          <div class="stockMiniCell ${i % 2 === 0 ? 'positive' : 'neutral'}">
            <div class="sym">${item.label}</div>
            <div class="val">live</div>
            <div class="chg">${i === 0 ? '2m chart' : 'öppna modul'}</div>
          </div>
        `).join('')}
      </div>
      <div class="tileMeta"><div><div class="tileStat">Aktier</div><div class="tileSub">guld • silver • olja • us100</div></div></div>`;
  }

  function renderMatchesTile() {
    const next = state.matches[0];
    return `
      <div class="tileRows">
        <div class="matchMini"><span>${state.matches.length} kort</span><span>${next?.status || 'tomt'}</span></div>
        <div class="matchMini"><span>${next ? escapeHtml(next.title) : 'Ingen match ännu'}</span><span>${next?.date || ''}</span></div>
      </div>
      <div class="tileMeta"><div><div class="tileStat">Matcher</div><div class="tileSub">scroll fixad</div></div></div>`;
  }

  function renderLogisticsTile() {
    const route = getRouteState();
    return `
      <div class="tileRows">
        <div class="routeMini"><span>${escapeHtml(state.route.day || 'Plan')}</span><span>${route.countdownLabel}</span></div>
        <div class="routeMini"><span>${route.nextTitle ? escapeHtml(route.nextTitle) : 'Ingen punkt vald'}</span><span>${route.nextTime || ''}</span></div>
      </div>
      <div class="tileMeta"><div><div class="tileStat">Logistik</div><div class="tileSub">waypoints</div></div></div>`;
  }

  function renderTasksModule() {
    return `
      <section class="moduleSection">
        <div class="sectionLabel">Skapa uppgift</div>
        <div class="inlineAdd">
          <input id="taskInput" class="softField" type="text" placeholder="Skriv ny uppgift och tryck enter" />
          <button id="addTaskBtn" class="plusBtn" type="button" aria-label="Lägg till">+</button>
        </div>
      </section>
      <section class="moduleSection">
        <div class="sectionLabel">Uppgifter</div>
        <div id="taskList" class="taskList"></div>
      </section>`;
  }

  function initTasksModule() {
    const input = document.getElementById('taskInput');
    const addBtn = document.getElementById('addTaskBtn');
    const list = document.getElementById('taskList');

    const rerender = () => {
      list.innerHTML = state.tasks.length ? state.tasks.map(task => `
        <article class="taskCard ${task.done ? 'done' : ''}" data-task-id="${task.id}">
          <div class="taskHead">
            <label class="checkWrap"><input type="checkbox" data-task-toggle="${task.id}" ${task.done ? 'checked' : ''}></label>
            <div class="taskContent">
              <div class="taskTitle">${escapeHtml(task.text)}</div>
              <div class="subtaskList">
                ${(task.subtasks || []).map(sub => `
                  <label class="subtaskItem">
                    <input type="checkbox" data-subtask-toggle="${task.id}:${sub.id}" ${sub.done ? 'checked' : ''}>
                    <span>${escapeHtml(sub.text)}</span>
                  </label>
                `).join('')}
              </div>
              <div class="subtaskAddRow">
                <input class="miniField" data-subtask-input="${task.id}" type="text" placeholder="Lägg till delmål" />
                <button class="miniAddBtn" data-subtask-add="${task.id}" type="button">+</button>
              </div>
            </div>
            <button class="ghostDelete" data-task-delete="${task.id}" type="button">×</button>
          </div>
        </article>
      `).join('') : `<div class="emptyState">Inga tasks ännu.</div>`;

      list.querySelectorAll('[data-task-toggle]').forEach(el => {
        el.addEventListener('change', () => {
          const task = state.tasks.find(t => t.id === el.dataset.taskToggle);
          if (!task) return;
          task.done = el.checked;
          saveJSON(STORAGE_KEYS.tasks, state.tasks);
          rerender();
          renderTiles();
        });
      });

      list.querySelectorAll('[data-task-delete]').forEach(el => {
        el.addEventListener('click', () => {
          state.tasks = state.tasks.filter(t => t.id !== el.dataset.taskDelete);
          saveJSON(STORAGE_KEYS.tasks, state.tasks);
          rerender();
          renderTiles();
        });
      });

      list.querySelectorAll('[data-subtask-add]').forEach(btn => {
        btn.addEventListener('click', () => addSubtask(btn.dataset.subtaskAdd));
      });

      list.querySelectorAll('[data-subtask-input]').forEach(inputEl => {
        inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') addSubtask(inputEl.dataset.subtaskInput);
        });
      });

      list.querySelectorAll('[data-subtask-toggle]').forEach(el => {
        el.addEventListener('change', () => {
          const [taskId, subId] = el.dataset.subtaskToggle.split(':');
          const task = state.tasks.find(t => t.id === taskId);
          const sub = task?.subtasks?.find(s => s.id === subId);
          if (!sub) return;
          sub.done = el.checked;
          saveJSON(STORAGE_KEYS.tasks, state.tasks);
          rerender();
          renderTiles();
        });
      });
    };

    const addTask = () => {
      const value = input.value.trim();
      if (!value) return;
      state.tasks.unshift({ id: uid(), text: value, done: false, subtasks: [] });
      input.value = '';
      saveJSON(STORAGE_KEYS.tasks, state.tasks);
      rerender();
      renderTiles();
      input.focus();
    };

    function addSubtask(taskId) {
      const field = list.querySelector(`[data-subtask-input="${taskId}"]`);
      const value = field?.value.trim();
      if (!value) return;
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;
      task.subtasks = task.subtasks || [];
      task.subtasks.push({ id: uid(), text: value, done: false });
      field.value = '';
      saveJSON(STORAGE_KEYS.tasks, state.tasks);
      rerender();
      renderTiles();
    }

    addBtn.addEventListener('click', addTask);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTask();
    });

    rerender();
  }

  function renderCalendarModule() {
    return `
      <section class="moduleSection noPadTop">
        <div class="calendarHeroBar"></div>
        <div class="calendarWrapLarge">
          <iframe src="${CALENDAR_EMBED_URL}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Google kalender"></iframe>
        </div>
      </section>`;
  }

  function initCalendarModule() {}

  function renderWeatherModule() {
    if (weatherState.loading) return `<section class="moduleSection"><div class="loadingText big">Hämtar väder…</div></section>`;
    if (weatherState.error || !weatherState.data) return `<section class="moduleSection"><div class="emptyState">Kunde inte hämta väder.</div></section>`;

    const { current, hourly, daily } = weatherState.data;
    const hourlyRows = (hourly?.time || []).slice(0, 8).map((time, i) => ({
      time,
      temp: hourly.temperature_2m?.[i],
      code: hourly.weather_code?.[i],
      rain: hourly.precipitation_probability?.[i],
    }));
    const dailyRows = (daily?.time || []).slice(0, 5).map((day, i) => ({
      day,
      max: daily.temperature_2m_max?.[i],
      min: daily.temperature_2m_min?.[i],
      code: daily.weather_code?.[i],
    }));

    return `
      <section class="moduleSection weatherNowSection">
        <div class="weatherNowIcon">${weatherEmoji(current.weather_code)}</div>
        <div class="weatherNowMain">${Math.round(current.temperature_2m)}°</div>
        <div class="weatherNowSub">Känns som ${Math.round(current.apparent_temperature)}° · ${weatherText(current.weather_code)}</div>
        <div class="weatherMetaRow">
          <span>Vind ${Math.round(current.wind_speed_10m)} m/s</span>
          <span>Fukt ${Math.round(current.relative_humidity_2m)}%</span>
          <span>${weatherState.location.name}</span>
        </div>
      </section>

      <section class="moduleSection">
        <div class="sectionLabel">Kommande timmar</div>
        <div class="hourlyStrip">
          ${hourlyRows.map(row => `
            <div class="hourCard">
              <div>${formatHour(row.time)}</div>
              <div class="wx">${weatherEmoji(row.code)}</div>
              <div>${Math.round(row.temp)}°</div>
              <div class="mutedTiny">${Math.round(row.rain || 0)}%</div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="moduleSection">
        <div class="sectionLabel">Kommande dagar</div>
        <div class="dailyList">
          ${dailyRows.map(row => `
            <div class="dayRow">
              <div>${formatDayShort(row.day)}</div>
              <div>${weatherEmoji(row.code)} ${weatherText(row.code)}</div>
              <div>${Math.round(row.max)}° / ${Math.round(row.min)}°</div>
            </div>
          `).join('')}
        </div>
      </section>`;
  }

  function initWeatherModule() {}

  function renderGoveeModule() {
    return `
      <section class="moduleSection">
        <div class="sectionLabel">Govee status</div>
        <div class="goveeLampHero">💡</div>
        <div class="goveeInfoText">UI redo för lampstyrning. Nästa steg är säker koppling via mellanlager så din API-nyckel inte ligger öppet i GitHub Pages.</div>
      </section>
      <section class="moduleSection goveeControls">
        <button class="goveeBtn">På</button>
        <button class="goveeBtn">Av</button>
        <button class="goveeBtn">Varm</button>
        <button class="goveeBtn">Kall</button>
        <button class="goveeBtn">Scene</button>
        <button class="goveeBtn">Glow</button>
      </section>`;
  }

  function initGoveeModule() {}

  function renderNotesModule() {
    return `
      <section class="moduleSection noteModuleSection">
        <div class="sectionLabel">Anteckning</div>
        <textarea id="noteArea" class="noteArea" placeholder="Skriv här…">${escapeHtml(state.note.text || '')}</textarea>
        <div id="noteStatus" class="noteStatus">${state.note.updatedAt ? `Sparad ${escapeHtml(state.note.updatedAt)}` : 'Autosave aktiv'}</div>
      </section>`;
  }

  function initNotesModule() {
    const area = document.getElementById('noteArea');
    const status = document.getElementById('noteStatus');
    area.addEventListener('input', () => {
      state.note.text = area.value;
      state.note.updatedAt = new Date().toLocaleString('sv-SE');
      saveJSON(STORAGE_KEYS.note, state.note);
      status.textContent = `Sparad ${state.note.updatedAt}`;
      renderTiles();
    });
  }

  function renderStocksModule() {
    const active = TRACKED_QUOTES.find(s => s.id === activeChartSymbol) || TRACKED_QUOTES[0];
    return `
      <section class="moduleSection noPadTop stocksModuleSection">
        <div class="chartShell">
          <div class="chartFrame" id="tvChartWrap">
            <div class="tvContainer" id="tvChartContainer"></div>
          </div>
        </div>
      </section>
      <section class="moduleSection stocksButtonsSection">
        <div class="sectionLabel">Symboler</div>
        <div class="symbolBar">
          ${STOCK_SYMBOL_BUTTONS.map(id => {
            const item = TRACKED_QUOTES.find(x => x.id === id);
            if (!item) return '';
            return `<button class="symbolBtn ${id === active.id ? 'active' : ''}" data-symbol-btn="${id}" type="button">${item.label}</button>`;
          }).join('')}
        </div>
      </section>`;
  }

  function initStocksModule() {
    const mount = () => {
      const wrap = document.getElementById('tvChartContainer');
      if (!wrap) return;
      wrap.innerHTML = '';
      const script = document.createElement('script');
      script.src = TV_SCRIPT;
      script.async = true;
      script.innerHTML = JSON.stringify({
        autosize: true,
        symbol: TRACKED_QUOTES.find(s => s.id === activeChartSymbol)?.tv || 'OANDA:XAUUSD',
        interval: '2',
        timezone: 'Europe/Stockholm',
        theme: 'dark',
        style: '1',
        locale: 'sv',
        enable_publishing: false,
        allow_symbol_change: false,
        hide_top_toolbar: false,
        withdateranges: false,
        save_image: false,
        hide_side_toolbar: false,
        container_id: 'tvChartContainer',
      });
      wrap.appendChild(script);
    };

    document.querySelectorAll('[data-symbol-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeChartSymbol = btn.dataset.symbolBtn;
        openModule('stocks');
      });
    });

    mount();
  }

  function renderMatchesModule() {
    return `
      <section class="moduleSection">
        <div class="sectionLabel">Ny match</div>
        <div class="matchFormGrid">
          <input class="softField" id="matchDate" placeholder="Datum / tid" />
          <input class="softField" id="matchTitle" placeholder="Motstånd / titel" />
          <input class="softField" id="matchCollect" placeholder="Samling" />
          <input class="softField" id="matchPlace" placeholder="Plats" />
          <input class="softField" id="matchTeam" placeholder="Lag" />
          <input class="softField" id="matchPlayers" placeholder="Spelare" />
          <input class="softField" id="matchStatus" placeholder="Status" />
          <button id="matchAddBtn" class="plusBtn wide" type="button">Lägg till</button>
        </div>
      </section>
      <section class="moduleSection fillScrollSection">
        <div class="sectionLabel">Matchkort</div>
        <div id="matchCards" class="matchesList"></div>
      </section>`;
  }

  function initMatchesModule() {
    const cards = document.getElementById('matchCards');
    const fields = {
      date: document.getElementById('matchDate'),
      title: document.getElementById('matchTitle'),
      collect: document.getElementById('matchCollect'),
      place: document.getElementById('matchPlace'),
      team: document.getElementById('matchTeam'),
      players: document.getElementById('matchPlayers'),
      status: document.getElementById('matchStatus'),
    };

    const render = () => {
      cards.innerHTML = state.matches.length ? state.matches.map(match => `
        <article class="matchCardLarge">
          <div class="matchCardTop">
            <div>
              <div class="matchMainTitle">${escapeHtml(match.title)}</div>
              <div class="matchMetaLine">${escapeHtml(match.date)} · ${escapeHtml(match.status || '')}</div>
            </div>
            <button class="ghostDelete" data-match-delete="${match.id}" type="button">×</button>
          </div>
          <div class="matchDetailsGrid">
            <div><span>Samling</span><strong>${escapeHtml(match.collect || '—')}</strong></div>
            <div><span>Plats</span><strong>${escapeHtml(match.place || '—')}</strong></div>
            <div><span>Lag</span><strong>${escapeHtml(match.team || '—')}</strong></div>
            <div><span>Spelare</span><strong>${escapeHtml(match.players || '—')}</strong></div>
          </div>
        </article>
      `).join('') : `<div class="emptyState">Inga matchkort ännu.</div>`;

      cards.querySelectorAll('[data-match-delete]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.matches = state.matches.filter(m => m.id !== btn.dataset.matchDelete);
          saveJSON(STORAGE_KEYS.matches, state.matches);
          render();
          renderTiles();
        });
      });
    };

    document.getElementById('matchAddBtn').addEventListener('click', () => {
      if (!fields.title.value.trim()) return;
      state.matches.unshift({
        id: uid(),
        date: fields.date.value.trim(),
        title: fields.title.value.trim(),
        collect: fields.collect.value.trim(),
        place: fields.place.value.trim(),
        team: fields.team.value.trim(),
        players: fields.players.value.trim(),
        status: fields.status.value.trim(),
      });
      Object.values(fields).forEach(el => el.value = '');
      saveJSON(STORAGE_KEYS.matches, state.matches);
      render();
      renderTiles();
    });

    render();
  }

  function renderLogisticsModule() {
    const route = getRouteState();
    return `
      <section class="moduleSection">
        <div class="sectionLabel">Plan</div>
        <div class="inlineAdd routeDayRow">
          <input id="routeDayInput" class="softField" type="text" placeholder="Dag" value="${escapeHtml(state.route.day || '')}" />
        </div>
        <div class="routeFocusCard">
          <div class="routeFocusTop">
            <span>${escapeHtml(route.nextTitle || 'Ingen kommande punkt')}</span>
            <strong>${route.nextTime || '—'}</strong>
          </div>
          <div class="routeCountdown">${route.countdownLabel}</div>
          <div class="progressTrack"><div class="progressFill" style="width:${route.progress}%"></div></div>
        </div>
      </section>
      <section class="moduleSection">
        <div class="sectionLabel">Ny waypoint</div>
        <div class="routeAddGrid">
          <input id="routeTimeInput" class="softField" placeholder="Tid 13:45" />
          <input id="routeTitleInput" class="softField" placeholder="Rubrik" />
          <input id="routeDurationInput" class="softField" placeholder="Minuter (valfritt)" />
          <button id="routeAddBtn" class="plusBtn wide" type="button">Lägg till</button>
        </div>
      </section>
      <section class="moduleSection fillScrollSection">
        <div class="sectionLabel">Waypoints</div>
        <div id="routeTimeline" class="routeTimeline"></div>
      </section>`;
  }

  function initLogisticsModule() {
    const timeline = document.getElementById('routeTimeline');
    const dayInput = document.getElementById('routeDayInput');
    const timeInput = document.getElementById('routeTimeInput');
    const titleInput = document.getElementById('routeTitleInput');
    const durationInput = document.getElementById('routeDurationInput');

    const render = () => {
      const route = getRouteState();
      timeline.innerHTML = state.route.steps.length ? state.route.steps
        .sort((a, b) => sortTime(a.time, b.time))
        .map(step => {
          const active = route.nextId === step.id;
          const segmentWidth = active ? route.progress : 0;
          return `
            <article class="routeStep ${active ? 'active' : ''}" data-route-id="${step.id}">
              <div class="routeDot"></div>
              <div class="routeStepMain">
                <div class="routeStepTop">
                  <input class="routeTimeField" data-route-time="${step.id}" value="${escapeHtml(step.time || '')}" />
                  <button class="ghostDelete" data-route-delete="${step.id}" type="button">×</button>
                </div>
                <input class="routeTitleField" data-route-title="${step.id}" value="${escapeHtml(step.title || '')}" />
                <input class="routeDurationField" data-route-duration="${step.id}" value="${escapeHtml(step.duration || '')}" placeholder="Minuter" />
                <div class="routeBarInline"><div class="routeBarFill" style="width:${segmentWidth}%"></div></div>
              </div>
            </article>`;
        }).join('') : `<div class="emptyState">Inga waypoints ännu.</div>`;

      timeline.querySelectorAll('[data-route-delete]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.route.steps = state.route.steps.filter(s => s.id !== btn.dataset.routeDelete);
          saveJSON(STORAGE_KEYS.route, state.route);
          render();
          renderTiles();
        });
      });

      timeline.querySelectorAll('[data-route-time], [data-route-title], [data-route-duration]').forEach(field => {
        field.addEventListener('input', () => {
          const routeId = field.dataset.routeTime || field.dataset.routeTitle || field.dataset.routeDuration;
          const step = state.route.steps.find(s => s.id === routeId);
          if (!step) return;
          if (field.dataset.routeTime) step.time = field.value;
          if (field.dataset.routeTitle) step.title = field.value;
          if (field.dataset.routeDuration) step.duration = field.value;
          saveJSON(STORAGE_KEYS.route, state.route);
          renderTiles();
        });
      });
    };

    document.getElementById('routeAddBtn').addEventListener('click', () => {
      if (!titleInput.value.trim()) return;
      state.route.day = dayInput.value.trim();
      state.route.steps.push({ id: uid(), time: timeInput.value.trim(), title: titleInput.value.trim(), duration: durationInput.value.trim() });
      timeInput.value = '';
      titleInput.value = '';
      durationInput.value = '';
      saveJSON(STORAGE_KEYS.route, state.route);
      render();
      renderTiles();
    });

    dayInput.addEventListener('input', () => {
      state.route.day = dayInput.value;
      saveJSON(STORAGE_KEYS.route, state.route);
      renderTiles();
    });

    render();
  }

  async function bootWeather(force = false) {
    try {
      weatherState.loading = true;
      weatherState.error = '';
      if (navigator.geolocation && !force) {
        await new Promise(resolve => {
          navigator.geolocation.getCurrentPosition(
            pos => {
              weatherState.location = { name: 'Din plats', lat: pos.coords.latitude, lon: pos.coords.longitude };
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: false, timeout: 2500, maximumAge: 600000 }
          );
        });
      }
      const res = await fetch(WEATHER_URL(weatherState.location.lat, weatherState.location.lon));
      const data = await res.json();
      weatherState.data = data;
    } catch (err) {
      weatherState.error = err?.message || 'Weather error';
    } finally {
      weatherState.loading = false;
      renderTiles();
    }
  }

  function getRouteState() {
    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const steps = [...(state.route.steps || [])].sort((a, b) => sortTime(a.time, b.time));
    if (!steps.length) return { nextTitle: '', nextTime: '', countdownLabel: 'Ingen plan', progress: 0, nextId: null };

    let nextIndex = steps.findIndex(step => toMinutes(step.time) >= minutesNow);
    if (nextIndex === -1) nextIndex = steps.length - 1;
    const next = steps[nextIndex];
    const prev = steps[Math.max(0, nextIndex - 1)];
    const nextMin = toMinutes(next.time);
    const prevMin = toMinutes(prev.time);
    const span = Math.max(1, nextMin - prevMin || 60);
    const progressed = Math.max(0, Math.min(span, minutesNow - prevMin));
    const progress = Math.max(2, Math.min(100, (progressed / span) * 100));
    const diff = nextMin - minutesNow;
    const countdownLabel = diff > 0 ? `${diff} min kvar` : diff === 0 ? 'nu' : 'passerad';

    return {
      nextTitle: next.title,
      nextTime: next.time,
      countdownLabel,
      progress,
      count: steps.length,
      nextId: next.id,
    };
  }

  function loadJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function escapeHtml(str = '') {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function weatherEmoji(code) {
    if ([0].includes(code)) return '☀️';
    if ([1, 2].includes(code)) return '🌤️';
    if ([3].includes(code)) return '☁️';
    if ([45, 48].includes(code)) return '🌫️';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
    if ([95, 96, 99].includes(code)) return '⛈️';
    return '⛅';
  }

  function weatherText(code) {
    if (code === 0) return 'Klart';
    if ([1, 2].includes(code)) return 'Halvklart';
    if (code === 3) return 'Mulet';
    if ([45, 48].includes(code)) return 'Dimma';
    if ([51, 53, 55].includes(code)) return 'Duggregn';
    if ([61, 63, 65, 80, 81, 82].includes(code)) return 'Regn';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snö';
    if ([95, 96, 99].includes(code)) return 'Åska';
    return 'Väder';
  }

  function formatHour(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDayShort(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('sv-SE', { weekday: 'short' });
  }

  function toMinutes(value = '') {
    const [h, m] = String(value).split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  }

  function sortTime(a, b) {
    return toMinutes(a) - toMinutes(b);
  }

  function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean.length === 3 ? clean.split('').map(x => x + x).join('') : clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  init();
})();
