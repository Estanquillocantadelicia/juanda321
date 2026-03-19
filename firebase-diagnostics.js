
// 🔍 Diagnóstico de Firebase - Verifica colecciones y estructura de datos
async function diagnosticarFirebase() {
    console.log('🔬 INICIANDO DIAGNÓSTICO DE FIREBASE...\n');
    
    // Lista de colecciones estándar (nombres reales en tu base de datos)
    const coleccionesPosibles = [
        'users',
        'clients',
        'products',
        'categories',
        'providers',
        'sales',
        'abonos',
        'cajas',
        'configuracion',
        'customPrices',
        'purchases',
        'notas_internas',
        'pagos'
    ];
    
    const resultado = {
        coleccionesEncontradas: [],
        coleccionesVacias: [],
        coleccionesNoExisten: []
    };
    
    for (const nombreColeccion of coleccionesPosibles) {
        try {
            const snapshot = await window.db.collection(nombreColeccion).limit(5).get();
            
            if (snapshot.empty) {
                resultado.coleccionesVacias.push(nombreColeccion);
                console.log(`⚠️ Colección "${nombreColeccion}" existe pero está VACÍA`);
            } else {
                resultado.coleccionesEncontradas.push({
                    nombre: nombreColeccion,
                    documentos: snapshot.size,
                    muestra: snapshot.docs.map(doc => ({
                        id: doc.id,
                        data: doc.data()
                    }))
                });
                console.log(`✅ Colección "${nombreColeccion}" encontrada con ${snapshot.size} documentos`);
                
                // Mostrar estructura del primer documento
                if (snapshot.docs.length > 0) {
                    console.log(`   📋 Estructura de ejemplo:`, snapshot.docs[0].data());
                }
            }
        } catch (error) {
            resultado.coleccionesNoExisten.push(nombreColeccion);
            console.log(`❌ Colección "${nombreColeccion}" NO EXISTE o no es accesible`);
        }
    }
    
    console.log('\n📊 RESUMEN DEL DIAGNÓSTICO:');
    console.log('='.repeat(60));
    console.log(`✅ Colecciones con datos: ${resultado.coleccionesEncontradas.length}`);
    console.log(`⚠️ Colecciones vacías: ${resultado.coleccionesVacias.length}`);
    console.log(`❌ Colecciones inexistentes: ${resultado.coleccionesNoExisten.length}`);
    console.log('='.repeat(60));
    
    console.log('\n📁 COLECCIONES ENCONTRADAS:');
    resultado.coleccionesEncontradas.forEach(col => {
        console.log(`   • ${col.nombre} (${col.documentos} documentos)`);
    });
    
    if (resultado.coleccionesVacias.length > 0) {
        console.log('\n⚠️ COLECCIONES VACÍAS:');
        resultado.coleccionesVacias.forEach(col => {
            console.log(`   • ${col}`);
        });
    }
    
    console.log('\n💡 RECOMENDACIONES:');
    
    // Detectar si están en español o inglés
    const tieneEspanol = resultado.coleccionesEncontradas.some(c => 
        ['usuarios', 'clientes', 'productos', 'categorias', 'proveedores', 'ventas', 'creditos'].includes(c.nombre)
    );
    
    const tieneIngles = resultado.coleccionesEncontradas.some(c => 
        ['users', 'clients', 'products', 'categories', 'providers', 'sales', 'credits'].includes(c.nombre)
    );
    
    if (tieneEspanol && !tieneIngles) {
        console.log('   ⚠️ Tus colecciones están en ESPAÑOL');
        console.log('   📝 Necesitas actualizar el código para usar nombres en español');
    } else if (tieneIngles && !tieneEspanol) {
        console.log('   ✅ Tus colecciones están en INGLÉS (correcto)');
        console.log('   📝 El código ya está configurado correctamente');
    } else if (tieneEspanol && tieneIngles) {
        console.log('   ⚠️ PROBLEMA: Tienes colecciones DUPLICADAS en español e inglés');
        console.log('   📝 Debes consolidar en un solo idioma');
    } else {
        console.log('   ❌ No se encontraron colecciones principales');
        console.log('   📝 Necesitas crear las colecciones en Firebase');
    }
    
    return resultado;
}

// Ejecutar diagnóstico automáticamente al cargar
if (window.db) {
    setTimeout(() => {
        diagnosticarFirebase();
    }, 2000);
}

// Hacer disponible globalmente
window.diagnosticarFirebase = diagnosticarFirebase;
