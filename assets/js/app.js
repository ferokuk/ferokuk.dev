'use strict';

(function () {
  const CONFIG = {
    accent: '#E8FF4D',
    accentAlt: '#52A8FF',
    ymId: 112122572
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

  let revealObserver = null;
  const revealTimers = new Set();
  let revealItems = [];

  const finishReveals = () => {
    if (revealObserver) { revealObserver.disconnect(); revealObserver = null; }
    revealTimers.forEach(clearTimeout);
    revealTimers.clear();
    revealItems.forEach(el => {
      el.dataset.revDone = '1';
      el.style.transition = 'none';
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.willChange = 'auto';
    });
  };

  const initReveal = (reduce) => {
    revealItems = all('[data-rev]', root || document);
    if (reduce || !('IntersectionObserver' in window)) return;

    const show = el => {
      if (el.dataset.revDone) return;
      el.dataset.revDone = '1';
      el.style.transition = 'opacity 450ms cubic-bezier(.2,.8,.2,1), transform 450ms cubic-bezier(.2,.8,.2,1)';
      el.style.opacity = '1';
      el.style.transform = 'translate3d(0,0,0)';
      const id = setTimeout(() => {
        revealTimers.delete(id);
        el.style.willChange = 'auto';
      }, 500);
      revealTimers.add(id);
      if (revealObserver) revealObserver.unobserve(el);
    };

    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) show(entry.target); });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    revealItems.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translate3d(0,10px,0)';
      el.style.willChange = 'opacity, transform';
      revealObserver.observe(el);
    });
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
  const timers = new Set();
  const activeRafs = new Set();
  const animations = new Set();
  let pipelineObserver = null;
  let motionQuery = null;
  let pipelineToggle = null;
  let running = false;
  let pipelineVisible = false;
  let manuallyPaused = false;
  let reducedMotion = false;
  let pagePresent = true;
  let destroyed = false;
  let errBurst = false;
  let evIdx = 0;
  let phase = 0.6;
  let load = 0.38;

  // Every pipeline timer and frame is removed from its registry on completion.
  // The same scheduler owns telemetry, burst recovery and event choreography.
  const at = (ms, fn) => {
    if (!running) return null;
    const id = setTimeout(() => {
      timers.delete(id);
      if (running) fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const trackedRaf = callback => {
    const id = requestAnimationFrame(ts => {
      activeRafs.delete(id);
      if (running) callback(ts);
    });
    activeRafs.add(id);
    return id;
  };

  const cancelRaf = id => {
    if (id == null) return;
    cancelAnimationFrame(id);
    activeRafs.delete(id);
  };

  const playAnimation = (el, frames, options, onDone) => {
    if (!running || !el || typeof el.animate !== 'function') {
      if (onDone) onDone();
      return null;
    }
    const animation = el.animate(frames, options);
    const done = () => {
      animations.delete(animation);
      if (onDone) onDone();
    };
    animation.onfinish = done;
    animation.oncancel = done;
    animations.add(animation);
    return animation;
  };

  const speed = () => 1 - Math.min(0.32, load * 0.32);

  const initPipeline = () => {
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
    pipelineToggle = document.getElementById('pipeline-toggle');
    if (pipelineToggle) pipelineToggle.addEventListener('click', togglePipeline);
    renderStaticState();
    if ('IntersectionObserver' in window) {
      pipelineObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.target !== panel) return;
          pipelineVisible = entry.isIntersecting && entry.intersectionRatio > 0;
          syncPipeline();
        });
      }, { threshold: 0 });
      pipelineObserver.observe(panel);
    } else {
      window.addEventListener('scroll', updatePipelineVisibility, { passive: true });
      window.addEventListener('resize', updatePipelineVisibility, { passive: true });
    }
    updatePipelineVisibility();
  };

  const renderStaticState = () => {
    if (!pp) return;
    const ev = EVENTS[1];
    if (pp.evName) pp.evName.textContent = ev.name;
    if (pp.evId) pp.evId.textContent = ev.id;
    animNum(pp.score, ev.score, 0, 2);
    if (pp.score) pp.score.style.color = '#F1F3EC';
    applyLoad();
    animNum(pp.err, 0.03, 0, 2);
    if (pp.err) pp.err.style.color = cssv('--acc');
    setOutcome('verdict', ev);
  };

  const startPipeline = () => {
    if (!pp || running || destroyed) return;
    running = true;
    errBurst = false;
    applyLoad();
    tickLoad();
    applyErr();
    tickErr();
    runEvent();
  };

  const stopPipeline = () => {
    running = false;
    timers.forEach(clearTimeout);
    timers.clear();
    activeRafs.forEach(cancelAnimationFrame);
    activeRafs.clear();
    Array.from(animations).forEach(animation => animation.cancel());
    animations.clear();
    if (!pp) return;
    [pp.rps, pp.p99, pp.err, pp.podN, pp.score].forEach(el => { if (el) el._raf = null; });
    all('.pl-spark', panel).forEach(el => el.remove());
    all('[data-dot], [data-dot2], [data-fill]', panel).forEach(el => {
      el.style.opacity = '0';
    });
    [pp.gw, pp.ev, pp.af, pp.kafka, pp.ch, pp.cq, pp.ops].forEach(el => {
      if (!el) return;
      el.style.borderColor = BC;
      el.style.boxShadow = 'none';
    });
    pp.srcs.forEach(el => {
      el.style.borderColor = 'rgba(241,243,236,.1)';
      el.style.boxShadow = 'none';
      el.style.color = '#8B9188';
    });
    errBurst = false;
    renderStaticState();
    // Covers CSS pulses/transitions as well as JS-created animations. The state
    // selector disables their styles while stopped, and re-enables them on resume.
    if (typeof panel.getAnimations === 'function') {
      panel.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    }
  };

  const syncPipeline = () => {
    if (!panel) return;
    const state = destroyed || !pagePresent ? 'stopped'
      : reducedMotion ? 'reduced'
      : manuallyPaused ? 'paused'
      : document.hidden ? 'hidden'
      : !pipelineVisible ? 'offscreen' : 'running';
    panel.dataset.pipelineState = state;
    if (pipelineToggle) {
      pipelineToggle.setAttribute('aria-pressed', String(manuallyPaused));
      pipelineToggle.disabled = reducedMotion;
      const label = reducedMotion ? pipelineToggle.dataset.reducedLabel
        : manuallyPaused ? pipelineToggle.dataset.resumeLabel : pipelineToggle.dataset.pauseLabel;
      pipelineToggle.setAttribute('aria-label', label);
      pipelineToggle.title = label;
    }
    if (state === 'running') startPipeline();
    else stopPipeline();
  };

  const updatePipelineVisibility = () => {
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    pipelineVisible = rect.bottom > 0 && rect.top < window.innerHeight
      && rect.right > 0 && rect.left < window.innerWidth;
    syncPipeline();
  };

  const togglePipeline = () => {
    manuallyPaused = !manuallyPaused;
    syncPipeline();
  };

  const initDemoInfo = () => {
    const info = q('.demo-info');
    if (!info) return;
    const trigger = q('.demo-trigger', info);
    const setOpen = open => {
      info.dataset.open = String(open);
      trigger.setAttribute('aria-expanded', String(open));
    };
    setOpen(false);
    info.addEventListener('mouseenter', () => setOpen(true));
    info.addEventListener('mouseleave', () => {
      if (!info.contains(document.activeElement)) setOpen(false);
    });
    trigger.addEventListener('focus', () => setOpen(true));
    trigger.addEventListener('click', () => setOpen(true));
    info.addEventListener('focusout', event => {
      if (!info.contains(event.relatedTarget)) setOpen(false);
    });
    document.addEventListener('pointerdown', event => {
      if (!info.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setOpen(false);
    });
  };

  const onVisibilityChange = () => updatePipelineVisibility();
  const onPageHide = () => { pagePresent = false; syncPipeline(); };
  const onPageShow = () => { pagePresent = true; updatePipelineVisibility(); };
  const onMotionChange = event => {
    reducedMotion = event.matches;
    if (reducedMotion) finishReveals();
    syncPipeline();
  };

  const tickLoad = () => {
    const step = () => {
      phase += 0.055 + Math.random() * 0.03;
      const target = 0.5 + 0.4 * Math.sin(phase) + (Math.random() - 0.5) * 0.1;
      load += (Math.max(0.06, Math.min(1, target)) - load) * 0.24;
      applyLoad();
      at(1300, step);
    };
    at(900, step);
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
    const wobble = () => { applyErr(); at(2200 + Math.random() * 900, wobble); };
    at(1800, wobble);
    const burst = () => {
      errBurst = true;
      applyErr();
      at(1000, applyErr);
      at(2200, () => { errBurst = false; applyErr(); });
      at(30000 + Math.random() * 10000, burst);
    };
    at(24000 + Math.random() * 9000, burst);
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
    cancelRaf(el._raf);
    el._raf = null;
    if (!running || dur <= 0 || !isFinite(from) || Math.abs(to - from) < 0.0001) {
      el.dataset.v = to;
      el.textContent = to.toFixed(dec);
      return;
    }
    const t0 = performance.now();
    const tick = now => {
      el._raf = null;
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      const v = from + (to - from) * e;
      el.textContent = v.toFixed(dec);
      el.dataset.v = v;
      if (k < 1) el._raf = trackedRaf(tick);
      else el.dataset.v = to;
    };
    el._raf = trackedRaf(tick);
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
    playAnimation(dot, [
      { top: '-4px', opacity: 0 },
      { top: '0px', opacity: 1, offset: 0.12 },
      { top: 'calc(100% - 8px)', opacity: 1, offset: 0.88 },
      { top: 'calc(100% - 4px)', opacity: 0 }
    ], { duration: dur, easing: EASE });
    if (ghost || !fill) return;
    playAnimation(fill, [
      { transform: 'scaleY(0)', opacity: 1 },
      { transform: 'scaleY(1)', opacity: 1, offset: 0.72 },
      { transform: 'scaleY(1)', opacity: 0 }
    ], { duration: dur + 420, easing: EASE });
  };

  // The fan-out below the verdict is drawn as a bracket: a horizontal bar from 25% to 75%,
  // then vertical drops into the sinks. travel() only walks the centred connector, so a dot
  // has to follow the bracket by hand to reach a node instead of jumping to it.
  const spark = (fan, frames, color, dur) => {
    if (!fan || !running) return;
    const d = document.createElement('span');
    d.className = 'pl-spark';
    d.style.background = color;
    d.style.boxShadow = '0 0 12px ' + color;
    fan.appendChild(d);
    playAnimation(d, frames, { duration: dur, easing: EASE }, () => d.remove());
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
      at(i * 130, () => playAnimation(d, [
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
      t.style.color = '#777E76';
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
    if (running && ev.v === 'review') o.style.animation = 'brth 1.5s ease-in-out 2';
    if (running && ev.v === 'flagged') o.style.animation = 'shk .32s ' + EASE + ' 1';
  };

  const nextEvent = () => {
    let ev = EVENTS[evIdx++ % EVENTS.length];
    if (load > 0.8 && ev.v === 'approved' && Math.random() < 0.32) {
      ev = { name: ev.name, id: ev.id, score: 0.87, v: 'flagged', reason: 'velocity spike' };
    }
    return ev;
  };

  const runEvent = () => {
    if (!pp || !running) return;
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
    at(t, runEvent);
  };

  const destroy = () => {
    destroyed = true;
    syncPipeline();
    if (pipelineObserver) { pipelineObserver.disconnect(); pipelineObserver = null; }
    if (pipelineToggle) pipelineToggle.removeEventListener('click', togglePipeline);
    window.removeEventListener('scroll', updatePipelineVisibility);
    window.removeEventListener('resize', updatePipelineVisibility);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    if (motionQuery) {
      if (motionQuery.removeEventListener) motionQuery.removeEventListener('change', onMotionChange);
      else motionQuery.removeListener(onMotionChange);
    }
    finishReveals();
    if (goalIo) { goalIo.disconnect(); goalIo = null; }
    if (engagedTimer) { clearTimeout(engagedTimer); engagedTimer = null; }
    pp = null;
  };

  const initLogos = () => {
    const drop = img => { if (img.parentNode) img.parentNode.removeChild(img); };
    Array.prototype.forEach.call(document.querySelectorAll('.logo-chip-img'), img => {
      if (img.complete && img.naturalWidth === 0) drop(img);
      else img.addEventListener('error', () => drop(img), { once: true });
    });
  };

  const YM_SECTIONS = ['work', 'stack', 'path', 'contact'];

  let goalIo = null;
  let goalDepth = -1;
  let engagedTimer = null;

  const goal = (name) => {
    if (typeof window.ym === 'function') window.ym(CONFIG.ymId, 'reachGoal', name);
  };

  const reachSection = (id) => {
    const idx = YM_SECTIONS.indexOf(id);
    if (idx < 0 || idx <= goalDepth) return;
    for (let i = goalDepth + 1; i <= idx; i++) goal('section_' + YM_SECTIONS[i]);
    goalDepth = idx;
  };

  const goalFor = (el) => {
    const href = el.getAttribute('href') || '';
    if (href.indexOf('mailto:') === 0) return 'contact_email';
    if (href.indexOf('t.me/') > -1) return 'contact_telegram';
    if (href.indexOf('cv.ferokuk.dev') > -1) return 'cv_open';
    if (href.indexOf('github.com') > -1) return 'contact_github';
    if (el.id === 'lang-en') return 'lang_en';
    if (el.id === 'lang-ru') return 'lang_ru';
    if (el.classList.contains('btn-secondary')) return 'cta_contact';
    if (el.classList.contains('btn-primary')) return 'cta_work';
    return null;
  };

  const initGoals = () => {
    if (typeof window.ym !== 'function') return;

    window.ym(CONFIG.ymId, 'params', { page_type: 'landing', lang: document.documentElement.lang });

    document.addEventListener('click', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('a, button') : null;
      if (!el) return;
      const name = goalFor(el);
      if (name) goal(name);
    }, true);

    document.addEventListener('copy', () => {
      const sel = String(window.getSelection() || '');
      if (sel.indexOf('@ferokuk.dev') > -1) goal('email_copied');
    });

    if ('IntersectionObserver' in window) {
      goalIo = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          reachSection(en.target.id);
          if (goalIo) goalIo.unobserve(en.target);
        });
      }, { threshold: 0, rootMargin: '0px 0px -25% 0px' });
      YM_SECTIONS.forEach(id => {
        const el = document.getElementById(id);
        if (el) goalIo.observe(el);
      });
    }

    engagedTimer = setTimeout(() => goal('engaged_60s'), 60000);
  };

  const boot = () => {
    applyTheme();
    initLogos();
    initGoals();
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = motionQuery.matches;
    if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
    else motionQuery.addListener(onMotionChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    initPipeline();
    initDemoInfo();
    initReveal(reducedMotion);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.ferokuk = { CONFIG, applyTheme, runGhost, destroy };
})();
