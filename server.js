const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');
const XLSX = require('xlsx');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(compression());
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos sin cache (express.static maneja sus propias cabeceras)
app.use(express.static(path.join(__dirname), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Endpoint para descargar historial en Excel
app.post('/api/descargar-historial-excel', (req, res) => {
  try {
    const { datos } = req.body;
    
    if (!datos || !Array.isArray(datos) || datos.length === 0) {
      return res.status(400).json({ error: 'No hay datos para descargar' });
    }

    // Crear workbook y worksheet
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial de Ventas');

    // Calcular sumas
    const totalVentas = datos.reduce((sum, row) => sum + (parseFloat(row.Total) || 0), 0);
    const totalUtilidad = datos.reduce((sum, row) => sum + (parseFloat(row.Utilidad) || 0), 0);

    // Agregar fila vacía y fila de totales
    const lastRow = datos.length + 2;
    ws[`A${lastRow}`] = { v: 'TOTALES', t: 's', s: { bold: true, fill: { fgColor: { rgb: 'FFFF00' } } } };
    ws[`H${lastRow}`] = { v: totalVentas, t: 'n', z: '$#,##0.00', s: { bold: true, fill: { fgColor: { rgb: 'FFFF00' } } } };
    ws[`I${lastRow}`] = { v: totalUtilidad, t: 'n', z: '$#,##0.00', s: { bold: true, fill: { fgColor: { rgb: 'FFFF00' } } } };

    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 12 }, // Folio
      { wch: 12 }, // Fecha
      { wch: 12 }, // Hora
      { wch: 15 }, // Vendedor
      { wch: 20 }, // Cliente
      { wch: 15 }, // Tipo Venta
      { wch: 15 }, // Cantidad Productos
      { wch: 12 }, // Total
      { wch: 12 }, // Utilidad
      { wch: 15 }, // Método Pago
      { wch: 12 }  // Estado
    ];

    // Generar archivo
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Enviar archivo
    const ahora = new Date();
    const nombreArchivo = `Historial_Ventas_${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    console.error('Error generando Excel:', error);
    res.status(500).json({ error: 'Error al generar el archivo Excel' });
  }
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Error interno del servidor'
  });
});

// Iniciar servidor
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, HOST, () => {
    console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
  });
}

module.exports = app;
