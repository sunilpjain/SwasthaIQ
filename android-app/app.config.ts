import type { ExpoConfig } from 'expo/config';

/**
 * "SwasthyaIQ · Arihant" — Android only (no iPhone or web app in the prototype).
 * APP_ENV picks the backend: dev (default) or demo. EAS build profiles set it (eas.json).
 */
const appEnv = process.env.EXPO_PUBLIC_APP_ENV === 'demo' ? 'demo' : 'dev';

const config: ExpoConfig = {
  name: appEnv === 'demo' ? 'SwasthyaIQ · Arihant' : 'SwasthyaIQ · Arihant (dev)',
  slug: 'swasthyaiq-arihant',
  scheme: 'swasthyaiq',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  platforms: ['android'],
  android: {
    package:
      appEnv === 'demo' ? 'in.cognihealth.swasthyaiq.arihant' : 'in.cognihealth.swasthyaiq.arihant.dev',
    adaptiveIcon: {
      backgroundColor: '#00695C',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.CAMERA',
      'android.permission.USE_BIOMETRIC',
    ],
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-local-authentication', { faceIDPermission: false }],
    ['expo-build-properties', { android: { minSdkVersion: 29 } }], // Android 10+
  ],
  experiments: { typedRoutes: true },
  extra: { appEnv },
};

export default config;
