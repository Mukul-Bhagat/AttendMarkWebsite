import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
    apiKey: "AIzaSyBoWv3-BdwtrO4ljkF2N03tUrm-V_vmf7A",
    authDomain: "attend-mark.firebaseapp.com",
    projectId: "attend-mark",
    messagingSenderId: "408522161876",
    appId: "1:408522161876:web:dcc248b159912e64280541",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const messaging = getMessaging(firebaseApp);
