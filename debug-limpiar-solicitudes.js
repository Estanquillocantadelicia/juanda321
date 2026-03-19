
// 🔧 SCRIPT DE DEBUG - LIMPIAR SOLICITUDES Y SESIONES ATORADAS
// Ejecuta esto en la consola del navegador (F12 → Console)

// ========== FUNCIÓN 1: Limpiar TODAS las solicitudes (Admin) ==========
async function limpiarSolicitudesAtoradas() {
    try {
        console.log('🔍 Buscando todas las solicitudes...');
        
        const todasSolicitudes = await window.db.collection('solicitudes_edicion_precio').get();
        
        console.log(`📊 Total de solicitudes en la base de datos: ${todasSolicitudes.size}`);
        
        const solicitudesPorEstado = {};
        todasSolicitudes.docs.forEach(doc => {
            const data = doc.data();
            const estado = data.estado || 'sin-estado';
            
            if (!solicitudesPorEstado[estado]) {
                solicitudesPorEstado[estado] = [];
            }
            
            solicitudesPorEstado[estado].push({
                id: doc.id,
                vendedor: data.vendedor,
                carrito: data.carritoNombre,
                fecha: data.fechaSolicitud?.toDate().toLocaleString()
            });
        });
        
        console.log('📋 Solicitudes por estado:', solicitudesPorEstado);
        
        const pendientes = solicitudesPorEstado['pendiente'] || [];
        
        if (pendientes.length > 0) {
            console.log(`\n⚠️ Encontradas ${pendientes.length} solicitudes PENDIENTES:`);
            pendientes.forEach(s => {
                console.log(`   • ID: ${s.id}`);
                console.log(`     Vendedor: ${s.vendedor}`);
                console.log(`     Carrito: ${s.carrito}`);
                console.log(`     Fecha: ${s.fecha}\n`);
            });
            
            const confirmar = confirm(`¿Cancelar ${pendientes.length} solicitud(es) pendiente(s)?`);
            
            if (confirmar) {
                const batch = window.db.batch();
                
                pendientes.forEach(s => {
                    const ref = window.db.collection('solicitudes_edicion_precio').doc(s.id);
                    batch.update(ref, {
                        estado: 'cancelada',
                        fechaCancelacion: firebase.firestore.Timestamp.now(),
                        canceladaPor: window.authSystem?.currentUser?.uid || 'debug-script',
                        notasCancelacion: 'Cancelada por script de debug'
                    });
                });
                
                await batch.commit();
                console.log('✅ Solicitudes canceladas exitosamente');
                alert('✅ Solicitudes canceladas. Actualiza la página para ver los cambios.');
            } else {
                console.log('❌ Operación cancelada por el usuario');
            }
        } else {
            console.log('✅ No hay solicitudes pendientes para limpiar');
            alert('✅ No hay solicitudes pendientes');
        }
        
    } catch (error) {
        console.error('❌ Error en el script de limpieza:', error);
        alert('❌ Error: ' + error.message);
    }
}

// ========== FUNCIÓN 2: Resetear sesión del VENDEDOR ACTUAL (Vendedor) ==========
async function resetearMiSesionVendedor() {
    try {
        const userId = window.authSystem?.currentUser?.uid;
        const userName = window.authSystem?.currentUser?.nombre || 'Usuario';
        
        if (!userId) {
            alert('❌ Error: No estás autenticado');
            return;
        }
        
        console.log('🔍 Buscando sesiones y solicitudes del vendedor:', userName, '(', userId, ')');
        
        // 1. Desactivar TODAS las sesiones activas del vendedor
        const sesionesSnapshot = await window.db.collection('sesiones_precio_temporal')
            .where('vendedorId', '==', userId)
            .where('activo', '==', true)
            .get();
        
        console.log(`📊 Sesiones activas encontradas: ${sesionesSnapshot.size}`);
        
        // 2. Cancelar TODAS las solicitudes del vendedor (pendientes o aprobadas)
        const solicitudesSnapshot = await window.db.collection('solicitudes_edicion_precio')
            .where('vendedorId', '==', userId)
            .where('estado', 'in', ['pendiente', 'aprobada'])
            .get();
        
        console.log(`📊 Solicitudes activas encontradas: ${solicitudesSnapshot.size}`);
        
        if (sesionesSnapshot.empty && solicitudesSnapshot.empty) {
            console.log('✅ No hay sesiones ni solicitudes activas para este vendedor');
            alert('✅ Tu cuenta ya está limpia. No hay sesiones activas.');
            return;
        }
        
        const confirmar = confirm(
            `¿Resetear tu sesión de vendedor?\n\n` +
            `• Sesiones activas: ${sesionesSnapshot.size}\n` +
            `• Solicitudes activas: ${solicitudesSnapshot.size}\n\n` +
            `Esto desactivará el modo de edición de precios.`
        );
        
        if (!confirmar) {
            console.log('❌ Operación cancelada por el usuario');
            return;
        }
        
        const batch = window.db.batch();
        
        // Desactivar sesiones
        sesionesSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
                activo: false,
                fechaDesactivacion: firebase.firestore.Timestamp.now(),
                resetManual: true
            });
        });
        
        // Cancelar solicitudes
        solicitudesSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
                estado: 'cancelada',
                fechaCancelacion: firebase.firestore.Timestamp.now(),
                canceladaPor: userId,
                notasCancelacion: 'Reset manual de sesión'
            });
        });
        
        await batch.commit();
        
        console.log('✅ Sesión reseteada exitosamente');
        console.log(`   • ${sesionesSnapshot.size} sesiones desactivadas`);
        console.log(`   • ${solicitudesSnapshot.size} solicitudes canceladas`);
        
        // Resetear estado local del módulo de ventas
        if (window.ventasModule) {
            window.ventasModule.modoEdicionPreciosActivo = false;
            window.ventasModule.sesionActualId = null;
            window.ventasModule.solicitudPendiente = false;
            window.ventasModule.actualizarBotonEdicionPrecios();
            window.ventasModule.renderCarrito();
            console.log('✅ Módulo de ventas reseteado localmente');
        }
        
        alert('✅ Sesión reseteada exitosamente.\n\nActualiza la página para ver los cambios.');
        
    } catch (error) {
        console.error('❌ Error reseteando sesión:', error);
        alert('❌ Error: ' + error.message);
    }
}

