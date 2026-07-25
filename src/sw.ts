/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

type ServiceWorkerWithManifest = ServiceWorkerGlobalScope &
  typeof globalThis & {
    __WB_MANIFEST: Array<PrecacheEntry | string>;
  };

declare const self: ServiceWorkerWithManifest;

const serviceWorker = self;

// Workbox reemplaza literalmente `self.__WB_MANIFEST` durante el build.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

// Las navegaciones de la SPA vuelven al shell precargado cuando no hay red.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api(?:\/|$)/],
  }),
);

// Los datos compartidos siempre pasan por la red y por la estrategia local-first
// de la aplicación. Nunca quedan copias de Supabase dentro del service worker.
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co'),
  new NetworkOnly(),
);

// Las teselas estándar de OpenStreetMap quedan estrictamente online.
// Sin conexión se muestran las coordenadas guardadas en una lista accesible.
registerRoute(
  ({ request, url }) =>
    request.destination === 'image' &&
    (url.hostname.endsWith('.tile.openstreetmap.org') ||
      url.hostname.endsWith('.basemaps.cartocdn.com')),
  new NetworkOnly(),
);

function requestsSkipWaiting(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'SKIP_WAITING'
  );
}

serviceWorker.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (requestsSkipWaiting(event.data)) {
    event.waitUntil(serviceWorker.skipWaiting());
  }
});

export {};
