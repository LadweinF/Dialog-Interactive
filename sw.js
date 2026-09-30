/* Listen to the dialogue - offline storage
   Bump VERSION whenever index.html changes, so iPads pick up the new copy. */

var VERSION = "v19";
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

/* Files that may not exist yet are added one by one, failures ignored. The
   recordings are kept as the page fetches them. */
var OPTIONAL = [];

/* a new version keeps the old one's recordings; page files are always fresh */
function carryOver(c){
  return caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){
      if (k.indexOf(PREFIX) !== 0 || k === CACHE) return null;
      return caches.open(k).then(function(old){
        return old.keys().then(function(reqs){
          return Promise.all(reqs.map(function(req){
            return c.match(req).then(function(have){
              if (have) return null;
              return old.match(req).then(function(res){ if (res) return c.put(req, res); });
            });
          }));
        });
      });
    }));
  }).catch(function(){});
}

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll(CORE).then(function(){
        return Promise.all(OPTIONAL.map(function(u){
          return c.add(u).catch(function(){ /* not uploaded yet - fine */ });
        }));
      }).then(function(){ return carryOver(c); });
    }).then(function(){ return self.skipWaiting(); })
  );
});

/* only this app's own old copies go - the monster app shares the address */
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if (k.indexOf(PREFIX) === 0 && k !== CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* Safari asks for sound in pieces and plays only the exact piece it asked for */
function piece(req, range){
  return caches.match(req.url, { ignoreVary:true }).then(function(hit){
    if (!hit) return fetch(req);
    return hit.arrayBuffer().then(function(buf){
      var size = buf.byteLength;
      var m = /bytes=(\d*)-(\d*)/.exec(range) || [];
      var start = m[1] ? parseInt(m[1], 10) : 0;
      var end   = m[2] ? parseInt(m[2], 10) : size - 1;
      if (!m[1] && m[2]){ start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
      end = Math.min(end, size - 1);
      if (start >= size || end < start){
        return new Response(null, { status:416, headers:{ "Content-Range":"bytes */" + size } });
      }
      return new Response(buf.slice(start, end + 1), {
        status:206, statusText:"Partial Content",
        headers:{
          "Content-Type":  hit.headers.get("Content-Type") || "audio/mpeg",
          "Content-Range": "bytes " + start + "-" + end + "/" + size,
          "Content-Length": String(end - start + 1),
          "Accept-Ranges": "bytes"
        }
      });
    });
  });
}

/* cache-first for speed and offline use, refreshed in the background */
self.addEventListener("fetch", function(e){
  if (e.request.method !== "GET") return;

  var range = e.request.headers.get("range");
  if (range){ e.respondWith(piece(e.request, range)); return; }

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
