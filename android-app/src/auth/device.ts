import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import type { Biometrics, SecureKeyValueStore } from './session';

/** expo-secure-store encrypts values with a key held in the Android Keystore. */
export const secureStore: SecureKeyValueStore = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};

/** Fingerprint or face unlock; the phone's PIN or pattern is offered as the fallback. */
export const deviceBiometrics: Biometrics = {
  async available() {
    const [hardware, level] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);
    return hardware && level !== LocalAuthentication.SecurityLevel.NONE;
  },
  async authenticate(prompt) {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      cancelLabel: 'Use password',
      disableDeviceFallback: false,
    });
    return res.success;
  },
};
