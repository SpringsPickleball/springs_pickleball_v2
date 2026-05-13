// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      track('mobile_nav_toggled', { open: isOpen });
    });
  }

  // Mark active nav link based on current page
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links > li > a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // Hide one-off event cards after their final event date. Recurring cards stay visible.
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  document.querySelectorAll('.event-card[data-event-end]').forEach(card => {
    const eventEnd = card.getAttribute('data-event-end');
    if (/^\d{4}-\d{2}-\d{2}$/.test(eventEnd) && todayKey > eventEnd) {
      card.hidden = true;
    }
  });

  // Dropdown / megamenu open-close
  const isDesktop = () => window.matchMedia('(min-width: 981px)').matches;
  const dropdowns = document.querySelectorAll('.nav-links > li.has-dropdown');

  function setDropdownOpen(li, open) {
    li.classList.toggle('open', open);
    const trigger = li.querySelector(':scope > a, :scope > button');
    if (trigger) trigger.setAttribute('aria-expanded', String(open));
  }

  function closeDropdowns() {
    dropdowns.forEach(li => setDropdownOpen(li, false));
  }

  dropdowns.forEach(li => {
    const trigger = li.querySelector(':scope > a, :scope > button');
    if (!trigger) return;
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');

    // Desktop: open on hover
    li.addEventListener('mouseenter', () => { if (isDesktop()) setDropdownOpen(li, true); });
    li.addEventListener('mouseleave', () => { if (isDesktop()) setDropdownOpen(li, false); });

    // All: toggle on click (for mobile + keyboard)
    trigger.addEventListener('click', e => {
      if (trigger.tagName === 'A' && trigger.getAttribute('href') && trigger.getAttribute('href') !== '#' && isDesktop()) {
        return; // allow link navigation on desktop if href is real
      }
      const wasOpen = li.classList.contains('open');
      if (trigger.tagName === 'A' && trigger.getAttribute('href') && trigger.getAttribute('href') !== '#' && wasOpen) {
        return; // second tap on mobile follows the parent page link
      }
      e.preventDefault();
      closeDropdowns();
      if (!wasOpen) setDropdownOpen(li, true);
      track('nav_dropdown_toggled', {
        label: cleanText(trigger.textContent),
        open: !wasOpen,
      });
    });
  });

  // Click outside to close
  document.addEventListener('click', e => {
    if (!e.target.closest('.nav-links')) {
      closeDropdowns();
    }
    if (toggle && links && !e.target.closest('.site-header')) {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeDropdowns();
    if (toggle && links) {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Contact form fallback for the static site.
  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      const data = new FormData(contactForm);
      const location = data.get('location');
      const recipients = {
        west: 'west@springspickleball.com',
        east: 'east@springspickleball.com',
        either: 'west@springspickleball.com,east@springspickleball.com',
      };
      const locationLabels = {
        west: 'West (Vondelpark)',
        east: 'East (New Center Point)',
        either: 'Either / Not Sure',
      };
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim();
      const message = String(data.get('message') || '').trim();
      const subject = encodeURIComponent(`Website message from ${name || 'Springs Pickleball visitor'}`);
      const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nLocation: ${locationLabels[location] || locationLabels.either}\n\n${message}`);
      track('contact_form_submitted', {
        location,
        recipient: recipients[location] || recipients.either,
      });
      window.location.href = `mailto:${recipients[location] || recipients.either}?subject=${subject}&body=${body}`;
    });
  }

  // PostHog: named events for site interest and booking funnel
  const pagePath = window.location.pathname || '/';
  const pageName = pagePath.split('/').pop() || 'index.html';
  const baseProps = () => ({
    page: pageName,
    path: pagePath,
    title: document.title,
  });
  function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  function detectSource(el) {
    if (el.closest('.mobile-book-bar')) return 'mobile_bar';
    if (el.closest('.hero')) return 'hero';
    if (el.closest('.promo-banner')) return 'promo_banner';
    if (el.closest('.membership-special')) return 'membership_special';
    if (el.closest('.pricing')) return 'pricing_card';
    if (el.closest('.calc')) return 'calculator';
    if (el.closest('.app-section')) return 'app_section';
    if (el.closest('.event-card')) return 'event_card';
    if (el.closest('.program-layout')) return 'program_card';
    if (el.closest('.champion-section')) return 'championship_series';
    if (el.closest('.loc-card')) return 'location_card';
    if (el.closest('.utility-social')) return 'utility_social';
    if (el.closest('.megamenu') || el.closest('.submenu')) return 'nav';
    if (el.closest('.sponsors')) return 'sponsors';
    if (el.closest('.cta-band')) return 'cta_band';
    if (el.closest('.site-footer')) return 'footer';
    if (el.closest('.card')) return 'card';
    return 'other';
  }
  function detectLocationFromHref(href) {
    if (/8778/.test(href) || /west/i.test(href)) return 'west';
    if (/15687/.test(href) || /east/i.test(href)) return 'east';
    return null;
  }
  function detectCourtReserveOrg(href) {
    if (/\/8778(?:[/?#]|$)|[?&](?:orgId|organizationId)=8778\b/.test(href)) return '8778';
    if (/\/15687(?:[/?#]|$)|[?&](?:orgId|organizationId)=15687\b/.test(href)) return '15687';
    return null;
  }
  function detectEventType(label, href) {
    const value = `${label} ${href}`.toLowerCase();
    if (value.includes('open play') || value.includes('gbt6ftib7o8778')) return 'open_play';
    if (value.includes('clinic') || value.includes('lesson') || value.includes('yjt') || value.includes('qmvl')) return 'clinic_or_lesson';
    if (value.includes('tournament') || value.includes('springspickleballtournaments.com')) return 'tournament';
    if (value.includes('dupr') || value.includes('rated')) return 'dupr';
    if (value.includes('social') || value.includes('paddle up')) return 'social';
    if (value.includes('youth')) return 'youth';
    if (value.includes('intro')) return 'intro';
    if (href.includes('/Events/') || href.includes('/Leagues/')) return 'courtreserve_event';
    if (href.includes('tab=explore')) return 'events_explore';
    return null;
  }
  function detectLinkKind(a, href) {
    if (href.includes('publicbookings') && href.includes('tab=explore')) return 'events';
    if (href.includes('publicbookings')) return 'court_booking';
    if (href.includes('Memberships/ViewPublicMembership') || href.includes('Memberships/Public')) return 'membership_signup';
    if (href.includes('/Events/') || href.includes('/Leagues/') || href.includes('springspickleballtournaments.com')) return 'events';
    if (href.includes('apps.apple.com')) return 'app_store';
    if (href.includes('play.google.com')) return 'google_play';
    if (href.includes('instagram.com') || href.includes('youtube.com') || href.includes('facebook.com') || href.includes('chat.whatsapp.com')) return 'social';
    if (href.startsWith('mailto:')) return 'email';
    if (href.startsWith('tel:')) return 'phone';
    if (a.classList.contains('nav-cta') || a.classList.contains('btn')) return 'cta';
    return 'link';
  }
  function track(name, props) {
    if (!window.posthog || !window.posthog.capture) return;
    window.posthog.capture(name, { ...baseProps(), ...props });
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('[posthog]', name, { ...baseProps(), ...props });
    }
  }
  window.spTrack = track;

  track('site_page_viewed', {
    referrer: document.referrer || null,
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || !a.href) return;
    const href = a.href;
    const source = detectSource(a);
    const label = cleanText(a.textContent) || cleanText(a.getAttribute('aria-label')) || a.href;
    const linkKind = detectLinkKind(a, href);
    const location = detectLocationFromHref(href);
    const courtreserveOrgId = detectCourtReserveOrg(href);
    const eventType = detectEventType(label, href);
    const props = {
      source,
      label,
      href,
      link_kind: linkKind,
      location,
      courtreserve_org_id: courtreserveOrgId,
      event_type: eventType,
      destination_host: a.hostname || null,
      outbound: a.origin !== window.location.origin,
    };

    track('site_link_clicked', props);

    if (
      a.classList.contains('btn') ||
      a.classList.contains('app-badge') ||
      a.closest('.inline-links') ||
      a.closest('.footer-social') ||
      a.closest('.utility-social')
    ) {
      track('cta_clicked', props);
    }

    // Court booking clicks
    if (href.includes('publicbookings/8778') && !href.includes('tab=explore')) {
      track('book_court_clicked', { location: 'west', kind: 'guest', source, label, href });
      track('court_booking_clicked', { location: 'west', booking_type: 'guest_court', source, label, href });
    } else if (href.includes('publicbookings/15687') && !href.includes('tab=explore')) {
      track('book_court_clicked', { location: 'east', kind: 'guest', source, label, href });
      track('court_booking_clicked', { location: 'east', booking_type: 'guest_court', source, label, href });
    } else if (href.includes('EmbedCode/8778/24144')) {
      track('book_court_clicked', { location: 'west', kind: 'member_schedule', source, label, href });
      track('court_booking_clicked', { location: 'west', booking_type: 'member_schedule', source, label, href });
    } else if (href.includes('EmbedCode/15687/45222')) {
      track('book_court_clicked', { location: 'east', kind: 'member_schedule', source, label, href });
      track('court_booking_clicked', { location: 'east', booking_type: 'member_schedule', source, label, href });
    }

    // CourtReserve event and event-discovery clicks
    if (
      href.includes('/Online/Events/') ||
      href.includes('/Online/Leagues/') ||
      href.includes('tab=explore') ||
      href.includes('springspickleballtournaments.com')
    ) {
      track('event_registration_clicked', {
        location,
        event_type: eventType,
        courtreserve_org_id: courtreserveOrgId,
        source,
        label,
        href,
      });
    }

    // Memberships page navigation (nav tab, hero CTA, footer, etc.)
    if (/\/memberships\.html(?:[?#]|$)/.test(href) || href.endsWith('memberships.html')) {
      track('memberships_clicked', { source, label, href });
      track('membership_interest_clicked', { source, label, href });
    }

    // Membership signup clicks
    if (href.includes('membershipId=253681')) {
      track('membership_signup_clicked', { location: 'west', promo: 'summer_special', source, label, href });
    } else if (href.includes('membershipId=253683')) {
      track('membership_signup_clicked', { location: 'east', promo: 'summer_special', source, label, href });
    } else if (href.includes('Memberships/Public/8778')) {
      track('membership_signup_clicked', { location: 'west', source, label, href });
    } else if (href.includes('Memberships/Public/15687')) {
      track('membership_signup_clicked', { location: 'east', source, label, href });
    }

    if (linkKind === 'app_store' || linkKind === 'google_play') {
      track('app_download_clicked', { store: linkKind === 'app_store' ? 'apple' : 'google', source, label, href });
    }

    if (linkKind === 'social') {
      track('social_link_clicked', { source, label, href, destination_host: a.hostname || null });
    }
  });

  const scrollMilestones = [25, 50, 75, 100];
  const seenScroll = new Set();
  function checkScrollDepth() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const percent = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
    scrollMilestones.forEach(mark => {
      if (percent >= mark && !seenScroll.has(mark)) {
        seenScroll.add(mark);
        track('scroll_depth_reached', { percent: mark });
      }
    });
  }
  window.addEventListener('scroll', checkScrollDepth, { passive: true });
  checkScrollDepth();

  // Scroll reveal
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
  const sectionEls = document.querySelectorAll('section');
  const seenSections = new Set();
  function sectionName(section) {
    return cleanText(
      section.querySelector('h1, h2, h3')?.textContent ||
      section.querySelector('.eyebrow, .promo-kicker')?.textContent ||
      section.className ||
      section.tagName
    );
  }
  function trackSection(section) {
    const name = sectionName(section);
    if (!name || seenSections.has(name)) return;
    seenSections.add(name);
    track('section_viewed', {
      section: name,
      section_class: section.className || null,
    });
  }
  if (prefersReduced || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('is-visible'));
    sectionEls.forEach(trackSection);
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(el => io.observe(el));
    const sectionIo = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          trackSection(entry.target);
          sectionIo.unobserve(entry.target);
        }
      });
    }, { threshold: 0.45 });
    sectionEls.forEach(section => sectionIo.observe(section));
  }
});
