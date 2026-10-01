(function(){
  var cs = new CSInterface();
  var STORE = 'excaliburlxt.bindings';
  var $ = function(id){ return document.getElementById(id); };
  var bindings = load();
  var captured = [];
  var pendingKey = '', pendingCode = null, pendingMods = null;

  function load(){ try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch(e){ return []; } }
  function save(){ try { localStorage.setItem(STORE, JSON.stringify(bindings)); } catch(e){} }
  function status(t){ $('status').textContent = t; }
  window.onerror = function(m){ status('Erreur JS : ' + m); };

  function host(fn, arg, cb){
    var call = fn + '(' + (arg === undefined ? '' : JSON.stringify(typeof arg === 'string' ? arg : JSON.stringify(arg))) + ')';
    cs.evalScript(call, function(r){
      var o; try { o = JSON.parse(r); } catch(e){ o = {ok:false, error: 'Réponse invalide : ' + r}; }
      cb(o);
    });
  }

  // ---- touches ----
  function combo(e){
    var k, c = e.code || '';
    if (/^Digit\d$/.test(c)) k = c.slice(5);
    else if (/^Numpad/.test(c)) k = 'Num' + c.slice(6);
    else if (/^F\d+$/.test(c)) k = c;
    else if (e.altKey && /^Key[A-Z]$/.test(c)) k = c.slice(3);
    else if (e.key === ' ') k = 'Space';
    else if (e.key.length === 1) k = e.key.toUpperCase();
    else k = e.key;
    if (/^(Control|Shift|Alt|Meta)$/.test(k)) return '';
    var m = [];
    if (e.ctrlKey || e.metaKey) m.push('Ctrl');
    if (e.altKey) m.push('Alt');
    if (e.shiftKey) m.push('Shift');
    return m.concat(k).join('+');
  }
  function isReserved(k){ return window.RESERVED_KEYS.indexOf(k) !== -1; }

  function setKeyMsg(t, ok){ $('keyMsg').textContent = t || ''; $('keyMsg').className = 'msg' + (ok ? ' ok' : ''); }

  $('keyField').addEventListener('keydown', function(e){
    e.preventDefault(); e.stopPropagation();
    var k = combo(e); if (!k) return;
    pendingCode = e.code; pendingMods = {ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, shift: e.shiftKey};
    if (isReserved(k)){ pendingKey = ''; this.value = k; setKeyMsg('« ' + k + ' » est déjà utilisée par Première Pro.'); return; }
    var dup = bindings.filter(function(b){ return b.key === k; })[0];
    pendingKey = k; this.value = k;
    setKeyMsg(dup ? 'Déjà assignée : elle sera remplacée.' : 'Touche libre.', !dup);
  });
  $('clearKey').onclick = function(){ pendingKey = ''; pendingCode = null; pendingMods = null; $('keyField').value = ''; setKeyMsg(''); };

  // ---- UI ----
  $('type').onchange = function(){
    var l = this.value === 'layers';
    $('layersOpts').hidden = !l; $('effectOpts').hidden = l;
  };

  function renderCaptured(){
    $('captured').innerHTML = '';
    captured.forEach(function(c, i){
      var li = document.createElement('li');
      li.innerHTML = '<span class="d"></span><button>✕</button>';
      li.firstChild.textContent = c.name + ' (V' + (c.track + 1) + ')';
      li.lastChild.onclick = function(){ captured.splice(i, 1); renderCaptured(); };
      $('captured').appendChild(li);
    });
  }

  function capture(done){
    host('captureSelection', undefined, function(r){
      if (!r.ok){ status(r.error); setKeyMsg(r.error); return done && done(false); }
      captured = r.data; renderCaptured(); status(captured.length + ' calque(s) capturé(s)');
      setKeyMsg(captured.length + ' calque(s) capturé(s).', true);
      if (done) done(true);
    });
  }
  $('capture').onclick = function(){ capture(); };

  $('fromSel').onclick = function(){
    host('selectedEffectNames', undefined, function(r){
      if (!r.ok) return status(r.error);
      $('effectList').innerHTML = '';
      r.data.forEach(function(n){ var o = document.createElement('option'); o.value = n; $('effectList').appendChild(o); });
      status(r.data.length + ' effet(s) trouvés — choisissez dans le champ');
    });
  };

  $('save').onclick = function(){
    if ($('type').value === 'layers' && !captured.length && pendingKey && !isReserved(pendingKey))
      return capture(function(ok){ if (ok) save1(); });
    save1();
  };
  function save1(){
    if (!pendingKey) return setKeyMsg('Choisissez une touche libre.');
    var b = {key: pendingKey, code: pendingCode, mods: pendingMods};
    if ($('type').value === 'layers'){
      if (!captured.length) return setKeyMsg('Capturez au moins un calque.');
      b.type = 'layers'; b.layers = captured; b.keepEffects = $('keepEffects').checked;
    } else {
      var n = $('effectName').value.trim();
      if (!n) return setKeyMsg("Saisissez le nom de l'effet.");
      b.type = 'effect'; b.effect = n;
    }
    bindings = bindings.filter(function(x){ return x.key !== b.key; });
    bindings.push(b); save(); render();
    captured = []; renderCaptured(); pendingKey = ''; pendingCode = null; pendingMods = null; $('keyField').value = ''; setKeyMsg('Assigné.', true);
  }

  function describe(b){
    if (b.type === 'effect') return 'Effet : ' + b.effect;
    return b.layers.length + ' calque(s) : ' + b.layers.map(function(l){ return l.name; }).join(', ') +
      (b.keepEffects ? ' [+ effets]' : '');
  }
  function render(){
    $('bindings').innerHTML = '';
    bindings.forEach(function(b){
      var li = document.createElement('li');
      li.innerHTML = '<span class="k"></span><span class="d"></span><button title="Tester maintenant">▶</button><button>✕</button>';
      li.children[0].textContent = b.key;
      li.children[1].textContent = describe(b) + (b.code ? '' : ' (à réassigner pour la timeline)'); li.children[1].title = li.children[1].textContent;
      li.children[2].onclick = function(){ run(b); };
      li.children[3].onclick = function(){ bindings = bindings.filter(function(x){ return x !== b; }); save(); render(); };
      $('bindings').appendChild(li);
    });
    if (!bindings.length) $('bindings').innerHTML = '<li class="d">Aucune assignation.</li>';
  }

  // ---- exécution ----
  function run(b){
    if (b.type === 'effect')
      host('applyEffect', b.effect, function(r){ status(r.ok ? 'Effet appliqué à ' + r.data.applied + ' clip(s)' : r.error); });
    else
      host('applyLayers', {layers: b.layers, keepEffects: b.keepEffects}, function(r){
        status(!r.ok ? r.error : r.data.placed + ' calque(s) posé(s)' +
          ' · valeurs copiées : ' + r.data.valuesOk + (r.data.valuesFail ? ' (échecs : ' + r.data.valuesFail + ')' : '') +
          (r.data.tracks && r.data.tracks.length ? ' · piste ' + r.data.tracks.join(', ') : '') +
          (r.data.fitted ? ' · calé sur la sélection' : '') +
          (r.data.audioRemoved ? ' · audio retiré : ' + r.data.audioRemoved : '') +
          (r.data.err ? ' · ' + r.data.err : '') +
          (r.data.skipped.length ? ' — introuvable(s) : ' + r.data.skipped.join(', ') : ''));
      });
  }

  document.addEventListener('keydown', function(e){
    if (!$('armed').checked){ status('Touche reçue mais « Raccourcis actifs » est décoché.'); return; }
    var t = e.target.tagName;
    if (t === 'INPUT' && e.target.type !== 'checkbox' && !e.target.readOnly || t === 'SELECT') return;
    var k = combo(e); if (!k) return;
    var b = bindings.filter(function(x){ return x.key === k; })[0];
    status('Touche reçue : ' + k + (b ? '' : ' (non assignée)'));
    if (b){ e.preventDefault(); run(b); }
  });

  // Demande à CEP de transmettre les touches assignées au panneau.
  try {
    cs.registerKeyEventsInterest(JSON.stringify(
      Array.apply(null, Array(256)).map(function(_, i){ return {keyCode: i}; })));
  } catch(e){}

  // ---- rechargement / mise à jour ----
  function nodeReq(m){ return (window.cep_node && window.cep_node.require ? window.cep_node.require : window.require)(m); }
  var SET = 'excaliburlxt.update';
  var cfg = {}; try { cfg = JSON.parse(localStorage.getItem(SET)) || {}; } catch(e){}
  ['Repo','Branch','Token'].forEach(function(k){
    var el = $('up' + k); if (cfg[k]) el.value = cfg[k];
    el.onchange = function(){ cfg[k] = el.value.trim(); try { localStorage.setItem(SET, JSON.stringify(cfg)); } catch(e){} };
  });

  function reloadAll(){
    var jsx = cs.getSystemPath('extension') + '/jsx/host.jsx';
    cs.evalScript('$.evalFile(' + JSON.stringify(jsx) + ')', function(){ location.reload(); });
  }
  $('reload').onclick = function(){ status('Rechargement…'); setTimeout(reloadAll, 150); };

  function req(https, host, path, token, accept, cb){
    var h = {'User-Agent': 'ExcaliburLXT'};
    if (accept) h.Accept = accept;
    if (token) h.Authorization = 'Bearer ' + token;
    https.get({hostname: host, path: path, headers: h}, function(res){
      var chunks = [];
      res.on('data', function(c){ chunks.push(c); });
      res.on('end', function(){
        if (res.statusCode !== 200){
          var msg = 'GitHub ' + res.statusCode + ' (' + path.split('?')[0] + ')';
          if (res.statusCode === 403 && res.headers['x-ratelimit-remaining'] === '0')
            msg = 'Limite de requêtes GitHub atteinte (réessayez vers ' +
              new Date(res.headers['x-ratelimit-reset'] * 1000).toLocaleTimeString() + ' ou ajoutez un jeton)';
          return cb(new Error(msg));
        }
        cb(null, Buffer.concat(chunks));
      });
    }).on('error', cb);
  }

  // Sans jeton : raw.githubusercontent.com (pas de limite d'API) + liste files.txt.
  // Avec jeton : API GitHub (dépôts privés).
  function listFiles(https, repo, br, tok, cb){
    if (!tok){
      var enc = br.split('/').map(encodeURIComponent).join('/');
      return req(https, 'raw.githubusercontent.com', '/' + repo + '/' + enc + '/files.txt', '', '', function(err, buf){
        if (err) return cb(err);
        cb(null, buf.toString().split(/\r?\n/).map(function(x){ return x.trim(); }).filter(Boolean));
      });
    }
    req(https, 'api.github.com', '/repos/' + repo + '/git/trees/' + encodeURIComponent(br) + '?recursive=1', tok, 'application/vnd.github+json', function(err, buf){
      if (err) return cb(err);
      cb(null, JSON.parse(buf.toString()).tree.filter(function(t){ return t.type === 'blob' && !/^\.git/.test(t.path); })
        .map(function(t){ return t.path; }));
    });
  }
  function getFile(https, repo, br, tok, path, cb){
    if (!tok){
      var enc = br.split('/').map(encodeURIComponent).join('/');
      return req(https, 'raw.githubusercontent.com', '/' + repo + '/' + enc + '/' + path.split('/').map(encodeURIComponent).join('/'), '', '', cb);
    }
    req(https, 'api.github.com', '/repos/' + repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(br), tok, 'application/vnd.github.raw', cb);
  }

  $('update').onclick = function(){
    var https, fs, pathMod;
    try { https = nodeReq('https'); fs = nodeReq('fs'); pathMod = nodeReq('path'); }
    catch(e){ return status('Node.js indisponible dans ce panneau.'); }
    var repo = $('upRepo').value.trim(), br = $('upBranch').value.trim(), tok = $('upToken').value.trim();
    var root = cs.getSystemPath('extension');
    status('Mise à jour… connexion à GitHub (' + repo + ', ' + br + ')');
    var guard = setTimeout(function(){ status('Pas de réponse de GitHub après 20 s (réseau bloqué ?).'); }, 20000);
    listFiles(https, repo, br, tok, function(err, paths){
      clearTimeout(guard);
      if (err) return status(err.message + (tok ? '' : ' — dépôt privé ? ajoutez un jeton'));
      var got = {}, left = paths.length, failed = null;
      if (!left) return status('Aucun fichier trouvé.');
      status('Téléchargement de ' + left + ' fichiers…');
      paths.forEach(function(f){
        getFile(https, repo, br, tok, f, function(e, data){
          if (e) failed = failed || e; else got[f] = data;
          if (--left) return;
          if (failed) return status('Échec : ' + failed.message);
          var manifestChanged = false;
          Object.keys(got).forEach(function(p){
            var dest = pathMod.join(root, p);
            if (p === 'CSXS/manifest.xml'){
              try { manifestChanged = fs.readFileSync(dest).toString() !== got[p].toString(); } catch(x){ manifestChanged = true; }
            }
            fs.mkdirSync(pathMod.dirname(dest), {recursive: true});
            fs.writeFileSync(dest, got[p]);
          });
          if (manifestChanged) return status('Mis à jour — manifest modifié : redémarrez Première Pro.');
          status('Mis à jour (' + Object.keys(got).length + ' fichiers), rechargement…');
          setTimeout(reloadAll, 400);
        });
      });
    });
  };

  // ---- passerelle locale pour Hammerspoon (touches depuis la timeline) ----
  var MACCODE = {KeyA:0,KeyS:1,KeyD:2,KeyF:3,KeyH:4,KeyG:5,KeyZ:6,KeyX:7,KeyC:8,KeyV:9,IntlBackslash:10,KeyB:11,KeyQ:12,KeyW:13,KeyE:14,KeyR:15,KeyY:16,KeyT:17,Digit1:18,Digit2:19,Digit3:20,Digit4:21,Digit6:22,Digit5:23,Equal:24,Digit9:25,Digit7:26,Minus:27,Digit8:28,Digit0:29,BracketRight:30,KeyO:31,KeyU:32,BracketLeft:33,KeyI:34,KeyP:35,Enter:36,KeyL:37,KeyJ:38,Quote:39,KeyK:40,Semicolon:41,Backslash:42,Comma:43,Slash:44,KeyN:45,KeyM:46,Period:47,Tab:48,Space:49,Backquote:50,Backspace:51,Escape:53,F1:122,F2:120,F3:99,F4:118,F5:96,F6:97,F7:98,F8:100,F9:101,F10:109,F11:103,F12:111,Numpad0:82,Numpad1:83,Numpad2:84,Numpad3:85,Numpad4:86,Numpad5:87,Numpad6:88,Numpad7:89,Numpad8:91,Numpad9:92,ArrowLeft:123,ArrowRight:124,ArrowDown:125,ArrowUp:126};
  function fromLabel(label){
    var parts = label.split('+'), k = parts.pop(), mods = {ctrl:false, meta:false, alt:false, shift:false}, code = null;
    parts.forEach(function(m){ if (m === 'Ctrl') mods.meta = true; if (m === 'Alt') mods.alt = true; if (m === 'Shift') mods.shift = true; });
    if (/^[A-Z]$/.test(k)) code = 'Key' + k;
    else if (/^\d$/.test(k)) code = 'Digit' + k;
    else if (/^F\d+$/.test(k)) code = k;
    else if (/^Num\d$/.test(k)) code = 'Numpad' + k.slice(3);
    return {code: code, mods: mods};
  }

  var PORT = 47820, TOKEN_KEY = 'excaliburlxt.token', server = null;
  function getToken(){
    var t = null; try { t = localStorage.getItem(TOKEN_KEY); } catch(e){}
    if (!t){
      t = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
      try { localStorage.setItem(TOKEN_KEY, t); } catch(e){}
    }
    return t;
  }
  function startServer(attempt){
    var http, qs;
    try { http = nodeReq('http'); qs = nodeReq('querystring'); } catch(e){ return; }
    server = http.createServer(function(req, res){
      var m = /^\/run\?(.*)$/.exec(req.url || ''), q = m ? qs.parse(m[1]) : {};
      function out(code, body){ res.writeHead(code, {'Content-Type': 'text/plain'}); res.end(body); }
      if (!m || q.token !== getToken()) return out(403, 'denied');
      if (!$('armed').checked) return out(200, 'off');
      var b = bindings.filter(function(x){ return x.key === q.key; })[0];
      if (!b) return out(200, 'none');
      status('Touche globale : ' + b.key);
      run(b);
      out(200, 'ok');
    });
    server.on('error', function(err){
      server = null;
      if (err && err.code === 'EADDRINUSE' && attempt < 8) setTimeout(function(){ startServer(attempt + 1); }, 1000);
      else status('Serveur local indisponible : ' + (err && err.message));
    });
    server.listen(PORT, '127.0.0.1');
  }
  window.addEventListener('beforeunload', function(){ try { if (server) server.close(); } catch(e){} });
  startServer(0);

  $('genGlobal').onclick = function(){
    var fs, os, pathMod, msg = $('globalMsg');
    try { fs = nodeReq('fs'); os = nodeReq('os'); pathMod = nodeReq('path'); } catch(e){ msg.textContent = 'Node.js indisponible.'; return; }
    var ok = bindings.filter(function(b){ return b.code && MACCODE[b.code] !== undefined; });
    var bad = bindings.filter(function(b){ return ok.indexOf(b) === -1; });
    var lua = ['-- Généré par ExcaliburLXT. Ne pas modifier : régénéré depuis le panneau.',
      'local TOKEN = ' + JSON.stringify(getToken()),
      'local hks = {}',
      'local function isPremiere(app) return app ~= nil and app:name() ~= nil and string.find(app:name(), "Premiere") ~= nil end',
      'local function bindKey(mods, code, label)',
      '  local hk',
      '  hk = hs.hotkey.new(mods, code, function()',
      '    local url = "http://127.0.0.1:' + PORT + '/run?token=" .. TOKEN .. "&key=" .. hs.http.encodeForQuery(label)',
      '    hs.http.doAsyncGet(url, nil, function(status, body)',
      '      if status ~= 200 or body ~= "ok" then',
      '        hk:disable()',
      '        hs.eventtap.keyStroke(mods, hs.keycodes.map[code] or code, 0)',
      '        hs.timer.doAfter(0.05, function() hk:enable() end)',
      '      end',
      '    end)',
      '  end)',
      '  table.insert(hks, hk)',
      'end'];
    ok.forEach(function(b){
      var mods = [];
      if (b.mods && b.mods.ctrl) mods.push('"ctrl"');
      if (b.mods && b.mods.meta) mods.push('"cmd"');
      if (b.mods && b.mods.alt) mods.push('"alt"');
      if (b.mods && b.mods.shift) mods.push('"shift"');
      lua.push('bindKey({' + mods.join(',') + '}, ' + MACCODE[b.code] + ', ' + JSON.stringify(b.key) + ')');
    });
    lua = lua.concat([
      'local function setEnabled(on) for _, hk in ipairs(hks) do if on then hk:enable() else hk:disable() end end end',
      'setEnabled(isPremiere(hs.application.frontmostApplication()))',
      'if lxtWatcher then lxtWatcher:stop() end',
      'lxtWatcher = hs.application.watcher.new(function(name, event, app)',
      '  if event == hs.application.watcher.activated then setEnabled(isPremiere(app))',
      '  elseif event == hs.application.watcher.deactivated and isPremiere(app) then setEnabled(false) end',
      'end)',
      'lxtWatcher:start()', '']);
    try {
      var dir = pathMod.join(os.homedir(), '.hammerspoon');
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFileSync(pathMod.join(dir, 'excaliburlxt.lua'), lua.join('\n'));
      var init = pathMod.join(dir, 'init.lua'), cur = '';
      try { cur = fs.readFileSync(init).toString(); } catch(e){}
      if (cur.indexOf('excaliburlxt.lua') === -1)
        fs.writeFileSync(init, cur + (cur && !/\n$/.test(cur) ? '\n' : '') + 'dofile(os.getenv("HOME") .. "/.hammerspoon/excaliburlxt.lua")\n');
      msg.className = 'msg ok';
      msg.textContent = ok.length + ' touche(s) écrites dans ~/.hammerspoon. Dans Hammerspoon : Reload Config.' +
        (bad.length ? ' À réassigner : ' + bad.map(function(b){ return b.key; }).join(', ') + '.' : '');
    } catch(e){ msg.className = 'msg'; msg.textContent = 'Échec : ' + e.message; }
  };

  function freeKeys(){
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), digits = '0123456789'.split(''), i;
    var fk = [], num = [], sym = ['<','>',',',';',':','!','?','.','/','\\','-','=','[',']',"'",'`','+','*'];
    for (i = 1; i <= 12; i++) fk.push('F' + i);
    for (i = 0; i <= 9; i++) num.push('Num' + i);
    function free(list, mod){ return list.map(function(k){ return mod + k; }).filter(function(k){ return !isReserved(k); }); }
    return [
      ['Touches seules', free(digits, '').concat(free(fk, ''), free(num, ''), free(sym, ''))],
      ['Maj + chiffre / F', free(digits, 'Shift+').concat(free(fk, 'Shift+'))],
      ['Alt + lettre / chiffre / F', free(letters, 'Alt+').concat(free(digits, 'Alt+'), free(fk, 'Alt+'))],
      ['Maj + lettre', free(letters, 'Shift+')],
      ['Ctrl + chiffre / F', free(digits, 'Ctrl+').concat(free(fk, 'Ctrl+'))],
      ['Ctrl + Alt + lettre', free(letters, 'Ctrl+Alt+')],
      ['Ctrl + Maj + chiffre / F', free(digits, 'Ctrl+Shift+').concat(free(fk, 'Ctrl+Shift+'))]
    ];
  }
  $('free').innerHTML = freeKeys().filter(function(g){ return g[1].length; }).map(function(g){
    return '<div class="grp">' + g[0] + '</div>' + g[1].map(function(k){ return '<span>' + k + '</span>'; }).join('');
  }).join('');
  $('free').onclick = function(e){
    if (e.target.tagName !== 'SPAN') return;
    pendingKey = e.target.textContent; $('keyField').value = pendingKey;
    var d = fromLabel(pendingKey); pendingCode = d.code; pendingMods = d.mods;
    setKeyMsg(d.code ? 'Touche libre.' : 'Touche libre (non utilisable depuis la timeline : appuyez plutôt sur la touche).', true);
  };

  $('reserved').innerHTML = window.RESERVED_KEYS.map(function(k){ return '<span>' + k + '</span>'; }).join('');
  render();
})();
