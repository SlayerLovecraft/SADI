import { Platform } from 'react-native';

export const storage =
  Platform.OS === 'web'
    ? require('./supabaseStorage.web').storage
    : require('./supabaseStorage.native').storage;

