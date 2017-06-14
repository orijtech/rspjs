// Resp defined here
function Resp(params) {
  params = params || {};

  var apiKey = params.apiKey;
  if (!(apiKey && apiKey.length > 0))
    throw new Error('expecting apiKey to have been set');

  this.searchElement = document.getElementById(params.itemId);
  if (!this.searchElement)
    throw new Error('expected itemId to have been set');

  this.uid = params.uid || '';
  this.services = params.services || {};
  timeoutWaitMillis = params.timeoutWaitMillis || 3000;
  this.maxTypingPeriodMs = 90;

  this.onMessage = params.onMessage;
  if (typeof this.onMessage !== 'function')
    throw new Error('expecting onMessage to have been set');

  /* Events and their enumerations */
  this.onError		  = params.onError;
  this.onConnected	  = params.onConnected;
  this.onDisconnected	  = params.onDisconnected;
  this.onStoppedTyping	  = params.onStoppedTyping;
  this.onTyping		  = params.onTyping;
  this.onAcknowledgement  = params.onAcknowledgement;

  this.EventTyping	    = 'typing';
  this.EventInitialized	    = 'initialized';
  this.EventNewData	    = 'newData';
  this.EventNewSearch	    = 'newSearch';
  this.EventStoppedTyping   = 'stoppedTyping';
  this.EventAcknowledgement = 'acknowledgement';
  /* Events and their enumerations complete */

  var req = new XMLHttpRequest();
  this.connected = false;

  var resp = this;
  req.onreadystatechange = function() {
    var state = this;
    if (state.readyState === 4) {
      var statusOK = state.status >= 200 && state.status <= 299;
      if (!statusOK) { 
	throw new Error(state.responseText);
	return;
      }

      // Otherwise parse out the:
      // * wsAddress
      // * persistence key
      var data = JSON.parse(state.responseText);
      setWSAddr(data.WSURL);
      resp.persistenceKey = data.key;
      resp.initSocket(params.initialSearch);
    }
  }

  req.open('POST', 'https://rsp.orijtech.com/auth', true);
  req.setRequestHeader('Content-Type', 'application/json');
  req.send(JSON.stringify({'api_key': apiKey}));

  // Expecting:
  // * apiKey
  // * onMessage
  // * onError
  // Optionally:
  // * input-element or #resp-input
  // * onTyping

  resp.searchElement.addEventListener('input', function() {
    resp.handleTypingEvents();
  });
}

Resp.prototype.handleErr = function(ex) {
  if (typeof this.onError === 'function')
    this.onError(ex);
  else
    console.log('handled exception %s', ex);
}

var wsAddr = '';
var timeoutWaitMillis = 0;

Resp.prototype.initSocket = function(initialSearchTerm) {
  try {
    this.socket = new WebSocket(wsAddr);
  } catch(ex) {
    // Caught exception here
    console.log('failed to connect here! ', ex);
  } finally {
    if (!this.socket)
      console.log('failed to connect :(');
  }

  this.connected = false;
  this.uid = '';

  var resp = this;

  // On message handler.
  resp.socket.addEventListener('message', function(event) {
    var data = event.data || '{}';
    try {
      data = JSON.parse(data);
    } catch(ex) {
      resp.handleErr(ex);
      return;
    }

    // Otherwise it is now clear to mux and handle the results.
    resp.muxOnResponseData(data);
  });

  // Initialized handler.
  resp.socket.addEventListener('open', function() {
    if (typeof resp.onConnected === 'function')
      resp.onConnected();

    resp.connected = true;
    if (initialSearchTerm && initialSearchTerm.length > 0)
	resp.search(initialSearchTerm);
  });

  var retry = function() {
    resp.initSocket(resp.lastInput);
  }

  // Reconnection handler.
  resp.socket.addEventListener('close', function() {
    resp.connected = false;
    // console.log('resp.disconnected!');
    if (typeof resp.onDisconnected === 'function')
      resp.onDisconnected();

    setTimeout(retry, timeoutWaitMillis);
  });

  // Error handler. It is necessary because
  resp.socket.addEventListener('error', function(evt) {
    console.log('onerr ', evt);
  });
}

Resp.prototype.handleTypingEvents = function() {
  if (!this.connected)
    return;

  if (!this.typing)
    this.typing = true;


  var resp = this;
  var curTime = resp.getCurrTimeEpochSeconds();
  var timeDiff = curTime - resp.lastTypingTime;
  if (timeDiff >= resp.maxTypingPeriodMs && resp.typing) {
    resp._emit({event: resp.EventStoppedTyping, uid: resp.uid});
    resp.typing = false;
  }

  if (!resp.typing)
    resp._doSearch();

  this.lastTypingTime = this.getCurrTimeEpochSeconds();
}

Resp.prototype.search = function(query) {
  this.lastInput = query;
  this._emit({
    value: query, event: this.EventNewSearch,
    services: this.services, uid: this.uid,
  });
}

Resp.prototype._doSearch = function(fallbackMessage) {
  var input = this.searchElement.value;
  var nonBlankInput = (input && input.length > 0);
  var canUseFallbackMessage = (fallbackMessage && fallbackMessage.length > 0);

  if (!nonBlankInput) {
    if (!canUseFallbackMessage)
      return;

    input = fallbackMessage;
  }

  if (input === this.lastInput)
    return;

  this.search(input);
}

Resp.prototype._emit = function(obj) {
  if (this.connected)
    try {
      this.socket.send(JSON.stringify(obj));
    } catch(ex) {
      console.log('_emit exception ', ex);
    }
}

Resp.prototype.handleNewData = function(data) {
  if (typeof this.onMessage === 'function')
    this.onMessage(data);
}

function invokeIfDefined(fn, args) {
  if (typeof fn === 'function')
    fn(args);
}

Resp.prototype.muxOnResponseData = function(data) {
  switch (data.event) {
    case this.EventNewData:
      this.handleNewData(data);
      break;

    case this.EventTyping:
      invokeIfDefined(this.onTyping, data);
      break;

    case this.EventInitialized:
      invokeIfDefined(this.onInitialized, data);
      break;

    case this.EventStoppedTyping:
      invokeIfDefined(this.onStoppedTyping, data);
      break;

    case this.EventAcknowledgement:
      invokeIfDefined(this.onAcknowledgement, data);
      break;
  }
}

Resp.prototype.getCurrTimeEpochSeconds = function() {
  return (new Date()).getTime();
}

function setWSAddr(theURL) {
  wsAddr = theURL;
}
