// ---------------------------------------------------------------
// Membership pricing + savings calculator
// Edit PLANS and GUEST_RATES below to change pricing assumptions.
// ---------------------------------------------------------------

const SIGNUP = {
  west: 'https://app.courtreserve.com/Online/Memberships/Public/8778',
  east: 'https://app.courtreserve.com/Online/Memberships/Public/15687',
};

const PLANS = {
  guest: {
    name: 'Free Member Account',
    variants: {
      single: {
        annual: { name: 'Free Member Account', amount: 0, label: '/mo', billingText: 'free account; pay as you play' },
        monthly: { name: 'Free Member Account', amount: 0, label: '/mo', billingText: 'free account; pay as you play' },
      },
      couples: {
        annual: { name: 'Free Member Account', amount: 0, label: '/mo', billingText: 'each player creates a free member account' },
        monthly: { name: 'Free Member Account', amount: 0, label: '/mo', billingText: 'each player creates a free member account' },
      },
    },
    description: 'Create a free account to book courts and open play at guest rates.',
    perks: [
      'No monthly membership dues',
      'Pay standard guest rates for courts and open play',
      '3-day advance booking access',
      'Access to both Springs Pickleball locations',
      'Upgrade to Flex or Unlimited any time',
    ],
  },
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
      'Children under 18 receive Flex rates',
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
      'Children under 18 receive Flex rates',
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
  tournament: 60,      // typical tournament entry
  clinic: 30,          // per clinic
};

