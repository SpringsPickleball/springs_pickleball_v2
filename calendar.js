// Unified Springs Pickleball calendar: merges CourtReserve public events from
// the East and West locations into one Day/Week/Month calendar.
(function () {
  'use strict';

  // Cloudflare Worker that holds the CourtReserve Basic Auth credentials and
  // proxies/merges the East + West eventcalendar/eventlist calls server-side.
  // See cf-worker/.
  var WORKER_URL = 'https://springs-pickleball-calendar.jdavisdev.workers.dev';

  var DEFAULT_CATEGORY_KEYWORDS = ['social', 'tournament'];
  var CACHE_KEY = 'sp_calendar_events_v1';
  var CACHE_TTL_MS = 60 * 60 * 1000;
  // CourtReserve's eventlist endpoint errors out above a 120-day window
  // (it returns IsSuccessStatusCode: true with no Data, no useful error
  // status - see cf-worker), so every fetch must stay under that.
  var MAX_RANGE_DAYS = 110;
  var PAST_BUFFER_DAYS = 15;

  var state = {
    view: 'week',
    anchor: startOfDay(new Date()),
    events: [],
    categories: [],
    activeCategories: null,
    fetchedRange: null,
    loading: false
  };

  var root = document.getElementById('cal-root');
  var statusEl = document.getElementById('cal-status');
  var rangeLabelEl = document.getElementById('cal-range-label');
  var filtersEl = document.getElementById('cal-filters');

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    document.querySelectorAll('.cal-view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setView(btn.getAttribute('data-view'));
      });
    });
    document.getElementById('cal-prev').addEventListener('click', function () { step(-1); });
    document.getElementById('cal-next').addEventListener('click', function () { step(1); });
    document.getElementById('cal-today').addEventListener('click', function () {
      state.anchor = startOfDay(new Date());
      render();
    });

    loadEvents().then(render);
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll('.cal-view-btn').forEach(function (btn) {
      var active = btn.getAttribute('data-view') === view;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    render();
  }

  function step(direction) {
    var d = new Date(state.anchor);
    if (state.view === 'day') d.setDate(d.getDate() + direction);
    else if (state.view === 'week') d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    state.anchor = d;
    maybeRefetch().then(render);
  }

  // ---- Data loading ----

  function loadEvents() {
    var cached = readCache();
    if (cached) {
      state.events = cached.events;
      state.fetchedRange = cached.range;
      buildCategoryFilters();
      return Promise.resolve();
    }
    var range = defaultRange();
    return fetchAndStore(range);
  }

  function maybeRefetch() {
    if (!state.fetchedRange) return loadEvents();
    var viewStart = rangeForView()[0];
    var viewEnd = rangeForView()[1];
    if (viewStart >= state.fetchedRange.start && viewEnd <= state.fetchedRange.end) {
      return Promise.resolve();
    }
    var start = addDays(viewStart, -PAST_BUFFER_DAYS);
    return fetchAndStore({ start: start, end: addDays(start, MAX_RANGE_DAYS) });
  }

  function defaultRange() {
    var start = addDays(state.anchor, -PAST_BUFFER_DAYS);
    return { start: start, end: addDays(start, MAX_RANGE_DAYS) };
  }

  function fetchAndStore(range) {
    state.loading = true;
    setStatus('Loading events…', false);
    var startDate = isoDate(range.start);
    var endDate = isoDate(range.end);
    var params = new URLSearchParams({ startDate: startDate, endDate: endDate });

    return fetch(WORKER_URL + '?' + params.toString())
      .then(function (res) { return res.json(); })
      .then(function (data) {
        state.loading = false;
        var events = (data.events || []).map(function (ev) { return normalizeEvent(ev, ev.Location); });
        var failedLocations = data.failed || [];

        events.sort(function (a, b) { return a.start - b.start; });
        state.events = events;
        state.fetchedRange = range;
        writeCache({ events: events, range: range });
        buildCategoryFilters();

        if (failedLocations.length >= 2) {
          setStatus('Unable to load events right now. Please check back soon, or see the full schedule on the Event Schedule page.', true);
        } else if (failedLocations.length) {
          setStatus('Could not load ' + failedLocations.join(' and ') + ' events right now. Showing what is available.', true);
        } else if (!events.length) {
          setStatus('No upcoming events found for this range.', false);
        } else {
          setStatus('', false);
        }
      })
      .catch(function () {
        state.loading = false;
        setStatus('Unable to load events right now. Please check back soon, or see the full schedule on the Event Schedule page.', true);
      });
  }

  function normalizeEvent(ev, loc) {
    return {
      id: loc + '-' + ev.EventId,
      title: ev.EventName || 'Event',
      start: ev.StartDateTime ? new Date(ev.StartDateTime) : null,
      end: ev.EndDateTime ? new Date(ev.EndDateTime) : null,
      categoryName: ev.EventCategoryName || 'Other',
      location: loc,
      url: ev.PublicEventUrl || ev.SsoUrl || '#',
      isCanceled: !!ev.IsCanceled
    };
  }

  // ---- Cache ----

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
      return {
        events: parsed.events.map(function (e) {
          return Object.assign({}, e, {
            start: e.start ? new Date(e.start) : null,
            end: e.end ? new Date(e.end) : null
          });
        }),
        range: { start: new Date(parsed.range.start), end: new Date(parsed.range.end) }
      };
    } catch (e) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        events: data.events,
        range: { start: data.range.start, end: data.range.end }
      }));
    } catch (e) { /* storage unavailable or full; ignore */ }
  }

  // ---- Category filters ----

  function isDefaultCategory(name) {
    var lower = name.toLowerCase();
    return DEFAULT_CATEGORY_KEYWORDS.some(function (kw) { return lower.indexOf(kw) !== -1; });
  }

  function buildCategoryFilters() {
    var found = Array.from(new Set(state.events.map(function (e) { return e.categoryName; }))).sort();
    var available = found.length ? found : ['Social Events', 'Tournaments'];
    // Only Social Events and Tournaments are offered as filters for now; the
    // other CourtReserve categories (Open Play, Clinics, Lessons, etc.) are
    // hidden entirely rather than just left unchecked.
    var categories = available.filter(isDefaultCategory);

    if (state.activeCategories === null) {
      state.activeCategories = new Set(categories);
    } else {
      state.activeCategories = new Set(Array.from(state.activeCategories).filter(function (c) {
        return categories.indexOf(c) !== -1;
      }));
    }
    state.categories = categories;

    filtersEl.querySelectorAll('label').forEach(function (l) { l.remove(); });
    categories.forEach(function (cat) {
      var label = document.createElement('label');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.value = cat;
      input.checked = state.activeCategories.has(cat);
      input.addEventListener('change', function () {
        if (input.checked) state.activeCategories.add(cat);
        else state.activeCategories.delete(cat);
        render();
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + cat));
      filtersEl.appendChild(label);
    });
  }

  function filteredEvents() {
    if (!state.activeCategories || !state.activeCategories.size) return [];
    return state.events.filter(function (e) {
      return !e.isCanceled && state.activeCategories.has(e.categoryName) && e.start;
    });
  }

  // ---- Rendering ----

  function render() {
    if (state.view === 'day') renderDay();
    else if (state.view === 'week') renderWeek();
    else renderMonth();
  }

  function rangeForView() {
    if (state.view === 'day') {
      return [startOfDay(state.anchor), addDays(startOfDay(state.anchor), 1)];
    }
    if (state.view === 'week') {
      var ws = startOfWeek(state.anchor);
      return [ws, addDays(ws, 7)];
    }
    var ms = startOfMonth(state.anchor);
    return [startOfWeek(ms), addDays(startOfWeek(addDays(endOfMonth(state.anchor), 1)), 0)];
  }

  function renderDay() {
    var day = startOfDay(state.anchor);
    rangeLabelEl.textContent = formatDate(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    var events = filteredEvents().filter(function (e) { return sameDay(e.start, day); });
    events.sort(function (a, b) { return a.start - b.start; });

    root.innerHTML = '';
    var list = document.createElement('div');
    list.className = 'cal-day-list';
    if (!events.length) {
      list.appendChild(emptyMessage('No Matching Events Today'));
    } else {
      events.forEach(function (e) { list.appendChild(eventListItem(e, true)); });
    }
    root.appendChild(list);
  }

  function renderWeek() {
    var ws = startOfWeek(state.anchor);
    var days = [];
    for (var i = 0; i < 7; i++) days.push(addDays(ws, i));
    rangeLabelEl.textContent = formatDate(ws, { month: 'short', day: 'numeric' }) + ' – ' +
      formatDate(addDays(ws, 6), { month: 'short', day: 'numeric', year: 'numeric' });

    var events = filteredEvents();
    root.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'cal-week-grid';
    days.forEach(function (day) {
      var dayEvents = events.filter(function (e) { return sameDay(e.start, day); })
        .sort(function (a, b) { return a.start - b.start; });

      var col = document.createElement('div');
      col.className = 'cal-week-col' + (sameDay(day, new Date()) ? ' is-today' : '') +
        (dayEvents.length ? ' has-events' : ' is-empty');
      var head = document.createElement('div');
      head.className = 'cal-week-col-head';
      head.textContent = formatDate(day, { weekday: 'short', day: 'numeric' });
      col.appendChild(head);

      if (!dayEvents.length) {
        col.appendChild(emptyMessage('No Matching Events Today'));
      } else {
        dayEvents.forEach(function (e) { col.appendChild(eventListItem(e, false)); });
      }
      grid.appendChild(col);
    });
    root.appendChild(grid);
  }

  function renderMonth() {
    var monthStart = startOfMonth(state.anchor);
    var monthEnd = endOfMonth(state.anchor);
    var gridStart = startOfWeek(monthStart);
    var gridEnd = startOfWeek(addDays(monthEnd, 7));
    rangeLabelEl.textContent = formatDate(state.anchor, { month: 'long', year: 'numeric' });

    var events = filteredEvents();
    root.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'cal-month-grid';

    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(function (d) {
      var h = document.createElement('div');
      h.className = 'cal-month-dow';
      h.textContent = d;
      grid.appendChild(h);
    });

    var day = new Date(gridStart);
    while (day < gridEnd) {
      (function (cellDay) {
        var cell = document.createElement('div');
        cell.className = 'cal-month-cell';
        if (cellDay.getMonth() !== monthStart.getMonth()) cell.classList.add('is-outside');
        if (sameDay(cellDay, new Date())) cell.classList.add('is-today');

        var num = document.createElement('div');
        num.className = 'cal-month-daynum';
        num.textContent = cellDay.getDate();
        cell.appendChild(num);

        var dayEvents = events.filter(function (e) { return sameDay(e.start, cellDay); })
          .sort(function (a, b) { return a.start - b.start; });
        var shown = dayEvents.slice(0, 3);
        shown.forEach(function (e) {
          var chip = document.createElement('a');
          chip.className = 'cal-month-chip cal-loc-' + e.location.toLowerCase();
          chip.href = e.url;
          chip.target = '_blank';
          chip.rel = 'noopener';
          chip.textContent = e.title;
          cell.appendChild(chip);
        });
        if (dayEvents.length > shown.length) {
          var more = document.createElement('button');
          more.type = 'button';
          more.className = 'cal-month-more';
          more.textContent = '+' + (dayEvents.length - shown.length) + ' more';
          more.addEventListener('click', function () {
            state.anchor = cellDay;
            setView('day');
          });
          cell.appendChild(more);
        }
        grid.appendChild(cell);
      })(new Date(day));
      day.setDate(day.getDate() + 1);
    }
    root.appendChild(grid);
  }

  function eventListItem(e, detailed) {
    var item = document.createElement('a');
    item.className = 'cal-event-item cal-loc-' + e.location.toLowerCase();
    item.href = e.url;
    item.target = '_blank';
    item.rel = 'noopener';

    var loc = document.createElement('span');
    loc.className = 'cal-event-loc';
    loc.textContent = e.location;
    item.appendChild(loc);

    var time = document.createElement('span');
    time.className = 'cal-event-time';
    time.textContent = formatTime(e.start) + (e.end ? '–' + formatTime(e.end) : '');
    item.appendChild(time);

    var title = document.createElement('span');
    title.className = 'cal-event-title';
    title.textContent = e.title;
    item.appendChild(title);

    if (detailed) {
      var meta = document.createElement('span');
      meta.className = 'cal-event-meta';
      meta.textContent = e.categoryName;
      item.appendChild(meta);
    }
    return item;
  }

  function emptyMessage(text) {
    var p = document.createElement('p');
    p.className = 'cal-empty';
    p.textContent = text;
    return p;
  }

  function setStatus(message, isError) {
    if (!message) {
      statusEl.hidden = true;
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle('cal-status-error', !!isError);
  }

  // ---- Date helpers ----

  function startOfDay(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function startOfWeek(d) {
    var x = startOfDay(d);
    x.setDate(x.getDate() - x.getDay());
    return x;
  }
  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  function endOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }
  function addDays(d, n) {
    var x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }
  function sameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function isoDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function formatDate(d, opts) {
    return d.toLocaleDateString('en-US', opts);
  }
  function formatTime(d) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
})();
