/* Service Worker fuer die Snooker-App.
   Zweck: Die App startet ohne Internet. Nur die Supabase-Aufrufe
   brauchen Netz, die laufen bewusst am Cache vorbei.

   Ablauf beim Aktualisieren: VERSION hochzaehlen, Dateien hochladen.
   Der Browser holt sw.js beim naechsten Start mit Netz neu, legt die
   neuen Dateien an und schaltet nach dem naechsten Schliessen um. */

const VERSION = "snooker-v8";

/* Alles, was die App zum Starten braucht. Relative Pfade, damit es
   egal ist, in welchem Ordner die App liegt. */
const DATEIEN = [
  "index.html",       /* leitet nur weiter, muss aber mit in den Cache,
                         sonst scheitert der Start ueber die kurze Adresse */
  "SnookerApp.html",
  "auswertung.html",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(DATEIEN); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (namen) {
        return Promise.all(namen.map(function (n) {
          return n === VERSION ? null : caches.delete(n);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;

  /* Nur den eigenen Ordner bedienen. Wichtig: die App liegt inzwischen auf
     derselben Adresse wie die Datenbank (beides *.supabase.co). Ein Vergleich
     der Herkunft wuerde also auch die REST-Aufrufe des Abgleichs einfangen -
     die sollen aber echte Netzfehler sehen, keine alte Antwort aus dem Cache.
     self.registration.scope ist der Ordner, in dem sw.js liegt. */
  if (!req.url.startsWith(self.registration.scope)) return;

  /* Zuerst der Cache, damit der Start auch ohne Netz sofort geht.
     Nebenher wird im Hintergrund die neue Fassung geholt und abgelegt,
     sie greift beim naechsten Start. */
  e.respondWith(
    caches.match(req).then(function (treffer) {
      const ausDemNetz = fetch(req).then(function (antwort) {
        if (antwort && antwort.ok) {
          const kopie = antwort.clone();
          caches.open(VERSION).then(function (c) { c.put(req, kopie); });
        }
        return antwort;
      }).catch(function () {
        /* Kein Netz. Wenn nichts im Cache liegt, faellt es unten auf
           die Startseite zurueck. */
        return treffer || caches.match("SnookerApp.html");
      });
      return treffer || ausDemNetz;
    })
  );
});