// Flex-member rates for calculator
const FLEX_RATES = {
  openPlay: 7,
  courtPerHr: 15,
  league: 96,          // ~20% off
  tournament: 48,      // ~20% off
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

function inputNumber(id) {
  return Math.max(0, parseFloat(document.getElementById(id)?.value) || 0);
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
    open_play_sessions_per_week: inputNumber('calc-openplay'),
    court_hours_per_week: inputNumber('calc-court'),
    leagues_per_year: inputNumber('calc-leagues'),
    tournaments_per_year: inputNumber('calc-tourneys'),
    clinics_per_month: inputNumber('calc-clinics'),
    kids_under_18_free_flex: inputNumber('calc-kids'),
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
    el.className = ['plan', `plan-${key}`, plan.featured ? 'featured' : ''].filter(Boolean).join(' ');
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

  const openPlays = inputNumber('calc-openplay');
  const courtHrs = inputNumber('calc-court');
  const leagues = inputNumber('calc-leagues');
  const tourneys = inputNumber('calc-tourneys');
  const clinics = inputNumber('calc-clinics');
  const kids = inputNumber('calc-kids');
  const couples = document.getElementById('calc-couples').checked;

  const adultPlayers = couples ? 2 : 1;

  // Weekly events scaled to yearly for paying adult players.
  const yearlyOpenPlay = openPlays * 52 * adultPlayers;
  const yearlyCourtHrs = courtHrs * 52 * adultPlayers;
  const yearlyLeagues = leagues * adultPlayers;
  const yearlyTourneys = tourneys * adultPlayers;
  const yearlyClinics = clinics * 12 * adultPlayers;
  const adultYearlyOpenPlay = openPlays * 52 * adultPlayers;
  const adultYearlyCourtHrs = courtHrs * 52 * adultPlayers;
  const adultYearlyLeagues = leagues * adultPlayers;
  const adultYearlyTourneys = tourneys * adultPlayers;
  const adultYearlyClinics = clinics * 12 * adultPlayers;

  const guestYearly =
    yearlyOpenPlay * GUEST_RATES.openPlay +
    yearlyCourtHrs * GUEST_RATES.courtPerHr +
    yearlyLeagues * GUEST_RATES.league +
    yearlyTourneys * GUEST_RATES.tournament +
    yearlyClinics * GUEST_RATES.clinic;

  // Cost under each plan uses current annual pricing from CourtReserve.
  const party = couples ? 'couples' : 'single';

  const flexMembership = planAnnualCost(PLANS.flex, 'annual', party);
  const flexUsage =
    adultYearlyOpenPlay * FLEX_RATES.openPlay +
    adultYearlyCourtHrs * FLEX_RATES.courtPerHr +
    adultYearlyLeagues * FLEX_RATES.league +
    adultYearlyTourneys * FLEX_RATES.tournament +
    adultYearlyClinics * GUEST_RATES.clinic;
  const flexTotal = flexMembership + flexUsage;

  const unlimitedMembership = planAnnualCost(PLANS.unlimited, 'annual', party);
  const unlimitedUsage =
    adultYearlyLeagues * GUEST_RATES.league * 0.5 +
    adultYearlyTourneys * GUEST_RATES.tournament * 0.5 +
    adultYearlyClinics * GUEST_RATES.clinic; // Unlimited gets 50% off adult events; clinics are paid separately.
  const unlimitedTotal = unlimitedMembership + unlimitedUsage;

  const options = [
    { key: 'guest', name: 'Pay as Guest', total: guestYearly, dues: 0, usage: guestYearly, includedValue: 0, benefitRank: 0 },
    { key: 'flex', name: PLANS.flex.variants[party].annual.name || PLANS.flex.name, total: flexTotal, dues: flexMembership, usage: flexUsage, includedValue: 0, benefitRank: 1 },
    { key: 'unlimited', name: PLANS.unlimited.variants[party].annual.name || PLANS.unlimited.name, total: unlimitedTotal, dues: unlimitedMembership, usage: unlimitedUsage, includedValue: 0, benefitRank: 2 },
  ];

  const plusMembership = planAnnualCost(PLANS.unlimited_plus, 'annual', party);
  if (plusMembership !== null) {
    const includedClinicsMonthly = Math.min(clinics, 1) * adultPlayers;
    const paidClinicsMonthly = Math.max(0, clinics - 1) * adultPlayers;
    const plusUsage = paidClinicsMonthly * 12 * GUEST_RATES.clinic; // Unlimited+ includes adult leagues, tournaments, and one clinic per month.
    const plusIncludedValue =
      adultYearlyLeagues * GUEST_RATES.league +
      adultYearlyTourneys * GUEST_RATES.tournament +
      includedClinicsMonthly * 12 * GUEST_RATES.clinic;
    options.push({
      key: 'unlimited_plus',
      name: PLANS.unlimited_plus.variants[party].annual.name || PLANS.unlimited_plus.name,
      total: plusMembership + plusUsage,
      dues: plusMembership,
      usage: plusUsage,
      includedValue: plusIncludedValue,
      benefitRank: 3,
    });
  }

  options.forEach(option => {
    option.comparisonTotal = option.total;
  });
  options.sort((a, b) => {
    const costDifference = a.comparisonTotal - b.comparisonTotal;
    if (Math.abs(costDifference) > 1) return costDifference;
    return b.benefitRank - a.benefitRank;
  });

  const best = options[0];
  const vsGuest = guestYearly - best.comparisonTotal;
  const guestMonthly = guestYearly / 12;
  const bestMonthly = best.total / 12;
  const bestDuesMonthly = best.dues / 12;
  const bestUsageMonthly = best.usage / 12;
  const bestIncludedMonthly = best.includedValue / 12;
  const monthlySavings = Math.max(0, vsGuest / 12);
  const bestIsMembership = best.key !== 'guest';
  const bestIncludesFreeFlexKids = kids > 0 && ['unlimited', 'unlimited_plus'].includes(best.key);
  const kidsNote = bestIncludesFreeFlexKids
    ? `<p class="calc-kids-note">Under-18 discount: ${kids} kid${kids === 1 ? '' : 's'} ${kids === 1 ? 'gets' : 'get'} Flex rates with no added Flex dues.</p>`
    : '';
  const includedValueNote = bestIncludedMonthly > 0
    ? `<p class="calc-kids-note">Includes ${moneyMonthly(bestIncludedMonthly)}/mo in league, tournament, and clinic value.</p>`
    : '';
  const savingsLead = monthlySavings > 0
    ? `${moneyMonthly(monthlySavings)}<small>/mo saved versus guest pricing</small>`
    : `$0<small>/mo saved versus guest pricing</small>`;
  const duesDetail = bestIsMembership
    ? `${moneyMonthly(bestDuesMonthly)}/mo dues${bestUsageMonthly > 0 ? ` + ${moneyMonthly(bestUsageMonthly)}/mo usage` : ''}`
    : 'pay as you play';

  const out = document.getElementById('calc-result');
  out.innerHTML = `
    <div class="calc-recommend">
      <span class="eyebrow">Best Fit</span>
      <h3>${best.name}</h3>
      <div class="calc-cost-line">
        <span>Estimated monthly total</span>
        <strong>${moneyMonthly(bestMonthly)}<small>/mo</small></strong>
      </div>
      <p class="calc-dues">${duesDetail}</p>
      <p class="calc-total calc-savings-total">${savingsLead}</p>
      ${kidsNote}
      ${includedValueNote}
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
      <h4>Plan comparison</h4>
      <ol>
        ${options.map(o => {
          const optionSavings = Math.max(0, guestYearly - o.comparisonTotal);
          const savingsText = o.key !== 'guest' ? `, saves ${moneyMonthly(optionSavings / 12)}/mo` : '';
          return `<li><strong>${o.name}</strong> — ${moneyMonthly(o.total / 12)}/mo${savingsText} <span>(${money(o.total)}/yr)</span></li>`;
        }).join('')}
      </ol>
      <p class="calc-note">All values are estimates and subject to change. Kids under 18 are noted as a benefit only and are not factored into play or usage cost estimates. Unlimited+ savings includes Springs Pickleball-hosted leagues and tournaments plus up to one $30 clinic per month. With Unlimited or Unlimited+, kids under 18 get Flex pricing with no added Flex dues. Prime-time and event pricing may vary.</p>
    </div>
  `;
  out.style.display = 'block';

  trackMembershipEvent('membership_calculator_used', {
    open_play_sessions_per_week: openPlays,
    court_hours_per_week: courtHrs,
    leagues_per_year: leagues,
    tournaments_per_year: tourneys,
    clinics_per_month: clinics,
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

  ['calc-openplay', 'calc-court', 'calc-leagues', 'calc-tourneys', 'calc-clinics', 'calc-kids'].forEach(id => {
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
  ['calc-openplay', 'calc-court', 'calc-leagues', 'calc-tourneys', 'calc-clinics', 'calc-kids'].forEach(id => {
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
