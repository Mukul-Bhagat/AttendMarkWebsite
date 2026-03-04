import { onMessage } from 'firebase/messaging';

import { appLogger } from '../shared/logger';
import { getMessagingInstance } from './firebase';

export const onMessageListener = async (
  callback: (payload: any) => void,
): Promise<(() => void) | null> => {
  const messaging = await getMessagingInstance();
  if (!messaging) {
    return null;
  }

  return onMessage(messaging, (payload) => {
    appLogger.info('[Foreground] Message received:', payload);
    callback(payload);
  });
};
