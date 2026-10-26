import * as SecureStore from 'expo-secure-store';

export const kvStore = {
  async getItem(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string) {
    await SecureStore.deleteItemAsync(key);
  },
};

