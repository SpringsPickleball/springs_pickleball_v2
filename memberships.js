// ---------------------------------------------------------------
// Membership pricing + savings calculator
// Edit PLANS and GUEST_RATES below to change pricing assumptions.
// ---------------------------------------------------------------

const SIGNUP = {
  west: 'https://app.courtreserve.com/Online/Memberships/Public/8778',
  east: 'https://app.courtreserve.com/Online/Memberships/Public/15687',
};

const PLANS = {
  flex: {
    name: 'Flex',
    variants: {
      single: {
        annual: { name: 'Flex Annual Membership', amount: 39, label: '/mo', billingText: 'normally $49/mo' },
        monthly: { name: 'Flex Month to Month Membership', amount: 49, label: '/mo', billingText: 'no annual contract' },
      },
      couples: {
        annual: { name: 'Couples Flex Annual Membership', amount: 69, label: '/mo', billingText: 'normally $98/mo' },
      },
    },
    description: 'Save 50% on open play and court rentals, with early 7-day registration access.',
    perks: [
      '50% off court rentals and open play',
      '7-day advance registration for prime open play and court spots',
      'Free paddle demos and 10% account credit on paddle purchases',
      'Free access to dink room, gym, and shower rooms',
      'Discounts on leagues and Springs Pickleball-run tournaments',
    ],
  },
  unlimited: {
    name: 'Unlimited',
    featured: true,
    variants: {
      single: {
        annual: { name: 'Unlimited Annual Membership Special', amount: 99, label: '/mo', billingText: 'normally $139/mo' },
        monthly: { name: 'Unlimited Month to Month Membership', amount: 129, label: '/mo', billingText: 'no annual contract' },
      },
      couples: {
        annual: { name: 'Couples Unlimited Annual Membership Special', amount: 189, label: '/mo', billingText: 'normally $269/mo' },
      },
    },
    description: 'Never pay for open play or doubles court rentals, with 9-day advance reservations.',
    perks: [
      'Free court rentals for doubles play',
      'Free open play sessions',
      '9-day advance reservations',
      'Free drilling and singles time when courts are available',
      '50% off Springs Pickleball leagues and tournaments',
    ],
  },
  unlimited_plus: {
    name: 'Unlimited+',
    variants: {
      single: {
        annual: { name: 'Unlimited+ Annual Membership Special', amount: 139, label: '/mo', billingText: 'normally $169/mo' },
      },
      couples: {},
    },
    description: 'The ultimate membership with free court rentals, open play, leagues, tournaments, clinics, and guest passes.',
    perks: [
      'Free open play and court rentals for doubles play',
      'Free Springs Pickleball-hosted leagues and tournaments',
      '1 free clinic per month ($30 value)',
      '10-day advance reservations',
      'Guest passes included',
    ],
  },
};

const GUEST_RATES = {
  openPlay: 14,        // per 2-hr session
  courtPerHr: 30,      // per hour (full court up to 6)
  league: 120,         // per 6-week league
  tournament: 50,      // per tournament entry
};

// Flex-member rates for calculator
const FLEX_RATES = {
  openPlay: 7,
  courtPerHr: 15,
  league: 96,          // ~20% off
  tournament: 40,
};

// ---------------------------------------------------------------
// Render pricing cards based on toggle state
// ---------------------------------------------------------------

const state = { billing: 'annual', party: 'single' };
let calculatorStarted = false;

function planVariant(plan) {
  return plan.variants[state.party]?.[state.billing] || null;
}

function planAnnualCost(plan, billing = state.billing, party = state.party) {
  const variant = plan.variants[party]?.[billing] || null;
  if (!variant) return null;
  return variant.amount * 12;
}

function money(n) {
  return '$' + Math.round(n).toLocaleString();
}

function moneyMonthly(n) {
  return '$' + Math.round(n).toLocaleString();
}

function trackMembershipEvent(name, props = {}) {
  if (!window.spTrack) return;
  window.spTrack(name, {
    ...props,
    billing: state.billing,
    party: state.party,
  });
}

