(function() {
        const CV = window.CV,
            M = CV.Map,
            rnd = a => a[Math.random() * a.length | 0];
        const g = (a, b, s) => Math.exp(-((a - b) ** 2) / (2 * s * s));
        CV.curve = { dem: h => .55 + .22 * g(h, 8, 2.2) + .32 * g(h, 19, 2.5), tr: h => Math.min(1, .28 + .7 * g(h, 8, 1.8) + .75 * g(h, 17.5, 2) + .2 * g(h, 13, 3)), wat: h => .6 + .55 * g(h, 7, 1.5) + .6 * g(h, 19, 2) + .2 * g(h, 13, 3), sun: h => h > 6 && h < 18 ? Math.sin(Math.PI * (h - 6) / 12) : 0 };
        CV.hour = () => (CV.State.t / 60) % 24;
        CV.clock = () => {
            const t = CV.State.t,
                m = t % 1440;
            return `Day ${1+Math.floor(t/1440)} · ${String(m/60|0).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
        };
        CV.alert = (l, m, k) => {
            const S = CV.State;
            if (k) {
                if (S.ak[k] != null && S.t - S.ak[k] < 120) return;
                S.ak[k] = S.t
            }
            S.alerts.unshift({ l, m, c: CV.clock(), t: S.t });
            if (S.alerts.length > 40) S.alerts.length = 40
        };
        CV.kpis = () => {
            const E = CV.Energy,
                wp = 100 * CV.Water.level / CV.Water.CAP,
                k = { cong: CV.Traffic.cong, deficit: E.deficit, renew: E.renew, water: wp, aqi: CV.Env.aqi, inc: CV.Emergency.incidents.length };
            k.score = Math.max(0, Math.min(100, Math.round(100 - .2 * k.cong - .12 * k.aqi - 60 * (E.demand ? E.deficit / E.demand : 0) - (wp < 30 ? (30 - wp) * .6 : 0) - k.inc * 3)));
            return k
        };
        const ROWS = [
            ['cong', 'Congestion %', -1, 0],
            ['deficit', 'Power deficit MW', -1, 1],
            ['renew', 'Renewable %', 1, 0],
            ['water', 'Reservoir %', 1, 0],
            ['aqi', 'AQI', -1, 0],
            ['inc', 'Active incidents', -1, 0],
            ['score', 'City score', 1, 0]
        ];
        const SCN = [{
                id: 'rush',
                n: '🚗 Rush-hour gridlock',
                d: 'Traffic ×2.2 with higher emissions',
                a(m) {
                    m.traffic = 2.2;
                    m.pol = 1.3
                }
            },
            {
                id: 'heat',
                n: '🔥 Heatwave',
                d: 'Power ×1.35, water ×1.3, stronger sun',
                a(m) {
                    m.demand = 1.35;
                    m.water = 1.3;
                    m.solar = 1.1;
                    m.pol = 1.15
                }
            },
            {
                id: 'green',
                n: '🌱 Green transition',
                d: '+30% solar, 30% less traffic, 12 trees',
                a(m) {
                    m.solar = 1.3;
                    m.traffic = .7;
                    m.pol = .7;
                    CV.cfg.trees += 12
                },
                r() { CV.cfg.trees -= 12 }
            },
            {
                id: 'flood',
                n: '🌊 Major flood',
                d: 'Heavy rain, flooded streets, an accident',
                a(m) {
                    m.rain = 1.8;
                    CV.Emergency.create('flood', ...rnd(M.roads), 3);
                    CV.Emergency.create('flood', ...rnd(M.roads), 2);
                    CV.Emergency.create('accident', ...rnd(M.roads), 2)
                }
            },
            { id: 'ind', n: '🏭 Industrial shutdown', d: 'All factories go offline', a(m) { m.ind = 0 } },
            { id: 'burst', n: '💧 Water main burst', d: 'Three simultaneous leaks', a(m) { m.water = 1.1; for (let k = 0; k < 3; k++) CV.Water.addLeak(...rnd(M.roads)) } },
            {
                id: 'black',
                n: '🌑 Grid failure',
                d: 'Two districts lose power',
                a() {
                    CV.Energy.setOutage(0, true);
                    CV.Energy.setOutage(1, true)
                },
                r() {
                    CV.Energy.setOutage(0, false);
                    CV.Energy.setOutage(1, false)
                }
            }
        ];
        const S0 = () => ({ demand: 1, solar: 1, traffic: 1, pol: 1, water: 1, rain: 1, ind: 1 });
        const Sim = CV.Sim = {
                raf: 0,
                acc: 0,
                last: 0,
                newState() {
                    CV.State = { t: CV.saved.t || 480, running: false, mods: S0(), scen: null, alerts: [], ak: {}, pop0: M.tiles.reduce((a, t) => a + t.pop, 0), pop: 0 };
                    this.pop()
                },
                pop() {
                    const S = CV.State;
                    S.pop = Math.round(S.pop0 * (1 + S.t / 1440 * .0015))
                },
                init() {
                    this.newState();
                    CV.Traffic.init();
                    CV.Energy.init();
                    CV.Water.init();
                    CV.Emergency.init();
                    CV.Analytics.init();
                    CV.Env.init();
                    CV.Traffic.step();
                    CV.Energy.step(true);
                    this.btn()
                },
                btn() {
                    $('bPlay').textContent = CV.State.running ? '⏸ Pause' : '▶ Start';
                    $('bPlay').classList.toggle('on', CV.State.running);
                    $('speed').value = CV.cfg.speed
                },
                start() {
                    if (CV.State.running) return;
                    CV.State.running = true;
                    this.last = performance.now();
                    this.acc = 0;
                    this.raf = requestAnimationFrame(t => this.loop(t));
                    this.btn()
                },
                pause() {
                    CV.State.running = false;
                    cancelAnimationFrame(this.raf);
                    this.btn();
                    CV.save()
                },
                toggle() { CV.State.running ? this.pause() : this.start() },
                reset() {
                    this.pause();
                    CV.saved = { cfg: CV.cfg };
                    CV.lastScen = null;
                    this.init();
                    M.sel = null;
                    $('insp').hidden = true;
                    CV.save();
                    CV.App.refresh();
                    M.draw();
                    CV.toast('Simulation reset')
                },
                setSpeed(v) {
                    CV.cfg.speed = +v;
                    CV.save();
                    this.btn()
                },
                loop(ts) {
                    if (!CV.State.running) return;
                    const rd = Math.max(0, Math.min(.1, (ts - this.last) / 1000)),
                        sp = CV.cfg.speed;
                    this.last = ts;
                    CV.Traffic.move(Math.min(.12, rd * sp));
                    this.acc += rd * sp;
                    let n = 0;
                    while (this.acc >= .5 && n++ < 6) {
                        this.acc -= .5;
                        this.step()
                    }
                    if (n >= 6) this.acc = 0;
                    M.draw();
                    this.raf = requestAnimationFrame(t => this.loop(t))
                },
                step() {
                    const S = CV.State;
                    S.t += 5;
                    this.pop();
                    CV.Traffic.step();
                    CV.Energy.step();
                    CV.Water.step();
                    CV.Env.step();
                    CV.Emergency.step();
                    this.random();
                    this.scen();
                    CV.Analytics.sample();
                    if (S.t % 60 == 0) CV.save();
                    CV.App.refresh()
                },
                random() {
                    if (!CV.cfg.random || Math.random() > .02) return;
                    const r = Math.random(),
                        E = CV.Energy;
                    if (r < .35) CV.Water.addLeak(...rnd(M.roads));
                    else if (r < .6) { if (!E.out.some(x => x)) E.setOutage(Math.random() * 4 | 0, true, true) } else {
                        const ty = rnd(['fire', 'accident', 'medical', 'flood']),
                            t = rnd(M.tiles);
                        CV.Emergency.create(ty, t.i, t.j)
                    }
                },
                run(id) {
                    const S = CV.State;
                    if (S.scen) { CV.toast('A scenario is already running'); return }
                    const sc = SCN.find(x => x.id == id),
                        before = CV.kpis();
                    sc.a(S.mods);
                    S.scen = { sc, left: 48, total: 48, before, sum: {}, n: 0 };
                    CV.alert('info', 'Scenario started: ' + sc.n);
                    this.start();
                    CV.App.show('scenario')
                },
                stop() {
                    const S = CV.State;
                    if (!S.scen) return;
                    this.fin(true)
                },
                scen() {
                    const s = CV.State.scen;
                    if (!s) return;
                    const k = CV.kpis();
                    for (const x in k) s.sum[x] = (s.sum[x] || 0) + k[x];
                    s.n++;
                    if (--s.left <= 0) this.fin()
                },
                fin(abort) {
                    const S = CV.State,
                        s = S.scen,
                        after = {};
                    for (const x in s.sum) after[x] = s.sum[x] / Math.max(1, s.n);
                    if (!s.n) Object.assign(after, CV.kpis());
                    S.mods = S0();
                    s.sc.r && s.sc.r();
                    S.scen = null;
                    CV.lastScen = { name: s.sc.n, before: s.before, after, impact: Math.round(after.score - s.before.score), abort: !!abort };
                    CV.alert('ok', 'Scenario finished: ' + s.sc.n);
                    CV.save();
                    CV.App.refresh()
                },
                panel(el) { el.innerHTML = `<h3>🧪 Scenario Simulator</h3><div class="card"><div class="row2"><small>Simulation</small><div class="seg"><button class="btn" id="sc-go">▶ Start / pause</button><button class="btn" id="sc-rs">↺ Reset</button></div></div><small>Each scenario runs for 4 simulated hours, then compares before and after.</small></div><div id="sc-st"></div>${SCN.map(s=>`<div class="card"><div class="row2"><b>${s.n}</b><button class="btn" data-s="${s.id}">Run</button></div><small>${s.d}</small></div>`).join('')}<div id="sc-res"></div>`;
$('sc-go').onclick=()=>this.toggle();$('sc-rs').onclick=()=>this.reset();el.onclick=e=>{const id=e.target.dataset.s;if(id)this.run(id);if(e.target.id=='sc-stop')this.stop()}},
refresh(){if(!$('sc-st'))return;const s=CV.State.scen;$('sc-st').innerHTML=s?`<div class="card"><div class="row2"><b>Running: ${s.sc.n}</b><button class="btn" id="sc-stop">Stop</button></div><div class="bar"><i style="width:${100*(s.total-s.left)/s.total}%"></i></div></div>`:'';
const r=CV.lastScen;$('sc-res').innerHTML=r?`<div class="card"><b>Last result: ${r.name}</b>${r.abort?' <small>(stopped early)</small>':''}<div class="row2"><small>Impact score</small><b class="big ${r.impact<0?'bad':'ok'}">${r.impact>0?'+':''}${r.impact}</b></div><table><tr><th></th><th>Before</th><th>After</th><th>Δ</th></tr>${ROWS.map(([k,l,d,f])=>{const a=r.before[k],b=r.after[k],x=b-a,c=Math.abs(x)<.05?'':(x*d>0?'ok':'bad');return`<tr><td>${l}</td><td>${a.toFixed(f?1:0)}</td><td>${b.toFixed(f?1:0)}</td><td class="${c}">${x>0?'+':''}${x.toFixed(f?1:0)}</td></tr>`}).join('')}</table></div>`:'<div class="empty">No scenario run yet. Pick one above to compare before and after.</div>'}};
})();