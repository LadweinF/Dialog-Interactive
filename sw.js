/* Listen to the dialogue - offline storage
   Bump VERSION whenever index.html changes, so iPads pick up the new copy. */

var VERSION = "v9";
var PREFIX  = "dialogue-";
var CACHE   = PREFIX + VERSION;

var CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

/* The recordings. These may not exist yet, and a missing one must never break
   the cache - so they are added one by one, failures ignored. Any clip with
   another name is still kept, because the page fetches every clip it uses. */
var OPTIONAL = [];
for (var i = 1; i <= 12; i++){
  var clip = (i < 10 ? "0" : "") + i;
  OPTIONAL.push("./audio/" + clip + ".mp3");
}

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll(CORE).then(function(){
        return Promise.all(OPTIONAL.map(function(u){
          return c.add(u).catch(function(){ /* not uploaded yet - fine */ });
        }));
      });
    }).then(function(){ return self.skipWaiting(); })
  );
});

/* Only this app's own old copies are cleared. Other apps on the same
   github.io address (the monster app) keep their caches. */
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if (k.indexOf(PREFIX) === 0 && k !== CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* Cache-first for speed and offline use; a fresh copy is fetched in the
   background whenever there is a connection. */
self.addEventListener("fetch", function(e){
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then(function(hit){
      var live = fetch(e.request).then(function(res){
        if (res && res.status === 200 && res.type === "basic"){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        }
        return res;
      }).catch(function(){ return hit; });

      return hit || live;
    })
  );
});