function calculatorInputs() {
  return {
    open_play_sessions_per_week: parseFloat(document.getElementById('calc-openplay')?.value) || 0,
    court_hours_per_week: parseFloat(document.getElementById('calc-court')?.value) || 0,
    leagues_per_year: parseFloat(document.getElementById('calc-leagues')?.value) || 0,
    tournaments_per_year: parseFloat(document.getElementById('calc-tourneys')?.value) || 0,
    kids_under_18_free_flex: parseFloat(document.getElementById('calc-kids')?.value) || 0,
    couples: Boolean(document.getElementById('calc-couples')?.checked),
  };
}

function trackCalculatorStarted(source) {
  if (calculatorStarted) return;
  calculatorStarted = true;
  trackMembershipEvent('membership_calculator_started', {
    source,
    ...calculatorInputs(),
  });
}

function renderPlans() {
  const grid = document.getElementById('plan-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.entries(PLANS).forEach(([key, plan]) => {
    const variant = planVariant(plan);
    if (!variant) return;

    const el = document.createElement('div');
    el.className = 'plan' + (plan.featured ? ' featured' : '');
    el.innerHTML = `
      <h3>${plan.name}</h3>
      <div class="price">${money(variant.amount)}<small>${variant.label}</small></div>
      ${variant?.name ? `<p class="plan-variant">${variant.name}</p>` : ''}
      ${variant?.billingText ? `<p class="plan-note">${variant.billingText}</p>` : ''}
      ${plan.description ? `<p>${plan.description}</p>` : ''}
      <ul>${plan.perks.map(p => `<li>${p}</li>`).join('')}</ul>
      <div class="plan-ctas">
        <a href="${SIGNUP.west}" class="btn" target="_blank" rel="noopener">Join at West</a>
        <a href="${SIGNUP.east}" class="btn" target="_blank" rel="noopener">Join at East</a>
      </div>
    `;
    el.querySelectorAll('.plan-ctas a').forEach(link => {
      link.addEventListener('click', () => {
        trackMembershipEvent('membership_plan_cta_clicked', {
          plan_key: key,
          plan_name: plan.name,
          variant_name: variant?.name || null,
          available: Boolean(variant),
          location: link.href.includes('/8778') ? 'west' : 'east',
        });
      });
    });
    grid.appendChild(el);
  });
}

// ---------------------------------------------------------------
// Toggles
// ---------------------------------------------------------------

function bindToggles() {
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.toggle;
      const value = btn.dataset.value;
      state[group] = value;
      document.querySelectorAll(`[data-toggle="${group}"]`).forEach(b => {
        b.classList.toggle('active', b.dataset.value === value);
      });
      renderPlans();
      trackMembershipEvent('membership_toggle_changed', {
        toggle: group,
        value,
      });
    });
  });
}

// ---------------------------------------------------------------
// Calculator: recommend the best-value plan
// ---------------------------------------------------------------

