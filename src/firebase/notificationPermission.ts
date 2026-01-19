import { getToken } from "firebase/messaging";
import { messaging } from "./firebase";

// 🔑 VAPID Key Configuration
// TODO: Replace with your actual VAPID key from Firebase Console
// Steps to get VAPID key:
// 1. Go to Firebase Console: https://console.firebase.google.com/
// 2. Select your project (attend-mark)
// 3. Go to Project Settings (gear icon) → Cloud Messaging tab
// 4. Scroll to "Web Push certificates"
// 5. Generate a new key pair or use existing public key
// 6. Copy the "Key pair" value and paste it below

const VAPID_KEY = "BN7pMjGDXpjNjyzcpHCH4EIPsY1lvOQqodGtaKattO-BgEXiDGAdx7VzQBQxfgjZ8tfJ0zDFkTkUopWD2hY4KlE";

export const requestNotificationPermission = async () => {
    try {
        console.log('Requesting notification permission...');

        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);

        if (permission !== "granted") {
            console.log("Notification permission denied");
            return null;
        }

        console.log('Getting FCM token...');
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
        });

        console.log("✅ FCM Token generated:", token);
        return token;
    } catch (error) {
        console.error("Error getting FCM token:", error);
        return null;
    }
};
