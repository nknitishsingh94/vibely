import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vibely.app',
  appName: 'Vibely',
  webDir: 'public',
  server: {
    url: 'https://vibely-sigma-roan.vercel.app',
    cleartext: true,
    errorPath: 'index.html',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
