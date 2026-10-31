// Flex League standings (the #flex-standings section of leagues.html).
// Reads one JSON file that the Flex League email system publishes hourly from CourtReserve
// (FlexLeagueEmail run.publish_standings), so this page and the weekly email always agree.
// Players appear as "First L." only; the file carries no emails or full last names.
(function () {
  var DATA_URL = window.FLEX_STANDINGS_URL ||
    'https://xazxbmodtcgqtovxoboc.supabase.co/storage/v1/object/public/site-data/flex-standings.json';
  var REFRESH_MS = 10 * 60 * 1000;
  var STORE_KEY = 'flexStandingsLadder';

  var root = document.getElementById('flexStandings');
  if (!root) return;
  var body = root.querySelector('[data-fs-body]');
  var ladderNav = root.querySelector('[data-fs-ladders]');
  var foot = root.querySelector('[data-fs-foot]');
  var venueBtns = root.querySelectorAll('[data-fs-venue]');

  var data = null;
  var current = null; // selected ladder id
  var query = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function remember(id) {
    try { localStorage.setItem(STORE_KEY, String(id)); } catch (e) {}
  }

  function recalled() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }

  function pct(p) {
    if (p == null) return '—';
    return p === 100 ? '100%' : p.toFixed(1) + '%';
  }

  function move(m) {
    if (!m) return '<span class="fs-move fs-flat" aria-label="no change">—</span>';
    return m > 0
      ? '<span class="fs-move fs-up" aria-label="up ' + m + '">▲' + m + '</span>'
      : '<span class="fs-move fs-down" aria-label="down ' + (-m) + '">▼' + (-m) + '</span>';
  }

  function shortName(l) {
    return l.name.replace(/ Ladder$/, '');
  }

  function playedLabel(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function updatedLabel(iso) {
    var t = new Date(iso);
    var mins = Math.round((Date.now() - t.getTime()) / 60000);
    if (mins < 2) return 'just now';
    if (mins < 60) return mins + ' min ago';
    if (mins < 180) return Math.round(mins / 60) + (mins < 90 ? ' hour ago' : ' hours ago');
    return t.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function byId(id) {
    for (var i = 0; i < data.ladders.length; i++) if (String(data.ladders[i].id) === String(id)) return data.ladders[i];
    return null;
  }

  // ------------------------------------------------------------ picker
  function renderPicker() {
    var lad = byId(current);
    venueBtns.forEach(function (b) {
      var on = b.getAttribute('data-fs-venue') === lad.venue;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    ladderNav.innerHTML = data.ladders.filter(function (l) { return l.venue === lad.venue; }).map(function (l) {
      var on = l.id === lad.id;
      return '<button type="button" class="fs-chip' + (on ? ' active' : '') + '" data-fs-ladder="' + l.id + '"' +
        (on ? ' aria-current="true"' : '') + '>' + esc(shortName(l)) + '</button>';
    }).join('');
  }

  // ------------------------------------------------------------ ladder
  function podium(l) {
    var t = l.players;
    if (t.length < 3) return '';
    function cell(p, place, lead) {
      var mv = p.move ? (p.move > 0 ? '▲' + p.move + ' from #' + p.prev : '▼' + (-p.move) + ' from #' + p.prev) : '— held';
      return '<div class="fs-pod' + (lead ? ' fs-pod-lead' : '') + '">' +
        '<span class="fs-pod-tag">' + (lead ? 'Ladder leader' : '#' + place) + '</span>' +
        '<span class="fs-pod-num">' + (place < 10 ? '0' : '') + place + '</span>' +
        '<span class="fs-pod-name">' + esc(p.name) + '</span>' +
        '<span class="fs-pod-line">' + p.w + '–' + p.l + ' · ' + pct(p.pct) + '</span>' +
        '<span class="fs-pod-line">' + esc(mv) + '</span></div>';
    }
    return '<div class="fs-section"><span class="fs-kicker">Top of the ladder</span>' +
      '<div class="fs-podium">' + cell(t[1], 2) + cell(t[0], 1, true) + cell(t[2], 3) + '</div></div>';
  }

  function talking(l) {
    if (!l.talking_points.length) return '';
    return '<div class="fs-section"><span class="fs-kicker">Week ' + l.week + ' talking points</span><div class="fs-points">' +
      l.talking_points.map(function (t) {
        return '<div class="fs-point"><span class="fs-point-label">' + esc(t.label) + '</span>' +
          '<strong>' + esc(t.title) + '</strong><span>' + esc(t.detail) + '</span></div>';
      }).join('') + '</div></div>';
  }

  function rowsHtml(l) {
    var q = query.trim().toLowerCase();
    var rows = l.players.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) !== -1; });
    if (!rows.length) return '<tr><td colspan="5" class="fs-none">No player matches “' + esc(query) + '”.</td></tr>';
    return rows.map(function (p, i) {
      var top = p.rank && p.rank <= 3;
      var fire = p.streak >= 3 ? ' <span class="fs-fire" title="' + p.streak + ' straight wins">🔥' + p.streak + '</span>' : '';
      return '<tr class="' + (top ? 'fs-top' : '') + '">' +
        '<td class="fs-rank">' + (p.rank || '—') + '</td>' +
        '<td class="fs-name">' + esc(p.name) + ' ' + move(p.move) + fire + '</td>' +
        '<td class="fs-c">' + esc(p.dupr || '—') + '</td>' +
        '<td class="fs-c fs-strong">' + p.w + '–' + p.l + '</td>' +
        '<td class="fs-r fs-strong">' + pct(p.pct) + '</td></tr>';
    }).join('');
  }

  function table(l) {
    return '<div class="fs-section"><div class="fs-table-head"><div><span class="fs-kicker">The full ladder</span>' +
      '<h3>Standings after Week ' + l.week + '</h3></div>' +
      '<label class="fs-search"><span class="sr-only">Find a player</span>' +
      '<input type="search" placeholder="Find your name" value="' + esc(query) + '" data-fs-search autocomplete="off"></label></div>' +
      '<div class="fs-table-wrap"><table class="fs-table"><thead><tr>' +
      '<th scope="col" class="fs-rank">Rank</th><th scope="col">Player</th><th scope="col" class="fs-c">DUPR</th>' +
      '<th scope="col" class="fs-c">W–L</th><th scope="col" class="fs-r">Pts %</th></tr></thead>' +
      '<tbody data-fs-rows>' + rowsHtml(l) + '</tbody></table></div>' +
      '<p class="fs-note">Rank is CourtReserve’s official ladder rank. Arrows show the change since last week. 🔥 = 3+ wins in a row.</p></div>';
  }

  function summary(l) {
    var n = l.next;
    var nextHtml = '';
    if (n) {
      var who = n.optins != null ? ' · ' + n.optins + ' of ' + l.players_count + ' players in' : '';
      nextHtml = '<div class="fs-next"><div><span class="fs-kicker">' + (l.week ? 'Next up · Week ' + (l.week + 1) : 'Season starts') + '</span>' +
        '<strong>' + esc(n.label) + '</strong><span>' + esc(who.replace(/^ · /, '')) + '</span></div>' +
        '<a class="btn" href="' + esc(n.url) + '" target="_blank" rel="noopener">' + (l.week ? 'Opt in for ' + esc(n.short) : 'View in CourtReserve') + '</a></div>';
    } else if (l.week) {
      nextHtml = '<div class="fs-next fs-final"><div><span class="fs-kicker">Season complete</span><strong>Final standings</strong>' +
        '<span>That’s a wrap. See you next season.</span></div></div>';
    }
    var meta = l.week
      ? 'Week ' + l.week + ' of ' + l.weeks + ' · after ' + esc(playedLabel(l.played_on)) + ' · ' + l.players_count + ' players'
      : 'Not started yet';
    return '<div class="fs-summary"><div><span class="fs-venue-tag">' + esc(l.venue_name) + '</span>' +
      '<h2>' + esc(l.name) + '</h2><p class="fs-meta">' + meta + '</p></div>' + nextHtml + '</div>';
  }

  function numbers(l) {
    if (!l.numbers || !l.week) return '';
    var v = [[l.numbers.players, 'Players'], [l.numbers.games, 'Games'], [l.numbers.points.toLocaleString('en-US'), 'Points scored'],
      [l.numbers.weeks_left + ' of ' + l.weeks, 'Weeks left']];
    return '<div class="fs-section"><span class="fs-kicker">Week ' + l.week + ' by the numbers</span><div class="fs-numbers">' +
      v.map(function (x) { return '<div><strong>' + esc(x[0]) + '</strong><span>' + x[1] + '</span></div>'; }).join('') + '</div></div>';
  }

  function renderLadder() {
    var l = byId(current);
    if (!l.week) {
      body.innerHTML = summary(l) + '<p class="fs-status">Standings appear here after the first game day.</p>';
      return;
    }
    body.innerHTML = summary(l) + podium(l) + talking(l) + table(l) + numbers(l);
  }

  function render() {
    renderPicker();
    renderLadder();
    foot.hidden = false;
    foot.textContent = 'Updated ' + updatedLabel(data.generated_at) + ' from CourtReserve.';
  }

  function select(id, push) {
    if (!byId(id)) return;
    current = byId(id).id;
    query = '';
    remember(current);
    if (push) history.replaceState(null, '', '#' + current);
    render();
  }

  // ------------------------------------------------------------ events
  root.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-fs-ladder]');
    if (chip) return select(chip.getAttribute('data-fs-ladder'), true);
    var v = e.target.closest('[data-fs-venue]');
    if (v && data) {
      var venue = v.getAttribute('data-fs-venue');
      if (byId(current).venue === venue) return;
      var first = data.ladders.filter(function (l) { return l.venue === venue; })[0];
      if (first) select(first.id, true);
    }
  });

  root.addEventListener('input', function (e) {
    if (!e.target.matches('[data-fs-search]')) return;
    query = e.target.value;
    root.querySelector('[data-fs-rows]').innerHTML = rowsHtml(byId(current));
  });

  window.addEventListener('hashchange', function () {
    var id = location.hash.slice(1);
    if (data && byId(id) && String(id) !== String(current)) select(id, false);
  });

  function jump() {
    var el = document.getElementById('flex-standings');
    el.scrollIntoView({ behavior: 'instant' });
    // lazy images above it load as we arrive and push it down; follow it for a few seconds
    if (!window.ResizeObserver) return;
    var ro = new ResizeObserver(function () { el.scrollIntoView({ behavior: 'instant' }); });
    ro.observe(document.body);
    ['wheel', 'touchstart', 'keydown'].forEach(function (t) {
      window.addEventListener(t, function () { ro.disconnect(); }, { once: true, passive: true });
    });
    setTimeout(function () { ro.disconnect(); }, 4000);
  }

  // ------------------------------------------------------------ load
  function load(first) {
    var bust = Math.floor(Date.now() / 300000); // follows the file's 5-minute cache
    return fetch(DATA_URL + (DATA_URL.indexOf('?') === -1 ? '?' : '&') + 'v=' + bust)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        if (!d || !d.ladders || !d.ladders.length) throw new Error('empty');
        // next season's ladders are in the file before they start; hide them until their first game day
        var started = d.ladders.filter(function (l) { return l.week; });
        if (started.length) d.ladders = started;
        data = d;
        var season = document.querySelector('[data-fs-season]');
        if (season && d.season) season.textContent = d.season;
        var want = location.hash.slice(1) || recalled();
        if (!current || !byId(current)) current = (byId(want) || d.ladders[0]).id;
        if (first) {
          render();
          // a shared link to one ladder (leagues.html#30520) lands on the standings, not the top of the page
          if (byId(location.hash.slice(1))) jump();
        }
        else { renderPicker(); if (!query) renderLadder(); foot.textContent = 'Updated ' + updatedLabel(d.generated_at) + ' from CourtReserve.'; }
      })
      .catch(function () {
        if (data) return; // keep showing what we have
        body.innerHTML = '<p class="fs-status">Standings are taking a quick break. Check your ladder in the ' +
          '<a href="https://apps.apple.com/us/app/springs-pickleball/id6746125979" target="_blank" rel="noopener">Springs Pickleball app</a> ' +
          'or try again in a few minutes.</p>';
      });
  }

  load(true);
  setInterval(function () { if (!document.hidden) load(false); }, REFRESH_MS);
})();
