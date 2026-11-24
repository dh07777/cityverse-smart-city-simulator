(function() {
    const CV = window.CV,
        M = CV.Map,
        COLS = ['#27d3ff', '#ffd23d', '#ff7a45', '#e6edff', '#2ee59d'];
    const Tr = CV.Traffic = {
        vehicles: [],
        closed: new Set(),
        over: {},
        mode: 'auto',
        t: 0,
        cong: 0,
        avg: 0,
        stopped: 0,
        dens: {},
        series: [],
        init() {
            this.vehicles = [];
            this.closed = new Set(CV.saved.closed || []);
            this.over = {};
            this.mode = 'auto';
            this.t = 0;
            this.cong = 0;
            this.dens = {};
            this.series = [];
            this.step()
        },
        sigAt(i, j) { const m = this.over[i + ',' + j] || this.mode; return m == 'auto' ? (Math.floor(this.t / CV.cfg.cycle) % 2 ? 'ew' : 'ns') : m },
        inter: (i, j) => i % 3 == 0 && j % 3 == 0,
        spawn() {
            let i, j, k = 0;
            do {
                [i, j] = M.roads[Math.random() * M.roads.length | 0]
            } while (this.closed.has(i + ',' + j) && ++k < 20);
            const hor = j % 3 == 0 && (i % 3 != 0 || Math.random() < .5),
                s = Math.random() < .5 ? 1 : -1;
            this.vehicles.push({ x: i + .5, y: j + .5, dx: hor ? s : 0, dy: hor ? 0 : s, c: COLS[Math.random() * 5 | 0], stop: 0, sp: 1 })
        },
        turn(v, i, j) {
            const o = [
                [v.dx, v.dy],
                [-v.dy, v.dx],
                [v.dy, -v.dx]
            ].filter(([x, y]) => M.isRoad(i + x, j + y) && !this.closed.has((i + x) + ',' + (j + y)));
            if (!o.length) {
                v.dx = -v.dx;
                v.dy = -v.dy;
                return
            }
            const st = o.find(d => d[0] == v.dx && d[1] == v.dy),
                p = st && Math.random() < .6 ? st : o[Math.random() * o.length | 0];
            v.dx = p[0];
            v.dy = p[1];
            v.x = i + .5;
            v.y = j + .5
        },
        move(dt) {
            this.t += dt;
            const c = {};
            for (const v of this.vehicles) {
                const k = (v.x | 0) + ',' + (v.y | 0);
                c[k] = (c[k] || 0) + 1
            }
            for (const v of this.vehicles) {
                const ci = v.x | 0,
                    cj = v.y | 0,
                    n = c[ci + ',' + cj] || 1,
                    out = CV.Energy.out[M.secOf(ci, cj)];
                const f = Math.max(.15, 1 - .17 * (n - 1)) * (out ? .6 : 1);
                v.sp = f;
                v.stop = 0;
                const ds = Math.min(.25, 1.7 * f * dt),
                    nx = v.x + v.dx * ds,
                    ny = v.y + v.dy * ds,
                    ni = nx | 0,
                    nj = ny | 0;
                if (ni != ci || nj != cj) {
                    if (!M.isRoad(ni, nj) || this.closed.has(ni + ',' + nj)) {
                        v.dx = -v.dx;
                        v.dy = -v.dy;
                        continue
                    }
                    if (this.inter(ni, nj) && !CV.Energy.out[M.secOf(ni, nj)] && this.sigAt(ni, nj) != (v.dx ? 'ew' : 'ns')) { v.stop = 1; continue }
                }
                const s = v.dx + v.dy,
                    cx = (v.dx ? ni : nj) + .5,
                    a = v.dx ? v.x : v.y,
                    b = v.dx ? nx : ny;
                v.x = nx;
                v.y = ny;
                if (this.inter(ni, nj) && (a - cx) * s < 0 && (b - cx) * s >= 0) this.turn(v, ni, nj)
            }
        },
        step() {
            const V = this.vehicles,
                tg = Math.round(CV.cfg.cars * CV.State.mods.traffic * (.35 + .65 * CV.curve.tr(CV.hour())));
            while (V.length < tg) this.spawn();
            while (V.length > tg) V.shift();
            this.stopped = V.filter(v => v.stop).length;
            const raw = 100 * Math.min(1, .75 * this.stopped / Math.max(1, V.length) + .25 * Math.min(1, V.length / 160));
            this.cong = this.cong * .7 + raw * .3;
            this.avg = V.length ? Math.round(V.reduce((a, v) => a + v.sp * 45, 0) / V.length) : 0;
            const c = {};
            V.forEach(v => {
                const k = (v.x | 0) + ',' + (v.y | 0);
                c[k] = (c[k] || 0) + 1
            });
            for (const k in c) this.dens[k] = (this.dens[k] || 0) * .5 + c[k] * .5;
            for (const k in this.dens)
                if (!(k in c)) { this.dens[k] *= .5; if (this.dens[k] < .05) delete this.dens[k] }
            this.series.push(this.cong);
            if (this.series.length > 60) this.series.shift();
            if (this.cong > 60) CV.alert('warn', 'Heavy congestion: ' + Math.round(this.cong) + '% — adjust signals or reopen roads', 'cong')
        },
        close(i, j, b) {
            const k = i + ',' + j;
            b ? this.closed.add(k) : this.closed.delete(k);
            if (b) this.vehicles = this.vehicles.filter(v => (v.x | 0) != i || (v.y | 0) != j)
        },
        toggleClosure(i, j) {
            if (!M.isRoad(i, j)) return false;
            const k = i + ',' + j,
                b = !this.closed.has(k);
            this.close(i, j, b);
            CV.alert('info', (b ? 'Road closed at ' : 'Road reopened at ') + `(${i},${j})`);
            CV.save();
            CV.App.refresh();
            return true
        },
        panel(el) {
            el.innerHTML = `<h3>🚦 Traffic Management</h3><div class="g2"><div class="card"><small>Congestion</small><b class="big" id="tr-c"></b></div><div class="card"><small>Vehicles</small><b class="big" id="tr-v"></b></div><div class="card"><small>Avg speed</small><b class="big" id="tr-s"></b></div><div class="card"><small>Closed roads</small><b class="big" id="tr-x"></b></div></div>
<div class="card"><small>Signal control (all intersections)</small><div class="seg" id="tr-mode"><button data-m="auto">Auto</button><button data-m="ns">North–South green</button><button data-m="ew">East–West green</button></div><label>Cycle length: <b id="tr-cv"></b> s<input type="range" id="tr-cyc" min="3" max="15"></label><small>Tip: click an intersection on the map to override one signal.</small></div>
<div class="card"><div class="seg"><button class="btn" id="tr-close">🚧 Close roads on map</button><button class="btn" id="tr-clear">Reopen all</button></div><label>Traffic volume: <b id="tr-nv"></b> vehicles<input type="range" id="tr-cars" min="10" max="200"></label></div>
<div class="card"><small>Congestion, last 60 ticks</small><canvas class="ch" id="tr-ch"></canvas></div><div class="card"><small>Traffic density by district</small><div id="tr-sec"></div></div>`;
            $('tr-mode').onclick = e => {
                const m = e.target.dataset.m;
                if (!m) return;
                this.mode = m;
                this.over = {};
                CV.App.refresh()
            };
            $('tr-cyc').oninput = e => {
                CV.cfg.cycle = +e.target.value;
                CV.save();
                this.refresh()
            };
            $('tr-cars').oninput = e => {
                CV.cfg.cars = +e.target.value;
                CV.save();
                this.refresh()
            };
            $('tr-close').onclick = () => { CV.Map.setMode('close', 'Click roads to close / reopen them'); if (innerWidth <= 900) document.body.classList.remove('panelopen') };
            $('tr-clear').onclick = () => {
                this.closed.clear();
                CV.toast('All roads reopened');
                CV.save();
                CV.App.refresh()
            };
            $('tr-cyc').value = CV.cfg.cycle;
            $('tr-cars').value = CV.cfg.cars
        },
        refresh() {
            if (!$('tr-c')) return;
            $('tr-c').textContent = Math.round(this.cong) + '%';
            $('tr-v').textContent = this.vehicles.length;
            $('tr-s').textContent = this.avg + ' km/h';
            $('tr-x').textContent = this.closed.size;
            $('tr-cv').textContent = CV.cfg.cycle;
            $('tr-nv').textContent = CV.cfg.cars;
            document.querySelectorAll('#tr-mode button').forEach(b => b.classList.toggle('on', b.dataset.m == this.mode));
            const s = [0, 0, 0, 0];
            this.vehicles.forEach(v => s[M.secOf(v.x | 0, v.y | 0)]++);
            const tot = Math.max(1, this.vehicles.length);
            $('tr-sec').innerHTML = CV.bars(s.map((n, i) => ({ l: M.SEC[i], v: 100 * n / tot * 2, t: n + ' veh', c: n / tot > .3 ? 'var(--warn)' : '' })));
            CV.Charts.line($('tr-ch'), [{ d: this.series, c: '#ffb83d' }], { min: 0, max: 100 })
        }
    };
})();