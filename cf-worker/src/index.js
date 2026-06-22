// Proxies CourtReserve's eventcalendar/eventlist for the East and West
// Springs Pickleball locations, merging both into one response so the
// CourtReserve Basic Auth credentials never reach the browser.
const ALLOWED_ORIGINS = [
  'https://springspickleball.com',
  'https://www.springspickleball.com'
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    if (!startDate || !endDate) {
      return json({ error: 'startDate and endDate are required' }, 400, headers);
    }

    const locations = [
      { name: 'West', username: env.CR_WEST_USERNAME, password: env.CR_WEST_PASSWORD },
      { name: 'East', username: env.CR_EAST_USERNAME, password: env.CR_EAST_PASSWORD }
    ];
    const params = new URLSearchParams({ startDate, endDate });

    const results = await Promise.allSettled(locations.map(async (loc) => {
      const res = await fetch(`https://api.courtreserve.com/api/v1/eventcalendar/eventlist?${params}`, {
        headers: { Authorization: 'Basic ' + btoa(`${loc.username}:${loc.password}`) }
      });
      const data = await res.json();
      // CourtReserve can return IsSuccessStatusCode: true with an
      // ErrorMessage and Data: null (e.g. when the date range exceeds its
      // 120-day max), so ErrorMessage alone must be treated as a failure.
      if (!data || data.ErrorMessage || data.IsSuccessStatusCode === false) {
        throw new Error((data && data.ErrorMessage) || `Request failed for ${loc.name}`);
      }
      return (data.Data || []).map((ev) => Object.assign({}, ev, { Location: loc.name }));
    }));

    const events = [];
    const failed = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') events.push(...r.value);
      else failed.push(locations[i].name);
    });

    return json({ events, failed }, 200, headers, 'public, max-age=3600');
  }
};

function json(body, status, headers, cacheControl) {
  const h = Object.assign({ 'Content-Type': 'application/json' }, headers);
  if (cacheControl) h['Cache-Control'] = cacheControl;
  return new Response(JSON.stringify(body), { status, headers: h });
}
