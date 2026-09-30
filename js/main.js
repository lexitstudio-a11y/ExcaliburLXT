(function(){
  var cs = new CSInterface();
  var STORE = 'excaliburlxt.bindings';
  var $ = function(id){ return document.getElementById(id); };
  var bindings = load();
  var captured = [];
  var pendingKey = '';

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
    if (isReserved(k)){ pendingKey = ''; this.value = k; setKeyMsg('« ' + k + ' » est déjà utilisée par Première Pro.'); return; }
    var dup = bindings.filter(function(b){ return b.key === k; })[0];
    pendingKey = k; this.value = k;
    setKeyMsg(dup ? 'Déjà assignée : elle sera remplacée.' : 'Touche libre.', !dup);
  });
  $('clearKey').onclick = function(){ pendingKey = ''; $('keyField').value = ''; setKeyMsg(''); };

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
    var b = {key: pendingKey};
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
    captured = []; renderCaptured(); pendingKey = ''; $('keyField').value = ''; setKeyMsg('Assigné.', true);
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
      li.children[1].textContent = describe(b); li.children[1].title = describe(b);
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
          (r.data.audioRemoved ? ' · audio retiré : ' + r.data.audioRemoved : '') +
          (r.data.err ? ' · ' + r.data.err : '') +
          (r.data.skipped.length ? ' — introuvable(s) : ' + r.data.skipped.join(', ') : ''));
      });
  }

  document.addEventListener('keydown', function(e){
    if (!$('armed').checked) return;
    var t = e.target.tagName;
    if (t === 'INPUT' && e.target.type !== 'checkbox' || t === 'SELECT') return;
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

  function gh(https, path, token, raw, cb){
    var h = {'User-Agent': 'ExcaliburLXT', 'Accept': raw ? 'application/vnd.github.raw' : 'application/vnd.github+json'};
    if (token) h.Authorization = 'Bearer ' + token;
    https.get({hostname: 'api.github.com', path: path, headers: h}, function(res){
      var chunks = [];
      res.on('data', function(c){ chunks.push(c); });
      res.on('end', function(){
        if (res.statusCode !== 200) return cb(new Error('GitHub ' + res.statusCode + ' (' + path.split('?')[0] + ')'));
        cb(null, Buffer.concat(chunks));
      });
    }).on('error', cb);
  }

  $('update').onclick = function(){
    var https, fs, pathMod;
    try { https = nodeReq('https'); fs = nodeReq('fs'); pathMod = nodeReq('path'); }
    catch(e){ return status('Node.js indisponible dans ce panneau.'); }
    var repo = $('upRepo').value.trim(), br = $('upBranch').value.trim(), tok = $('upToken').value.trim();
    var root = cs.getSystemPath('extension');
    status('Mise à jour… connexion à GitHub (' + repo + ', ' + br + ')');
    var guard = setTimeout(function(){ status('Pas de réponse de GitHub après 20 s (réseau bloqué ?).'); }, 20000);
    gh(https, '/repos/' + repo + '/git/trees/' + encodeURIComponent(br) + '?recursive=1', tok, false, function(err, buf){
      clearTimeout(guard);
      if (err) return status(err.message + (tok ? '' : ' — dépôt privé ? ajoutez un jeton'));
      var files = JSON.parse(buf.toString()).tree.filter(function(t){ return t.type === 'blob' && !/^\.git/.test(t.path); });
      var got = {}, left = files.length, failed = null;
      if (!left) return status('Aucun fichier trouvé.');
      status('Téléchargement de ' + left + ' fichiers…');
      files.forEach(function(f){
        gh(https, '/repos/' + repo + '/contents/' + f.path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(br), tok, true, function(e, data){
          if (e) failed = failed || e; else got[f.path] = data;
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

  $('reserved').innerHTML = window.RESERVED_KEYS.map(function(k){ return '<span>' + k + '</span>'; }).join('');
  render();
})();
