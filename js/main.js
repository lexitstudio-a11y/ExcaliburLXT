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

  $('capture').onclick = function(){
    host('captureSelection', undefined, function(r){
      if (!r.ok) return status(r.error);
      captured = r.data; renderCaptured(); status(captured.length + ' calque(s) capturé(s)');
    });
  };

  $('fromSel').onclick = function(){
    host('selectedEffectNames', undefined, function(r){
      if (!r.ok) return status(r.error);
      $('effectList').innerHTML = '';
      r.data.forEach(function(n){ var o = document.createElement('option'); o.value = n; $('effectList').appendChild(o); });
      status(r.data.length + ' effet(s) trouvés — choisissez dans le champ');
    });
  };

  $('save').onclick = function(){
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
  };

  function describe(b){
    if (b.type === 'effect') return 'Effet : ' + b.effect;
    return b.layers.length + ' calque(s) : ' + b.layers.map(function(l){ return l.name; }).join(', ') +
      (b.keepEffects ? ' [+ effets]' : '');
  }
  function render(){
    $('bindings').innerHTML = '';
    bindings.forEach(function(b){
      var li = document.createElement('li');
      li.innerHTML = '<span class="k"></span><span class="d"></span><button>✕</button>';
      li.children[0].textContent = b.key;
      li.children[1].textContent = describe(b); li.children[1].title = describe(b);
      li.children[2].onclick = function(){ bindings = bindings.filter(function(x){ return x !== b; }); save(); render(); };
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
        status(r.ok ? r.data.placed + ' calque(s) posé(s)' + (r.data.skipped.length ? ' — introuvable(s) : ' + r.data.skipped.join(', ') : '') : r.error);
      });
  }

  document.addEventListener('keydown', function(e){
    if (!$('armed').checked) return;
    var t = e.target.tagName;
    if (t === 'INPUT' && e.target.type !== 'checkbox' || t === 'SELECT') return;
    var k = combo(e); if (!k) return;
    var b = bindings.filter(function(x){ return x.key === k; })[0];
    if (b){ e.preventDefault(); run(b); }
  });

  // Demande à CEP de transmettre les touches assignées au panneau.
  try {
    cs.registerKeyEventsInterest(JSON.stringify(
      Array.apply(null, Array(256)).map(function(_, i){ return {keyCode: i}; })));
  } catch(e){}

  $('reserved').innerHTML = window.RESERVED_KEYS.map(function(k){ return '<span>' + k + '</span>'; }).join('');
  render();
})();