// ========== FUNCIÓN 3: Ver estado actual del vendedor (Diagnóstico) ==========
async function verEstadoVendedor() {
    try {
        const userId = window.authSystem?.currentUser?.uid;
        const userName = window.authSystem?.currentUser?.nombre || 'Usuario';
        const userRole = window.authSystem?.currentUser?.rol || 'Sin rol';
        
        if (!userId) {
            console.log('❌ No estás autenticado');
            return;
        }
        
        console.log('👤 DIAGNÓSTICO DEL VENDEDOR');
        console.log('=================================');
        console.log('Nombre:', userName);
        console.log('ID:', userId);
        console.log('Rol:', userRole);
        console.log('');
        
        // Sesiones activas
        const sesionesSnapshot = await window.db.collection('sesiones_precio_temporal')
            .where('vendedorId', '==', userId)
            .get();
        
        console.log(`📊 SESIONES (${sesionesSnapshot.size} total):`);
        sesionesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`   • ID: ${doc.id}`);
            console.log(`     Activo: ${data.activo ? '✅ SÍ' : '❌ NO'}`);
            console.log(`     Creación: ${data.fechaCreacion?.toDate().toLocaleString()}`);
            console.log('');
        });
        
        // Solicitudes
        const solicitudesSnapshot = await window.db.collection('solicitudes_edicion_precio')
            .where('vendedorId', '==', userId)
            .get();
        
        console.log(`📋 SOLICITUDES (${solicitudesSnapshot.size} total):`);
        solicitudesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`   • ID: ${doc.id}`);
            console.log(`     Estado: ${data.estado}`);
            console.log(`     Carrito: ${data.carritoNombre}`);
            console.log(`     Fecha: ${data.fechaSolicitud?.toDate().toLocaleString()}`);
            console.log('');
        });
        
        // Estado local del módulo
        if (window.ventasModule) {
            console.log('💻 ESTADO LOCAL (módulo de ventas):');
            console.log(`   Modo edición activo: ${window.ventasModule.modoEdicionPreciosActivo ? '✅ SÍ' : '❌ NO'}`);
            console.log(`   Sesión actual ID: ${window.ventasModule.sesionActualId || 'Ninguna'}`);
            console.log(`   Solicitud pendiente: ${window.ventasModule.solicitudPendiente ? '✅ SÍ' : '❌ NO'}`);
        }
        
        console.log('=================================');
        
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
    }
}

// ========== AUTO-EJECUCIÓN ==========
console.log('🛠️ SCRIPTS DE DEBUG CARGADOS');
console.log('');
console.log('Funciones disponibles:');
console.log('  1. resetearMiSesionVendedor() - Limpia TU sesión de vendedor');
console.log('  2. verEstadoVendedor() - Ver diagnóstico completo');
console.log('  3. limpiarSolicitudesAtoradas() - Limpia TODAS las solicitudes (Admin)');
console.log('');
console.log('💡 Si eres VENDEDOR y tienes el modo edición atorado, ejecuta:');
console.log('   resetearMiSesionVendedor()');
