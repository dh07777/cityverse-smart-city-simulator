(function() {
    const CV = window.CV,
        M = CV.Map;
    const E = CV.Energy = {
        out: [0, 0, 0, 0],
        tm: [0, 0, 0, 0],
        solar: 0,
        conv: 0,
        demand: 0,
        deficit: 0,
        renew: 0,
        eff: 100,
        sec: [0, 0, 0, 0],
        mwh: 0,
        co2: 0,
        sD: [],
        sS: [],
        sSol: [],
        init() {
            this.out = [0, 0, 0, 0];
            this.tm = [0, 0, 0, 0];
            M.tiles.forEach(t => t.outage = false);
            this.mwh = this.co2 = 0;
            this.sD = [];
            this.sS = [];
            this.sSol = [];
            this.step(true)
        },
        setOutage(s, b, auto) {
            this.out[s] = b ? 1 : 0;
            this.tm[s] = b && auto ? 8 : 0;
            M.tiles.forEach(t => { if (t.sector == s) t.outage = !!b });
            CV.alert(b ? 'crit' : 'ok', b ? 'Power outage in ' + M.SEC[s] + ' district' : 'Power restored in ' + M.SEC[s] + ' district')
        },
        step(init) {
            const h = CV.hour(),
                m = CV.State.mods;
            let dem = 0;
            this.sec = [0, 0, 0, 0];
            for (const t of M.tiles) {
                if (t.outage || !t.mw) continue;
                let w = t.mw * CV.curve.dem(h) * m.demand;
                if (t.type == 'ind') w *= m.ind * (CV.cfg.curb ? .6 : 1);
                dem += w;
                this.sec[t.sector] += w
            }
            const sol = Math.min(dem, M.count.solar * 8 * CV.curve.sun(h) * m.solar),
                cap = M.count.power * 20 * CV.cfg.conv / 100,
                conv = Math.max(0, Math.min(cap, dem - sol));
            this.demand = dem;
            this.solar = sol;
            this.conv = conv;
            this.deficit = Math.max(0, dem - sol - conv);
            this.renew = sol + conv > 0 ? 100 * sol / (sol + conv) : 0;
            this.eff = dem > 0 ? Math.round(Math.min(1, (sol + conv) / dem) * (70 + 30 * this.renew / 100)) : 100;
            if (init) return;
            const dh = 5 / 60;
            this.mwh += (sol + conv) * dh;
            this.co2 += conv * dh * .75;
            if (h < .1) { this.mwh = this.co2 = 0 }
            for (let s = 0; s < 4; s++)
                if (this.out[s] && this.tm[s] > 0 && --this.tm[s] == 0) this.setOutage(s, false);
            this.sD.push(dem);
            this.sS.push(sol + conv);
            this.sSol.push(sol);
            [this.sD, this.sS, this.sSol].forEach(a => { if (a.length > 48) a.shift() });
            if (this.deficit > .5) CV.alert('crit', 'Power shortage of ' + this.deficit.toFixed(1) + ' MW — raise conventional limit', 'def')
        },
        panel(el) {
            el.innerHTML = `<h3>⚡ Energy Management</h3><div class="g2"><div class="card"><small>Demand</small><b class="big" id="en-d"></b></div><div class="card"><small>Supply</small><b class="big" id="en-s"></b></div><div class="card"><small>Solar</small><b class="big" id="en-so"></b></div><div class="card"><small>Conventional</small><b class="big" id="en-c"></b></div><div class="card"><small>Renewable share</small><b class="big" id="en-r"></b></div><div class="card"><small>Efficiency</small><b class="big" id="en-e"></b></div></div>
<div class="card"><label>Conventional capacity limit: <b id="en-lv"></b>%<input type="range" id="en-lim" min="20" max="100" step="5"></label><small id="en-x"></small></div>
<div class="card"><small>Power distribution by district</small><div id="en-sec"></div></div><div class="card"><small>Usage, last 4 hours (demand / supply / solar, MW)</small><canvas class="ch" id="en-ch"></canvas></div>`;
            $('en-lim').oninput = e => {
                CV.cfg.conv = +e.target.value;
                CV.save();
                CV.Energy.step(true);
                CV.App.refresh()
            };
            $('en-lim').value = CV.cfg.conv;
            $('en-sec').onclick = e => {
                const s = e.target.dataset.s;
                if (s == null) return;
                this.setOutage(+s, !this.out[+s]);
                CV.App.refresh()
            }
        },
        refresh() {
            if (!$('en-d')) return;
            const f = (id, v) => $(id).textContent = v;
            f('en-d', this.demand.toFixed(1) + ' MW');
            f('en-s', (this.solar + this.conv).toFixed(1) + ' MW');
            f('en-so', this.solar.toFixed(1) + ' MW');
            f('en-c', this.conv.toFixed(1) + ' MW');
            f('en-r', Math.round(this.renew) + '%');
            f('en-e', this.eff + '%');
            f('en-lv', CV.cfg.conv);
            $('en-x').textContent = `Deficit ${this.deficit.toFixed(1)} MW · energy today ${this.mwh.toFixed(0)} MWh · CO₂ ${this.co2.toFixed(1)} t`;
            $('en-sec').innerHTML = M.SEC.map((n, i) => `<div class="row"><span>${n}</span><div class="bar"><i style="width:${Math.min(100,this.sec[i]*3.5)}%;background:${this.out[i]?'var(--bad)':''}"></i></div><em>${this.out[i]?'<span class=bad>OUT</span>':this.sec[i].toFixed(1)+' MW'}</em></div><div class="seg"><button data-s="${i}">${this.out[i]?'🔌 Restore power':'⚡ Simulate outage'}</button></div>`).join('');
            CV.Charts.line($('en-ch'), [{ d: this.sD, c: '#ff4d6d' }, { d: this.sS, c: '#27d3ff' }, { d: this.sSol, c: '#ffd23d' }], { min: 0 })
        }
    };
})();