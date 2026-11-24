(function() {
        const CV = window.CV,
            M = CV.Map;
        const NEED = { fire: ['fire', 'fire'], flood: ['pol', 'pol'], accident: ['amb', 'pol'], medical: ['amb'] },
            BASE = { fire: 14, flood: 20, accident: 8, medical: 6 },
            KN = { fire: 'Fire trucks', amb: 'Ambulances', pol: 'Police / rescue' };
        const rnd = a => a[Math.random() * a.length | 0];
        const E = CV.Emergency = {
                IC: { fire: '🔥', flood: '🌊', accident: '🚗', medical: '🚑' },
                incidents: [],
                units: [],
                resolved: 0,
                resp: [],
                nid: 1,
                sel: 'fire',
                init() {
                    this.incidents = [];
                    this.resolved = 0;
                    this.resp = [];
                    this.nid = 1;
                    let u = 1;
                    this.units = [];
                    M.tiles.filter(t => t.type == 'fire').forEach(t => this.units.push({ id: u++, k: 'fire', home: t, busy: 0, eta: 0 }));
                    M.tiles.filter(t => t.type == 'hosp').forEach(t => this.units.push({ id: u++, k: 'amb', home: t, busy: 0, eta: 0 }));
                    M.tiles.filter(t => t.type == 'com').slice(0, 4).forEach(t => this.units.push({ id: u++, k: 'pol', home: t, busy: 0, eta: 0 }))
                },
                create(type, i, j, sev) {
                    let a = i,
                        b = j;
                    if (type == 'accident' && !M.isRoad(i, j))[a, b] = M.nearRoad(i, j);
                    if (type == 'fire' && M.isRoad(i, j))[a, b] = M.nearBld(i, j);
                    const t = M.grid[b][a],
                        n = { id: this.nid++, type, i: a, j: b, sev: sev || 1 + (Math.random() * 3 | 0), age: 0, progress: 0, need: NEED[type].slice(), assigned: [], resp: null, closed: false, status: 'reported', name: t ? t.name : `Road (${a},${b})` };
                    if ((type == 'accident' || type == 'flood') && M.isRoad(a, b) && !CV.Traffic.closed.has(a + ',' + b)) {
                        CV.Traffic.close(a, b, true);
                        n.closed = true
                    }
                    this.incidents.push(n);
                    CV.alert('crit', `${this.IC[type]} ${type} reported at ${n.name}`);
                    if (CV.cfg.autoDispatch) this.dispatch(n);
                    CV.App.refresh();
                    return n
                },
                dispatch(n) {
                    const miss = n.need.slice();
                    n.assigned.forEach(id => { const x = miss.indexOf(this.units.find(u => u.id == id).k); if (x >= 0) miss.splice(x, 1) });
                    n.short = false;
                    for (const k of miss) {
                        let best = null,
                            bd = 1e9;
                        for (const u of this.units)
                            if (u.k == k && !u.busy) {
                                const d = Math.abs(u.home.i - n.i) + Math.abs(u.home.j - n.j);
                                if (d < bd) {
                                    bd = d;
                                    best = u
                                }
                            }
                        if (best) {
                            best.busy = n.id;
                            best.eta = Math.ceil(bd / 3) + 1;
                            best.eta0 = best.eta;
                            n.assigned.push(best.id)
                        } else n.short = true
                    }
                    if (n.assigned.length && n.status == 'reported') n.status = 'dispatched';
                    return n.assigned.length
                },
                end(n, ok) {
                    this.units.forEach(u => {
                        if (u.busy == n.id) {
                            u.busy = 0;
                            u.eta = 0
                        }
                    });
                    if (n.closed) CV.Traffic.close(n.i, n.j, false);
                    this.incidents = this.incidents.filter(x => x != n);
                    if (ok) {
                        this.resolved++;
                        CV.alert('ok', `${n.type} at ${n.name} resolved`)
                    } else CV.alert('info', `Incident #${n.id} cancelled`)
                },
                step() {
                    for (const n of this.incidents.slice()) {
                        n.age++;
                        if (CV.cfg.autoDispatch && (n.assigned.length < n.need.length)) this.dispatch(n);
                        let arr = 0;
                        n.assigned.forEach(id => { const u = this.units.find(x => x.id == id); if (u.eta > 0) u.eta--; if (u.eta <= 0) arr++ });
                        if (arr && n.resp == null) {
                            n.resp = n.age;
                            this.resp.push(n.age)
                        }
                        if (arr) {
                            n.progress += 100 / (BASE[n.type] * (.7 + .3 * n.sev)) * arr / n.need.length;
                            n.status = 'responding'
                        } else {
                            n.status = n.assigned.length ? 'dispatched' : 'reported';
                            if (n.age % 6 == 0 && n.sev < 3) {
                                n.sev++;
                                CV.alert('warn', `Incident #${n.id} is escalating (severity ${n.sev})`)
                            }
                        }
                        if (n.progress >= 100) this.end(n, true)
                    }
                },
                panel(el) {
                    const f = this.incidents;
                    el.innerHTML = `<h3>🚨 Emergency Management</h3><div class="g2"><div class="card"><small>Active</small><b class="big" id="em-a"></b></div><div class="card"><small>Resolved</small><b class="big" id="em-r"></b></div><div class="card"><small>Avg response</small><b class="big" id="em-t"></b></div><div class="card"><small>Units busy</small><b class="big" id="em-u"></b></div></div>
<div class="card"><small>Create incident</small><div class="seg" id="em-ty">${Object.keys(this.IC).map(k=>`<button data-t="${k}">${this.IC[k]} ${k}</button>`).join('')}</div><div class="seg"><button class="btn" id="em-pl">📍 Place on map</button><button class="btn" id="em-rd">🎲 Random location</button></div><label><input type="checkbox" id="em-au"> Auto-dispatch nearest units</label></div>
<div id="em-ls"></div><div class="card"><small>Rescue resources</small><div id="em-un"></div></div>
<div class="card"><small>Fire stations and hospitals</small>${M.tiles.filter(t=>t.type=='fire'||t.type=='hosp').map(t=>`<div class="row2"><span>${t.type=='fire'?'🚒':'🏥'} ${t.name}</span><button class="btn" data-f="${t.i},${t.j}">Locate</button></div>`).join('')}</div>`;
$('em-ty').onclick=e=>{if(e.target.dataset.t){this.sel=e.target.dataset.t;this.refresh()}};
$('em-pl').onclick=()=>{M.setMode('inc:'+this.sel,'Click the map to place: '+this.sel);if(innerWidth<=900)document.body.classList.remove('panelopen')};
$('em-rd').onclick=()=>{const t=this.sel,r=t=='accident'?rnd(M.roads):t=='flood'?rnd(M.roads.concat(M.tiles.map(x=>[x.i,x.j]))):t=='medical'?(x=>[x.i,x.j])(rnd(M.tiles.filter(x=>x.type=='res'))):(x=>[x.i,x.j])(rnd(M.tiles.filter(x=>x.type!='park')));this.create(t,r[0],r[1])};
$('em-au').checked=CV.cfg.autoDispatch;$('em-au').onchange=e=>{CV.cfg.autoDispatch=e.target.checked;CV.save()};
el.onclick=e=>{const d=e.target.dataset;if(d.f){const[i,j]=d.f.split(',').map(Number);M.focus(i,j)}else if(d.a){const n=this.incidents.find(x=>x.id==+d.i);if(!n)return;if(d.a=='d'){CV.toast(this.dispatch(n)?'Units dispatched':'No free units available');}else this.end(n,false);CV.App.refresh()}}},
refresh(){if(!$('em-a'))return;const b=this.units.filter(u=>u.busy).length;$('em-a').textContent=this.incidents.length;$('em-r').textContent=this.resolved;$('em-t').textContent=this.resp.length?Math.round(this.resp.reduce((a,x)=>a+x,0)/this.resp.length*5)+' min':'–';$('em-u').textContent=b+'/'+this.units.length;
document.querySelectorAll('#em-ty button').forEach(x=>x.classList.toggle('on',x.dataset.t==this.sel));
$('em-ls').innerHTML=this.incidents.length?this.incidents.map(n=>`<div class="card"><div class="row2"><b>${this.IC[n.type]} ${n.type} #${n.id}</b><span class="pill ${n.status}">${n.status}</span></div><small>${n.name} · severity ${n.sev} · units ${n.assigned.length}/${n.need.length}${n.short?' · <span class=warn>no free unit</span>':''}</small><div class="bar"><i style="width:${Math.min(100,n.progress)}%"></i></div><div class="seg"><button class="btn" data-a="d" data-i="${n.id}">🚓 Dispatch units</button><button class="btn" data-a="c" data-i="${n.id}">✖ Cancel</button></div></div>`).join(''):'<div class="empty">✅ No active incidents. Create one above, or keep random events on in Settings.</div>';
$('em-un').innerHTML=Object.keys(KN).map(k=>{const a=this.units.filter(u=>u.k==k),f=a.filter(u=>!u.busy).length;return`<div class="row"><span>${KN[k]}</span><div class="bar"><i style="width:${100*f/a.length}%"></i></div><em>${f}/${a.length} free</em></div>`}).join('')}};
})();