/// <reference types="vite/client" />

interface ScreenOrientation {
  lock?(orientation: OrientationLockType): Promise<void>;
}
