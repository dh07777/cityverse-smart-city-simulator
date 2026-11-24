(function() {
    const CV = window.CV;
    const NAV = [
        ['overview', '🏙️', 'Overview'],
        ['traffic', '🚦', 'Traffic'],
        ['energy', '⚡', 'Energy'],
        ['water', '💧', 'Water'],
        ['env', '🌿', 'Environment'],
        ['emergency', '🚨', 'Emergency'],
        ['analytics', '📊', 'Analytics'],
        ['scenario', '🧪', 'Scenarios'],
        ['settings', '⚙️', 'Settings']
    ];
    let cur = 'overview',
        MODS = {};
    const lv = (v, a, b) => v > b ? 'bad' : v > a ? 'warn' : 'ok';
    CV.toast = m => {
        const t = $('toast');
        t.textContent = m;
        t.classList.add('show');
        clearTimeout(CV._tt);
        CV._tt = setTimeout(() => t.classList.remove('show'), 2400)
    };
    const dl = (name, txt, type) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([txt], { type }));
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 500)
    };
    CV.Overview = {
        panel(el) {
            el.innerHTML = `<h3>🏙️ City Overview</h3><div class="card" style="display:flex;gap:12px;align-items:center"><svg viewBox="0 0 100 100" width="104" height="104"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(120,160,220,.25)" stroke-width="9"/><circle id="ov-ring" cx="50" cy="50" r="42" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="264" transform="rotate(-90 50 50)"/><text id="ov-sc" x="50" y="58" text-anchor="middle" font-size="26" font-weight="700" fill="currentColor">0</text></svg><div><b>City health score</b><br><small id="ov-pop"></small><br><small>Score blends traffic, air, power, water and incidents.</small></div></div>
<div class="card"><div class="row2"><b>Alerts</b><button class="btn" id="ov-clr">Clear</button></div><div id="ov-al"></div></div>
<div class="card"><b>Getting started</b><br><small>Press ▶ Start. Click any building or road to inspect it. Use the layer buttons on the map for traffic, pollution, power and water views. Drag to pan, scroll or pinch to zoom.</small></div>`;
            $('ov-clr').onclick = () => {
                CV.State.alerts = [];
                CV.App.refresh()
            }
        },
        refresh() {
            if (!$('ov-sc')) return;
            const k = CV.kpis(),
                c = k.score > 70 ? 'var(--ok)' : k.score > 45 ? 'var(--warn)' : 'var(--bad)',
                r = $('ov-ring');
            r.style.stroke = c;
            r.setAttribute('stroke-dashoffset', 264 * (1 - k.score / 100));
            $('ov-sc').textContent = k.score;
            $('ov-pop').textContent = 'Population ' + CV.State.pop.toLocaleString();
            $('ov-al').innerHTML = CV.State.alerts.length ? CV.State.alerts.slice(0, 8).map(a => `<div class="al ${a.l}"><small>${a.c}</small>${a.m}</div>`).join('') : '<div class="empty">✅ All systems nominal. No alerts.</div>'
        }
    };
    CV.Settings = {
        panel(el) {
            const c = CV.cfg;
            el.innerHTML = `<h3>⚙️ Settings</h3><div class="card"><label>Theme<br><select id="st-th"><option value="dark">Midnight (dark)</option><option value="ocean">Ocean teal</option><option value="light">Daylight</option></select></label><label>Default simulation speed<br><select id="st-sp"><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select></label>
<label><input type="checkbox" id="st-rn"> Random incidents (leaks, outages, emergencies)</label><label><input type="checkbox" id="st-ad"> Auto-dispatch emergency units</label><label><input type="checkbox" id="st-vh"> Show vehicles on map</label></div>
<div class="card"><small>Data</small><div class="seg"><button class="btn" id="st-ej">⬇ Export JSON</button><button class="btn" id="st-ec">⬇ Export analytics CSV</button></div><div class="seg"><button class="btn" id="st-tr">🎓 Replay tour</button><label class="btn" style="margin:0">⬆ Import JSON<input type="file" id="st-im" accept=".json" hidden></label></div><small>Shortcuts: Space start/pause · +/− zoom · L cycle layers · 1–9 open modules · Esc cancel</small><div class="seg"><button class="btn" id="st-rs">↺ Reset simulation</button><button class="btn" id="st-ra">🗑 Reset everything</button></div><small>Settings are saved in your browser's LocalStorage. Everything runs locally.</small></div>`;
            $('st-th').value = c.theme;
            $('st-sp').value = c.speed;
            $('st-rn').checked = c.random;
            $('st-ad').checked = c.autoDispatch;
            $('st-vh').checked = c.showVehicles;
            $('st-th').onchange = e => {
                c.theme = e.target.value;
                document.documentElement.dataset.theme = c.theme;
                CV.Map.themeChanged();
                CV.save()
            };
            $('st-sp').onchange = e => CV.Sim.setSpeed(e.target.value);
            $('st-rn').onchange = e => {
                c.random = e.target.checked;
                CV.save()
            };
            $('st-ad').onchange = e => {
                c.autoDispatch = e.target.checked;
                CV.save()
            };
            $('st-vh').onchange = e => {
                c.showVehicles = e.target.checked;
                CV.save();
                CV.Map.invalidate()
            };
            $('st-ej').onclick = () => dl('cityverse-export.json', JSON.stringify({ exported: new Date().toISOString(), clock: CV.clock(), cfg: c, kpis: CV.kpis(), population: CV.State.pop, closedRoads: [...CV.Traffic.closed], incidents: CV.Emergency.incidents, leaks: CV.Water.leaks, alerts: CV.State.alerts, analytics: CV.Analytics.hist }, null, 2), 'application/json');
            $('st-ec').onclick = () => {
                const K = ['pop', 'cong', 'dem', 'eff', 'aqi'],
                    rows = [
                        ['period', 'index', ...K].join(',')
                    ];
                CV.Analytics.hist.h.forEach((x, i) => rows.push(['hourly', i, ...K.map(k => x[k].toFixed(2))].join(',')));
                CV.Analytics.hist.d.forEach((x, i) => rows.push(['daily', i, ...K.map(k => x[k].toFixed(2))].join(',')));
                dl('cityverse-analytics.csv', rows.join('\n'), 'text/csv')
            };
            $('st-rs').onclick = () => CV.Sim.reset();
            $('st-tr').onclick = () => CV.tour();
            $('st-im').onchange = e => {
                const f = e.target.files[0];
                if (!f) return;
                f.text().then(t => {
                    try {
                        const o = JSON.parse(t);
                        if (!o.cfg) throw 0;
                        Object.assign(CV.cfg, o.cfg);
                        CV.save();
                        location.reload()
                    } catch (x) { CV.toast('Not a valid CityVerse export') }
                })
            };
            $('st-ra').onclick = () => {
                if (confirm('Delete all saved settings and data, then reload?')) {
                    CV.Storage.clear();
                    location.reload()
                }
            }
        },
        refresh() {}
    };
    const App = CV.App = {
        show(id) {
            cur = id;
            document.querySelectorAll('.pane').forEach(p => p.classList.toggle('active', p.id == 'p-' + id));
            document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.m == id));
            if (innerWidth <= 900) {
                document.body.classList.remove('navopen');
                document.body.classList.add('panelopen')
            } else document.body.classList.remove('pcol');
            this.refresh()
        },
        refresh() {
            $('clock').textContent = CV.clock();
            this.kpi();
            const m = MODS[cur];
            m && m.refresh();
            if (cur != 'overview') CV.Overview.refresh();
            if (!CV.State.running) CV.Map.invalidate()
        },
        kpi() {
            const S = CV.State,
                E = CV.Energy,
                wp = Math.round(100 * CV.Water.level / CV.Water.CAP),
                n = S.alerts.filter(a => S.t - a.t < 180).length,
                aq = CV.Env.aqi;
            const k = [
                ['overview', '👥 Population', S.pop.toLocaleString(), ''],
                ['traffic', '🚦 Traffic', Math.round(CV.Traffic.cong) + '%', lv(CV.Traffic.cong, 40, 70)],
                ['energy', '⚡ Energy', E.demand.toFixed(0) + ' / ' + (E.solar + E.conv).toFixed(0) + ' MW', E.deficit > .5 ? 'bad' : 'ok'],
                ['water', '💧 Water', wp + '%', wp < 20 ? 'bad' : wp < 40 ? 'warn' : 'ok'],
                ['env', '🌫️ AQI', aq, lv(aq, 100, 150)],
                ['emergency', '🚨 Alerts', n, n > 3 ? 'bad' : n ? 'warn' : 'ok']
            ];
            $('kpis').innerHTML = k.map(x => `<button class="kpi ${x[3]}" data-m="${x[0]}"><small>${x[1]}</small><b>${x[2]}</b></button>`).join('')
        },
        place(m, i, j) {
            const C = CV;
            if (m == 'close') { if (!C.Traffic.toggleClosure(i, j)) C.toast('Select a road tile'); return true }
            if (m == 'leak') { C.Water.addLeak(i, j); return false }
            if (m.startsWith('inc:')) { C.Emergency.create(m.slice(4), i, j); return false }
            return false
        },
        inspect(i, j) {
            const M = CV.Map,
                t = M.grid[j][i],
                k = i + ',' + j;
            M.sel = { i, j };
            let h;
            if (t) { h = `<b>${t.name}</b> <small>${t.type}</small><div class="kv">District: ${M.SEC[t.sector]}<br>Status: ${t.outage?'<span class=bad>Power outage</span>':'<span class=ok>Operational</span>'}<br>Power use: ${t.outage?0:(t.mw*CV.curve.dem(CV.hour())).toFixed(2)} MW${t.pop?'<br>Residents: '+t.pop.toLocaleString():''}<br>Local air index: ${Math.round(20+330*CV.Env.pol[j][i])}</div><div class="seg"><button class="btn" data-a="fire">🔥 Fire</button><button class="btn" data-a="med">🚑 Medical</button><button class="btn" data-a="out">⚡ ${t.outage?'Restore':'Cut'} power</button></div>` } else {
                const it = i % 3 == 0 && j % 3 == 0,
                    cl = CV.Traffic.closed.has(k);
                h = `<b>${it?'Intersection':'Road'} (${i},${j})</b><div class="kv">Vehicles: ${(CV.Traffic.dens[k]||0).toFixed(1)}<br>Status: ${cl?'<span class=bad>Closed</span>':'<span class=ok>Open</span>'}${it?'<br>Signal: '+(CV.Traffic.sigAt(i,j)=='ns'?'North–South green':'East–West green'):''}</div><div class="seg"><button class="btn" data-a="close">${cl?'Reopen':'🚧 Close'}</button><button class="btn" data-a="leak">💧 Leak</button><button class="btn" data-a="acc">🚗 Accident</button></div>${it?'<div class="seg"><button class="btn" data-a="sns">N–S green</button><button class="btn" data-a="sew">E–W green</button><button class="btn" data-a="sau">Auto</button></div>':''}`
            }
            const p = $('insp');
            p.innerHTML = '<div class="row2" style="float:right"><button class="ib" data-a="x">×</button></div>' + h;
            p.hidden = false;
            M.invalidate()
        }
    };

    function inspAct(e) {
        const a = e.target.dataset.a;
        if (!a) return;
        const M = CV.Map,
            s = M.sel;
        if (a == 'x') {
            M.sel = null;
            $('insp').hidden = true;
            M.invalidate();
            return
        }
        if (!s) return;
        const { i, j } = s, t = M.grid[j][i], T = CV.Traffic;
        if (a == 'fire') CV.Emergency.create('fire', i, j);
        else if (a == 'med') CV.Emergency.create('medical', i, j);
        else if (a == 'out') CV.Energy.setOutage(t.sector, !CV.Energy.out[t.sector]);
        else if (a == 'close') T.toggleClosure(i, j);
        else if (a == 'leak') CV.Water.addLeak(i, j);
        else if (a == 'acc') CV.Emergency.create('accident', i, j);
        else if (a == 'sns' || a == 'sew' || a == 'sau') {
            T.over[i + ',' + j] = a == 'sns' ? 'ns' : a == 'sew' ? 'ew' : 'auto';
            CV.toast('Signal updated')
        }
        CV.App.inspect(i, j);
        CV.App.refresh()
    }
    CV.tour = () => {
        const S = [
            ['Welcome to CityVerse', 'A living digital twin of a smart city. Everything is simulated locally in your browser.'],
            ['Explore the map', 'Drag to pan, scroll or pinch to zoom. Click any building or road to inspect it and trigger events.'],
            ['Control the city', 'Use the menu for traffic, energy, water, environment, emergencies, analytics and scenarios. Press Start or Space to run time.']
        ];
        let k = 0;
        const o = document.createElement('div');
        o.id = 'tour';
        document.body.appendChild(o);
        const end = () => {
                o.remove();
                CV.cfg.seen = 1;
                CV.save()
            },
            r = () => {
                o.innerHTML = `<div class="tc"><h3>${S[k][0]}</h3><p>${S[k][1]}</p><div class="row2"><small>${k+1} / ${S.length}</small><span class="seg"><button class="btn" id="t-s">Skip</button><button class="btn on" id="t-n">${k<2?'Next':'Start exploring'}</button></span></div></div>`;
                $('t-s').onclick = end;
                $('t-n').onclick = () => ++k < S.length ? r() : end()
            };
        r()
    };
    window.addEventListener('DOMContentLoaded', () => {
        document.documentElement.dataset.theme = CV.cfg.theme;
        const P = $('panes'),
            nv = $('nav');
        NAV.forEach(([id, ic, lb]) => {
            const s = document.createElement('section');
            s.className = 'pane';
            s.id = 'p-' + id;
            P.appendChild(s);
            const b = document.createElement('button');
            b.dataset.m = id;
            b.textContent = ic + ' ' + lb;
            nv.appendChild(b)
        });
        MODS = { overview: CV.Overview, traffic: CV.Traffic, energy: CV.Energy, water: CV.Water, env: CV.Env, emergency: CV.Emergency, analytics: CV.Analytics, scenario: CV.Sim, settings: CV.Settings };
        CV.Sim.init();
        for (const id in MODS) MODS[id].panel($('p-' + id));
        nv.onclick = e => { if (e.target.dataset.m) App.show(e.target.dataset.m) };
        $('kpis').onclick = e => { const b = e.target.closest('.kpi'); if (b) App.show(b.dataset.m) };
        $('insp').onclick = inspAct;
        $('bPlay').onclick = () => CV.Sim.toggle();
        $('bReset').onclick = () => CV.Sim.reset();
        $('speed').onchange = e => CV.Sim.setSpeed(e.target.value);
        $('bNav').onclick = () => {
            document.body.classList.remove('panelopen');
            document.body.classList.toggle('navopen')
        };
        $('bPanel').onclick = () => {
            if (innerWidth <= 900) {
                document.body.classList.remove('navopen');
                document.body.classList.toggle('panelopen')
            } else document.body.classList.toggle('pcol')
        };
        $('pClose').onclick = () => document.body.classList.remove('panelopen');
        $('scrim').onclick = () => document.body.classList.remove('navopen', 'panelopen');
        $('ctlTog').onclick = () => document.body.classList.toggle('ctlopen');
        document.addEventListener('keydown', e => {
            if (e.key == 'Escape') CV.Map.setMode(null);
            const k = e.key;
            if (!/INPUT|SELECT/.test(e.target.tagName)) {
                if (k == '+' || k == '=') CV.Map.zoom(1.25);
                if (k == '-') CV.Map.zoom(.8);
                if (k == 'l' || k == 'L') {
                    const L = ['city', 'traffic', 'pollution', 'power', 'water'];
                    CV.Map.setLayer(L[(L.indexOf(CV.Map.layer) + 1) % 5])
                }
                if (k >= '1' && k <= '9') App.show(NAV[k - 1][0])
            }
            if (e.code == 'Space' && !/INPUT|SELECT|BUTTON/.test(e.target.tagName)) {
                e.preventDefault();
                CV.Sim.toggle()
            }
        });
        $('zf').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        CV.Map.init();
        App.show('overview');
        if (!CV.cfg.seen) CV.tour();
        if (innerWidth <= 900) document.body.classList.remove('panelopen');
        CV.Sim.btn()
    });
})();