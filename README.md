# rsp
Realtime Search Platform

## Usage
* Javascript usage:
Import the library like this:
```javascript
<script type="text/javascript" src="https://storage.googleapis.com/realsp/rsp.min.js"></script>
```

Then use it in your code like this:
```javascript
var resp = new Resp({
  "itemId": "searchInput",
  "apiKey": "fe4123b3-ad36-44f7-9a5b-0ea8c3abc813",
  "initialSearch": initialKeyword,
  "onMessage": handleNewData,
  "onDisconnected": turnOnSpinnerGIF,
  "onConnected": turnOffSpinnerGIF,
  "onError": function(err) {
    console.log('encountered an error', err);
  },
  "services": {
    "gifs": {},
    "youtube": {},
    "iTunes": {},
  }
});
```

In the above case the id of the search input is "searchInput"

## Supported backends
* iTunes
* youTube
