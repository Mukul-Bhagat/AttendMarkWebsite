importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyBoWv3-BdwtrO4ljkF2N03tUrm-V_vmf7A",
    authDomain: "attend-mark.firebaseapp.com",
    projectId: "attend-mark",
    messagingSenderId: "408522161876",
    appId: "1:408522161876:web:dcc248b159912e64280541",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    self.registration.showNotification(payload.notification.title, {
        body: payload.notification.body,
        icon: "/notification-icon.png",
    });
});
