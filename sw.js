/* global self, caches, fetch */
"use strict";

var CACHE_VERSION = "billing-pwa-v6";
var PRECACHE_URLS = [
  "./",
  "./index.html",
  "./settings.html",
  "./history.html",
  "./backup.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./css/themes.css",
  "./css/responsive.css",
  "./css/print.css",
  "./vendor/jspdf.umd.min.js",
  "./assets/logo-placeholder.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-180.png",
  "./assets/fonts/NotoSans-Regular.ttf",
  "./js/db.js",
  "./js/storage-repository.js",
  "./js/settings.js",
  "./js/items.js",
  "./js/customers.js",
  "./js/preview.js",
  "./js/document-editor.js",
  "./js/document-types.js",
  "./js/numbering.js",
  "./js/money.js",
  "./js/validation.js",
  "./js/theme.js",
  "./js/ui-common.js",
  "./js/pwa.js",
  "./js/gst.js",
  "./js/calculations.js",
  "./js/export-png.js",
  "./js/export-pdf.js",
  "./js/print.js",
  "./js/onboarding.js",
  "./js/page-editor.js",
  "./js/page-settings.js",
  "./js/page-history.js",
  "./js/backup-restore.js",
  "./js/page-backup.js"
];

function precacheAll(cache) {
  return Promise.all(
    PRECACHE_URLS.map(function (url) {
      return cache.add(url).catch(function (err) {
        console.warn("[sw] precache skipped:", url, err && err.message ? err.message : err);
      });
    })
  );
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(function (cache) {
        return precacheAll(cache);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE_VERSION;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

function isSameOriginRequest(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

function cacheFirst(request) {
  return caches.match(request, { ignoreSearch: true }).then(function (cached) {
    if (cached) {
      return cached;
    }
    return fetch(request).then(function (response) {
      if (!response || response.status !== 200 || response.type === "opaque") {
        return response;
      }
      var copy = response.clone();
      caches.open(CACHE_VERSION).then(function (cache) {
        cache.put(request, copy);
      });
      return response;
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET" || !isSameOriginRequest(request)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(function (cached) {
        if (cached) {
          return cached;
        }
        return fetch(request).catch(function () {
          return caches.match("./index.html");
        });
      })
    );
    return;
  }

  event.respondWith(cacheFirst(request));
});