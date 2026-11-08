(function (AA) {
  const { qs, clamp } = AA.util;
  const { EASE_OUT } = AA.CONST;

  class ClockController {
    constructor(container, store, obstacleEl) {
      this.container = container;
      this.store = store;
      this.panel = obstacleEl;
      this.clockElement = qs(this.container, '#clock');
      this.clockWrapper = qs(this.container, '#clock-wrapper');
      this.dateElement = qs(this.container, '#date');
      this.customTextElement = qs(this.container, '#custom-text');
      this.tensCont = qs(this.clockElement, '.tens-group');
      this.unitsCont = qs(this.clockElement, '.units-group');
      this.minCont = qs(this.clockElement, '.minutes-group');
      this.colonHM = qs(this.clockElement, '.colon-hm');
      this.colonMS = qs(this.clockElement, '.colon-ms');
      this.secCont = qs(this.clockElement, '.seconds-group');
      this.ampmCont = qs(this.clockElement, '.ampm-group');
      this.lastTime = this.blank();

      [this.colonHM, this.colonMS].forEach(c => {
        c.innerHTML = '<span><div class="digit-old">:</div><div class="digit-new">:</div></span>';
      });

      this.clockElement.classList.toggle('is-vertical', this.store.getState().clockLayout === 1);

      const { clockCustomText, showCustomText, datePosition } = this.store.getState();
      this.customTextElement.textContent = clockCustomText;
      this.customTextElement.classList.toggle('is-hidden', !showCustomText);
      [this.dateElement, this.customTextElement].forEach(el => {
        el.classList.toggle('is-above', datePosition === 1);
      });

      this.timer = null;
      this.running = false;
      this.layoutAnim = null;
      this.datePosAnims = [];
      this.anchorAnim = null;
      this.anchorRaf = null;
      this.dateAnim = null;
      this.targetDateStr = null;
      this.fmtCache = {
        zhW: new Intl.DateTimeFormat('zh-TW', { weekday: 'long' }),
        enM: new Intl.DateTimeFormat('en-US', { month: 'long' }),
        enW: new Intl.DateTimeFormat('en-US', { weekday: 'long' })
      };
      this.ANIM_OPT = AA.CLOCK_ANIMS.ANIM_OPT;
      this.ANIM_REGISTRY = AA.CLOCK_ANIMS.ANIM_REGISTRY;

      this.evadeRaf = null;
      this.layoutObserver = new ResizeObserver(() => {
        if (this.evadeRaf) return;
        this.evadeRaf = requestAnimationFrame(() => {
          this.evadeRaf = null;
          this.updateEvasion();
        });
      });
      this.layoutObserver.observe(this.panel);
      [this.container, this.clockWrapper].forEach(e => this.layoutObserver.observe(e));

      const evade = () => this.updateEvasion();
      const retick = () => {
        this.lastTime = this.blank();
        this.tick();
      };
      const handlers = {
        clockLayout: (_, val) => this.animateLayout(val),
        datePosition: (_, val) => this.animateDatePosition(val),
        clockAnchor: () => this.animateAnchor(),
        clockCustomText: (_, val) => {
          this.customTextElement.textContent = val;
        },
        showCustomText: (_, val) => {
          this.customTextElement.classList.toggle('is-hidden', !val);
        }
      };
      ['isPanelOpen', 'clockOffsetX', 'clockOffsetY'].forEach(k => {
        handlers[k] = evade;
      });
      ['is24Hour', 'showSeconds', 'isLeadingZero', 'clockTickAnim', 'lang', 'showDate', 'showYear', 'showMonth', 'showDay', 'showWeekday'].forEach(k => {
        handlers[k] = retick;
      });
      this.stateHandlers = handlers;

      this.store.subscribe(Object.keys(handlers), (key, val) => this.handleStateChange(key, val));
    }

    blank() {
      return { tens: "", units: "", min: "", sec: "", ampm: "" };
    }

    formatDate(now, lang, y, m, d, w) {
      if (!y && !m && !d && !w) return "";

      if (lang === 'zh') {
        const datePart = `${y ? now.getFullYear() + '年' : ''}${m ? (now.getMonth() + 1) + '月' : ''}${d ? now.getDate() + '日' : ''}`;
        const weekPart = w ? this.fmtCache.zhW.format(now) : '';
        return [datePart, weekPart].filter(Boolean).join(' ');
      }

      const wStr = w ? this.fmtCache.enW.format(now) : '';
      const mStr = m ? this.fmtCache.enM.format(now) : '';
      const dStr = d ? String(now.getDate()) : '';
      const yStr = y ? String(now.getFullYear()) : '';
      const md = [mStr, dStr].filter(Boolean).join(' ');
      const datePart = (m && !d && y) ? `${mStr} ${yStr}` : [md, yStr].filter(Boolean).join(', ');
      return [wStr, datePart].filter(Boolean).join(', ');
    }

    resetDOM(oldEl, newEl, span, c) {
      oldEl.textContent = c;
      oldEl.style.transform = '';
      oldEl.style.filter = '';
      oldEl.style.opacity = '1';
      newEl.style.opacity = '0';
      span.style.perspective = 'none';
    }

    handleStateChange(key, val) {
      const handler = this.stateHandlers[key];
      if (handler) handler(key, val);
    }

    animateLayout(val) {
      const ce = this.clockElement;
      if (this.layoutAnim) {
        this.layoutAnim.cancel();
        this.layoutAnim = null;
      }
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const out = this.layoutAnim = ce.animate(
        calm
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.95)' }],
        { duration: 100, easing: EASE_OUT }
      );
      out.onfinish = () => {
        if (this.layoutAnim !== out) return;
        ce.classList.toggle('is-vertical', val === 1);
        this.updateEvasion();
        const inn = this.layoutAnim = ce.animate(
          calm
            ? [{ opacity: 0 }, { opacity: 1 }]
            : [{ opacity: 0, transform: 'scale(1.05)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: 180, easing: EASE_OUT }
        );
        inn.onfinish = inn.oncancel = () => {
          if (this.layoutAnim === inn) this.layoutAnim = null;
        };
      };
    }

    animateDatePosition(val) {
      if (this.datePosAnims.length) {
        this.datePosAnims.forEach(a => a.cancel());
        this.datePosAnims = [];
      }
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const batch = [];
      this.datePosAnims = batch;
      [this.dateElement, this.customTextElement].forEach((el, i) => {
        const out = el.animate(
          calm
            ? [{ opacity: 1 }, { opacity: 0 }]
            : [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(6px)' }],
          { duration: 100, easing: EASE_OUT }
        );
        batch.push(out);
        out.onfinish = () => {
          if (this.datePosAnims !== batch) return;
          el.classList.toggle('is-above', val === 1);
          if (i) this.updateEvasion();
          const inn = el.animate(
            calm
              ? [{ opacity: 0 }, { opacity: 1 }]
              : [{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)' }],
            { duration: 180, easing: EASE_OUT }
          );
          batch[i] = inn;
          inn.onfinish = inn.oncancel = () => {
            if (this.datePosAnims === batch && i === 1) this.datePosAnims = [];
          };
        };
      });
    }

    animateAnchor() {
      const cw = this.clockWrapper;
      const cl = this.container;
      const first = cw.getBoundingClientRect();
      if (this.anchorRaf) {
        cancelAnimationFrame(this.anchorRaf);
        this.anchorRaf = null;
      }
      if (this.anchorAnim) {
        this.anchorAnim.cancel();
        this.anchorAnim = null;
        cl.classList.remove('is-flipping');
      }
      this.anchorRaf = requestAnimationFrame(() => {
        this.anchorRaf = null;
        if (this.anchorAnim) {
          this.anchorAnim.cancel();
          this.anchorAnim = null;
        }
        cl.classList.add('is-flipping');
        this.updateEvasion();
        void cw.offsetWidth;
        const last = cw.getBoundingClientRect();
        const rx = first.left - last.left;
        const ry = first.top - last.top;
        const dist = Math.sqrt(rx * rx + ry * ry);
        const sc = cw.offsetWidth ? last.width / cw.offsetWidth : 1;
        const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (dist > 5) {
          const a = this.anchorAnim = cw.animate(
            calm
              ? [{ opacity: 0 }, { opacity: 1 }]
              : [
                { transform: `translate(${rx / sc}px,${ry / sc}px)`, filter: `blur(${Math.min(12, dist * 0.05)}px)` },
                { transform: 'translate(0px, 0px)', filter: 'blur(0px)' }
              ],
            { duration: calm ? 180 : 280, easing: EASE_OUT }
          );
          a.onfinish = a.oncancel = () => {
            if (this.anchorAnim === a) {
              this.anchorAnim = null;
              cl.classList.remove('is-flipping');
            }
          };
        } else {
          cl.classList.remove('is-flipping');
        }
      });
    }

    diffDOM(container, newStr, oldStr) {
      if (newStr !== oldStr) {
        if (!oldStr || container.children.length !== newStr.length) {
          container.innerHTML = newStr
            .split('')
            .map(c => `<span><div class="digit-old">${c}</div><div class="digit-new">${c}</div></span>`)
            .join('');
        } else {
          const { clockTickAnim, clockMaterial } = this.store.getState();
          const pfx = (container !== this.ampmCont && clockMaterial === 1) ? 'url(#hollow-fx) ' : '';
          for (let i = 0; i < newStr.length; i++) {
            if (newStr[i] !== oldStr[i]) {
              const span = container.children[i];
              const oldEl = qs(span, '.digit-old');
              const newEl = qs(span, '.digit-new');
              const animMode = Number(clockTickAnim);
              if (animMode === 0) {
                oldEl.textContent = newStr[i];
              } else {
                oldEl.textContent = oldStr[i];
                newEl.textContent = newStr[i];
                newEl.style.opacity = '1';
                const def = this.ANIM_REGISTRY[animMode];
                if (def) {
                  if (def.setup) def.setup(oldEl, newEl, span);
                  const mapFrames = frames => (pfx ? frames.map(f => (f.filter ? { ...f, filter: pfx + f.filter } : f)) : frames);
                  const oldAnim = oldEl.animate(mapFrames(def.old), { ...(def.oldOpts || def.opts), fill: 'forwards' });
                  newEl.animate(mapFrames(def.new), def.newOpts || def.opts).onfinish = () => {
                    oldAnim.cancel();
                    this.resetDOM(oldEl, newEl, span, newStr[i]);
                  };
                } else {
                  oldEl.textContent = newStr[i];
                }
              }
            }
          }
        }
      }
      return newStr;
    }

    tick() {
      clearTimeout(this.timer);
      if (!this.running) return;

      const { is24Hour, isLeadingZero, showSeconds, showDate, lang, showYear, showMonth, showDay, showWeekday } = this.store.getState();
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const de = this.dateElement;
      const lt = this.lastTime;

      let hh = now.getHours();
      const isPM = hh >= 12;
      if (!is24Hour) hh = hh % 12 || 12;
      const [hTens, hUnits] = pad(hh);
      const minStr = pad(now.getMinutes());
      const secStr = pad(now.getSeconds());
      const ampmStr = is24Hour ? '' : isPM ? 'PM' : 'AM';

      this.tensCont.classList.toggle('is-hidden', !isLeadingZero && hTens === '0');
      [this.secCont, this.colonMS].forEach(c => c.classList.toggle('is-hidden', !showSeconds));
      this.ampmCont.classList.toggle('is-hidden', is24Hour);
      de.classList.toggle('is-hidden', !showDate);

      lt.tens = this.diffDOM(this.tensCont, hTens, lt.tens);
      lt.units = this.diffDOM(this.unitsCont, hUnits, lt.units);
      lt.min = this.diffDOM(this.minCont, minStr, lt.min);
      lt.sec = this.diffDOM(this.secCont, secStr, lt.sec);
      lt.ampm = this.diffDOM(this.ampmCont, ampmStr, lt.ampm);

      const dateStr = this.formatDate(now, lang, showYear, showMonth, showDay, showWeekday);
      const curTarget = this.dateAnim ? this.targetDateStr : de.textContent;
      if (curTarget !== dateStr) {
        this.targetDateStr = dateStr;
        if (this.dateAnim) {
          this.dateAnim.cancel();
          this.dateAnim = null;
        }
        if (de.textContent === "" || dateStr === "") {
          de.textContent = dateStr;
        } else {
          const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          const out = this.dateAnim = de.animate(
            calm
              ? [{ opacity: 1 }, { opacity: 0 }]
              : [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(4px)' }],
            { duration: 100, easing: EASE_OUT }
          );
          out.onfinish = () => {
            if (this.dateAnim !== out) return;
            de.textContent = dateStr;
            const inn = this.dateAnim = de.animate(
              calm
                ? [{ opacity: 0 }, { opacity: 1 }]
                : [{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)' }],
              { duration: 180, easing: EASE_OUT }
            );
            inn.onfinish = inn.oncancel = () => {
              if (this.dateAnim === inn) this.dateAnim = null;
            };
          };
        }
      }

      this.timer = setTimeout(this.tick.bind(this), 1000 - (Date.now() % 1000));
    }

    updateEvasion() {
      const { isPanelOpen, clockAnchor, clockOffsetX, clockOffsetY } = this.store.getState();
      let x = 0;
      let y = 0;
      let k = 1;

      const ww = window.innerWidth;
      const wh = window.innerHeight;
      const cw = this.clockWrapper;
      const bw = cw.offsetWidth;
      const bh = cw.offsetHeight;

      if (bw > 0 && bh > 0) {
        const m = 16;
        const pad = Math.min(ww, wh) * 0.04;
        const edge = Math.min(pad, m);
        const maxW = Math.max(1, ww - pad * 2);
        const maxH = Math.max(1, wh - pad * 2);
        k = clamp(Math.min(1, maxW / bw, maxH / bh), 0.35, 1);

        const B = {
          l: cw.offsetLeft,
          r: cw.offsetLeft + bw,
          t: cw.offsetTop,
          b: cw.offsetTop + bh
        };
        const ox = [pad, ww / 2, ww - pad][clockAnchor % 3];
        const oy = [pad, wh / 2, wh - pad][Math.floor(clockAnchor / 3)];
        const dx = clockOffsetX * ww / 100;
        const dy = clockOffsetY * wh / 100;
        const R = f => ({
          l: ox + f * (B.l - ox) + dx,
          r: ox + f * (B.r - ox) + dx,
          t: oy + f * (B.t - oy) + dy,
          b: oy + f * (B.b - oy) + dy
        });

        let r = R(k);
        if (isPanelOpen) {
          const p = this.panel;
          const P = {
            l: p.offsetLeft - m,
            r: p.offsetLeft + p.offsetWidth + m,
            t: p.offsetTop - m,
            b: p.offsetTop + p.offsetHeight + m
          };
          if (r.l < P.r && r.r > P.l && r.t < P.b && r.b > P.t) {
            if (ww <= 600) {
              if (r.t + (P.t - r.b) < m) {
                k = Math.min(k, clamp((P.t - m) / bh, 0.35, 1));
                r = R(k);
              }
              y = Math.min(0, P.t - r.b);
            } else if (r.r + (P.r - r.l) <= ww - m) {
              x = P.r - r.l;
            } else if (r.t + (P.t - r.b) >= m) {
              y = P.t - r.b;
            } else {
              k = Math.min(k, clamp((ww - m - P.r) / bw, 0.35, 1));
              r = R(k);
              x = Math.max(0, P.r - r.l);
            }
          }
        }

        if (r.l + x < edge) x = edge - r.l;
        else if (r.r + x > ww - edge) x = ww - edge - r.r;
        if (r.t + y < edge) y = edge - r.t;
        else if (r.b + y > wh - edge) y = wh - edge - r.b;
      }

      const st = this.container.style;
      st.setProperty('--evade-x', `${x}px`);
      st.setProperty('--evade-y', `${y}px`);
      st.setProperty('--evade-scale', k.toFixed(3));
    }

    pause() {
      this.running = false;
      clearTimeout(this.timer);
    }

    resume() {
      if (this.running) return;
      this.running = true;
      this.tick();
    }

    start() {
      this.resume();
      this.updateEvasion();
    }
  }

  AA.ClockController = ClockController;
})(window.AA);
