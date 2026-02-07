// clinica-crm-mobile/lib/_core/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Cross-platform key-value storage.
 * - Web: localStorage
 * - Native: AsyncStorage
 */
export async function kvGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return AsyncStorage.getItem(key);
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      // fallthrough
    }
  }
  await AsyncStorage.setItem(key, value);
}

export async function kvRemove(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.removeItem(key);
      return;
    } catch {
      // fallthrough
    }
  }
  await AsyncStorage.removeItem(key);
}
