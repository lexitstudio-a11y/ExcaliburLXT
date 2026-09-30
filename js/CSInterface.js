// Version minimale de CSInterface (Adobe CEP). Remplaçable par le CSInterface.js officiel.
function CSInterface(){}
CSInterface.prototype.evalScript = function(script, cb){
  window.__adobe_cep__.evalScript(script, cb || function(){});
};
CSInterface.prototype.getSystemPath = function(type){
  var p = decodeURI(window.__adobe_cep__.getSystemPath(type));
  p = p.replace(/^file:\/\//, '');
  if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1); // Windows : /C:/... -> C:/...
  return p;
};
CSInterface.prototype.registerKeyEventsInterest = function(json){
  return window.__adobe_cep__.registerKeyEventsInterest(json);
};
CSInterface.SystemPath = {EXTENSION:"extension"};
