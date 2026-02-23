import { onMessage } from "firebase/messaging";
import { messaging } from "./firebase";

import { appLogger } from '../shared/logger';
export const onMessageListener = () =>
    new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            appLogger.info('[Foreground] Message received:', payload);
            resolve(payload);
        });
    });
