
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

// Activar persistencia offline (cache local en IndexedDB)
// Esto reduce drásticamente las lecturas de Firestore: los documentos ya leídos
// se guardan en el dispositivo y solo se descargan los cambios nuevos.
db.enablePersistence({ synchronizeTabs: true })
  .then(() => console.log('✅ Firestore offline persistence activada'))
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('⚠️ Persistencia no disponible (múltiples pestañas abiertas)');
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ Persistencia no soportada en este navegador');
    }
  });

// Inicializar Authentication
const auth = firebase.auth();

// Hacer disponibles globalmente
window.db = db;
window.auth = auth;

console.log('Firebase inicializado correctamente');
