import { Platform } from 'react-native';

export const kvStore =
  Platform.OS === 'web'
    ? require('./kvStore.web').kvStore
    : require('./kvStore.native').kvStore;

