(function() {
        const CV = window.CV,
            M = CV.Map;
        const W = CV.Water = {
                CAP: 10,
                level: 7,
                supply: 0,
                demand: 0,
                raw: 0,
                loss: 0,
                ratio: 1,
                leaks: [],
                saved: 0,
                lpcd: 0,
                pr: [0, 0, 0, 0],
                s1: [],
                s2: [],
                nid: 1,
                init() {
                    this.level = 7;
                    this.leaks = [];
                    this.saved = 0;
                    this.s1 = [];
                    this.s2 = [];
                    this.ratio = 1;
                    this.calc()
                },
                calc() {
                    const S = CV.State,
                        m = S.mods,
                        c = CV.cfg.conservation / 100;
                    this.raw = S.pop * 1.1e-5 * CV.curve.wat(CV.hour()) * m.water;
                    this.demand = this.raw * (1 - c);
                    this.supply = .45 * CV.cfg.inflow / 100 * m.rain;
                    this.loss = this.leaks.length * .05;
                    this.lpcd = Math.round(this.demand * 24 * 1e6 / Math.max(1, S.pop))
                },
                step() {
                    this.calc();
                    const dt = 5 / 60,
                        av = this.level + this.supply * dt,
                        need = (this.demand + this.loss) * dt;
                    if (av >= need) {
                        this.level = Math.min(this.CAP, av - need);
                        this.ratio = 1
                    } else {
                        this.level = 0;
                        this.ratio = av / need
                    }
                    this.saved += (this.raw - this.demand) * dt;
                    this.leaks.forEach(l => { if (l.fix > 0 && --l.fix == 0) l.done = 1 });
                    const d = this.leaks.filter(l => l.done);
                    if (d.length) {
                        this.leaks = this.leaks.filter(l => !l.done);
                        CV.alert('ok', 'Leak repaired — pipe restored')
                    }
                    const p = this.level / this.CAP;
                    if (p < .2) CV.alert(p < .1 ? 'crit' : 'warn', 'Reservoir at ' + Math.round(p * 100) + '%', 'wl');
                    if (this.ratio < 1) CV.alert('crit', 'Water rationing: ' + Math.round(this.ratio * 100) + '% of demand served', 'wr');
                    this.pr = [0, 1, 2, 3].map(s => Math.max(5, Math.round(60 * (.4 + .6 * this.ratio) * (.65 + .35 * Math.min(1, p * 3)) - 5 * this.leaks.filter(l => M.secOf(l.i, l.j) == s).length)));
                    this.s1.push(this.demand + this.loss);
                    this.s2.push(this.supply);
                    [this.s1, this.s2].forEach(a => { if (a.length > 48) a.shift() })
                },
                addLeak(i, j) {
                    const [a, b] = M.isRoad(i, j) ? [i, j] : M.nearRoad(i, j);
                    if (this.leaks.some(l => l.i == a && l.j == b)) { CV.toast('A leak already exists there'); return }
                    this.leaks.push({ id: this.nid++, i: a, j: b, fix: 0 });
                    CV.alert('warn', `Water leak detected at (${a},${b}) in ${M.SEC[M.secOf(a,b)]} district`);
                    CV.App.refresh()
                },
                panel(el) {
                    el.innerHTML = `<h3>💧 Water Management</h3><div class="card"><div class="row2"><small>Reservoir level</small><b id="wa-p"></b></div><div class="bar"><i id="wa-b"></i></div></div>
<div class="g2"><div class="card"><small>Demand</small><b class="big" id="wa-d"></b></div><div class="card"><small>Supply</small><b class="big" id="wa-s"></b></div><div class="card"><small>Per person</small><b class="big" id="wa-l"></b></div><div class="card"><small>Water saved</small><b class="big" id="wa-v"></b></div></div>
<div class="card"><label>Conservation target: <b id="wa-cv"></b>% less demand<input type="range" id="wa-con" min="0" max="30"></label><label>Treatment inflow: <b id="wa-iv"></b>%<input type="range" id="wa-in" min="50" max="150" step="5"></label></div>
<div class="card"><small>Distribution pressure (psi)</small><div id="wa-pr"></div></div>
<div class="card"><div class="row2"><small>Leakage incidents</small><span class="seg"><button class="btn" id="wa-rl">🎲 Random</button><button class="btn" id="wa-pl">📍 Place</button></span></div><div id="wa-lk"></div></div>
<div class="card"><small>Demand vs supply (ML/h)</small><canvas class="ch" id="wa-ch"></canvas></div>`;
                    $('wa-con').oninput = e => {
                        CV.cfg.conservation = +e.target.value;
                        CV.save();
                        this.calc();
                        CV.App.refresh()
                    };
                    $('wa-in').oninput = e => {
                        CV.cfg.inflow = +e.target.value;
                        CV.save();
                        this.calc();
                        CV.App.refresh()
                    };
                    $('wa-con').value = CV.cfg.conservation;
                    $('wa-in').value = CV.cfg.inflow;
                    $('wa-rl').onclick = () => this.addLeak(...M.roads[Math.random() * M.roads.length | 0]);
                    $('wa-pl').onclick = () => { M.setMode('leak', 'Click a road to create a leak'); if (innerWidth <= 900) document.body.classList.remove('panelopen') };
                    $('wa-lk').onclick = e => {
                        const i = e.target.dataset.r;
                        if (!i) return;
                        const l = this.leaks.find(x => x.id == +i);
                        if (l) {
                            l.fix = 6;
                            CV.toast('Repair crew dispatched');
                            CV.App.refresh()
                        }
                    }
                },
                refresh() {
                    if (!$('wa-p')) return;
                    const p = Math.round(100 * this.level / this.CAP);
                    $('wa-p').textContent = p + '% (' + this.level.toFixed(1) + ' ML)';
                    $('wa-b').style.width = p + '%';
                    $('wa-b').style.background = p < 20 ? 'var(--bad)' : p < 40 ? 'var(--warn)' : '';
                    $('wa-d').textContent = this.demand.toFixed(2) + ' ML/h';
                    $('wa-s').textContent = this.supply.toFixed(2) + ' ML/h';
                    $('wa-l').textContent = this.lpcd + ' L/day';
                    $('wa-v').textContent = this.saved.toFixed(1) + ' ML';
                    $('wa-cv').textContent = CV.cfg.conservation;
                    $('wa-iv').textContent = CV.cfg.inflow;
                    $('wa-pr').innerHTML = CV.bars(M.SEC.map((n, i) => ({ l: n, v: this.pr[i] / 70 * 100, t: this.pr[i] + ' psi', c: this.pr[i] < 35 ? 'var(--bad)' : '' })));
                    $('wa-lk').innerHTML = this.leaks.length ? this.leaks.map(l => `<div class="row2"><span>Leak #${l.id} · (${l.i},${l.j})</span>${l.fix?`<small>repairing… ${l.fix}</small>`:`<button class="btn" data-r="${l.id}">🔧 Repair</button>`}</div>`).join(''):'<div class="empty">No leaks detected. Distribution is healthy.</div>';
CV.Charts.line($('wa-ch'),[{d:this.s1,c:'#ff7a45'},{d:this.s2,c:'#2fa8ff'}],{min:0})}};
})();