function calculate() {
  trackCalculatorStarted('calculate_button');
  trackMembershipEvent('membership_calculator_calculate_clicked', calculatorInputs());

  const openPlays = parseFloat(document.getElementById('calc-openplay').value) || 0;
  const courtHrs = parseFloat(document.getElementById('calc-court').value) || 0;
  const leagues = parseFloat(document.getElementById('calc-leagues').value) || 0;
  const tourneys = parseFloat(document.getElementById('calc-tourneys').value) || 0;
  const kids = Math.max(0, parseFloat(document.getElementById('calc-kids')?.value) || 0);
  const couples = document.getElementById('calc-couples').checked;

  const adultPlayers = couples ? 2 : 1;
  const totalPlayers = adultPlayers + kids;

  // Weekly events scaled to yearly
  const yearlyOpenPlay = openPlays * 52 * totalPlayers;
  const yearlyCourtHrs = courtHrs * 52 * totalPlayers;
  const yearlyLeagues = leagues * totalPlayers;
  const yearlyTourneys = tourneys * totalPlayers;
  const adultYearlyOpenPlay = openPlays * 52 * adultPlayers;
  const adultYearlyCourtHrs = courtHrs * 52 * adultPlayers;
  const adultYearlyLeagues = leagues * adultPlayers;
  const adultYearlyTourneys = tourneys * adultPlayers;
  const kidYearlyOpenPlay = openPlays * 52 * kids;
  const kidYearlyCourtHrs = courtHrs * 52 * kids;
  const kidYearlyLeagues = leagues * kids;
  const kidYearlyTourneys = tourneys * kids;

  const guestYearly =
    yearlyOpenPlay * GUEST_RATES.openPlay +
    yearlyCourtHrs * GUEST_RATES.courtPerHr +
    yearlyLeagues * GUEST_RATES.league +
    yearlyTourneys * GUEST_RATES.tournament;

  // Cost under each plan uses current annual pricing from CourtReserve.
  const party = couples ? 'couples' : 'single';
  const freeFlexKidUsage =
    kidYearlyOpenPlay * FLEX_RATES.openPlay +
    kidYearlyCourtHrs * FLEX_RATES.courtPerHr +
    kidYearlyLeagues * FLEX_RATES.league +
    kidYearlyTourneys * FLEX_RATES.tournament;

  const flexMembership = planAnnualCost(PLANS.flex, 'annual', party);
  const flexUsage =
    yearlyOpenPlay * FLEX_RATES.openPlay +
    yearlyCourtHrs * FLEX_RATES.courtPerHr +
    yearlyLeagues * FLEX_RATES.league +
    yearlyTourneys * FLEX_RATES.tournament;
  const flexTotal = flexMembership + flexUsage;

  const unlimitedMembership = planAnnualCost(PLANS.unlimited, 'annual', party);
  const unlimitedUsage =
    adultYearlyLeagues * GUEST_RATES.league * 0.5 + // 50% off leagues
    adultYearlyTourneys * GUEST_RATES.tournament * 0.5 +
    freeFlexKidUsage;
  const unlimitedTotal = unlimitedMembership + unlimitedUsage;

  const options = [
    { key: 'guest', name: 'Pay as Guest', total: guestYearly, dues: 0, usage: guestYearly },
    { key: 'flex', name: PLANS.flex.variants[party].annual.name || PLANS.flex.name, total: flexTotal, dues: flexMembership, usage: flexUsage },
    { key: 'unlimited', name: PLANS.unlimited.variants[party].annual.name || PLANS.unlimited.name, total: unlimitedTotal, dues: unlimitedMembership, usage: unlimitedUsage },
  ];

  const plusMembership = planAnnualCost(PLANS.unlimited_plus, 'annual', party);
  if (plusMembership !== null) {
    const plusUsage = freeFlexKidUsage;
    options.push({
      key: 'unlimited_plus',
      name: PLANS.unlimited_plus.variants[party].annual.name || PLANS.unlimited_plus.name,
      total: plusMembership + plusUsage,
      dues: plusMembership,
      usage: plusUsage,
    });
  }

  options.sort((a, b) => a.total - b.total);

  const best = options[0];
  const vsGuest = guestYearly - best.total;
  const guestMonthly = guestYearly / 12;
  const bestMonthly = best.total / 12;
  const bestDuesMonthly = best.dues / 12;
  const bestUsageMonthly = best.usage / 12;
  const monthlySavings = Math.max(0, vsGuest / 12);
  const annualSavings = Math.max(0, vsGuest);
  const bestIsMembership = best.key !== 'guest';
  const kidsNote = kids > 0
    ? `<p class="calc-kids-note">Includes ${kids} kid${kids === 1 ? '' : 's'} under 18 at $0 Free Flex dues, with Free Flex usage pricing applied to their play.</p>`
    : '';
  const savingsLead = monthlySavings > 0
    ? `${moneyMonthly(monthlySavings)}<small>/mo estimated savings</small>`
    : `$0<small>/mo estimated savings</small>`;
  const savingsSubhead = monthlySavings > 0
    ? `<p class="calc-save">About ${money(annualSavings)}/yr less than guest pricing</p>`
    : '<p class="calc-save muted">Guest pricing is currently your lowest estimate.</p>';

  const out = document.getElementById('calc-result');
  out.innerHTML = `
    <div class="calc-recommend">
      <span class="eyebrow">Best Savings Match</span>
      <h3>${best.name}</h3>
      <p class="calc-total calc-savings-total">${savingsLead}</p>
      ${savingsSubhead}
      <p class="calc-dues">Estimated total: ${moneyMonthly(bestMonthly)}/mo (${money(best.total)}/yr)${bestIsMembership ? `; plan dues ${moneyMonthly(bestDuesMonthly)}/mo${bestUsageMonthly > 0 ? ` + about ${moneyMonthly(bestUsageMonthly)}/mo usage` : ''}` : ''}</p>
      ${kidsNote}
    </div>
    <div class="calc-snapshot">
      <div>
        <span>Monthly savings</span>
        <strong>${monthlySavings > 0 ? moneyMonthly(monthlySavings) : '$0'}<small>/mo</small></strong>
      </div>
      <div>
        <span>Your best plan</span>
        <strong>${moneyMonthly(bestMonthly)}<small>/mo</small></strong>
      </div>
      <div>
        <span>Guest pricing</span>
        <strong>${moneyMonthly(guestMonthly)}<small>/mo</small></strong>
      </div>
    </div>
    <div class="calc-breakdown">
      <h4>Savings and estimated costs:</h4>
      <ol>
        ${options.map(o => {
          const usageText = o.key !== 'guest' && o.usage > 0 ? `, includes about ${moneyMonthly(o.usage / 12)}/mo usage` : '';
          const duesText = o.key !== 'guest' ? ` dues ${moneyMonthly(o.dues / 12)}/mo${usageText}` : ' pay-as-you-play';
          const optionSavings = Math.max(0, guestYearly - o.total);
          const savingsText = o.key !== 'guest' ? `, saves ${moneyMonthly(optionSavings / 12)}/mo` : '';
          return `<li><strong>${o.name}</strong> — ${moneyMonthly(o.total / 12)}/mo${savingsText} <span>(${money(o.total)}/yr; ${duesText})</span></li>`;
        }).join('')}
      </ol>
      <p class="calc-note">Estimates separate membership dues from projected usage. Kids under 18 are modeled with $0 Free Flex dues. Prime-time, weekend, and event-specific pricing may vary.</p>
    </div>
  `;
  out.style.display = 'block';

  trackMembershipEvent('membership_calculator_used', {
    open_play_sessions_per_week: openPlays,
    court_hours_per_week: courtHrs,
    leagues_per_year: leagues,
    tournaments_per_year: tourneys,
    kids_under_18_free_flex: kids,
    couples,
    best_plan_key: best.key,
    best_plan_name: best.name,
    guest_monthly: Math.round(guestMonthly),
    best_monthly: Math.round(bestMonthly),
    monthly_savings: Math.round(monthlySavings),
    annual_savings: Math.round(Math.max(0, vsGuest)),
  });
}

