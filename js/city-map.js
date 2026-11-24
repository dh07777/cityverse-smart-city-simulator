(function() {
    const CV = window.CV,
        N = 13,
        T = 40;
    const ZN = [
        ['res', 'school', 'com', 'ind'],
        ['park', 'res', 'hosp', 'solar'],
        ['water', 'com', 'park', 'fire'],
        ['power', 'res', 'school', 'res']
    ];
    const NM = { res: 'Residential Block', com: 'Commercial Tower', ind: 'Factory', school: 'School', hosp: 'Hospital', fire: 'Fire Station', park: 'Park', solar: 'Solar Farm', water: 'Reservoir', power: 'Power Plant' };
    const MW = { res: 1.6, com: 2.5, ind: 4, school: .8, hosp: 2.5, fire: .5, park: .1, solar: 0, water: 1.5, power: 0 };
    const HT = { res: 10, com: 20, ind: 12, school: 8, hosp: 16, fire: 9, park: 0, solar: 3, water: 0, power: 14 };
    const COL = { res: '#5b8def', com: '#8a7dff', ind: '#c58a4a', school: '#f5b942', hosp: '#ff5c7a', fire: '#ff7a45', park: '#2ecf7a', solar: '#2a5fb5', water: '#2fa8ff', power: '#9aa7b5' };
    const SEC = ['North-West', 'North-East', 'South-West', 'South-East'];
    const tiles = [],
        grid = [],
        count = {},
        roads = [],
        cn = {};
    const hs = (i, j) => Math.abs((i * 73856093) ^ (j * 19349663)) % 100 / 100;
    for (let j = 0; j < N; j++) {
        grid[j] = [];
        for (let i = 0; i < N; i++) {
            let t = null;
            if (i % 3 && j % 3) {
                const bx = i / 3 | 0,
                    by = j / 3 | 0,
                    z = ZN[by][bx];
                cn[z] = (cn[z] || 0) + 1;
                count[z] = cn[z];
                t = { i, j, type: z, name: NM[z] + ' ' + cn[z], mw: MW[z], pop: z == 'res' ? 2200 + Math.round(hs(i, j) * 600) : 0, sector: (by >> 1) * 2 + (bx >> 1), outage: false, h: HT[z] + (z == 'res' || z == 'com' ? Math.round(hs(j, i) * 10) : 0) };
                tiles.push(t)
            } else roads.push([i, j]);
            grid[j][i] = t
        }
    }
    let cv, ctx, raf = 0,
        P = null,
        cam = { x: N * T / 2, y: N * T / 2, z: 1 };
    const near = (list, i, j) => list.reduce((b, t) => {
        const a = Array.isArray(t) ? t : [t.i, t.j],
            d = Math.abs(a[0] - i) + Math.abs(a[1] - j);
        return d < b.d ? { d, a } : b
    }, { d: 1e9 }).a;
    const Map = CV.Map = {
        N,
        T,
        tiles,
        grid,
        count,
        roads,
        SEC,
        NM,
        COL,
        sel: null,
        mode: null,
        layer: 'city',
        isRoad: (i, j) => i >= 0 && j >= 0 && i < N && j < N && !grid[j][i],
        secOf: (i, j) => Math.min(1, (j / 3 | 0) >> 1) * 2 + Math.min(1, (i / 3 | 0) >> 1),
        nearRoad: (i, j) => near(roads, i, j),
        nearBld: (i, j) => near(tiles, i, j),
        invalidate() { if (!raf) raf = requestAnimationFrame(draw) },
        themeChanged() {
            P = null;
            this.invalidate()
        },
        zoom(f) {
            cam.z = Math.max(.4, Math.min(4, cam.z * f));
            this.invalidate()
        },
        fit() {
            cam.x = cam.y = N * T / 2;
            cam.z = Math.min(cv.clientWidth, cv.clientHeight) / (N * T + 80) || 1;
            this.invalidate()
        },
        focus(i, j) {
            cam.x = (i + .5) * T;
            cam.y = (j + .5) * T;
            cam.z = Math.max(cam.z, 1.5);
            this.sel = { i, j };
            CV.App.inspect(i, j);
            this.invalidate()
        },
        setLayer(l) {
            this.layer = l;
            document.querySelectorAll('#mapctl [data-l]').forEach(b => b.classList.toggle('on', b.dataset.l == l));
            this.invalidate()
        },
        setMode(m, label) {
            this.mode = m;
            const h = $('hint');
            h.hidden = !m;
            if (m) {
                h.innerHTML = label + '<button id="hx">Done</button>';
                $('hx').onclick = () => this.setMode(null)
            }
            cv.style.cursor = m ? 'crosshair' : 'grab'
        },
        draw() { draw() },
        init() {
            cv = $('map');
            ctx = cv.getContext('2d');
            const rs = () => {
                const d = devicePixelRatio || 1;
                cv.width = cv.clientWidth * d;
                cv.height = cv.clientHeight * d;
                this.invalidate()
            };
            let first = 1;
            new ResizeObserver(() => {
                rs();
                if (first && cv.clientWidth) {
                    first = 0;
                    this.fit()
                }
            }).observe(cv);
            const ptrs = new window.Map();
            let drag = null,
                pinch = 0;
            cv.onpointerdown = e => {
                cv.setPointerCapture(e.pointerId);
                ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
                drag = { moved: 0 };
                pinch = 0
            };
            cv.onpointermove = e => {
                if (!ptrs.has(e.pointerId)) { hover(e); return }
                const p = ptrs.get(e.pointerId),
                    dx = e.clientX - p.x,
                    dy = e.clientY - p.y;
                p.x = e.clientX;
                p.y = e.clientY;
                if (ptrs.size == 2) {
                    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (pinch) this.zoom(d / pinch);
                    pinch = d;
                    drag.moved = 99
                } else {
                    cam.x -= dx / cam.z;
                    cam.y -= dy / cam.z;
                    drag.moved += Math.abs(dx) + Math.abs(dy)
                }
                this.invalidate()
            };
            cv.onpointerup = e => {
                ptrs.delete(e.pointerId);
                if (drag && drag.moved < 6 && !ptrs.size) click(e);
                if (!ptrs.size) drag = null;
                pinch = 0
            };
            cv.onpointerleave = () => $('tip').hidden = true;
            cv.addEventListener('wheel', e => {
                e.preventDefault();
                this.zoom(e.deltaY < 0 ? 1.12 : .89)
            }, { passive: false });
            $('zi').onclick = () => this.zoom(1.25);
            $('zo').onclick = () => this.zoom(.8);
            $('zr').onclick = () => this.fit();
            document.querySelectorAll('#mapctl [data-l]').forEach(b => b.onclick = () => this.setLayer(b.dataset.l))
        }
    };

    function pick(e) { const r = cv.getBoundingClientRect(); return [Math.floor(((e.clientX - r.left - r.width / 2) / cam.z + cam.x) / T), Math.floor(((e.clientY - r.top - r.height / 2) / cam.z + cam.y) / T)] }

    function click(e) {
        const [i, j] = pick(e);
        if (i < 0 || j < 0 || i >= N || j >= N) return;
        if (Map.mode) { if (!CV.App.place(Map.mode, i, j)) Map.setMode(null) } else CV.App.inspect(i, j);
        Map.invalidate()
    }

    function hover(e) {
        const [i, j] = pick(e), tp = $('tip');
        if (i < 0 || j < 0 || i >= N || j >= N) { tp.hidden = true; return }
        const t = grid[j][i];
        tp.textContent = t ? t.name + (t.outage ? ' (no power)' : '') : (i % 3 == 0 && j % 3 == 0 ? 'Intersection' : 'Road') + ' · ' + ((CV.Traffic.dens[i + ',' + j] || 0).toFixed(1)) + ' veh';
        const r = $('stage').getBoundingClientRect();
        tp.style.left = e.clientX - r.left + 14 + 'px';
        tp.style.top = e.clientY - r.top + 14 + 'px';
        tp.hidden = false
    }
    const pal = () => P || (P = (s => { const g = n => s.getPropertyValue(n).trim(); return { bg: g('--bg'), ground: g('--ground'), road: g('--road'), dash: 'rgba(255,255,255,.2)', ac: g('--ac') } })(getComputedStyle(document.documentElement)));
    const heat = v => `hsl(${120-120*v},85%,50%)`;

    function box(x, y, w, h, c) {
        if (h) {
            ctx.fillStyle = c;
            ctx.fillRect(x, y - h + w, w, h);
            ctx.fillStyle = 'rgba(0,0,0,.4)';
            ctx.fillRect(x, y - h + w, w, h)
        }
        ctx.fillStyle = c;
        ctx.fillRect(x, y - h, w, w)
    }

    function draw() {
        raf = 0;
        if (!cv || !CV.State) return;
        const p = pal(),
            W = cv.width,
            H = cv.height,
            d = devicePixelRatio || 1,
            L = Map.layer,
            Tr = CV.Traffic,
            now = Date.now(),
            hr = CV.hour(),
            night = hr < 6 || hr >= 19;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = p.bg;
        ctx.fillRect(0, 0, W, H);
        ctx.setTransform(cam.z * d, 0, 0, cam.z * d, W / 2 - cam.x * cam.z * d, H / 2 - cam.y * cam.z * d);
        ctx.fillStyle = p.ground;
        ctx.fillRect(-20, -20, N * T + 40, N * T + 40);
        for (const [i, j] of roads) {
            const k = i + ',' + j;
            ctx.fillStyle = p.road;
            ctx.fillRect(i * T, j * T, T, T);
            if (L == 'traffic') {
                const v = Math.min(1, (Tr.dens[k] || 0) / 3);
                if (v > .05) {
                    ctx.fillStyle = heat(v);
                    ctx.globalAlpha = .8;
                    ctx.fillRect(i * T, j * T, T, T);
                    ctx.globalAlpha = 1
                }
            }
            ctx.fillStyle = p.dash;
            if (j % 3 == 0 && i % 3) ctx.fillRect(i * T + 8, j * T + T / 2 - .5, T - 16, 1);
            else if (i % 3 == 0 && j % 3) ctx.fillRect(i * T + T / 2 - .5, j * T + 8, 1, T - 16);
            if (Tr.closed.has(k)) {
                ctx.strokeStyle = '#ff4d6d';
                ctx.lineWidth = 2;
                ctx.strokeRect(i * T + 4, j * T + 4, T - 8, T - 8);
                ctx.beginPath();
                ctx.moveTo(i * T + 4, j * T + 4);
                ctx.lineTo(i * T + T - 4, j * T + T - 4);
                ctx.moveTo(i * T + T - 4, j * T + 4);
                ctx.lineTo(i * T + 4, j * T + T - 4);
                ctx.stroke()
            }
        }
        for (const t of tiles) {
            const x = t.i * T + 5,
                y = t.j * T + 5,
                s = T - 10;
            let c = COL[t.type];
            if (L == 'power') c = t.outage ? '#7a2a3a' : (t.type == 'solar' || t.type == 'power' ? '#ffd23d' : '#1d6fa5');
            if (L == 'water') c = t.type == 'water' ? '#2fa8ff' : '#244a78';
            ctx.globalAlpha = t.outage ? .5 : L == 'pollution' ? .7 : 1;
            if (t.type == 'park') {
                ctx.fillStyle = c;
                ctx.globalAlpha *= .5;
                ctx.fillRect(x - 3, y - 3, s + 6, s + 6);
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#1b8f56';
                for (const [a, b] of[[.3, .3], [.7, .45], [.45, .75]]) {
                    ctx.beginPath();
                    ctx.arc(x + a * s, y + b * s, 5, 0, 7);
                    ctx.fill()
                }
            } else if (t.type == 'water') {
                ctx.fillStyle = '#10294a';
                ctx.fillRect(x, y, s, s);
                ctx.fillStyle = c;
                const lv = CV.Water.level / CV.Water.CAP;
                ctx.fillRect(x, y + s * (1 - lv), s, s * lv)
            } else { box(x, y, s, t.h, c); if (night && !t.outage && t.h > 6 && L == 'city') { ctx.fillStyle = '#ffe9a0'; for (let a = 0; a < 3; a++) ctx.fillRect(x + 4 + a * 10, y - t.h + s + 3, 3, 3) } }
            ctx.globalAlpha = 1;
            if (t.outage) {
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('⚡', x + s / 2, y + s / 2)
            }
        }
        if (L == 'pollution') {
            const q = CV.Env.pol;
            for (let j = 0; j < N; j++)
                for (let i = 0; i < N; i++) {
                    const v = q[j][i];
                    if (v > .01) {
                        ctx.fillStyle = `rgba(255,${Math.round(210-170*Math.min(1,v*2.5))},40,${Math.min(.6,v*1.6)})`;
                        ctx.fillRect(i * T, j * T, T, T)
                    }
                }
        }
        if (CV.cfg.showVehicles)
            for (const v of Tr.vehicles) {
                const px = (v.x - .18 * v.dy) * T,
                    py = (v.y + .18 * v.dx) * T;
                ctx.fillStyle = v.stop ? '#ff4d6d' : v.c;
                v.dx ? ctx.fillRect(px - 5, py - 2.5, 10, 5) : ctx.fillRect(px - 2.5, py - 5, 5, 10)
            }
        for (let i = 0; i < N; i += 3)
            for (let j = 0; j < N; j += 3) {
                const s = Tr.sigAt(i, j),
                    o = CV.Energy.out[Map.secOf(i, j)];
                ctx.fillStyle = o ? '#ffb83d' : s == 'ns' ? '#2ee59d' : '#ff4d6d';
                ctx.beginPath();
                ctx.arc(i * T + T / 2, j * T + 4, 2.6, 0, 7);
                ctx.fill();
                ctx.fillStyle = o ? '#ffb83d' : s == 'ew' ? '#2ee59d' : '#ff4d6d';
                ctx.beginPath();
                ctx.arc(i * T + 4, j * T + T / 2, 2.6, 0, 7);
                ctx.fill()
            }
        const mark = (i, j, em, col) => {
            const x = (i + .5) * T,
                y = (j + .5) * T,
                r = 9 + (now / 70) % 10;
            ctx.strokeStyle = col;
            ctx.globalAlpha = 1 - (r - 9) / 10;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, 7);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(em, x, y + 6)
        };
        for (const l of CV.Water.leaks) mark(l.i, l.j, '💧', '#2fa8ff');
        for (const n of CV.Emergency.incidents) mark(n.i, n.j, CV.Emergency.IC[n.type], '#ff4d6d');
        if (Map.sel) {
            ctx.strokeStyle = p.ac;
            ctx.lineWidth = 2;
            ctx.strokeRect(Map.sel.i * T + 1, Map.sel.j * T + 1, T - 2, T - 2)
        }
        for (const n of CV.Emergency.incidents)
            for (const id of n.assigned) {
                const u = CV.Emergency.units.find(x => x.id == id),
                    f = u.eta0 ? Math.max(0, 1 - u.eta / u.eta0) : 1,
                    x = (u.home.i + (n.i - u.home.i) * f + .5) * T,
                    y = (u.home.j + (n.j - u.home.j) * f + .5) * T;
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, 7);
                ctx.fill();
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText({ fire: '🚒', amb: '🚑', pol: '🚓' }[u.k], x, y + 4)
            }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const nt = hr < 5 || hr >= 21 ? 1 : hr < 7 ? (7 - hr) / 2 : hr >= 19 ? (hr - 19) / 2 : 0;
        if (nt > 0 && L == 'city') {
            ctx.fillStyle = `rgba(4,10,40,${.3*nt})`;
            ctx.fillRect(0, 0, W, H)
        }
        if (CV.State.mods.rain > 1.2 || CV.Emergency.incidents.some(n => n.type == 'flood')) {
            ctx.strokeStyle = 'rgba(150,200,255,.5)';
            ctx.lineWidth = d;
            ctx.beginPath();
            for (let k = 0; k < 70; k++) {
                const x = (k * 97 + now * .25) % W,
                    y = (k * 57 + now * .6) % H;
                ctx.moveTo(x, y);
                ctx.lineTo(x - 4 * d, y + 12 * d)
            }
            ctx.stroke()
        }
    }
})();