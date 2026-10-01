// ExtendScript (ES3) — exécuté dans Première Pro.

function _q(s){ return '"' + String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r?\n/g,' ') + '"'; }
function _json(o){
  if (o === null || o === undefined) return 'null';
  var t = typeof o, i, out;
  if (t === 'number') return isFinite(o) ? String(o) : 'null';
  if (t === 'boolean') return String(o);
  if (t === 'string') return _q(o);
  if (o instanceof Array){ out=[]; for(i=0;i<o.length;i++) out.push(_json(o[i])); return '['+out.join(',')+']'; }
  out=[]; for (var k in o) if (o.hasOwnProperty(k)) out.push(_q(k)+':'+_json(o[k]));
  return '{'+out.join(',')+'}';
}
function _ok(d){ return _json({ok:true, data:d}); }
function _err(m){ return _json({ok:false, error:String(m)}); }

function _seq(){
  if (!app.project || !app.project.activeSequence) throw new Error("Aucune séquence active.");
  return app.project.activeSequence;
}

function _selectedClips(seq){
  var res = [], t, c, tr, cl;
  for (t = 0; t < seq.videoTracks.numTracks; t++){
    tr = seq.videoTracks[t];
    for (c = 0; c < tr.clips.numItems; c++){
      cl = tr.clips[c];
      if (cl.isSelected()) res.push({clip: cl, track: t});
    }
  }
  return res;
}

function _findItem(parent, nodeId){
  var i, ch, f;
  for (i = 0; i < parent.children.numItems; i++){
    ch = parent.children[i];
    if (ch.nodeId === nodeId) return ch;
    if (ch.type === 2 /* BIN */){ f = _findItem(ch, nodeId); if (f) return f; }
  }
  return null;
}

function _snapshotEffects(clip){
  var out = [], i, j, comp, props, p;
  for (i = 0; i < clip.components.numItems; i++){
    comp = clip.components[i];
    props = [];
    for (j = 0; j < comp.properties.numItems; j++){
      p = comp.properties[j];
      var cv = null, item;
      try {
        // Les couleurs se lisent avec getColorValue() : [alpha, rouge, vert, bleu] (0-255)
        var c = p.getColorValue();
        if (c && c.length === 4 && typeof c[0] === 'number') cv = [c[0], c[1], c[2], c[3]];
      } catch (e0) {}
      try {
        item = {i: j, v: p.getValue()};
        if (cv) item.c = cv;
        props.push(item);
      } catch (e) {
        if (cv) props.push({i: j, v: null, c: cv});
      }
    }
    out.push({n: comp.displayName, p: props});
  }
  return out;
}

function _qeClipFor(seq, trackIdx, clip){
  var qeSeq = qe.project.getActiveSequence();
  var qt = qeSeq.getVideoTrackAt(trackIdx), k, it;
  for (k = 0; k < qt.numItems; k++){
    it = qt.getItemAt(k);
    if (it.type !== 'Empty' && Math.abs(it.start.secs - clip.start.seconds) < 0.001) return it;
  }
  return null;
}

function _setProps(comp, e, st){
  var j, pr, nm;
  for (j = 0; j < e.p.length; j++){
    pr = e.p[j];
    try {
      if (pr.c) comp.properties[pr.i].setColorValue(pr.c[0], pr.c[1], pr.c[2], pr.c[3], true);
      else comp.properties[pr.i].setValue(pr.v, true);
      st.ok++;
    }
    catch (x) {
      st.fail++;
      nm = ''; try { nm = comp.properties[pr.i].displayName; } catch (y) {}
      st.err = st.err || (e.n + (nm ? ' / ' + nm : '') + ' : ' + x);
    }
  }
}

// Retrouve le composant que l'on vient d'ajouter (par son nom, sans supposer sa position).
// Selon la version, Première Pro insère le nouvel effet tout en haut ou tout en bas des effets.
function _newComponent(clip, name, firstUser, prepend){
  var i, found = null;
  for (i = firstUser; i < clip.components.numItems; i++){
    if (clip.components[i].displayName === name){
      found = clip.components[i];
      if (prepend) return found;   // le premier de la liste est le plus récent
    }
  }
  return found;                     // le dernier de la liste est le plus récent
}

