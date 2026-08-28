'use strict';

(function () {
  const CONFIG = {
    accent: '#E8FF4D',
    accentAlt: '#52A8FF',
    langKey: 'ferokuk.lang',
    defaultLang: 'ru'
  };

  const root = document.getElementById('app');
  const panel = document.getElementById('pipeline');

  const q = (sel, ctx) => (ctx || document).querySelector(sel);
  const all = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));

  const applyTheme = () => {
    const d = document.documentElement.style;
    d.setProperty('--acc', CONFIG.accent || '#E8FF4D');
    d.setProperty('--acc2', CONFIG.accentAlt || '#52A8FF');
  };

  const readLang = () => {
    const saved = (() => { try { return localStorage.getItem(CONFIG.langKey); } catch (e) { return null; } })();
    return (saved === 'en' || saved === 'ru') ? saved : CONFIG.defaultLang;
  };

  const langButtons = {};

  const applyLang = (l) => {
    if (root) root.setAttribute('data-l', l);
    document.documentElement.setAttribute('lang', l);
    // the two titles live on #app as data-title-ru / data-title-en
    const title = root && root.getAttribute('data-title-' + l);
    if (title) document.title = title;
    Object.keys(langButtons).forEach(k => {
      if (langButtons[k]) langButtons[k].setAttribute('aria-pressed', String(k === l));
    });
  };

  const setLang = (l) => {
    applyLang(l);
    try { localStorage.setItem(CONFIG.langKey, l); } catch (e) {}
  };

  const initLang = () => {
    ['ru', 'en'].forEach(l => {
      const el = document.getElementById('lang-' + l) || q('[data-lb="' + l + '"]');
      if (!el) return;
      langButtons[l] = el;
      el.addEventListener('click', () => setLang(l));
    });
    applyLang(readLang());
  };

  let io = null;
  let sweep = null;
  let scrollBound = false;
  let safety = null;

  const initReveal = (reduce) => {
    const scope = root || document;
    const items = all('[data-rev]', scope);
    if (reduce || !('IntersectionObserver' in window)) return;

    items.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translate3d(0,26px,0)';
      el.style.willChange = 'opacity, transform';
    });

    const show = el => {
      if (el.dataset.revDone) return;
      el.dataset.revDone = '1';
      const d = parseInt(el.getAttribute('data-delay') || '0', 10);
      el.style.transition = 'opacity .75s cubic-bezier(.2,.8,.2,1) ' + d + 'ms, transform .75s cubic-bezier(.2,.8,.2,1) ' + d + 'ms';
      el.style.opacity = '1';
      el.style.transform = 'translate3d(0,0,0)';
      setTimeout(() => { el.style.willChange = 'auto'; }, 900 + d);
      if (io) io.unobserve(el);
    };

    sweep = () => {
      let pending = 0;
      items.forEach(el => {
        if (el.dataset.revDone) return;
        if (el.getBoundingClientRect().top < window.innerHeight * 0.94) show(el); else pending++;
      });
      if (!pending && scrollBound) {
        window.removeEventListener('scroll', sweep);
        scrollBound = false;
      }
    };

    io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) show(e.target); });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    items.forEach(el => io.observe(el));

    requestAnimationFrame(sweep);
    window.addEventListener('scroll', sweep, { passive: true });
    window.addEventListener('resize', sweep, { passive: true });
    scrollBound = true;
    safety = setTimeout(() => { items.forEach(show); }, 2200);
  };

  const EVENTS = [
    { name: 'payment.received', id: '#B734-9021', score: 0.09, v: 'approved', ms: 38 },
    { name: 'bill.created',    id: '#A91F-2048', score: 0.24, v: 'approved', ms: 42 },
    { name: 'bill.created',    id: '#C0D8-4417', score: 0.66, v: 'review',   reason: 'rules hit' },
    { name: 'payment.received', id: '#D512-7730', score: 0.93, v: 'flagged',  reason: 'duplicate invoice' },
    { name: 'bill.created',    id: '#E77A-1385', score: 0.31, v: 'approved', ms: 51 },
    { name: 'payment.received', id: '#F203-6642', score: 0.81, v: 'flagged',  reason: 'pattern match' }
  ];

  const BC = 'rgba(241,243,236,.14)';
  const EASE = 'cubic-bezier(.22,.61,.36,1)';
  // Multiplier on how long a dot takes to cross a connector, a track or the bus:
  // above 1 the dots move slower. Only the travel legs are scaled — the node glows
  // stay in step because runEvent's timeline accumulates the same leg value.
  const DOT_DUR = 1.1;

  const cssv = n => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    return v || (n === '--acc' ? CONFIG.accent : CONFIG.accentAlt);
  };

  let pp = null;
  let timers = [];
  let rafs = [];
  let sparks = [];
  let loadTimer = null;
  let errTimer = null;
  let burstTimer = null;
  let errBurst = false;
  let evIdx = 0;
  let phase = 0.6;
  let load = 0.38;

  const at = (ms, fn) => { timers.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const speed = () => 1 - Math.min(0.32, load * 0.32);

  const startPipeline = (reduce) => {
    if (!panel) return;
    const k = key => panel.querySelector('[data-k="' + key + '"]');
    pp = {
      gw: k('gw'), ev: k('ev'), af: k('af'), out: k('out'), outText: k('outtext'),
      evName: k('evname'), evId: k('evid'), score: k('score'), podN: k('pods'),
      pods: all('[data-pod]', panel), conns: all('[data-conn]', panel), tracks: all('[data-track]', panel), srcs: all('[data-src]', panel),
      kafka: k('e-kafka'), ch: k('e-ch'), cq: k('e-case'), ops: k('e-ops'),
      bus: q('.pl-bus', panel),
      bar: k('bar'), rps: k('rps'), p99: k('p99'), err: k('err')
    };
    timers = [];
    rafs = [];
    sparks = [];
    evIdx = 0;
    phase = 0.6;
    load = 0.38;
    setPods(4);
    if (reduce) {
      setOutcome('verdict', EVENTS[1]);
      return;
    }
    applyLoad();
    tickLoad();
    applyErr();
    tickErr();
    runEvent();
  };

  const tickLoad = () => {
    const step = () => {
      phase += 0.055 + Math.random() * 0.03;
      const target = 0.5 + 0.4 * Math.sin(phase) + (Math.random() - 0.5) * 0.1;
      load += (Math.max(0.06, Math.min(1, target)) - load) * 0.24;
      applyLoad();
      loadTimer = setTimeout(step, 1300);
    };
    loadTimer = setTimeout(step, 900);
  };

  const applyLoad = () => {
    if (!pp) return;
    const L = load, acc = cssv('--acc');
    if (pp.bar) {
      pp.bar.style.width = Math.round(8 + L * 88) + '%';
      pp.bar.style.background = L > 0.78 ? '#FF6B6B' : (L > 0.55 ? '#FFB454' : acc);
    }
    animNum(pp.rps, 1.55 + L * 3.05, 420, 2);
    animNum(pp.p99, 56 + L * 76, 420, 0);
    setPods(Math.max(2, Math.min(8, Math.round(2 + L * 6))));
  };

  const applyErr = () => {
    if (!pp || !pp.err) return;
    const v = errBurst ? 0.125 + Math.random() * 0.035 : 0.01 + Math.random() * 0.07;
    animNum(pp.err, v, 700, 2);
    pp.err.style.color = v >= 0.1 ? '#FFB454' : cssv('--acc');
  };

  const tickErr = () => {
    const wobble = () => { applyErr(); errTimer = setTimeout(wobble, 2200 + Math.random() * 900); };
    errTimer = setTimeout(wobble, 1800);
    const burst = () => {
      errBurst = true;
      applyErr();
      at(1000, () => applyErr());
      at(2200, () => { errBurst = false; applyErr(); });
      burstTimer = setTimeout(burst, 30000 + Math.random() * 10000);
    };
    burstTimer = setTimeout(burst, 24000 + Math.random() * 9000);
  };

  const setPods = (n) => {
    if (!pp) return;
    pp.pods.forEach((el, i) => {
      const on = i < n;
      el.style.opacity = on ? '1' : '0';
      el.style.transform = on ? 'scale(1)' : 'scale(.9)';
    });
    animNum(pp.podN, n, 300, 0);
  };

  const animNum = (el, to, dur, dec) => {
    if (!el) return;
    const from = parseFloat(el.dataset.v != null ? el.dataset.v : to);
    if (el._raf) cancelAnimationFrame(el._raf);
    if (!isFinite(from) || Math.abs(to - from) < 0.0001) { el.dataset.v = to; el.textContent = to.toFixed(dec); return; }
    const t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      const v = from + (to - from) * e;
      el.textContent = v.toFixed(dec);
      el.dataset.v = v;
      if (k < 1) { el._raf = requestAnimationFrame(tick); rafs.push(el._raf); }
      else { el.dataset.v = to; el._raf = null; }
    };
    el._raf = requestAnimationFrame(tick);
    rafs.push(el._raf);
  };

  const glow = (el, color, hold) => {
    if (!el) return;
    el.style.borderColor = 'color-mix(in oklab, ' + color + ' 46%, transparent)';
    el.style.boxShadow = '0 0 24px -10px ' + color;
    at(hold, () => { el.style.borderColor = BC; el.style.boxShadow = 'none'; });
  };

  const travel = (i, color, dur, ghost) => {
    if (!pp) return;
    const c = pp.conns[i];
    if (!c) return;
    const dot = c.querySelector(ghost ? '[data-dot2]' : '[data-dot]'), fill = c.querySelector('[data-fill]');
    if (!dot) return;
    dot.style.background = color;
    dot.style.boxShadow = ghost ? '0 0 8px ' + color : '0 0 12px ' + color;
    if (!ghost && fill) fill.style.background = 'color-mix(in oklab, ' + color + ' 60%, transparent)';
    dot.animate([
      { top: '-4px', opacity: 0 },
      { top: '0px', opacity: 1, offset: 0.12 },
      { top: 'calc(100% - 8px)', opacity: 1, offset: 0.88 },
      { top: 'calc(100% - 4px)', opacity: 0 }
    ], { duration: dur, easing: EASE });
    if (ghost || !fill) return;
    fill.animate([
      { transform: 'scaleY(0)', opacity: 1 },
      { transform: 'scaleY(1)', opacity: 1, offset: 0.72 },
      { transform: 'scaleY(1)', opacity: 0 }
    ], { duration: dur + 420, easing: EASE });
  };

  // The fan-out below the verdict is drawn as a bracket: a horizontal bar from 25% to 75%,
  // then vertical drops into the sinks. travel() only walks the centred connector, so a dot
  // has to follow the bracket by hand to reach a node instead of jumping to it.
  const spark = (fan, frames, color, dur) => {
    if (!fan) return;
    const d = document.createElement('span');
    d.className = 'pl-spark';
    d.style.background = color;
    d.style.boxShadow = '0 0 12px ' + color;
    fan.appendChild(d);
    const anim = d.animate(frames, { duration: dur, easing: EASE });
    const clean = () => {
      if (d.parentNode) d.parentNode.removeChild(d);
      const i = sparks.indexOf(anim);
      if (i !== -1) sparks.splice(i, 1);
    };
    anim.onfinish = clean;
    anim.oncancel = clean;
    sparks.push(anim);
  };

  // Measure the run down the spine and the turn-off into one sink. Read from live
  // geometry so it holds at any panel width.
  const busPlan = (node, s) => {
    if (!pp || !pp.bus || !node) return null;
    const bus = pp.bus.getBoundingClientRect();
    const n = node.getBoundingClientRect();
    if (!bus.width || !n.width) return null;
    const cx = bus.width / 2;
    const y = n.top + n.height / 2 - bus.top;
    const left = (n.left + n.width / 2 - bus.left) < cx;
    const edge = left ? n.right - bus.left : n.left - bus.left;
    const travelled = y + Math.abs(cx - edge);
    return { cx: cx, y: y, edge: edge, dur: Math.max(240, Math.round(travelled * 5.5 * s * DOT_DUR)) };
  };

  // Down the spine, then a right-angle turn off into the node.
  const busRun = (plan, color) => {
    if (!plan) return;
    const turn = 1 - Math.abs(plan.cx - plan.edge) / (plan.y + Math.abs(plan.cx - plan.edge));
    spark(pp.bus, [
      { left: (plan.cx - 4) + 'px', top: '-4px', opacity: 0 },
      { left: (plan.cx - 4) + 'px', top: '0px', opacity: 1, offset: 0.08 },
      { left: (plan.cx - 4) + 'px', top: (plan.y - 4) + 'px', opacity: 1, offset: turn },
      { left: (plan.edge - 4) + 'px', top: (plan.y - 4) + 'px', opacity: 1 }
    ], color, plan.dur);
  };

  const runGhost = (delay, s) => {
    const leg = Math.round(340 * s * DOT_DUR), gap = Math.round(300 * s);
    for (let i = 0; i < 5; i++) {
      at(delay + i * (leg + gap), () => travel(i, 'rgba(241,243,236,.42)', leg, true));
    }
  };

  const pingSource = () => {
    if (!pp) return;
    const list = pp.srcs;
    if (!list || !list.length) return;
    const el = list[Math.floor(Math.random() * list.length)];
    const acc = cssv('--acc');
    el.style.borderColor = 'color-mix(in oklab, ' + acc + ' 46%, transparent)';
    el.style.boxShadow = '0 0 24px -10px ' + acc;
    el.style.color = '#F1F3EC';
    at(Math.round(1100 * speed()), () => {
      el.style.borderColor = 'rgba(241,243,236,.1)';
      el.style.boxShadow = 'none';
      el.style.color = '#8B9188';
    });
  };

  const runTracks = (dur) => {
    if (!pp) return;
    pp.tracks.forEach((t, i) => {
      const d = t.querySelector('[data-dot]');
      if (!d) return;
      at(i * 130, () => d.animate([
        { left: '0px', opacity: 0 },
        { left: '2px', opacity: 1, offset: 0.14 },
        { left: 'calc(100% - 5px)', opacity: 1, offset: 0.86 },
        { left: 'calc(100% - 5px)', opacity: 0 }
      ], { duration: dur, easing: EASE }));
    });
  };

  const setOutcome = (mode, ev) => {
    if (!pp) return;
    const o = pp.out, t = pp.outText;
    if (!o || !t) return;
    o.style.animation = 'none';
    if (mode === 'idle') {
      o.style.background = 'rgba(10,11,14,.4)';
      o.style.borderColor = 'rgba(241,243,236,.1)';
      o.style.boxShadow = 'none';
      t.style.color = '#6E756D';
      t.textContent = 'awaiting event';
      return;
    }
    if (mode === 'scoring') { t.style.color = '#8B9188'; t.textContent = 'SCORING \u00B7 model v7'; return; }
    const acc = cssv('--acc'), blue = cssv('--acc2');
    const c = ev.v === 'approved' ? acc : (ev.v === 'review' ? blue : '#FF6B6B');
    o.style.background = 'color-mix(in oklab, ' + c + ' 14%, transparent)';
    o.style.borderColor = 'color-mix(in oklab, ' + c + ' 45%, transparent)';
    o.style.boxShadow = '0 0 26px -12px ' + c;
    t.style.color = c;
    t.textContent = ev.v === 'approved'
      ? '\u2713 APPROVED \u00B7 ' + ev.ms + ' ms'
      : (ev.v === 'review' ? '\u25A0 REVIEW \u00B7 ' + ev.reason : '\u2715 FLAGGED \u00B7 ' + ev.reason);
    void o.offsetWidth;
    if (ev.v === 'review') o.style.animation = 'brth 1.5s ease-in-out 2';
    if (ev.v === 'flagged') o.style.animation = 'shk .32s ' + EASE + ' 1';
  };

  const nextEvent = () => {
    let ev = EVENTS[evIdx++ % EVENTS.length];
    if (load > 0.8 && ev.v === 'approved' && Math.random() < 0.32) {
      ev = { name: ev.name, id: ev.id, score: 0.87, v: 'flagged', reason: 'velocity spike' };
    }
    return ev;
  };

  const runEvent = () => {
    if (!pp) return;
    if (document.hidden) { at(800, () => runEvent()); return; }
    const s = speed();
    const leg = Math.round(340 * s * DOT_DUR), hold = Math.round(620 * s);
    const ev = nextEvent();
    const N = '#F1F3EC', acc = cssv('--acc');
    const c = ev.v === 'approved' ? acc : (ev.v === 'review' ? cssv('--acc2') : '#FF6B6B');
    let t = 0;
    setOutcome('idle');
    pingSource();
    travel(0, N, leg);
    t += leg; at(t, () => glow(pp.gw, N, hold + 200));
    t += hold;
    at(t, () => {
      if (pp.evName) pp.evName.textContent = ev.name;
      if (pp.evId) pp.evId.textContent = ev.id;
      travel(1, N, leg);
    });
    t += leg; at(t, () => glow(pp.ev, N, hold + 200));
    t += hold;
    at(t, () => { if (pp.score) pp.score.style.color = N; travel(2, N, leg); });
    t += leg;
    at(t, () => {
      glow(pp.af, acc, Math.round(1180 * s));
      setOutcome('scoring');
      runTracks(Math.round(460 * s * DOT_DUR));
      animNum(pp.score, ev.score, Math.round(540 * s), 2);
      if (pp.score) pp.score.style.color = ev.score > 0.8 ? '#FF6B6B' : (ev.score > 0.6 ? cssv('--acc2') : N);
    });
    t += Math.round(1180 * s);
    at(t, () => travel(3, c, leg));
    t += leg;
    at(t, () => setOutcome('verdict', ev));
    t += hold + Math.round(420 * s);
    at(t, () => travel(4, c, leg));
    t += leg;
    const sinkHold = Math.round(1100 * s);
    const N2 = '#F1F3EC';
    const target = ev.v === 'approved' ? pp.kafka : (ev.v === 'review' ? pp.cq : pp.ops);
    const auditPlan = busPlan(pp.ch, s);
    const targetPlan = busPlan(target, s);
    const auditDur = auditPlan ? auditPlan.dur : 0;
    const targetDur = targetPlan ? targetPlan.dur : 0;

    // the audit copy always turns off into ClickHouse; the verdict copy takes its own sink
    at(t, () => busRun(auditPlan, N2));
    at(t + auditDur, () => glow(pp.ch, N2, sinkHold));
    at(t, () => busRun(targetPlan, c));
    at(t + targetDur, () => glow(target, c, sinkHold));

    t += Math.max(auditDur, targetDur);
    t += Math.round(1500 * s);
    at(t, () => { clearTimers(); runEvent(); });
  };

  const destroy = () => {
    if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
    if (errTimer) { clearTimeout(errTimer); errTimer = null; }
    if (burstTimer) { clearTimeout(burstTimer); burstTimer = null; }
    clearTimers();
    rafs.forEach(id => cancelAnimationFrame(id));
    rafs = [];
    sparks.forEach(a => { try { a.cancel(); } catch (e) {} });
    sparks = [];
    if (io) { io.disconnect(); io = null; }
    if (safety) { clearTimeout(safety); safety = null; }
    if (sweep) {
      window.removeEventListener('scroll', sweep);
      window.removeEventListener('resize', sweep);
      scrollBound = false;
      sweep = null;
    }
    pp = null;
  };

  const initLogos = () => {
    const drop = img => { if (img.parentNode) img.parentNode.removeChild(img); };
    Array.prototype.forEach.call(document.querySelectorAll('.logo-chip-img'), img => {
      if (img.complete && img.naturalWidth === 0) drop(img);
      else img.addEventListener('error', () => drop(img), { once: true });
    });
  };

  const boot = () => {
    applyTheme();
    initLang();
    initLogos();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    startPipeline(reduce);
    initReveal(reduce);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener('pagehide', destroy);

  window.ferokuk = { CONFIG, applyTheme, setLang, runGhost, destroy };
})();
