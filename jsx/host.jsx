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
      try { props.push({i: j, v: p.getValue()}); } catch (e) {}
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

// intrinsicOnly : ne réapplique que les valeurs des composants déjà présents (Mouvement, Opacité...)
// sans ajouter d'effet. Retourne {ok, fail, err}.
function _restoreEffects(seq, trackIdx, clip, effects, intrinsicOnly){
  app.enableQE();
  var st = {ok: 0, fail: 0, err: ''};
  var qc = intrinsicOnly ? null : _qeClipFor(seq, trackIdx, clip), i, j, e, comp, pr;
  for (i = 0; i < effects.length; i++){
    e = effects[i];
    comp = (i < clip.components.numItems && clip.components[i].displayName === e.n) ? clip.components[i] : null;
    if (!comp){
      if (intrinsicOnly || !qc) continue;
      var fx = qe.project.getVideoEffectByName(e.n);
      if (!fx){ st.err = st.err || ('effet introuvable : ' + e.n); continue; }
      qc.addVideoEffect(fx);
      comp = clip.components[clip.components.numItems - 1];
    }
    for (j = 0; j < e.p.length; j++){
      pr = e.p[j];
      try { comp.properties[pr.i].setValue(pr.v, true); st.ok++; }
      catch (x) { st.fail++; st.err = st.err || (e.n + ' : ' + x); }
    }
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
        effects: _snapshotEffects(s.clip)
      });
    }
    return _ok(res);
  } catch (e) { return _err(e.message || e); }
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
    var i, L, item, tr, c, cl, placed = 0, skipped = [], t, a;
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
      var ti = Math.min(L.track, seq.videoTracks.numTracks - 1);
      tr = seq.videoTracks[ti];
      tr.overwriteClip(item, pos);
      audioRemoved += _removeLinkedAudio(seq, pos, L.nodeId);
      cl = null;
      for (c = 0; c < tr.clips.numItems; c++){
        if (Math.abs(tr.clips[c].start.seconds - pos) < 0.001){ cl = tr.clips[c]; break; }
      }
      if (!cl) continue;
      t = new Time(); t.seconds = pos + L.duration;
      try { cl.end = t; } catch (e1) { endErr = String(e1); }
      if (L.effects){
        var r = _restoreEffects(seq, ti, cl, L.effects, !spec.keepEffects);
        stats.ok += r.ok; stats.fail += r.fail; stats.err = stats.err || r.err;
      }
      placed++;
    }
    for (a = 0; a < untargeted.length; a++){ try { seq.audioTracks[untargeted[a]].setTargeted(true, true); } catch (e2) {} }
    return _ok({placed: placed, skipped: skipped, valuesOk: stats.ok, valuesFail: stats.fail,
                err: stats.err || endErr, audioRemoved: audioRemoved});
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