// intrinsicOnly : ne réapplique que les valeurs des composants déjà présents (Mouvement, Opacité...)
// sans ajouter d'effet. Retourne {ok, fail, err}.
function _restoreEffects(seq, trackIdx, clip, effects, intrinsicOnly){
  app.enableQE();
  var st = {ok: 0, fail: 0, err: ''};
  var n0 = clip.components.numItems;      // composants natifs de ce clip neuf
  var i, e, comp, extras = [];

  for (i = 0; i < effects.length; i++){
    e = effects[i];
    if (i < n0){
      if (clip.components[i].displayName === e.n) _setProps(clip.components[i], e, st);
    } else extras.push(e);
  }
  if (intrinsicOnly || !extras.length) return st;

  var qc = _qeClipFor(seq, trackIdx, clip);
  if (!qc){ st.err = st.err || 'clip introuvable pour ajouter les effets'; return st; }

  // Mode appris : true = les nouveaux effets se placent au-dessus des précédents.
  var prepend = ($.global.lxtPrepend === undefined) ? true : $.global.lxtPrepend;
  var order = [], k;
  for (k = 0; k < extras.length; k++) order.push(prepend ? extras[extras.length - 1 - k] : extras[k]);

  for (k = 0; k < order.length; k++){
    e = order[k];
    var fx = qe.project.getVideoEffectByName(e.n);
    if (!fx){ st.err = st.err || ('effet introuvable : ' + e.n); continue; }
    qc.addVideoEffect(fx);
    comp = _newComponent(clip, e.n, n0, prepend);
    if (comp) _setProps(comp, e, st);
  }

  // Vérifie l'ordre obtenu ; si faux, mémorise l'inverse pour la fois suivante.
  var wrong = false;
  for (k = 0; k < extras.length; k++){
    if (n0 + k >= clip.components.numItems || clip.components[n0 + k].displayName !== extras[k].n) wrong = true;
  }
  if (wrong && extras.length > 1){
    $.global.lxtPrepend = !prepend;
    st.err = st.err || 'ordre des effets inversé : annulez (Cmd+Z) et relancez, c\'est corrigé pour les prochaines fois';
  } else if (!wrong) {
    $.global.lxtPrepend = prepend;
  }
  return st;
}

// Capture les clips/calques sélectionnés.
function captureSelection(){
  try {
    var seq = _seq(), sel = _selectedClips(seq), res = [], i, s;
    if (!sel.length) return _err("Aucun clip sélectionné dans la timeline.");
    for (i = 0; i < sel.length; i++){
      s = sel[i];
      if (!s.clip.projectItem) continue;
      res.push({
        name: s.clip.name,
        nodeId: s.clip.projectItem.nodeId,
        track: s.track,
        duration: s.clip.end.seconds - s.clip.start.seconds,
        inPoint: s.clip.inPoint.seconds,
        outPoint: s.clip.outPoint.seconds,
        effects: _snapshotEffects(s.clip)
      });
    }
    return _ok(res);
  } catch (e) { return _err(e.message || e); }
}

function _isFree(tr, s, e){
  var c, cl;
  for (c = 0; c < tr.clips.numItems; c++){
    cl = tr.clips[c];
    if (cl.start.seconds < e - 0.0005 && cl.end.seconds > s + 0.0005) return false;
  }
  return true;
}

// Piste vidéo libre la plus basse (index le plus petit) strictement après `after`, libre sur [s, e].
function _lowestFreeTrack(seq, after, s, e){
  var t, locked;
  for (t = after + 1; t < seq.videoTracks.numTracks; t++){
    locked = false; try { locked = seq.videoTracks[t].isLocked(); } catch (x) {}
    if (!locked && _isFree(seq.videoTracks[t], s, e)) return t;
  }
  return -1;
}

function _removeLinkedAudio(seq, pos, nodeId){
  var a, c, cl, n = 0;
  for (a = 0; a < seq.audioTracks.numTracks; a++){
    var tr = seq.audioTracks[a];
    for (c = tr.clips.numItems - 1; c >= 0; c--){
      cl = tr.clips[c];
      if (Math.abs(cl.start.seconds - pos) < 0.001 && cl.projectItem && cl.projectItem.nodeId === nodeId){
        try { cl.remove(false, false); n++; } catch (e) {}
      }
    }
  }
  return n;
}

