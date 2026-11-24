(function() {
        const CV = window.CV,
            KEYS = ['pop', 'cong', 'dem', 'eff', 'aqi'];
        const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
        CV.bars = rows => rows.map(r => `<div class="row"><span>${r.l}</span><div class="bar"><i style="width:${Math.max(0,Math.min(100,r.v))}%;background:${r.c||''}"></i></div><em>${r.t}</em></div>`).join('');
        CV.Charts = {
            line(c, S, o = {}) {
                if (!c) return;
                const d = devicePixelRatio || 1,
                    w = c.clientWidth,
                    h = c.clientHeight;
                if (!w) return;
                c.width = w * d;
                c.height = h * d;
                const x = c.getContext('2d');
                x.scale(d, d);
                const all = S.flatMap(s => s.d);
                x.font = '10px system-ui';
                x.fillStyle = css('--mut');
                if (all.length < 2) { x.fillText('Collecting data… press Start', 10, h / 2); return }
                let mn = o.min != null ? o.min : Math.min(...all),
                    mx = o.max != null ? o.max : Math.max(...all);
                if (mx <= mn) { mx = mn + 1 }
                if (o.min == null) {
                    const pd = (mx - mn) * .1;
                    mn -= pd;
                    mx += pd
                }
                x.strokeStyle = css('--line');
                for (let k = 0; k < 3; k++) {
                    const y = 6 + k * (h - 24) / 2;
                    x.beginPath();
                    x.moveTo(0, y);
                    x.lineTo(w, y);
                    x.stroke()
                }
                x.fillText(mx >= 1000 ? Math.round(mx).toLocaleString() : mx.toFixed(1), 2, 14);
                x.fillText(mn >= 1000 ? Math.round(mn).toLocaleString() : mn.toFixed(1), 2, h - 16);
                if (o.labels) {
                    x.fillText(o.labels[0], 2, h - 3);
                    x.textAlign = 'right';
                    x.fillText(o.labels[1], w - 2, h - 3);
                    x.textAlign = 'left'
                }
                S.forEach(s => {
                    x.beginPath();
                    s.d.forEach((v, i) => {
                        const px = 4 + i * (w - 8) / (s.d.length - 1),
                            py = 6 + (1 - (v - mn) / (mx - mn)) * (h - 24);
                        i ? x.lineTo(px, py) : x.moveTo(px, py)
                    });
                    x.strokeStyle = s.c;
                    x.lineWidth = 2;
                    x.stroke()
                })
            }
        };
        const g = (a, b, s) => Math.exp(-((a - b) ** 2) / (2 * s * s));
        const mk = (hr, k) => ({ pop: 40000 * (1 + (k - 30) * .0015), cong: 35 * CV.curve.tr(hr) + 8 + 4 * Math.sin(k * 1.7 + hr), dem: 87 * CV.curve.dem(hr) * (.95 + .08 * Math.sin(k)), eff: 76 + 8 * Math.sin(k * .7 + hr / 5), aqi: 55 + 25 * Math.sin(k * .5) + 20 * g(hr, 8, 2) + 15 * g(hr, 18, 2) });
        const MET = [
            ['Population', 'pop', '#27d3ff'],
            ['Traffic congestion %', 'cong', '#ffb83d'],
            ['Energy demand (MW)', 'dem', '#ff7a45'],
            ['Energy efficiency %', 'eff', '#2ee59d'],
            ['Air quality (AQI)', 'aqi', '#ff4d6d']
        ];
        const A = CV.Analytics = {
                hist: null,
                acc: null,
                range: 'd',
                init() {
                    const s = CV.saved.hist;
                    if (s && s.h && s.d) this.hist = s;
                    else { this.hist = { h: Array.from({ length: 24 }, (_, k) => mk((k + 9) % 24, 0)), d: Array.from({ length: 30 }, (_, k) => mk(12, k)) } }
                    this.acc = null
                },
                sample() {
                    const S = CV.State,
                        a = this.acc = this.acc || { n: 0, pop: 0, cong: 0, dem: 0, eff: 0, aqi: 0 };
                    a.n++;
                    a.pop += S.pop;
                    a.cong += CV.Traffic.cong;
                    a.dem += CV.Energy.demand;
                    a.eff += CV.Energy.eff;
                    a.aqi += CV.Env.aqi;
                    if (S.t % 60 == 0) {
                        const r = {};
                        KEYS.forEach(k => r[k] = a[k] / a.n);
                        this.hist.h.push(r);
                        if (this.hist.h.length > 24) this.hist.h.shift();
                        this.acc = null;
                        if (S.t % 1440 == 0) {
                            const d = {};
                            KEYS.forEach(k => d[k] = this.hist.h.reduce((s, x) => s + x[k], 0) / this.hist.h.length);
                            this.hist.d.push(d);
                            if (this.hist.d.length > 30) this.hist.d.shift()
                        }
                    }
                },
                data() { return this.range == 'd' ? this.hist.h : this.range == 'w' ? this.hist.d.slice(-7) : this.hist.d },
                panel(el) { el.innerHTML = `<h3>📊 City Analytics</h3><div class="seg" id="an-r"><button data-r="d">Daily (24 h)</button><button data-r="w">Weekly</button><button data-r="m">Monthly</button></div>${MET.map((m,i)=>`<div class="card"><div class="row2"><small>${m[0]}</small><b id="an-v${i}"></b></div><canvas class="ch" id="an-c${i}"></canvas></div>`).join('')}`;
$('an-r').onclick=e=>{if(e.target.dataset.r){this.range=e.target.dataset.r;this.refresh()}}},
refresh(){if(!$('an-r'))return;document.querySelectorAll('#an-r button').forEach(b=>b.classList.toggle('on',b.dataset.r==this.range));const D=this.data(),lb=this.range=='d'?['24 h ago','now']:this.range=='w'?['7 days ago','today']:['30 days ago','today'];
MET.forEach((m,i)=>{const v=D.map(x=>x[m[1]]),l=v[v.length-1]||0;$('an-v'+i).textContent=m[1]=='pop'?Math.round(l).toLocaleString():l.toFixed(m[1]=='dem'?1:0);CV.Charts.line($('an-c'+i),[{d:v,c:m[2]}],{labels:lb})})}};
})();