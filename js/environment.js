(function() {
    const CV = window.CV,
        M = CV.Map,
        N = M.N;
    const Z = () => Array.from({ length: N }, () => Array(N).fill(0));
    const CAT = a => a <= 50 ? ['Good', 'var(--ok)'] : a <= 100 ? ['Moderate', 'var(--warn)'] : a <= 150 ? ['Unhealthy (sensitive)', '#ff8a3d'] : a <= 200 ? ['Unhealthy', 'var(--bad)'] : ['Hazardous', '#c026d3'];
    const V = CV.Env = {
        pol: Z(),
        aqi: 50,
        noise: 45,
        green: 12,
        wind: [1, 0],
        s1: [],
        s2: [],
        init() {
            this.pol = Z();
            this.wind = [1, 0];
            this.s1 = [];
            this.s2 = [];
            for (let k = 0; k < 20; k++) this.step(true)
        },
        step(init) {
            const m = CV.State.mods,
                e = Z();
            for (const k in CV.Traffic.dens) {
                const [i, j] = k.split(',');
                e[j][i] += CV.Traffic.dens[k] * .012 * m.pol
            }
            for (const t of M.tiles) { if (t.type == 'ind') e[t.j][t.i] += .06 * m.pol * m.ind * (CV.cfg.curb ? .5 : 1); if (t.type == 'power') e[t.j][t.i] += .06 * Math.min(1, CV.Energy.conv / 80) }
            for (const n of CV.Emergency.incidents)
                if (n.type == 'fire') e[n.j][n.i] += .1 * n.sev;
            if (!init && CV.State.t % 120 == 0 && Math.random() < .4) this.wind = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ][Math.random() * 4 | 0];
            const p = this.pol,
                q = Z(),
                [wx, wy] = this.wind;
            for (let j = 0; j < N; j++)
                for (let i = 0; i < N; i++) {
                    let s = 0,
                        c = 0;
                    for (const [a, b] of[[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                        const x = i + a,
                            y = j + b;
                        if (x >= 0 && y >= 0 && x < N && y < N) {
                            s += p[y][x];
                            c++
                        }
                    }
                    const ux = i - wx,
                        uy = j - wy,
                        up = ux >= 0 && uy >= 0 && ux < N && uy < N ? p[uy][ux] : 0;
                    let v = (p[j][i] * .55 + s / c * .3 + up * .15) * .96 + e[j][i];
                    const t = M.grid[j][i];
                    if (t && t.type == 'park') v *= .9;
                    q[j][i] = Math.min(1, v)
                }
            this.pol = q;
            this.green = Math.min(60, M.count.park / 64 * 100 + CV.cfg.trees * .5);
            let mean = 0;
            q.forEach(r => r.forEach(v => mean += v));
            mean /= N * N;
            this.aqi = Math.max(10, Math.min(500, Math.round((20 + 330 * mean) * (1 - this.green / 250))));
            const h = CV.hour();
            this.noise = Math.round(Math.min(110, 40 + 30 * Math.min(1, CV.Traffic.vehicles.length / 150) + 6 * CV.State.mods.ind - (h < 6 || h >= 22 ? 6 : 0)));
            if (init) return;
            this.s1.push(this.aqi);
            this.s2.push(this.noise);
            [this.s1, this.s2].forEach(a => { if (a.length > 48) a.shift() });
            if (this.aqi > 150) CV.alert('crit', 'Air quality ' + CV.aqiCat(this.aqi) + ' (AQI ' + this.aqi + ')', 'aqi');
            else if (this.aqi > 100) CV.alert('warn', 'Air quality is unhealthy for sensitive groups (AQI ' + this.aqi + ')', 'aqi');
            if (this.noise > 75) CV.alert('warn', 'Noise level high: ' + this.noise + ' dB', 'noi')
        },
        panel(el) {
            el.innerHTML = `<h3>🌿 Environmental Monitoring</h3><div class="card"><small>Air quality index</small><b class="big" id="ev-a"></b><small id="ev-ac"></small></div>
<div class="g2"><div class="card"><small>Noise</small><b class="big" id="ev-n"></b></div><div class="card"><small>Green coverage</small><b class="big" id="ev-g"></b></div><div class="card"><small>Wind</small><b class="big" id="ev-w"></b></div><div class="card"><small>Trees planted</small><b class="big" id="ev-t"></b></div></div>
<div class="card"><div class="seg"><button class="btn" id="ev-heat">🌫️ Show heatmap</button><button class="btn" id="ev-tree">🌳 Plant 10 trees</button></div><label><input type="checkbox" id="ev-curb"> Emission curbs on factories (−50% pollution, −40% power)</label></div>
<div class="card"><small>AQI and noise (dB), last 4 hours</small><canvas class="ch" id="ev-ch"></canvas></div>`;
            $('ev-heat').onclick = () => {
                M.setLayer('pollution');
                CV.toast('Pollution heatmap on the map');
                if (innerWidth <= 900) document.body.classList.remove('panelopen')
            };
            $('ev-tree').onclick = () => {
                CV.cfg.trees += 10;
                CV.save();
                CV.toast('10 trees planted');
                CV.Env.step(true);
                CV.App.refresh()
            };
            $('ev-curb').checked = CV.cfg.curb;
            $('ev-curb').onchange = e => {
                CV.cfg.curb = e.target.checked;
                CV.save();
                CV.Energy.step(true);
                CV.App.refresh()
            }
        },
        refresh() {
            if (!$('ev-a')) return;
            const c = CAT(this.aqi);
            $('ev-a').textContent = this.aqi;
            $('ev-a').style.color = c[1];
            $('ev-ac').textContent = c[0];
            $('ev-n').textContent = this.noise + ' dB';
            $('ev-g').textContent = this.green.toFixed(1) + '%';
            $('ev-w').textContent = { '1,0': '→ East', '-1,0': '← West', '0,1': '↓ South', '0,-1': '↑ North' }[this.wind.join()];
            $('ev-t').textContent = CV.cfg.trees;
            CV.Charts.line($('ev-ch'), [{ d: this.s1, c: '#ff4d6d' }, { d: this.s2, c: '#8a7dff' }], { min: 0 })
        }
    };
    CV.aqiCat = a => CAT(a)[0];
})();