// spec = {layers:[{nodeId,track,duration,effects}], keepEffects:bool}
// Pose tous les calques à la tête de lecture, sur leur piste d'origine (vidéo seulement).
function applyLayers(specStr){
  var untargeted = [];
  var seq = null;
  try {
    var spec = eval('(' + specStr + ')');
    seq = _seq();
    var pos = seq.getPlayerPosition().seconds;
    var i, L, item, tr, c, cl, placed = 0, skipped = [], t, a, tracksUsed = [], lastTrack = -1;

    // Si des clips sont sélectionnés dans la timeline, les calques épousent leur début et leur fin.
    var sel = _selectedClips(seq), start = pos, spanLen = null, k;
    if (sel.length){
      var smin = sel[0].clip.start.seconds, smax = sel[0].clip.end.seconds;
      for (k = 1; k < sel.length; k++){
        if (sel[k].clip.start.seconds < smin) smin = sel[k].clip.start.seconds;
        if (sel[k].clip.end.seconds > smax) smax = sel[k].clip.end.seconds;
      }
      start = smin; spanLen = smax - smin;
    }
    // On garde l'ordre d'empilement d'origine (piste la plus basse d'abord).
    spec.layers.sort(function(x, y){ return x.track - y.track; });
    var stats = {ok: 0, fail: 0, err: ''}, audioRemoved = 0, endErr = '';
    app.enableQE();

    // Empêche l'audio lié d'être posé : on dé-cible les pistes audio le temps de l'opération.
    for (a = 0; a < seq.audioTracks.numTracks; a++){
      try {
        if (seq.audioTracks[a].isTargeted()){ untargeted.push(a); seq.audioTracks[a].setTargeted(false, true); }
      } catch (e0) {}
    }

    for (i = 0; i < spec.layers.length; i++){
      L = spec.layers[i];
      item = _findItem(app.project.rootItem, L.nodeId);
      if (!item){ skipped.push(L.name || L.nodeId); continue; }
      var want = (spanLen !== null) ? spanLen : L.duration;
      var ti = _lowestFreeTrack(seq, lastTrack, start, start + want);
      if (ti < 0){ skipped.push((L.name || L.nodeId) + ' (aucune piste vidéo libre)'); continue; }
      tr = seq.videoTracks[ti];
      // La durée doit être fixée AVANT l'insertion. Ici la piste est libre sur toute la durée visée,
      // donc rien n'est écrasé.
      var oldIn = null, oldOut = null, inS, outS, durSet = want;
      try { oldIn = item.getInPoint().seconds; oldOut = item.getOutPoint().seconds; } catch (e4) {}
      inS = (L.inPoint !== undefined && L.inPoint !== null) ? L.inPoint : (oldIn || 0);
      var okSet = false, tryDur = [want, L.duration], d;
      for (d = 0; d < tryDur.length && !okSet; d++){
        outS = inS + tryDur[d];
        try {
          if (oldOut !== null && inS >= oldOut){ item.setOutPoint(outS, 4); item.setInPoint(inS, 4); }
          else { item.setInPoint(inS, 4); item.setOutPoint(outS, 4); }
          okSet = true; durSet = tryDur[d];
        } catch (e5) {}
      }
      if (!okSet){
        skipped.push((L.name || L.nodeId) + ' (durée non réglable)');
        continue;
      }
      var placeErr = null;
      try { tr.overwriteClip(item, start); } catch (e6) { placeErr = e6; }
      try {
        if (oldIn !== null && oldOut !== null){ item.setOutPoint(oldOut, 4); item.setInPoint(oldIn, 4); }
      } catch (e7) {}
      if (placeErr) throw placeErr;
      audioRemoved += _removeLinkedAudio(seq, start, L.nodeId);
      cl = null;
      for (c = 0; c < tr.clips.numItems; c++){
        if (Math.abs(tr.clips[c].start.seconds - start) < 0.001){ cl = tr.clips[c]; break; }
      }
      if (!cl) continue;
      lastTrack = ti; tracksUsed.push('V' + (ti + 1));
      // Ajuste la fin exacte (rallonge un calque d'effet ou une image fixe si nécessaire).
      t = new Time(); t.seconds = start + want;
      try { cl.end = t; } catch (e1) { endErr = String(e1); }
      if (L.effects){
        var r = _restoreEffects(seq, ti, cl, L.effects, !spec.keepEffects);
        stats.ok += r.ok; stats.fail += r.fail; stats.err = stats.err || r.err;
      }
      placed++;
    }
    for (a = 0; a < untargeted.length; a++){ try { seq.audioTracks[untargeted[a]].setTargeted(true, true); } catch (e2) {} }
    return _ok({placed: placed, skipped: skipped, valuesOk: stats.ok, valuesFail: stats.fail,
                err: stats.err || endErr, audioRemoved: audioRemoved, tracks: tracksUsed, fitted: spanLen !== null});
  } catch (e) {
    try { if (seq) for (a = 0; a < untargeted.length; a++) seq.audioTracks[untargeted[a]].setTargeted(true, true); } catch (e3) {}
    return _err(e.message || e);
  }
}

// Applique un effet vidéo aux clips sélectionnés.
function applyEffect(name){
  try {
    var seq = _seq(), sel = _selectedClips(seq), i, qc, n = 0;
    if (!sel.length) return _err("Aucun clip sélectionné.");
    app.enableQE();
    var fx = qe.project.getVideoEffectByName(name);
    if (!fx) return _err("Effet introuvable : " + name);
    for (i = 0; i < sel.length; i++){
      qc = _qeClipFor(seq, sel[i].track, sel[i].clip);
      if (qc){ qc.addVideoEffect(fx); n++; }
    }
    return _ok({applied: n});
  } catch (e) { return _err(e.message || e); }
}

// Noms des effets du premier clip sélectionné (pour l'auto-complétion).
function selectedEffectNames(){
  try {
    var sel = _selectedClips(_seq()), names = [], i;
    if (!sel.length) return _err("Aucun clip sélectionné.");
    for (i = 0; i < sel[0].clip.components.numItems; i++) names.push(sel[0].clip.components[i].displayName);
    return _ok(names);
  } catch (e) { return _err(e.message || e); }
}
