window.CV = window.CV || {};
window.$ = id => document.getElementById(id);
CV.DEF = { theme: 'dark', speed: 1, cycle: 6, cars: 60, conv: 100, inflow: 100, conservation: 10, curb: false, trees: 0, autoDispatch: true, random: true, showVehicles: true };
CV.Storage = { k: 'cityverse.v1', load() { try { return JSON.parse(localStorage.getItem(this.k)) || {} } catch (e) { return {} } }, save(d) { try { localStorage.setItem(this.k, JSON.stringify(d)) } catch (e) {} }, clear() { try { localStorage.removeItem(this.k) } catch (e) {} } };
CV.saved = CV.Storage.load();
CV.lastScen = CV.saved.scen || null;
CV.cfg = Object.assign({}, CV.DEF, CV.saved.cfg);
CV.save = () => CV.Storage.save({ cfg: CV.cfg, closed: [...CV.Traffic.closed], hist: CV.Analytics.hist, t: CV.State.t, scen: CV.lastScen });