
// Configuración de Firebase usando la versión compatible
const firebaseConfig = {
  apiKey: "AIzaSyCCX_Wh_TzzezEHHMq6Df0vOtYB_TQVkyE",
  authDomain: "app-estanquillo.firebaseapp.com",
  projectId: "app-estanquillo",
  storageBucket: "app-estanquillo.firebasestorage.app",
  messagingSenderId: "62033505434",
  appId: "1:62033505434:web:8d958ab7046cdb8c2c8323"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar Firestore
const db = firebase.firestore();

// Inicializar Authentication
const auth = firebase.auth();

// Hacer disponibles globalmente
window.db = db;
window.auth = auth;

console.log('Firebase inicializado correctamente');
