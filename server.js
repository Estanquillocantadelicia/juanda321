const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');
const ExcelJS = require('exceljs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(compression());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use(express.static(path.join(__dirname), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL PROFESIONAL — 3 hojas: Resumen, Historial, Detalle por Producto
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/descargar-historial-excel', async (req, res) => {
  try {
    const { ventas, periodo } = req.body;

    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
      return res.status(400).json({ error: 'No hay datos para descargar' });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'EstanquilloApp';
    wb.created = new Date();

    // ── Paleta de colores ──────────────────────────────────────────────────
    const C = {
      azulOscuro:  '1D3557',
      azulMedio:   '457B9D',
      azulClaro:   'A8D8EA',
      verdeBg:     'D4EDDA',
      verdeTexto:  '155724',
      rojoBg:      'F8D7DA',
      rojoTexto:   '721C24',
      amarilloBg:  'FFF3CD',
      amarilloText:'856404',
      grisClaro:   'F8F9FA',
      grisLinea:   'DEE2E6',
      blanco:      'FFFFFF',
      negro:       '212529',
    };

    // ── Helpers de estilo ──────────────────────────────────────────────────
    const fillSolid = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } });
    const fontWhiteBold = (sz = 11) => ({ color: { argb: 'FFFFFFFF' }, bold: true, size: sz, name: 'Calibri' });
    const fontDark = (sz = 10, bold = false) => ({ color: { argb: 'FF' + C.negro }, bold, size: sz, name: 'Calibri' });
    const borderThin = {
      top:    { style: 'thin', color: { argb: 'FF' + C.grisLinea } },
      bottom: { style: 'thin', color: { argb: 'FF' + C.grisLinea } },
      left:   { style: 'thin', color: { argb: 'FF' + C.grisLinea } },
      right:  { style: 'thin', color: { argb: 'FF' + C.grisLinea } },
    };
    const borderMedium = {
      top:    { style: 'medium', color: { argb: 'FF' + C.azulOscuro } },
      bottom: { style: 'medium', color: { argb: 'FF' + C.azulOscuro } },
      left:   { style: 'medium', color: { argb: 'FF' + C.azulOscuro } },
      right:  { style: 'medium', color: { argb: 'FF' + C.azulOscuro } },
    };
    const FMT_CURRENCY = '"$"#,##0.00';
    const FMT_PCT      = '0.00"%"';
    const alignCenter  = { horizontal: 'center', vertical: 'middle' };
    const alignRight   = { horizontal: 'right',  vertical: 'middle' };
    const alignLeft    = { horizontal: 'left',   vertical: 'middle' };

    // ── Cálculos globales ─────────────────────────────────────────────────
    const ventasActivas    = ventas.filter(v => v.estado !== 'cancelada');
    const ventasCanceladas = ventas.filter(v => v.estado === 'cancelada');
    const totalIngresos    = ventasActivas.reduce((s, v) => s + (v.total   || 0), 0);
    const totalCosto       = ventasActivas.reduce((s, v) => s + (v.costo   || 0), 0);
    const totalUtilidad    = ventasActivas.reduce((s, v) => s + (v.utilidad|| 0), 0);
    const margenGlobal     = totalIngresos > 0 ? (totalUtilidad / totalIngresos) * 100 : 0;
    const ticketPromedio   = ventasActivas.length > 0 ? totalIngresos / ventasActivas.length : 0;

    const agrupar = (campo) => ventasActivas.reduce((acc, v) => {
      const k = v[campo] || 'N/A';
      if (!acc[k]) acc[k] = { count: 0, total: 0, utilidad: 0 };
      acc[k].count++;
      acc[k].total    += v.total    || 0;
      acc[k].utilidad += v.utilidad || 0;
      return acc;
    }, {});

    const porTipo   = agrupar('tipoVenta');
    const porMetodo = agrupar('metodoPago');

    // ══════════════════════════════════════════════════════════════════════
    //  HOJA 1 — RESUMEN EJECUTIVO
    // ══════════════════════════════════════════════════════════════════════
    const wsR = wb.addWorksheet('📊 Resumen', { views: [{ showGridLines: false }] });
    wsR.properties.defaultColWidth = 18;

    wsR.columns = [
      { width: 30 },
      { width: 22 },
      { width: 22 },
      { width: 22 },
      { width: 22 },
    ];

    // Título principal
    wsR.mergeCells('A1:E1');
    const rT1 = wsR.getRow(1);
    rT1.height = 40;
    const cT1 = wsR.getCell('A1');
    cT1.value = '📊 REPORTE DE VENTAS — ESTANQUILLOAPP';
    cT1.font = { ...fontWhiteBold(18), name: 'Calibri' };
    cT1.fill = fillSolid(C.azulOscuro);
    cT1.alignment = alignCenter;

    wsR.mergeCells('A2:E2');
    const cPeriodo = wsR.getCell('A2');
    cPeriodo.value = `Período: ${periodo?.label || 'Todos los registros'}`;
    cPeriodo.font = { ...fontWhiteBold(11), name: 'Calibri' };
    cPeriodo.fill = fillSolid(C.azulMedio);
    cPeriodo.alignment = alignCenter;
    wsR.getRow(2).height = 24;

    wsR.mergeCells('A3:E3');
    const cGen = wsR.getCell('A3');
    cGen.value = `Generado: ${new Date().toLocaleString('es-MX')}`;
    cGen.font  = { color: { argb: 'FF' + C.azulMedio }, size: 9, name: 'Calibri' };
    cGen.fill  = fillSolid(C.grisClaro);
    cGen.alignment = alignCenter;
    wsR.getRow(3).height = 18;

    wsR.getRow(4).height = 10;

    // ── Métricas clave (tarjetas) ─────────────────────────────────────────
    const metricas = [
      ['VENTAS ACTIVAS',   ventasActivas.length, null,               C.azulOscuro],
      ['INGRESOS TOTALES', totalIngresos,        FMT_CURRENCY,       '2D6A4F'],
      ['COSTO TOTAL',      totalCosto,            FMT_CURRENCY,       '6D3B47'],
      ['UTILIDAD NETA',    totalUtilidad,         FMT_CURRENCY,       '1B4332'],
      ['MARGEN GLOBAL',    margenGlobal / 100,    '0.0"%"',           margenGlobal >= 30 ? '155724' : margenGlobal >= 15 ? '856404' : '721C24'],
    ];

    // Fila de etiquetas (fila 5)
    const rLbl = wsR.getRow(5);
    rLbl.height = 22;
    metricas.forEach(([lbl, , , clr], i) => {
      const col = String.fromCharCode(65 + i);
      const c = wsR.getCell(`${col}5`);
      c.value = lbl;
      c.font  = { ...fontWhiteBold(9) };
      c.fill  = fillSolid(clr);
      c.alignment = alignCenter;
      c.border = borderMedium;
    });

    // Fila de valores (fila 6)
    const rVal = wsR.getRow(6);
    rVal.height = 32;
    metricas.forEach(([, val, fmt, clr], i) => {
      const col = String.fromCharCode(65 + i);
      const c = wsR.getCell(`${col}6`);
      c.value = val;
      if (fmt) c.numFmt = fmt;
      c.font  = { bold: true, size: 14, name: 'Calibri', color: { argb: 'FF' + clr } };
      c.fill  = fillSolid(C.blanco);
      c.alignment = alignCenter;
      c.border = borderMedium;
    });

    wsR.getRow(7).height = 10;

    // Métricas secundarias (fila 8-9)
    const met2 = [
      ['TICKET PROMEDIO',    ticketPromedio,           FMT_CURRENCY, C.azulMedio],
      ['VENTAS CANCELADAS',  ventasCanceladas.length,  null,         '8B0000'],
      ['TOTAL TRANSACCIONES',ventas.length,            null,         C.azulOscuro],
    ];
    const rLbl2 = wsR.getRow(8);
    rLbl2.height = 20;
    const rVal2  = wsR.getRow(9);
    rVal2.height = 28;
    met2.forEach(([lbl, val, fmt, clr], i) => {
      const col = String.fromCharCode(65 + i);
      const cL = wsR.getCell(`${col}8`);
      cL.value = lbl;
      cL.font  = fontWhiteBold(9);
      cL.fill  = fillSolid(clr);
      cL.alignment = alignCenter;
      cL.border = borderThin;
      const cV = wsR.getCell(`${col}9`);
      cV.value = val;
      if (fmt) cV.numFmt = fmt;
      cV.font  = { bold: true, size: 13, name: 'Calibri', color: { argb: 'FF' + clr } };
      cV.fill  = fillSolid(C.grisClaro);
      cV.alignment = alignCenter;
      cV.border = borderThin;
    });

    wsR.getRow(10).height = 14;

    // ── Desglose por Tipo de Venta ─────────────────────────────────────────
    let row = 11;
    const addSubtitle = (label, r) => {
      wsR.mergeCells(`A${r}:E${r}`);
      const c = wsR.getCell(`A${r}`);
      c.value = label;
      c.font  = fontWhiteBold(11);
      c.fill  = fillSolid(C.azulMedio);
      c.alignment = alignLeft;
      c.border = borderThin;
      wsR.getRow(r).height = 24;
      return r + 1;
    };
    const addTableHeader = (cols, r) => {
      const rh = wsR.getRow(r);
      rh.height = 20;
      cols.forEach(({ lbl, col, align }) => {
        const c = wsR.getCell(`${col}${r}`);
        c.value = lbl;
        c.font  = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF' + C.azulOscuro } };
        c.fill  = fillSolid(C.azulClaro);
        c.alignment = align === 'right' ? alignRight : alignLeft;
        c.border = borderThin;
      });
      return r + 1;
    };

    row = addSubtitle('  📦 Desglose por Tipo de Venta', row);
    const colsTipo = [
      { lbl: 'Tipo de Venta', col: 'A', align: 'left' },
      { lbl: '# Ventas',      col: 'B', align: 'right' },
      { lbl: 'Ingresos',      col: 'C', align: 'right' },
      { lbl: 'Utilidad',      col: 'D', align: 'right' },
      { lbl: 'Margen %',      col: 'E', align: 'right' },
    ];
    row = addTableHeader(colsTipo, row);
    Object.entries(porTipo).sort((a,b) => b[1].total - a[1].total).forEach(([tipo, d], idx) => {
      const r = wsR.getRow(row);
      r.height = 20;
      const bg = idx % 2 === 0 ? C.blanco : C.grisClaro;
      const m  = d.total > 0 ? (d.utilidad / d.total) * 100 : 0;
      [['A', tipo, null, 'left'], ['B', d.count, null, 'right'],
       ['C', d.total, FMT_CURRENCY, 'right'], ['D', d.utilidad, FMT_CURRENCY, 'right'],
       ['E', m / 100, '0.0"%"', 'right']].forEach(([col, val, fmt, al]) => {
        const c = wsR.getCell(`${col}${row}`);
        c.value = val;
        if (fmt) c.numFmt = fmt;
        c.font  = fontDark(10);
        c.fill  = fillSolid(bg);
        c.alignment = al === 'right' ? alignRight : alignLeft;
        c.border = borderThin;
      });
      row++;
    });

    wsR.getRow(row).height = 10;
    row++;

    // ── Desglose por Método de Pago ────────────────────────────────────────
    row = addSubtitle('  💳 Desglose por Método de Pago', row);
    const colsMet = [
      { lbl: 'Método de Pago', col: 'A', align: 'left' },
      { lbl: '# Ventas',       col: 'B', align: 'right' },
      { lbl: 'Ingresos',       col: 'C', align: 'right' },
      { lbl: 'Utilidad',       col: 'D', align: 'right' },
      { lbl: 'Margen %',       col: 'E', align: 'right' },
    ];
    row = addTableHeader(colsMet, row);
    Object.entries(porMetodo).sort((a,b) => b[1].total - a[1].total).forEach(([met, d], idx) => {
      const r = wsR.getRow(row);
      r.height = 20;
      const bg = idx % 2 === 0 ? C.blanco : C.grisClaro;
      const m  = d.total > 0 ? (d.utilidad / d.total) * 100 : 0;
      [['A', met, null, 'left'], ['B', d.count, null, 'right'],
       ['C', d.total, FMT_CURRENCY, 'right'], ['D', d.utilidad, FMT_CURRENCY, 'right'],
       ['E', m / 100, '0.0"%"', 'right']].forEach(([col, val, fmt, al]) => {
        const c = wsR.getCell(`${col}${row}`);
        c.value = val;
        if (fmt) c.numFmt = fmt;
        c.font  = fontDark(10);
        c.fill  = fillSolid(bg);
        c.alignment = al === 'right' ? alignRight : alignLeft;
        c.border = borderThin;
      });
      row++;
    });

    // ══════════════════════════════════════════════════════════════════════
    //  HOJA 2 — HISTORIAL DETALLADO
    // ══════════════════════════════════════════════════════════════════════
    const wsH = wb.addWorksheet('📋 Historial', { views: [{ state: 'frozen', ySplit: 2, showGridLines: false }] });

    wsH.columns = [
      { header: '', key: 'folio',        width: 14 },
      { header: '', key: 'fecha',        width: 13 },
      { header: '', key: 'hora',         width: 10 },
      { header: '', key: 'dia',          width: 12 },
      { header: '', key: 'vendedor',     width: 18 },
      { header: '', key: 'cliente',      width: 20 },
      { header: '', key: 'tipoVenta',    width: 14 },
      { header: '', key: 'metodoPago',   width: 15 },
      { header: '', key: 'estado',       width: 13 },
      { header: '', key: 'nProductos',   width: 12 },
      { header: '', key: 'subtotal',     width: 14 },
      { header: '', key: 'descuento',    width: 12 },
      { header: '', key: 'total',        width: 14 },
      { header: '', key: 'costo',        width: 14 },
      { header: '', key: 'utilidad',     width: 14 },
      { header: '', key: 'margen',       width: 12 },
    ];

    // Fila de título
    wsH.mergeCells('A1:P1');
    const hT = wsH.getCell('A1');
    hT.value = `📋 HISTORIAL DETALLADO DE VENTAS — ${periodo?.label || 'Todos los registros'}`;
    hT.font  = fontWhiteBold(13);
    hT.fill  = fillSolid(C.azulOscuro);
    hT.alignment = alignCenter;
    wsH.getRow(1).height = 30;

    // Fila de cabeceras
    const HEADERS_H = [
      'Folio','Fecha','Hora','Día','Vendedor','Cliente',
      'Tipo Venta','Método Pago','Estado','# Productos',
      'Subtotal','Descuento','Total','Costo','Utilidad','Margen %'
    ];
    const rH2 = wsH.getRow(2);
    rH2.height = 22;
    HEADERS_H.forEach((h, i) => {
      const c = wsH.getCell(2, i + 1);
      c.value = h;
      c.font  = fontWhiteBold(10);
      c.fill  = fillSolid(C.azulMedio);
      c.alignment = i >= 10 ? alignRight : alignCenter;
      c.border = borderThin;
    });

    // Filas de datos
    const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    ventas.forEach((v, idx) => {
      const rNum = idx + 3;
      const r    = wsH.getRow(rNum);
      r.height   = 19;

      const cancelada = v.estado === 'cancelada';
      const bg = cancelada
        ? C.rojoBg
        : idx % 2 === 0 ? C.blanco : C.grisClaro;

      const margen = v.total > 0 ? (v.utilidad / v.total) * 100 : 0;

      const vals = [
        v.folio, v.fecha, v.hora, v.dia,
        v.vendedor, v.cliente,
        v.tipoVenta, v.metodoPago, v.estado,
        v.nProductos,
        v.subtotal, v.descuento, v.total, v.costo, v.utilidad,
        margen / 100,
      ];
      const fmts = [
        null, null, null, null, null, null,
        null, null, null, null,
        FMT_CURRENCY, FMT_CURRENCY, FMT_CURRENCY, FMT_CURRENCY, FMT_CURRENCY,
        '0.0"%"',
      ];
      const aligns = [
        'center','center','center','center','left','left',
        'center','center','center','center',
        'right','right','right','right','right','right',
      ];

      vals.forEach((val, i) => {
        const cell = wsH.getCell(rNum, i + 1);
        cell.value = val;
        if (fmts[i]) cell.numFmt = fmts[i];
        cell.font  = {
          ...fontDark(10, false),
          ...(cancelada ? { color: { argb: 'FF' + C.rojoTexto }, italic: true } : {}),
        };
        cell.fill  = fillSolid(bg);
        cell.alignment = { horizontal: aligns[i], vertical: 'middle' };
        cell.border = borderThin;
      });

      // Colorear celda Estado
      const cEstado = wsH.getCell(rNum, 9);
      if (v.estado === 'completada') {
        cEstado.fill = fillSolid(C.verdeBg);
        cEstado.font = { ...fontDark(10, true), color: { argb: 'FF' + C.verdeTexto } };
      } else if (v.estado === 'cancelada') {
        cEstado.fill = fillSolid(C.rojoBg);
        cEstado.font = { ...fontDark(10, true), color: { argb: 'FF' + C.rojoTexto } };
      }

      // Colorear margen
      const cMargen = wsH.getCell(rNum, 16);
      if (!cancelada) {
        if (margen >= 30) {
          cMargen.font = { ...fontDark(10, true), color: { argb: 'FF155724' } };
        } else if (margen >= 15) {
          cMargen.font = { ...fontDark(10, true), color: { argb: 'FF856404' } };
        } else {
          cMargen.font = { ...fontDark(10, true), color: { argb: 'FF721C24' } };
        }
      }
    });

    // Fila de totales
    const totRow = ventas.length + 3;
    const rTot   = wsH.getRow(totRow);
    rTot.height  = 24;
    const totales = [
      'TOTALES', '', '', '', '', '', '', '', '',
      ventasActivas.reduce((s, v) => s + (v.nProductos || 0), 0),
      ventasActivas.reduce((s, v) => s + (v.subtotal || 0), 0),
      ventasActivas.reduce((s, v) => s + (v.descuento || 0), 0),
      totalIngresos,
      totalCosto,
      totalUtilidad,
      margenGlobal / 100,
    ];
    const totFmts = [null, null, null, null, null, null, null, null, null,
      null, FMT_CURRENCY, FMT_CURRENCY, FMT_CURRENCY, FMT_CURRENCY, FMT_CURRENCY, '0.0"%"'];
    totales.forEach((val, i) => {
      const c = wsH.getCell(totRow, i + 1);
      c.value = val;
      if (totFmts[i]) c.numFmt = totFmts[i];
      c.font  = fontWhiteBold(11);
      c.fill  = fillSolid(C.azulOscuro);
      c.alignment = i >= 10 ? alignRight : alignCenter;
      c.border = borderMedium;
    });

    wsH.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 16 } };

    // ══════════════════════════════════════════════════════════════════════
    //  HOJA 3 — DETALLE POR PRODUCTO
    // ══════════════════════════════════════════════════════════════════════
    const wsP = wb.addWorksheet('🛍️ Por Producto', { views: [{ state: 'frozen', ySplit: 2, showGridLines: false }] });

    wsP.columns = [
      { width: 14 }, // Folio
      { width: 13 }, // Fecha
      { width: 18 }, // Vendedor
      { width: 20 }, // Cliente
      { width: 26 }, // Producto
      { width: 15 }, // Tipo
      { width: 10 }, // Cantidad
      { width: 14 }, // Precio Unit.
      { width: 14 }, // Costo Unit.
      { width: 14 }, // Subtotal
      { width: 14 }, // Utilidad
      { width: 12 }, // Margen %
    ];

    wsP.mergeCells('A1:L1');
    const pT = wsP.getCell('A1');
    pT.value = `🛍️ DETALLE POR PRODUCTO — ${periodo?.label || 'Todos los registros'}`;
    pT.font  = fontWhiteBold(13);
    pT.fill  = fillSolid(C.azulOscuro);
    pT.alignment = alignCenter;
    wsP.getRow(1).height = 30;

    const HEADERS_P = ['Folio','Fecha','Vendedor','Cliente','Producto','Tipo','Cantidad','Precio Unit.','Costo Unit.','Subtotal','Utilidad','Margen %'];
    const rP2 = wsP.getRow(2);
    rP2.height = 22;
    HEADERS_P.forEach((h, i) => {
      const c = wsP.getCell(2, i + 1);
      c.value = h;
      c.font  = fontWhiteBold(10);
      c.fill  = fillSolid(C.azulMedio);
      c.alignment = i >= 6 ? alignRight : alignCenter;
      c.border = borderThin;
    });

    let pRow = 3;
    let pTotSubtotal = 0, pTotUtilidad = 0;
    ventas.forEach((v) => {
      const items = v.items || [];
      if (items.length === 0) {
        // Venta sin items detallados: agregar fila resumen
        const r = wsP.getRow(pRow);
        r.height = 19;
        const bg = v.estado === 'cancelada' ? C.rojoBg : (pRow % 2 === 0 ? C.blanco : C.grisClaro);
        const rowVals = [v.folio, v.fecha, v.vendedor, v.cliente, '(sin desglose)', '—', '—', '—', '—', v.total, v.utilidad, '—'];
        rowVals.forEach((val, i) => {
          const c = wsP.getCell(pRow, i + 1);
          c.value = val;
          c.font  = fontDark(10);
          c.fill  = fillSolid(bg);
          c.alignment = i >= 6 ? alignRight : alignLeft;
          c.border = borderThin;
        });
        pTotSubtotal += v.total || 0;
        pTotUtilidad += v.utilidad || 0;
        pRow++;
        return;
      }

      items.forEach((item, iIdx) => {
        const r   = wsP.getRow(pRow);
        r.height  = 19;
        const bg  = v.estado === 'cancelada' ? C.rojoBg : (pRow % 2 === 0 ? C.blanco : C.grisClaro);
        const subtotalItem = (item.precioUnitario || 0) * (item.cantidad || 1);
        const costoItem    = (item.costo || 0) * (item.cantidad || 1);
        const utilItem     = subtotalItem - costoItem;
        const margenItem   = subtotalItem > 0 ? (utilItem / subtotalItem) * 100 : 0;

        const rowVals = [
          iIdx === 0 ? v.folio : '',
          iIdx === 0 ? v.fecha : '',
          iIdx === 0 ? v.vendedor : '',
          iIdx === 0 ? v.cliente : '',
          item.nombre,
          item.tipo,
          item.cantidad,
          item.precioUnitario,
          item.costo,
          subtotalItem,
          utilItem,
          margenItem / 100,
        ];
        const pFmts = [null, null, null, null, null, null, null, FMT_CURRENCY, FMT_CURRENCY, FMT_CURRENCY, FMT_CURRENCY, '0.0"%"'];
        const pAligns = ['center','center','left','left','left','center','center','right','right','right','right','right'];

        rowVals.forEach((val, i) => {
          const c = wsP.getCell(pRow, i + 1);
          c.value = val;
          if (pFmts[i]) c.numFmt = pFmts[i];
          c.font  = fontDark(10);
          c.fill  = fillSolid(bg);
          c.alignment = { horizontal: pAligns[i], vertical: 'middle' };
          c.border = borderThin;
        });

        // Colorear margen
        const cPMar = wsP.getCell(pRow, 12);
        if (v.estado !== 'cancelada') {
          if (margenItem >= 30) {
            cPMar.font = { ...fontDark(10, true), color: { argb: 'FF155724' } };
          } else if (margenItem >= 15) {
            cPMar.font = { ...fontDark(10, true), color: { argb: 'FF856404' } };
          } else {
            cPMar.font = { ...fontDark(10, true), color: { argb: 'FF721C24' } };
          }
        }

        if (v.estado !== 'cancelada') {
          pTotSubtotal += subtotalItem;
          pTotUtilidad += utilItem;
        }
        pRow++;
      });
    });

    // Fila de totales productos
    const pTotR = wsP.getRow(pRow);
    pTotR.height = 24;
    const pTotVals = ['TOTALES', '', '', '', '', '', '', '', '', pTotSubtotal, pTotUtilidad,
      pTotSubtotal > 0 ? (pTotUtilidad / pTotSubtotal) : 0];
    const pTotFmts = [null, null, null, null, null, null, null, null, null, FMT_CURRENCY, FMT_CURRENCY, '0.0"%"'];
    pTotVals.forEach((val, i) => {
      const c = wsP.getCell(pRow, i + 1);
      c.value = val;
      if (pTotFmts[i]) c.numFmt = pTotFmts[i];
      c.font  = fontWhiteBold(11);
      c.fill  = fillSolid(C.azulOscuro);
      c.alignment = i >= 9 ? alignRight : alignCenter;
      c.border = borderMedium;
    });

    wsP.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 12 } };

    // ── Enviar archivo ─────────────────────────────────────────────────────
    const periodTag = (periodo?.label || 'completo').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const fechaTag  = new Date().toISOString().slice(0, 10);
    const filename  = `Ventas_${periodTag}_${fechaTag}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await wb.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generando Excel:', error);
    res.status(500).json({ error: 'Error al generar el archivo Excel: ' + error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
//  INVENTARIO — Exportar Excel
// ══════════════════════════════════════════════════════════════════════
app.post('/api/descargar-inventario-excel', async (req, res) => {
  try {
    const { filas, filtrosActivos = {} } = req.body;
    if (!Array.isArray(filas) || filas.length === 0) {
      return res.status(400).json({ error: 'No hay datos para exportar' });
    }

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'EstanquilloApp';
    wb.created = new Date();

    const fmt = (n) => typeof n === 'number' ? n : 0;
    const pct = (n) => typeof n === 'number' ? n : 0;

    // ── Colores ──────────────────────────────────────────────────────
    const C = {
      headerBg:    '1D6A3B',
      headerFg:    'FFFFFF',
      subHeaderBg: '34C759',
      subHeaderFg: 'FFFFFF',
      simple:      'F0FFF4',
      variante:    'E8F4FD',
      conversion:  'FFF8E7',
      opcion:      'F5F5F7',
      totalBg:     'E8F5E9',
      alertaBaja:  'FFF3CD',
      alertaAgot:  'FFE5E5',
      resumenBg:   'F0FFF4',
    };

    const money = { numFmt: '"$"#,##0.00' };
    const pctFmt = { numFmt: '0.0"%"' };
    const bold = (txt, size = 11) => ({ value: txt, style: { font: { bold: true, size } } });

    // ════════════════════════════════════════════════════════════════
    //  HOJA 1 — RESUMEN
    // ════════════════════════════════════════════════════════════════
    const wsR = wb.addWorksheet('📊 Resumen', { views: [{ showGridLines: false }] });
    wsR.properties.defaultColWidth = 20;
    wsR.columns = [{ width: 32 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }];

    const addTitleR = (txt, cols = 5, bg = C.headerBg, fg = C.headerFg, sz = 14) => {
      const r = wsR.addRow([txt]);
      wsR.mergeCells(r.number, 1, r.number, cols);
      Object.assign(r.getCell(1), {
        font: { bold: true, size: sz, color: { argb: fg } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } },
        alignment: { horizontal: 'center', vertical: 'middle' },
      });
      r.height = sz === 14 ? 36 : 24;
    };

    // Totales generales
    const totalProductos = filas.length;
    const valInvCosto    = filas.reduce((s, f) => s + fmt(f.valorInventarioCosto), 0);
    const valInvPublico  = filas.reduce((s, f) => s + fmt(f.valorInventarioPublico), 0);
    const bajosStock     = filas.filter(f => f.estadoStock === 'bajo').length;
    const agotados       = filas.filter(f => f.estadoStock === 'agotado').length;
    const totalUnidades  = filas.reduce((s, f) => s + fmt(f.stockActual), 0);

    addTitleR('EstanquilloApp — Reporte de Inventario', 5, C.headerBg, C.headerFg, 14);
    const fechaRow = wsR.addRow([`Generado: ${new Date().toLocaleString('es-MX')}   |   Filtros: ${Object.entries(filtrosActivos).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') || 'Ninguno'}`]);
    wsR.mergeCells(fechaRow.number, 1, fechaRow.number, 5);
    fechaRow.getCell(1).alignment = { horizontal: 'center' };
    fechaRow.getCell(1).font = { color: { argb: '6E6E73' }, italic: true, size: 10 };
    wsR.addRow([]);

    // KPIs
    addTitleR('Indicadores Clave', 5, C.subHeaderBg, C.subHeaderFg, 11);
    const kpiHeader = wsR.addRow(['Indicador', 'Valor']);
    kpiHeader.eachCell(c => {
      c.font = { bold: true, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      c.alignment = { horizontal: 'center' };
    });
    const kpis = [
      ['SKUs en reporte', totalProductos],
      ['Total unidades en stock', totalUnidades],
      ['Valor inventario (costo)', valInvCosto],
      ['Valor inventario (precio público)', valInvPublico],
      ['Ganancia potencial', valInvPublico - valInvCosto],
      ['Productos stock bajo', bajosStock],
      ['Productos agotados', agotados],
    ];
    kpis.forEach(([label, val]) => {
      const r = wsR.addRow([label, val]);
      r.getCell(1).font = { size: 10 };
      r.getCell(1).alignment = { horizontal: 'left' };
      if (typeof val === 'number' && label.toLowerCase().includes('valor') || label.toLowerCase().includes('ganancia')) {
        r.getCell(2).numFmt = '"$"#,##0.00';
      }
      r.getCell(2).alignment = { horizontal: 'right' };
    });
    wsR.addRow([]);

    // Por categoría
    const byCategoria = {};
    filas.forEach(f => {
      const k = f.categoria || '(Sin categoría)';
      if (!byCategoria[k]) byCategoria[k] = { unidades: 0, valorCosto: 0, valorPublico: 0, skus: 0 };
      byCategoria[k].unidades  += fmt(f.stockActual);
      byCategoria[k].valorCosto  += fmt(f.valorInventarioCosto);
      byCategoria[k].valorPublico+= fmt(f.valorInventarioPublico);
      byCategoria[k].skus++;
    });
    addTitleR('Desglose por Categoría', 5, C.subHeaderBg, C.subHeaderFg, 11);
    const cHead = wsR.addRow(['Categoría', 'SKUs', 'Unidades', 'Valor Costo', 'Valor Público']);
    cHead.eachCell(c => {
      c.font = { bold: true, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      c.alignment = { horizontal: 'center' };
    });
    Object.entries(byCategoria).sort((a, b) => b[1].valorCosto - a[1].valorCosto).forEach(([cat, d]) => {
      const r = wsR.addRow([cat, d.skus, d.unidades, d.valorCosto, d.valorPublico]);
      r.getCell(4).numFmt = '"$"#,##0.00';
      r.getCell(5).numFmt = '"$"#,##0.00';
      r.getCell(1).alignment = { horizontal: 'left' };
      [2,3,4,5].forEach(i => r.getCell(i).alignment = { horizontal: 'right' });
    });
    wsR.addRow([]);

    // Por tipo
    const byTipo = {};
    filas.forEach(f => {
      const k = f.tipo || 'simple';
      if (!byTipo[k]) byTipo[k] = { skus: 0, unidades: 0, valorCosto: 0 };
      byTipo[k].skus++;
      byTipo[k].unidades  += fmt(f.stockActual);
      byTipo[k].valorCosto  += fmt(f.valorInventarioCosto);
    });
    addTitleR('Desglose por Tipo de Producto', 5, C.subHeaderBg, C.subHeaderFg, 11);
    const tHead = wsR.addRow(['Tipo', 'SKUs', 'Unidades', 'Valor Costo', '']);
    tHead.eachCell(c => {
      c.font = { bold: true, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      c.alignment = { horizontal: 'center' };
    });
    const tipoLabels = { simple: 'Simple', variante: 'Con Variantes', conversion: 'Con Conversión' };
    Object.entries(byTipo).forEach(([tipo, d]) => {
      const r = wsR.addRow([tipoLabels[tipo] || tipo, d.skus, d.unidades, d.valorCosto]);
      r.getCell(4).numFmt = '"$"#,##0.00';
      r.getCell(1).alignment = { horizontal: 'left' };
      [2,3,4].forEach(i => r.getCell(i).alignment = { horizontal: 'right' });
    });

    // ════════════════════════════════════════════════════════════════
    //  HOJA 2 — INVENTARIO DETALLADO
    // ════════════════════════════════════════════════════════════════
    const wsD = wb.addWorksheet('📦 Inventario Detallado', { views: [{ showGridLines: false }] });
    wsD.properties.defaultColWidth = 16;
    wsD.columns = [
      { header: 'Producto',          key: 'nombre',              width: 32 },
      { header: 'Tipo',              key: 'tipo',                width: 14 },
      { header: 'Variante / Conv.',  key: 'variante',            width: 20 },
      { header: 'Opción',            key: 'opcion',              width: 16 },
      { header: 'Categoría',         key: 'categoria',           width: 20 },
      { header: 'Proveedor',         key: 'proveedor',           width: 20 },
      { header: 'Stock Actual',      key: 'stockActual',         width: 14 },
      { header: 'Stock Mínimo',      key: 'stockMinimo',         width: 14 },
      { header: 'Estado Stock',      key: 'estadoStock',         width: 14 },
      { header: 'Costo Unitario',    key: 'precioCosto',         width: 16 },
      { header: 'Precio Público',    key: 'precioPublico',       width: 16 },
      { header: 'Precio Mayorista',  key: 'precioMayorista',     width: 16 },
      { header: '% Margen Público',  key: 'margenPublico',       width: 16 },
      { header: '% Margen May.',     key: 'margenMayorista',     width: 16 },
      { header: 'Valor Inv. Costo',  key: 'valorInventarioCosto',width: 18 },
      { header: 'Valor Inv. Público',key: 'valorInventarioPublico',width: 18 },
    ];

    // Título + cabecera
    wsD.insertRow(1, ['EstanquilloApp — Inventario Detallado']);
    wsD.mergeCells('A1:P1');
    const titleCell = wsD.getCell('A1');
    titleCell.value = 'EstanquilloApp — Inventario Detallado';
    titleCell.font = { bold: true, size: 14, color: { argb: C.headerFg } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsD.getRow(1).height = 36;

    const headerRow = wsD.getRow(2);
    headerRow.values = wsD.columns.map(c => c.header);
    headerRow.height = 24;
    headerRow.eachCell(c => {
      c.font = { bold: true, size: 10, color: { argb: C.headerFg } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.subHeaderBg } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = { bottom: { style: 'thin', color: { argb: 'CCCCCC' } } };
    });

    // Datos
    filas.forEach((f, i) => {
      const r = wsD.addRow({
        nombre:               f.nombre || '',
        tipo:                 { simple: 'Simple', variante: 'Variante', conversion: 'Conversión' }[f.tipo] || f.tipo,
        variante:             f.variante || '',
        opcion:               f.opcion || '',
        categoria:            f.categoria || '',
        proveedor:            f.proveedor || '',
        stockActual:          fmt(f.stockActual),
        stockMinimo:          fmt(f.stockMinimo),
        estadoStock:          f.estadoStock === 'agotado' ? 'Agotado' : f.estadoStock === 'bajo' ? 'Stock Bajo' : 'Normal',
        precioCosto:          fmt(f.precioCosto),
        precioPublico:        fmt(f.precioPublico),
        precioMayorista:      fmt(f.precioMayorista),
        margenPublico:        pct(f.margenPublico),
        margenMayorista:      pct(f.margenMayorista),
        valorInventarioCosto: fmt(f.valorInventarioCosto),
        valorInventarioPublico: fmt(f.valorInventarioPublico),
      });

      // Color de fila según tipo y estado stock
      let bg = i % 2 === 0 ? 'FFFFFF' : 'F9F9FB';
      if (f.estadoStock === 'agotado') bg = C.alertaAgot;
      else if (f.estadoStock === 'bajo') bg = C.alertaBaja;
      else if (f.tipo === 'variante')    bg = f.variante ? C.variante : 'FFFFFF';
      else if (f.tipo === 'conversion')  bg = f.variante ? C.conversion : 'FFFFFF';

      r.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.font = { size: 10 };
        c.alignment = { vertical: 'middle' };
        c.border = { bottom: { style: 'hair', color: { argb: 'ECECEC' } } };
      });

      // Formatos numéricos
      ['precioCosto','precioPublico','precioMayorista','valorInventarioCosto','valorInventarioPublico'].forEach(k => {
        const col = wsD.columns.find(c => c.key === k);
        if (col) r.getCell(wsD.columns.indexOf(col) + 1).numFmt = '"$"#,##0.00';
      });
      const colMargenPub  = wsD.columns.findIndex(c => c.key === 'margenPublico') + 1;
      const colMargenMay  = wsD.columns.findIndex(c => c.key === 'margenMayorista') + 1;
      r.getCell(colMargenPub).numFmt  = '0.0"%"';
      r.getCell(colMargenMay).numFmt  = '0.0"%"';

      // Alineaciones
      [7,8,10,11,12,13,14,15,16].forEach(ci => {
        r.getCell(ci).alignment = { horizontal: 'right', vertical: 'middle' };
      });
      r.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Fila de totales
    const totalRow = wsD.addRow({
      nombre:               'TOTALES',
      stockActual:          filas.reduce((s, f) => s + fmt(f.stockActual), 0),
      valorInventarioCosto: filas.reduce((s, f) => s + fmt(f.valorInventarioCosto), 0),
      valorInventarioPublico: filas.reduce((s, f) => s + fmt(f.valorInventarioPublico), 0),
    });
    totalRow.eachCell(c => {
      c.font = { bold: true, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalBg } };
      c.alignment = { horizontal: 'right', vertical: 'middle' };
    });
    totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    const tValCosto  = wsD.columns.findIndex(c => c.key === 'valorInventarioCosto') + 1;
    const tValPub    = wsD.columns.findIndex(c => c.key === 'valorInventarioPublico') + 1;
    totalRow.getCell(tValCosto).numFmt  = '"$"#,##0.00';
    totalRow.getCell(tValPub).numFmt    = '"$"#,##0.00';

    wsD.autoFilter = { from: 'A2', to: `P2` };

    // ── Respuesta ──────────────────────────────────────────────────
    const fechaTag = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="Inventario_${fechaTag}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await wb.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generando Excel inventario:', error);
    res.status(500).json({ error: 'Error al generar el archivo Excel: ' + error.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: true, message: err.message || 'Error interno del servidor' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, HOST, () => console.log(`Servidor corriendo en http://${HOST}:${PORT}`));
}

module.exports = app;
