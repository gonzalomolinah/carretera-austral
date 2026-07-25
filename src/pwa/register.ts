import { registerSW } from 'virtual:pwa-register';

export const PWA_STATUS_EVENT = 'ruta-austral:pwa-status';

export type PwaStatus =
  | 'desactivada'
  | 'no-compatible'
  | 'registrando'
  | 'lista-sin-conexion'
  | 'actualizacion-disponible'
  | 'actualizando'
  | 'error';

export interface PwaStatusDetail {
  status: PwaStatus;
  message: string;
  error?: Error;
}

export interface PwaUpdatePrompt {
  message: string;
  apply: () => Promise<void>;
  postpone: () => void;
}

export interface RegisterPwaOptions {
  /** En desarrollo queda desactivada por defecto para evitar cachés sorpresivos. */
  enabled?: boolean;
  onStatusChange?: (detail: PwaStatusDetail) => void;
  onUpdateAvailable?: (prompt: PwaUpdatePrompt) => void;
  onError?: (error: Error) => void;
}

export interface PwaRegistrationController {
  readonly registration: ServiceWorkerRegistration | undefined;
  readonly updateAvailable: boolean;
  checkForUpdates: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  postponeUpdate: () => void;
  dispose: () => void;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function unavailableController(
  detail: PwaStatusDetail,
  options: RegisterPwaOptions,
): PwaRegistrationController {
  options.onStatusChange?.(detail);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<PwaStatusDetail>(PWA_STATUS_EVENT, { detail }));
  }

  return {
    registration: undefined,
    updateAvailable: false,
    async checkForUpdates() {},
    async applyUpdate() {},
    postponeUpdate() {},
    dispose() {},
  };
}

/**
 * Registra la PWA y entrega la actualización pendiente a la interfaz.
 * La actualización nunca se instala sola: `prompt.apply()` es el consentimiento.
 */
export function registerPwa(options: RegisterPwaOptions = {}): PwaRegistrationController {
  const enabled = options.enabled ?? import.meta.env.PROD;

  if (!enabled) {
    return unavailableController(
      {
        status: 'desactivada',
        message: 'La PWA está desactivada durante el desarrollo.',
      },
      options,
    );
  }

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return unavailableController(
      {
        status: 'no-compatible',
        message: 'Este navegador no permite usar la aplicación sin conexión.',
      },
      options,
    );
  }

  let registration: ServiceWorkerRegistration | undefined;
  let updateAvailable = false;
  let disposed = false;
  let controller!: PwaRegistrationController;

  const publish = (detail: PwaStatusDetail): void => {
    if (disposed) return;
    options.onStatusChange?.(detail);
    window.dispatchEvent(new CustomEvent<PwaStatusDetail>(PWA_STATUS_EVENT, { detail }));
  };

  publish({
    status: 'registrando',
    message: 'Preparando el acceso sin conexión…',
  });

  const updateServiceWorker = registerSW({
    immediate: true,
    onRegisteredSW(_serviceWorkerUrl, currentRegistration) {
      if (disposed) return;
      registration = currentRegistration;
    },
    onOfflineReady() {
      if (disposed) return;
      publish({
        status: 'lista-sin-conexion',
        message: 'La aplicación ya está disponible sin conexión.',
      });
    },
    onNeedRefresh() {
      if (disposed) return;
      updateAvailable = true;
      const message = 'Hay una versión nueva. Actualiza cuando estés listo para recargar.';

      publish({
        status: 'actualizacion-disponible',
        message,
      });

      options.onUpdateAvailable?.({
        message,
        apply: () => controller.applyUpdate(),
        postpone: () => controller.postponeUpdate(),
      });
    },
    onRegisterError(reason) {
      if (disposed) return;
      const error = asError(reason);
      publish({
        status: 'error',
        message: 'No fue posible preparar el acceso sin conexión.',
        error,
      });
      options.onError?.(error);
    },
  });

  controller = {
    get registration() {
      return registration;
    },
    get updateAvailable() {
      return updateAvailable;
    },
    async checkForUpdates() {
      const currentRegistration =
        registration ?? (await navigator.serviceWorker.getRegistration('/'));

      if (!currentRegistration) {
        throw new Error('La PWA todavía no termina de registrarse. Intenta nuevamente.');
      }

      registration = currentRegistration;
      await currentRegistration.update();
    },
    async applyUpdate() {
      if (!updateAvailable && !registration?.waiting) {
        throw new Error('No hay una actualización lista para instalar.');
      }

      publish({
        status: 'actualizando',
        message: 'Aplicando la actualización…',
      });
      updateAvailable = false;
      await updateServiceWorker(true);
    },
    postponeUpdate() {
      publish({
        status: 'lista-sin-conexion',
        message: 'La actualización quedó pendiente para más tarde.',
      });
    },
    dispose() {
      disposed = true;
    },
  };

  return controller;
}