function resetCalculator() {
  trackMembershipEvent('membership_calculator_reset_clicked', calculatorInputs());

  ['calc-openplay', 'calc-court', 'calc-leagues', 'calc-tourneys', 'calc-kids'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '0';
  });

  const couples = document.getElementById('calc-couples');
  if (couples) couples.checked = false;

  const out = document.getElementById('calc-result');
  if (out) {
    out.innerHTML = '';
    out.style.display = 'none';
  }

  trackMembershipEvent('membership_calculator_reset');
}

// ---------------------------------------------------------------
// Init
// ---------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  renderPlans();
  bindToggles();
  ['calc-openplay', 'calc-court', 'calc-leagues', 'calc-tourneys', 'calc-kids'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('change', () => {
      trackCalculatorStarted(id);
      trackMembershipEvent('membership_calculator_input_changed', {
        field: id.replace('calc-', ''),
        ...calculatorInputs(),
      });
    });
  });
  const couples = document.getElementById('calc-couples');
  if (couples) {
    couples.addEventListener('change', () => {
      trackCalculatorStarted('calc-couples');
      trackMembershipEvent('membership_calculator_input_changed', {
        field: 'couples',
        ...calculatorInputs(),
      });
    });
  }
  const calcBtn = document.getElementById('calc-btn');
  if (calcBtn) calcBtn.addEventListener('click', calculate);
  const calcReset = document.getElementById('calc-reset');
  if (calcReset) calcReset.addEventListener('click', resetCalculator);
});
