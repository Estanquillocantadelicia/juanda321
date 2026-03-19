
// 🔄 Script de migración de colecciones (ejecutar UNA sola vez)
const admin = require('firebase-admin');

// Inicializar Firebase Admin (usa tus credenciales)
const serviceAccount = require('./firebase-admin-key.json'); // Descárgalo de Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Mapeo: colección antigua → colección nueva (INGLÉS)
const MIGRACIONES = {
  'categorías': 'categories',
  'clientes': 'clients', 
  'proveedores': 'providers'
};

async function migrarColeccion(origen, destino) {
  console.log(`\n🔄 Migrando: ${origen} → ${destino}`);
  
  try {
    // 1. Leer todos los documentos del origen
    const snapshot = await db.collection(origen).get();
    
    if (snapshot.empty) {
      console.log(`⚠️ ${origen} está vacía, omitiendo...`);
      return;
    }
    
    console.log(`📦 Encontrados ${snapshot.size} documentos en ${origen}`);
    
    // 2. Copiar cada documento al destino
    const batch = db.batch();
    let count = 0;
    
    snapshot.forEach(doc => {
      const destinoRef = db.collection(destino).doc(doc.id);
      batch.set(destinoRef, doc.data(), { merge: true }); // merge evita sobreescribir
      count++;
    });
    
    // 3. Ejecutar la copia
    await batch.commit();
    console.log(`✅ ${count} documentos copiados a ${destino}`);
    
    // 4. OPCIONAL: Eliminar colección antigua (comentado por seguridad)
    // await eliminarColeccion(origen);
    
  } catch (error) {
    console.error(`❌ Error migrando ${origen}:`, error);
  }
}

async function eliminarColeccion(nombreColeccion) {
  console.log(`🗑️ Eliminando colección: ${nombreColeccion}`);
  
  const snapshot = await db.collection(nombreColeccion).get();
  const batch = db.batch();
  
  snapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`✅ ${nombreColeccion} eliminada`);
}

async function ejecutarMigracion() {
  console.log('🚀 INICIANDO MIGRACIÓN DE COLECCIONES...\n');
  
  for (const [origen, destino] of Object.entries(MIGRACIONES)) {
    await migrarColeccion(origen, destino);
  }
  
  console.log('\n✅ MIGRACIÓN COMPLETADA');
  console.log('⚠️ IMPORTANTE: Verifica que los datos estén correctos antes de eliminar las colecciones antiguas');
  
  process.exit(0);
}

ejecutarMigracion();
