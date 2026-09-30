// Version minimale de CSInterface (Adobe CEP). Remplaçable par le CSInterface.js officiel.
function CSInterface(){}
CSInterface.prototype.evalScript = function(script, cb){
  window.__adobe_cep__.evalScript(script, cb || function(){});
};
CSInterface.prototype.getSystemPath = function(type){
  return decodeURI(JSON.parse(window.__adobe_cep__.getSystemPath(type)));
};
CSInterface.prototype.registerKeyEventsInterest = function(json){
  return window.__adobe_cep__.registerKeyEventsInterest(json);
};
CSInterface.SystemPath = {EXTENSION:"extension"};
