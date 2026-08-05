import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/socket';
import AI from './Admin/AdminIcons';
import { logSystem } from '../utils/systemLogger';
import ExcelJS from 'exceljs';
import {
  FaClipboardList, FaDollarSign, FaChartBar, FaHamburger,
  FaCalendarDay, FaHistory, FaSync, FaSearch,
  FaTrophy, FaLightbulb, FaTruck, FaChair, FaShoppingBag,
  FaUser, FaPhone, FaMapMarkerAlt, FaTimes, FaEye,
  FaFileInvoiceDollar, FaInfoCircle, FaArrowUp, FaArrowDown,
  FaFileExcel, FaFilter, FaDownload, FaChevronLeft, FaChevronRight,
  FaWhatsapp, FaMobileAlt, FaCashRegister, FaMoneyBillWave,
  FaCalendarWeek
} from 'react-icons/fa';

// Estilo premium por tipo de insight de IA
const AI_INSIGHT_STYLES = {
  success: { wrap: 'bg-emerald-50/70 border-emerald-200', chip: 'from-emerald-500 to-teal-600', Icon: FaTrophy },
  good:    { wrap: 'bg-blue-50/70 border-blue-200',       chip: 'from-blue-500 to-indigo-600',  Icon: FaArrowUp },
  warning: { wrap: 'bg-amber-50/70 border-amber-200',     chip: 'from-amber-500 to-orange-600', Icon: FaInfoCircle },
  info:    { wrap: 'bg-slate-50 border-slate-200',        chip: 'from-slate-400 to-slate-500',  Icon: FaLightbulb },
};

function EnhancedCompletedOrders() {
  const [completedOrders, setCompletedOrders] = useState([]);
  const [allTimeOrders, setAllTimeOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const { businessConfig, businessId } = useBusinessConfig();
  const isHotel = businessConfig?.businessType === 'hotel';
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalAmount: 0,
    ordersByType: {
      inSite: { count: 0, total: 0 },
      takeaway: { count: 0, total: 0 },
      delivery: { count: 0, total: 0 }
    }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showNoOrdersModal, setShowNoOrdersModal] = useState(false);
  const [viewMode, setViewMode] = useState('today');
  const [topSellingItems, setTopSellingItems] = useState([]);
  const [insights, setInsights] = useState([]);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterOrderType, setFilterOrderType] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination for history
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  // Stats agregados del rango completo (modo historial), calculados por el backend
  // sobre TODO el filtro, no solo la página actual. null = backend aún no los
  // envía (versión vieja) → el frontend cae al cálculo sobre la página.
  const [rangeStats, setRangeStats] = useState(null);
  const PAGE_SIZE = 50;

  // Análisis de ventas con IA (Groq)
  const [aiInsights, setAiInsights] = useState([]);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsError, setAiInsightsError] = useState(null);
  const [aiInsightsGenerated, setAiInsightsGenerated] = useState(false);

  // Export states
  const [exportingExcel, setExportingExcel] = useState(false);

  // Separate loading for data refreshes (filters) vs initial load
  const [refreshing, setRefreshing] = useState(false);
  const isInitialLoad = useRef(true);

  // Fetch completed orders for today
  const fetchCompletedOrders = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await api.post('/orders/daily-closing', { 
        businessId: businessId
      });
      
      if (response.data && response.data.orders) {
        setCompletedOrders(response.data.orders);
        
        if (response.data.stats) {
          setStats(response.data.stats);
          setTopSellingItems(response.data.stats.topSellingItems || []);
          generateInsights(response.data.stats, response.data.orders);
        }
      } else {
        setCompletedOrders([]);
        setStats({
          totalOrders: 0,
          totalAmount: 0,
          ordersByType: {
            inSite: { count: 0, total: 0 },
            takeaway: { count: 0, total: 0 },
            delivery: { count: 0, total: 0 }
          }
        });
        setTopSellingItems([]);
        setInsights([]);
      }
      
      setError(null);
    } catch (err) {
      logSystem('Error fetching completed orders: ' + err.message, 'error');
      setError('No se pudieron cargar los pedidos completados');
      setCompletedOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch all completed orders (for historical view) with filters + pagination
  const fetchAllCompletedOrders = useCallback(async (page = 1, isRefresh = false) => {
    if (viewMode !== 'all') return;
    if (isRefresh || !isInitialLoad.current) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({
        businessId,
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
      });
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      if (filterOrderType) params.append('orderType', filterOrderType);
      if (filterChannel) params.append('orderChannel', filterChannel);
      if (filterPayment) params.append('paymentMethod', filterPayment);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const response = await api.get(`/orders/completed?${params.toString()}`);
      if (response.data?.orders) {
        setAllTimeOrders(response.data.orders);
        setCurrentPage(response.data.pagination?.current || 1);
        setTotalPages(response.data.pagination?.total || 1);
        setTotalOrders(response.data.pagination?.totalOrders || response.data.orders.length);
        if (response.data.stats) setRangeStats(response.data.stats);
      } else if (Array.isArray(response.data)) {
        setAllTimeOrders(response.data);
        setTotalPages(1);
        setTotalOrders(response.data.length);
      }
      setError(null);
    } catch (err) {
      logSystem('Error fetching all completed orders: ' + err.message, 'error');
      setError('No se pudieron cargar el historial');
    } finally {
      setLoading(false);
      setRefreshing(false);
      isInitialLoad.current = false;
    }
  }, [businessId, dateFrom, dateTo, filterOrderType, filterChannel, filterPayment, searchTerm, viewMode]);

  // --- Export: Excel (.xlsx) with formatting ---
  const exportExcel = async () => {
    setExportingExcel(true);
    try {
      // Use loaded data directly when in 'today' mode
      let orders;
      if (viewMode === 'today') {
        orders = completedOrders;
      } else {
        /* Se pide por lotes de 1.000, que es el tope real del servidor. Antes
           se pedía limit=10000 de una: el backend lo recortaba en silencio a
           1.000 y el Excel salía incompleto —con los totales de las hojas de
           resumen mal, porque se calculan sumando las filas exportadas— sin
           que nada lo advirtiera. */
        const BATCH = 1000;
        const MAX_BATCHES = 50; // 50.000 pedidos: tope de cordura, no se cuelga
        orders = [];
        for (let page = 1; page <= MAX_BATCHES; page++) {
          const params = new URLSearchParams({ businessId, limit: String(BATCH), page: String(page) });
          if (dateFrom) params.append('from', dateFrom);
          if (dateTo) params.append('to', dateTo);
          if (filterOrderType) params.append('orderType', filterOrderType);
          if (filterChannel) params.append('orderChannel', filterChannel);
          if (filterPayment) params.append('paymentMethod', filterPayment);
          if (searchTerm.trim()) params.append('search', searchTerm.trim());

          // eslint-disable-next-line no-await-in-loop
          const response = await api.get(`/orders/completed?${params.toString()}`, { timeout: 60000 });
          const batch = response.data?.orders || (Array.isArray(response.data) ? response.data : []);
          orders.push(...batch);

          const totalPagesResp = response.data?.pagination?.total;
          if (batch.length < BATCH || (totalPagesResp && page >= totalPagesResp)) break;

          if (page === MAX_BATCHES) {
            alert(`El rango supera los ${MAX_BATCHES * BATCH} pedidos. Se exportaron los ${orders.length} más recientes; acota las fechas para el resto.`);
          }
        }
      }

      if (!orders || orders.length === 0) {
        alert('No hay pedidos para exportar');
        return;
      }

      const orderTypeLabel = (t) => t === 'delivery' ? 'Domicilio' : t === 'takeaway' ? 'Para llevar' : 'En sitio';
      const channelLabel = (c) => c === 'pos' ? 'POS' : c === 'inapp' ? 'In-App' : 'WhatsApp';
      const paymentLabel = (p) => {
        const map = { cash: 'Efectivo', efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', transfer: 'Transferencia', transferencia: 'Transferencia', other: 'Otro' };
        return map[p] || p || 'N/A';
      };

      const wb = new ExcelJS.Workbook();
      wb.creator = businessConfig?.businessName || 'MenuBy';
      wb.created = new Date();

      const ws = wb.addWorksheet('Pedidos', { views: [{ state: 'frozen', ySplit: 3 }] });

      const brandColor = 'FF2563EB';
      const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandColor } };
      const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      const borderStyle = { style: 'thin', color: { argb: 'FFD1D5DB' } };
      const allBorders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
      const currencyFormat = '"$"#,##0';

      // Title
      ws.mergeCells('A1:Q1');
      const titleCell = ws.getCell('A1');
      titleCell.value = `${businessConfig?.businessName || 'Reporte'} — Pedidos Completados`;
      titleCell.font = { bold: true, size: 16, color: { argb: brandColor } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 32;

      // Subtitle with active filters
      ws.mergeCells('A2:Q2');
      const subtitleCell = ws.getCell('A2');
      const dateLabel = viewMode === 'today'
        ? new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
        : `${dateFrom || '—'} a ${dateTo || '—'}`;
      const activeFilterParts = [];
      if (filterOrderType) activeFilterParts.push(`Tipo: ${orderTypeLabel(filterOrderType)}`);
      if (filterChannel) activeFilterParts.push(`Canal: ${channelLabel(filterChannel)}`);
      if (filterPayment) activeFilterParts.push(`Pago: ${paymentLabel(filterPayment)}`);
      if (searchTerm.trim()) activeFilterParts.push(`Búsqueda: "${searchTerm.trim()}"`);
      const filtersText = activeFilterParts.length > 0 ? `  |  Filtros: ${activeFilterParts.join(', ')}` : '';
      subtitleCell.value = `Fecha: ${dateLabel}  |  Total: ${orders.length} pedidos${filtersText}  |  Generado: ${new Date().toLocaleString('es-CO')}`;
      subtitleCell.font = { size: 10, color: { argb: 'FF6B7280' }, italic: true };
      subtitleCell.alignment = { horizontal: 'center' };
      ws.getRow(2).height = 20;

      // Headers
      const headers = ['# Pedido', 'Fecha', 'Hora', 'Cliente', 'Teléfono', 'Tipo', 'Canal', 'Método de Pago', 'Mesa/Hab', 'Dirección', 'Domiciliario', 'Productos', 'Cant. Items', 'Subtotal', 'Descuento', 'Envío', 'Total'];
      const headerRow = ws.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = allBorders;
      });
      headerRow.height = 24;

      ws.columns = [
        { width: 10 }, { width: 13 }, { width: 8 }, { width: 22 }, { width: 15 },
        { width: 13 }, { width: 11 }, { width: 15 }, { width: 10 }, { width: 25 },
        { width: 18 }, { width: 40 }, { width: 10 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 14 },
      ];

      const typeColors = { 'En sitio': 'FFDBEAFE', 'Para llevar': 'FFFEF3C7', 'Domicilio': 'FFF3E8FF' };

      // Data rows
      orders.forEach((o, idx) => {
        const date = new Date(o.completedAt || o.createdAt);
        const itemsSummary = (o.items || []).map(i => `${i.quantity}x ${i.name}`).join('\n');
        const totalItems = (o.items || []).reduce((s, i) => s + i.quantity, 0);
        const typeLabel = orderTypeLabel(o.orderType);
        const domiName = o.deliveryPersonId?.name || '';

        const row = ws.addRow([
          o.orderNumber,
          date.toLocaleDateString('es-CO'),
          date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          o.customerName || '', o.phone || '', typeLabel, channelLabel(o.orderChannel),
          paymentLabel(o.paymentMethod), o.tableNumber || '', o.address || '',
          domiName,
          itemsSummary, totalItems,
          o.totalAmount || 0, o.discountAmount || 0, o.deliveryFee || 0, o.finalAmount || o.totalAmount || 0,
        ]);

        const rowFill = idx % 2 === 0
          ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
          : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

        row.eachCell((cell, colNumber) => {
          cell.border = allBorders;
          cell.fill = rowFill;
          cell.alignment = { vertical: 'middle', wrapText: colNumber === 12 };
          if ([14, 15, 16, 17].includes(colNumber)) {
            cell.numFmt = currencyFormat;
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }
          if ([1, 2, 3, 6, 7, 9, 11, 13].includes(colNumber)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });

        const typeCell = row.getCell(6);
        if (typeColors[typeLabel]) {
          typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: typeColors[typeLabel] } };
        }
        row.height = Math.max(18, (itemsSummary.split('\n').length) * 14);
      });

      // Summary
      ws.addRow([]);
      const totalRevenue = orders.reduce((s, o) => s + (o.finalAmount || o.totalAmount || 0), 0);
      const totalDiscount = orders.reduce((s, o) => s + (o.discountAmount || 0), 0);
      const totalDeliveryFees = orders.reduce((s, o) => s + (o.deliveryFee || 0), 0);
      const avgTicket = totalRevenue / (orders.length || 1);

      const summaryHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      const summaryFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      const sRow = ws.lastRow.number + 1;
      ws.mergeCells(`A${sRow}:D${sRow}`);
      const shCell = ws.getCell(`A${sRow}`);
      shCell.value = 'RESUMEN';
      shCell.fill = summaryHeaderFill;
      shCell.font = summaryFont;
      shCell.alignment = { horizontal: 'center', vertical: 'middle' };
      shCell.border = allBorders;
      ['B', 'C', 'D'].forEach(c => { ws.getCell(`${c}${sRow}`).border = allBorders; });
      ws.getRow(sRow).height = 24;

      const summaryLabelFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      [['Total Pedidos', orders.length], ['Ventas Totales', totalRevenue], ['Ticket Promedio', avgTicket], ['Total Descuentos', totalDiscount], ['Total Envíos', totalDeliveryFees]].forEach(([label, value]) => {
        const r = ws.addRow([label, '', '', value]);
        ws.mergeCells(`A${r.number}:C${r.number}`);
        r.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } };
        r.getCell(1).fill = summaryLabelFill;
        r.getCell(1).border = allBorders;
        r.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        ['B', 'C'].forEach(c => { ws.getCell(`${c}${r.number}`).fill = summaryLabelFill; ws.getCell(`${c}${r.number}`).border = allBorders; });
        const valCell = r.getCell(4);
        valCell.font = { bold: true, size: 12, color: { argb: 'FF059669' } };
        valCell.border = allBorders;
        valCell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (label !== 'Total Pedidos') valCell.numFmt = currencyFormat;
      });

      // Helper: styled breakdown sheet
      const addBreakdownSheet = (sheetName, groupTitle, entries) => {
        const s = wb.addWorksheet(sheetName);
        s.columns = [{ width: 22 }, { width: 14 }, { width: 14 }, { width: 18 }];
        const h = s.addRow([groupTitle, 'Cantidad', '% Pedidos', 'Total']);
        h.eachCell((cell) => { cell.fill = headerFill; cell.font = headerFont; cell.border = allBorders; cell.alignment = { horizontal: 'center', vertical: 'middle' }; });
        h.height = 24;
        entries.forEach(([label, count, total], idx) => {
          const pct = orders.length > 0 ? ((count / orders.length) * 100).toFixed(1) + '%' : '0%';
          const r = s.addRow([label, count, pct, total]);
          r.eachCell((cell, col) => {
            cell.border = allBorders;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF' } };
            if (col === 2 || col === 3) cell.alignment = { horizontal: 'center' };
            if (col === 4) { cell.numFmt = currencyFormat; cell.alignment = { horizontal: 'right' }; }
          });
        });
        const tr = s.addRow(['TOTAL', orders.length, '100%', totalRevenue]);
        tr.eachCell((cell, col) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
          cell.font = { bold: true, size: 11 };
          cell.border = allBorders;
          if (col === 2 || col === 3) cell.alignment = { horizontal: 'center' };
          if (col === 4) { cell.numFmt = currencyFormat; cell.alignment = { horizontal: 'right' }; }
        });
      };

      // Sheet 2: Por Tipo
      const typeCounts = { 'En sitio': { count: 0, total: 0 }, 'Para llevar': { count: 0, total: 0 }, 'Domicilio': { count: 0, total: 0 } };
      orders.forEach(o => { const l = orderTypeLabel(o.orderType); if (typeCounts[l]) { typeCounts[l].count++; typeCounts[l].total += (o.finalAmount || o.totalAmount || 0); } });
      addBreakdownSheet('Por Tipo', 'Tipo de Pedido', Object.entries(typeCounts).map(([k, v]) => [k, v.count, v.total]));

      // Sheet 3: Por Canal
      const channelCounts = {};
      orders.forEach(o => {
        const ch = channelLabel(o.orderChannel);
        if (!channelCounts[ch]) channelCounts[ch] = { count: 0, total: 0 };
        channelCounts[ch].count++;
        channelCounts[ch].total += (o.finalAmount || o.totalAmount || 0);
      });
      addBreakdownSheet('Por Canal', 'Canal', Object.entries(channelCounts).map(([k, v]) => [k, v.count, v.total]));

      // Sheet 4: Por Método de Pago
      const payCounts = {};
      orders.forEach(o => {
        const pm = paymentLabel(o.paymentMethod);
        if (!payCounts[pm]) payCounts[pm] = { count: 0, total: 0 };
        payCounts[pm].count++;
        payCounts[pm].total += (o.finalAmount || o.totalAmount || 0);
      });
      addBreakdownSheet('Por Pago', 'Método de Pago', Object.entries(payCounts).map(([k, v]) => [k, v.count, v.total]));

      // Sheet 5: Top Productos
      const prodCounts = {};
      orders.forEach(o => {
        (o.items || []).forEach(item => {
          if (!prodCounts[item.name]) prodCounts[item.name] = { count: 0, total: 0 };
          prodCounts[item.name].count += item.quantity;
          prodCounts[item.name].total += (item.price || 0) * item.quantity;
        });
      });
      const topProducts = Object.entries(prodCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 30);
      if (topProducts.length > 0) {
        const ws5 = wb.addWorksheet('Top Productos');
        ws5.columns = [{ width: 6 }, { width: 30 }, { width: 12 }, { width: 18 }];
        const h5 = ws5.addRow(['#', 'Producto', 'Uds Vendidas', 'Ventas']);
        h5.eachCell((cell) => { cell.fill = headerFill; cell.font = headerFont; cell.border = allBorders; cell.alignment = { horizontal: 'center', vertical: 'middle' }; });
        h5.height = 24;
        topProducts.forEach(([name, d], idx) => {
          const r = ws5.addRow([idx + 1, name, d.count, d.total]);
          r.eachCell((cell, col) => {
            cell.border = allBorders;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF' } };
            if (col === 1 || col === 3) cell.alignment = { horizontal: 'center' };
            if (col === 4) { cell.numFmt = currencyFormat; cell.alignment = { horizontal: 'right' }; }
          });
          // Medal colors for top 3
          if (idx < 3) {
            const medalColors = ['FFFEF3C7', 'FFE5E7EB', 'FFFFEDD5'];
            r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: medalColors[idx] } };
            r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: medalColors[idx] } };
          }
        });
      }

      // Download
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = viewMode === 'today' ? new Date().toISOString().split('T')[0] : `${dateFrom || 'inicio'}_${dateTo || 'fin'}`;
      link.href = url;
      link.download = `Pedidos_${businessConfig?.businessName || 'reporte'}_${dateStr}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      logSystem('Error exporting Excel: ' + err.message, 'error');
      alert('Error al exportar Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  // Quick date presets
  const applyDatePreset = (preset) => {
    const now = new Date();
    // Fecha LOCAL (zona del navegador = Colombia), NO UTC. toISOString() daría
    // la fecha UTC y de noche adelantaría el día (ej. 8pm COL -> día siguiente).
    const toStr = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const today = toStr(now);
    switch (preset) {
      case 'today': {
        setDateFrom(today);
        setDateTo(today);
        break;
      }
      case 'yesterday': {
        const d = new Date(now); d.setDate(d.getDate() - 1);
        setDateFrom(toStr(d));
        setDateTo(toStr(d));
        break;
      }
      case 'week': {
        const d = new Date(now); d.setDate(d.getDate() - 7);
        setDateFrom(toStr(d));
        setDateTo(today);
        break;
      }
      case 'month': {
        const d = new Date(now); d.setMonth(d.getMonth() - 1);
        setDateFrom(toStr(d));
        setDateTo(today);
        break;
      }
      case 'year': {
        const d = new Date(now); d.setFullYear(d.getFullYear() - 1);
        setDateFrom(toStr(d));
        setDateTo(today);
        break;
      }
      default: break;
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilterOrderType('');
    setFilterChannel('');
    setFilterPayment('');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
  };

  const hasActiveFilters = filterOrderType || filterChannel || filterPayment || dateFrom || dateTo;

  // Genera insights de ventas con IA sobre el rango actual (o el día en modo hoy)
  const fetchAiInsights = async () => {
    setAiInsightsLoading(true);
    setAiInsightsError(null);
    try {
      const body = { businessId };
      if (viewMode === 'all') {
        if (dateFrom) body.from = dateFrom;
        if (dateTo) body.to = dateTo;
      } else {
        const now = new Date();
        const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        body.from = d;
        body.to = d;
      }
      const res = await api.post('/ai-tools/sales-insights', body);
      const list = res.data?.insights || [];
      setAiInsights(list);
      setAiInsightsGenerated(true);
      if (list.length === 0) setAiInsightsError(res.data?.message || 'No hay suficientes datos para generar el análisis.');
    } catch (err) {
      const status = err?.response?.status;
      setAiInsightsError(
        status === 403 ? 'Tu plan actual no incluye herramientas IA.' :
        status === 429 ? 'Demasiadas solicitudes. Intenta en un minuto.' :
        status === 503 ? 'Servicio de IA no disponible.' :
        'No se pudo generar el análisis.'
      );
    } finally {
      setAiInsightsLoading(false);
    }
  };

  // Generate insights and recommendations
  const generateInsights = (stats, orders) => {
    const newInsights = [];
    
    // Insight 1: Total sales performance
    if (stats.totalSales > 0) {
      if (stats.totalSales > 1000000) {
        newInsights.push({
          type: 'success',
          icon: 'trophy',
          title: '¡Excelente día!',
          message: `Has generado $${stats.totalSales.toLocaleString()} en ventas. ¡Sigue así!`,
          recommendation: 'Considera ofrecer promociones especiales para mantener este momentum.'
        });
      } else if (stats.totalSales > 500000) { // > $500K COP
        newInsights.push({
          type: 'good',
          icon: 'up',
          title: 'Buen día de ventas',
          message: `Has generado $${stats.totalSales.toLocaleString()} en ventas.`,
          recommendation: 'Podrías mejorar promocionando tus productos más populares.'
        });
      } else {
        newInsights.push({
          type: 'info',
          icon: 'lightbulb',
          title: 'Oportunidad de mejora',
          message: `Has generado $${stats.totalSales.toLocaleString()} en ventas.`,
          recommendation: 'Considera ofrecer combos o promociones para aumentar el ticket promedio.'
        });
      }
    }

    // Insight 2: Order type analysis
    const totalOrders = stats.ordersByType.inSite.count + stats.ordersByType.takeaway.count + stats.ordersByType.delivery.count;
    if (totalOrders > 0) {
      const deliveryPercentage = (stats.ordersByType.delivery.count / totalOrders) * 100;
      if (deliveryPercentage > 60) {
        newInsights.push({
          type: 'info',
          icon: 'truck',
          title: 'Alto volumen de delivery',
          message: `${deliveryPercentage.toFixed(1)}% de tus pedidos son a domicilio.`,
          recommendation: 'Considera optimizar tus rutas de delivery o implementar un sistema de delivery propio.'
        });
      }
    }

    // Insight 3: Average order value
    const avgOrderValue = stats.totalSales / (stats.totalOrders || 1);
    if (avgOrderValue > 50000) {
      newInsights.push({
        type: 'success',
        icon: 'dollar',
        title: 'Ticket promedio excelente',
        message: `Tu ticket promedio es de $${avgOrderValue.toLocaleString()}.`,
        recommendation: '¡Excelente! Los clientes están comprando productos de alto valor.'
      });
    } else if (avgOrderValue < 25000) {
      newInsights.push({
        type: 'warning',
        icon: 'chart',
        title: 'Oportunidad de aumentar ticket promedio',
        message: `Tu ticket promedio es de $${avgOrderValue.toLocaleString()}.`,
        recommendation: 'Ofrece combos, bebidas o postres para aumentar el valor por pedido.'
      });
    }

    // Insight 4: Top selling items
    if (topSellingItems.length > 0) {
      const topItem = topSellingItems[0];
      newInsights.push({
        type: 'success',
        icon: 'trophy',
        title: 'Producto estrella',
        message: `"${topItem.name}" es tu producto más vendido con ${topItem.count} unidades.`,
        recommendation: 'Asegúrate de tener suficiente stock y considera crear variaciones de este producto.'
      });
    }

    // Insight 5: Time-based insights
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 12 && hour <= 14) {
      newInsights.push({
        type: 'info',
        icon: 'food',
        title: 'Hora pico del almuerzo',
        message: 'Estás en la hora pico del almuerzo.',
        recommendation: 'Asegúrate de tener suficiente personal y productos preparados.'
      });
    } else if (hour >= 18 && hour <= 20) {
      newInsights.push({
        type: 'info',
        icon: 'food',
        title: 'Hora pico de la cena',
        message: 'Estás en la hora pico de la cena.',
        recommendation: 'Prepara tu cocina para el aumento de pedidos.'
      });
    }

    setInsights(newInsights);
  };

  // Effect to load orders when businessId changes
  useEffect(() => {
    if (!businessId) return;
    
    if (viewMode === 'today') {
      fetchCompletedOrders();
    } else {
      fetchAllCompletedOrders(1);
    }
    
    // Socket connection for real-time updates
    if (socket && !socket.connected) {
      socket.connect();
    }
    
    if (socket) {
      socket.emit('joinBusiness', businessId);
      
      socket.on('order_updated', (updatedOrder) => {
        if (updatedOrder.status === 'completed') {
          if (viewMode === 'today') fetchCompletedOrders();
          else fetchAllCompletedOrders(currentPage);
        }
      });
    }
    
    return () => {
      if (socket) {
        socket.off('order_updated');
      }
    };
  }, [businessId, viewMode]);

  // Re-fetch history when filters change (debounced for search)
  useEffect(() => {
    if (viewMode !== 'all' || !businessId) return;
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchAllCompletedOrders(1, true);
    }, searchTerm ? 400 : 0);
    return () => clearTimeout(timer);
  }, [dateFrom, dateTo, filterOrderType, filterChannel, filterPayment, searchTerm]);

  // Show order details
  const showOrderDetails = (order) => {
    setSelectedOrder(order);
    setOrderDetails(order);
  };

  // Generate daily closing report (view only, no deletion)
  const generateDailyClosingReport = async () => {
    try {
      setGeneratingReport(true);
      await fetchCompletedOrders();
      logSystem('Reporte de cierre del día generado correctamente', 'info');
    } catch (err) {
      logSystem('Error generating daily closing report: ' + err.message, 'error');
      let errorMessage = 'Error al generar el reporte de cierre diario';
      if (err.response) {
        if (err.response.status === 404) {
          setShowNoOrdersModal(true);
          return;
        } else if (err.response.data && err.response.data.message) {
          errorMessage = `Error: ${err.response.data.message}`;
        }
      } else if (err.request) {
        errorMessage = 'No se recibió respuesta del servidor. Verifica tu conexión.';
      }
      alert(errorMessage);
    } finally {
      setGeneratingReport(false);
    }
  };

  // Filter orders based on search term and view mode
  // For "today" mode: client-side filter. For "all" mode: server-side (already filtered).
  const getFilteredOrders = () => {
    if (viewMode === 'all') return allTimeOrders;
    return completedOrders.filter(order => 
      searchTerm 
        ? (order.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.orderNumber.toString().includes(searchTerm)
        : true
    );
  };

  // Order Details Modal
  const OrderDetailsModal = () => {
    if (!selectedOrder) return null;
    
    const formattedDate = selectedOrder.completedAt 
      ? new Date(selectedOrder.completedAt).toLocaleString('es-ES', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      : new Date(selectedOrder.createdAt).toLocaleString('es-ES', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
          {/* Modal header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pedido #{selectedOrder.orderNumber}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{formattedDate}</p>
            </div>
            <button
              onClick={() => { setSelectedOrder(null); setOrderDetails(null); }}
              className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Customer info */}
            <div className="bg-slate-50 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Cliente</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <FaUser className="text-slate-400 text-xs" />
                  <span>{selectedOrder.customerName || 'No especificado'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <FaPhone className="text-slate-400 text-xs" />
                  <span>{selectedOrder.phone || 'No especificado'}</span>
                </div>
                {selectedOrder.orderType === 'delivery' && (
                  <div className="col-span-2 flex items-center gap-2 text-slate-700">
                    <FaMapMarkerAlt className="text-slate-400 text-xs" />
                    <span>{selectedOrder.address}</span>
                  </div>
                )}
                {selectedOrder.orderType === 'delivery' && selectedOrder.deliveryPersonId?.name && (
                  <div className="col-span-2 flex items-center gap-2 text-slate-700">
                    <FaTruck className="text-slate-400 text-xs" />
                    <span>Domiciliario: <strong>{selectedOrder.deliveryPersonId.name}</strong></span>
                  </div>
                )}
                {selectedOrder.tableNumber && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <FaChair className="text-slate-400 text-xs" />
                    <span>{isHotel ? 'Hab.' : 'Mesa'} #{selectedOrder.tableNumber}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    selectedOrder.orderType === 'delivery' ? 'bg-purple-100 text-purple-700' :
                    selectedOrder.orderType === 'takeaway' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {selectedOrder.orderType === 'delivery' ? 'Delivery' :
                     selectedOrder.orderType === 'takeaway' ? 'Para llevar' : 'En sitio'}
                  </span>
                </div>
              </div>
            </div>

            {/* Products */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Productos</h3>
              <div className="space-y-2">
                {selectedOrder.items && selectedOrder.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {item.quantity}x {item.name}
                      </p>
                      {item.selectedToppings && item.selectedToppings.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {item.selectedToppings.flatMap((topping, idx) => {
                            const items = [];
                            if (topping.optionName) {
                              items.push(
                                <p key={`t-${idx}`} className="text-xs text-slate-500">
                                  + {topping.groupName}: {topping.optionName}
                                  {topping.price > 0 && ` (+$${topping.price.toLocaleString()})`}
                                </p>
                              );
                            }
                            if (topping.subGroups) {
                              topping.subGroups.forEach((sg, si) => {
                                items.push(
                                  <p key={`s-${idx}-${si}`} className="text-xs text-orange-600 pl-2">
                                    + {sg.subGroupTitle}: {sg.optionName}
                                    {sg.price > 0 && ` (+$${sg.price.toLocaleString()})`}
                                  </p>
                                );
                              });
                            }
                            return items;
                          })}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-slate-700 tabular-nums">
                      ${(item.price * item.quantity).toLocaleString('es-CO')}
                    </span>
                  </div>
                ))}
              </div>
              {/* Desglose: antes el "Total" mostraba totalAmount, que son solo
                  los productos, así que en los domicilios no cuadraba con el
                  cobro real de la tabla. El total es finalAmount. */}
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
                {(selectedOrder.deliveryFee > 0 || selectedOrder.discountAmount > 0 || selectedOrder.tipAmount > 0) && (
                  <div className="flex justify-between items-center text-sm text-slate-600">
                    <span>Subtotal</span>
                    <span className="tabular-nums">${(selectedOrder.totalAmount || 0).toLocaleString('es-CO')}</span>
                  </div>
                )}
                {selectedOrder.deliveryFee > 0 && (
                  <div className="flex justify-between items-center text-sm text-slate-600">
                    <span>Domicilio{selectedOrder.deliveryZoneName ? ` (${selectedOrder.deliveryZoneName})` : ''}</span>
                    <span className="tabular-nums">${selectedOrder.deliveryFee.toLocaleString('es-CO')}</span>
                  </div>
                )}
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between items-center text-sm text-emerald-600">
                    <span>Descuento{selectedOrder.couponCode ? ` (${selectedOrder.couponCode})` : ''}</span>
                    <span className="tabular-nums">-${selectedOrder.discountAmount.toLocaleString('es-CO')}</span>
                  </div>
                )}
                {selectedOrder.tipAmount > 0 && (
                  <div className="flex justify-between items-center text-sm text-slate-600">
                    <span>Propina</span>
                    <span className="tabular-nums">${selectedOrder.tipAmount.toLocaleString('es-CO')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                  <span className="text-sm font-semibold text-slate-900">Total</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    ${(selectedOrder.finalAmount || selectedOrder.totalAmount || 0).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Insight icon resolver
  const getInsightIcon = (iconKey) => {
    const iconMap = {
      trophy: <FaTrophy />,
      up: <FaArrowUp />,
      lightbulb: <FaLightbulb />,
      truck: <FaTruck />,
      dollar: <FaDollarSign />,
      chart: <FaChartBar />,
      food: <FaHamburger />,
    };
    return iconMap[iconKey] || <FaLightbulb />;
  };

  // Top Selling Items Component
  const TopSellingItems = () => {
    if (topSellingItems.length === 0) return null;

    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FaTrophy className="text-amber-500 text-sm" />
          <h3 className="text-sm font-semibold text-slate-800">{isService ? 'Servicios Más Solicitados' : 'Productos Más Vendidos'}</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {topSellingItems.slice(0, 5).map((item, index) => (
            <div key={index} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  index === 0 ? 'bg-amber-100 text-amber-700' :
                  index === 1 ? 'bg-slate-200 text-slate-600' :
                  index === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.count} uds</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-700">${item.total.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Insights Component
  const InsightsSection = () => {
    if (insights.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <FaLightbulb className="text-amber-500 text-xs" />
          <h3 className="text-sm font-semibold text-slate-800">Insights</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {insights.map((insight, index) => (
            <div key={index} className={`flex items-start gap-3 p-3 rounded-lg border ${
              insight.type === 'success' ? 'bg-emerald-50 border-emerald-200' :
              insight.type === 'warning' ? 'bg-amber-50 border-amber-200' :
              insight.type === 'good' ? 'bg-blue-50 border-blue-200' :
              'bg-slate-50 border-slate-200'
            }`}>
              <span className={`mt-0.5 text-sm ${
                insight.type === 'success' ? 'text-emerald-500' :
                insight.type === 'warning' ? 'text-amber-500' :
                insight.type === 'good' ? 'text-blue-500' :
                'text-slate-500'
              }`}>
                {getInsightIcon(insight.icon)}
              </span>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-slate-800">{insight.title}</h4>
                <p className="text-xs text-slate-600 mt-0.5">{insight.message}</p>
                <p className="text-xs text-slate-400 mt-1">{insight.recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const filteredOrders = getFilteredOrders();

  // Métricas de las tarjetas superiores. En historial ('all') vienen agregadas
  // del backend sobre TODO el rango filtrado (no solo la página cargada); en
  // 'today' se calculan sobre los pedidos del día. "Ventas" usa finalAmount
  // (incluye descuentos/envíos) igual que el Excel; cae a totalAmount si es null.
  const revenueOf = (o) => (o.finalAmount || o.totalAmount || 0);
  const localMetrics = (orderCount) => {
    const orders = orderCount != null ? orderCount : filteredOrders.length;
    const revenue = filteredOrders.reduce((s, o) => s + revenueOf(o), 0);
    const products = filteredOrders.reduce(
      (s, o) => s + (o.items || []).reduce((a, it) => a + (it.quantity || 0), 0), 0
    );
    return { orders, revenue, products, avg: filteredOrders.length > 0 ? revenue / filteredOrders.length : 0 };
  };
  const metrics = viewMode === 'all'
    ? (rangeStats
        ? {
            orders: rangeStats.totalOrders || 0,
            revenue: rangeStats.totalRevenue || 0,
            products: rangeStats.totalProducts || 0,
            avg: rangeStats.avgTicket || 0,
          }
        : localMetrics(totalOrders)) // backend viejo sin stats: total real + montos de la página
    : localMetrics();
  const fmtMoney = (n) => Math.round(n || 0).toLocaleString('es-CO');

  // Loading state — only show full spinner on initial load
  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FaInfoCircle className="text-3xl text-red-400 mb-3" />
        <p className="text-slate-600 text-sm">{error}</p>
        <button onClick={fetchCompletedOrders} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Subtle refreshing indicator */}
      {refreshing && (
        <div className="absolute top-0 left-0 right-0 z-10">
          <div className="h-0.5 bg-blue-200 overflow-hidden rounded-full">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        </div>
      )}
      {/* Action Bar: view toggle + search + filters + export + refresh */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* View mode pills — iOS segmented on mobile */}
          <div className="flex items-center bg-slate-100/80 lg:bg-slate-100 rounded-xl lg:rounded-lg p-[3px] lg:p-0.5">
            <button
              onClick={() => setViewMode('today')}
              className={`flex items-center gap-1.5 px-3.5 py-2 lg:py-1.5 rounded-xl lg:rounded-md text-[13px] lg:text-xs font-semibold lg:font-medium transition-all ${
                viewMode === 'today'
                  ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)] lg:shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FaCalendarDay className="text-[10px]" />
              <span>Cierre del Día</span>
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`flex items-center gap-1.5 px-3.5 py-2 lg:py-1.5 rounded-xl lg:rounded-md text-[13px] lg:text-xs font-semibold lg:font-medium transition-all ${
                viewMode === 'all'
                  ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)] lg:shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FaHistory className="text-[10px]" />
              <span>Historial</span>
            </button>
          </div>

          {/* Right side: search + filter toggle + export + refresh */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <div className="relative flex-1 sm:flex-none">
              <FaSearch className="absolute left-3 lg:left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                placeholder="Buscar cliente o #..."
                aria-label="Buscar cliente o número de pedido"
                className="w-full sm:w-48 pl-9 lg:pl-8 pr-3 py-2.5 lg:py-1.5 text-[14px] lg:text-sm border-0 lg:border lg:border-slate-200 rounded-xl lg:rounded-lg bg-slate-100/80 lg:bg-white focus:ring-2 focus:ring-red-500/20 lg:focus:ring-1 lg:focus:ring-blue-500 focus:bg-white lg:focus:border-blue-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3.5 lg:px-3 py-2.5 lg:py-1.5 text-[13px] lg:text-xs font-semibold lg:font-medium rounded-xl lg:rounded-lg border transition-colors ${
                hasActiveFilters
                  ? 'bg-red-50 lg:bg-blue-50 border-red-200 lg:border-blue-300 text-red-600 lg:text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FaFilter className="text-[10px]" />
              <span>Filtros</span>
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-red-500 lg:bg-blue-500" />}
            </button>

            {/* Export button */}
            <button
              onClick={exportExcel}
              disabled={exportingExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
              title="Exportar Excel"
            >
              {exportingExcel ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-500" /> : <FaFileExcel className="text-[10px]" />}
              <span className="hidden sm:inline">Excel</span>
            </button>

            {/* Refresh */}
            {viewMode === 'today' && (
              <button
                onClick={generateDailyClosingReport}
                disabled={generatingReport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {generatingReport ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                ) : (
                  <FaSync className="text-[10px]" />
                )}
                <span>Actualizar</span>
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters Panel */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              key="filters"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
                {/* Quick date presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1 mr-1"><FaCalendarWeek className="text-[9px]" />Rápido</span>
                  {[['Hoy', 'today'], ['Ayer', 'yesterday'], ['Última semana', 'week'], ['Último mes', 'month'], ['Último año', 'year']].map(([label, key]) => (
                    <button key={key} onClick={() => applyDatePreset(key)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all active:scale-[0.97]">
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {/* Date From */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Desde</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                    />
                  </div>
                  {/* Date To */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Hasta</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                    />
                  </div>
                  {/* Order Type */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Tipo</label>
                    <select value={filterOrderType} onChange={(e) => setFilterOrderType(e.target.value)}
                      className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all">
                      <option value="">Todos</option>
                      <option value="inSite">En sitio</option>
                      <option value="takeaway">Para llevar</option>
                      <option value="delivery">Domicilio</option>
                    </select>
                  </div>
                  {/* Channel */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Canal</label>
                    <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)}
                      className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all">
                      <option value="">Todos</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="inapp">In-App</option>
                      <option value="pos">POS</option>
                    </select>
                  </div>
                  {/* Payment */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Pago</label>
                    <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}
                      className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all">
                      <option value="">Todos</option>
                      <option value="cash">Efectivo</option>
                      <option value="nequi">Nequi</option>
                      <option value="daviplata">Daviplata</option>
                      <option value="transfer">Transferencia</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                  {/* Clear */}
                  <div className="flex items-end">
                    <button onClick={clearFilters}
                      className="w-full px-2.5 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors">
                      Limpiar filtros
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats Row — compact cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: isService ? 'Citas' : 'Pedidos', value: (metrics.orders || 0).toLocaleString('es-CO'), Icon: FaClipboardList, from: 'from-blue-500', to: 'to-indigo-600' },
          { label: 'Ventas', value: `$${fmtMoney(metrics.revenue)}`, Icon: FaDollarSign, from: 'from-emerald-500', to: 'to-teal-600' },
          { label: 'Promedio', value: `$${fmtMoney(metrics.avg)}`, Icon: FaChartBar, from: 'from-violet-500', to: 'to-purple-600' },
          { label: isService ? 'Servicios' : 'Productos', value: (metrics.products || 0).toLocaleString('es-CO'), Icon: FaHamburger, from: 'from-orange-500', to: 'to-amber-600' },
        ].map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: i * 0.05 }}
            className="bg-white rounded-xl border border-slate-100 px-3 py-2.5 flex items-center gap-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
          >
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${c.from} ${c.to} flex items-center justify-center shrink-0`}>
              <c.Icon className="text-white text-[11px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide truncate leading-none mb-0.5">{c.label}</p>
              <p className="text-[15px] lg:text-base font-bold text-slate-900 leading-tight truncate tabular-nums">{c.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Análisis de ventas con IA (Groq) — compacto y colapsable */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="rounded-xl border border-violet-100 bg-white shadow-[0_1px_6px_rgba(124,58,237,0.05)] overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shrink-0">
              <FaLightbulb className="text-white text-[11px]" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-[13px] font-bold text-slate-800 whitespace-nowrap">Análisis IA</h3>
              <span className="hidden sm:inline text-[10px] text-slate-400 truncate">
                {viewMode === 'all' ? (dateFrom || dateTo ? 'rango filtrado' : 'todo el historial') : 'hoy'}
              </span>
            </div>
          </div>
          <button
            onClick={fetchAiInsights}
            disabled={aiInsightsLoading}
            className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-60 transition-all active:scale-[0.97]"
          >
            {aiInsightsLoading ? 'Analizando…' : (aiInsightsGenerated ? '↻ Regenerar' : '✨ Generar')}
          </button>
        </div>

        {/* Contenido: solo cuando hay algo que mostrar */}
        {(aiInsightsLoading || aiInsightsError || aiInsights.length > 0) && (
          <div className="px-3.5 pb-3.5 border-t border-slate-50">
            {aiInsightsError && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <FaInfoCircle className="shrink-0" /> {aiInsightsError}
              </div>
            )}

            {aiInsightsLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-lg border border-slate-100 p-2.5 animate-pulse">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md bg-slate-200" />
                      <div className="h-2.5 bg-slate-200 rounded w-1/2" />
                    </div>
                    <div className="h-2 bg-slate-100 rounded w-full mb-1.5" />
                    <div className="h-2 bg-slate-100 rounded w-4/5" />
                  </div>
                ))}
              </div>
            )}

            {!aiInsightsLoading && aiInsights.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                {aiInsights.map((insight, i) => {
                  const st = AI_INSIGHT_STYLES[insight.type] || AI_INSIGHT_STYLES.info;
                  const StIcon = st.Icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.06 }}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${st.wrap}`}
                    >
                      <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${st.chip} flex items-center justify-center shrink-0`}>
                        <StIcon className="text-white text-[10px]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[12px] font-bold text-slate-800">{insight.title}</h4>
                        {insight.message && <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{insight.message}</p>}
                        {insight.recommendation && (
                          <p className="text-[11px] text-violet-700 mt-1 font-semibold flex items-start gap-1">
                            <span>→</span><span>{insight.recommendation}</span>
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Insights + Top Selling — side by side on larger screens */}
      {viewMode === 'today' && (insights.length > 0 || topSellingItems.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InsightsSection />
          <TopSellingItems />
        </div>
      )}

      {/* Orders Table (desktop) + Card List (mobile) */}
      <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none overflow-hidden">
        {/* Table header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50/80 to-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0">
              <FaClipboardList className="text-white text-[11px]" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">
              {viewMode === 'today' ? (isService ? 'Citas del Día' : 'Pedidos del Día') : (isService ? 'Todas las Citas' : 'Todos los Pedidos')}
            </h2>
          </div>
          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full tabular-nums">
            {viewMode === 'all' ? `${totalOrders}` : `${filteredOrders.length}`} {isService ? 'citas' : 'pedidos'}
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-3">
              <FaShoppingBag className="text-2xl text-slate-400" />
            </div>
            <p className="text-sm text-slate-600 font-semibold">{isService ? 'Sin citas completadas' : 'Sin pedidos completados'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {hasActiveFilters ? 'Intenta ajustar los filtros' : (isService ? 'Las citas completadas aparecerán aquí' : 'Los pedidos completados aparecerán aquí')}
            </p>
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="overflow-x-auto hidden lg:block">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Canal</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Pago</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Detalle</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Fecha</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredOrders.map((order) => (
                  <tr key={order._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-slate-100 text-[12px] font-bold text-slate-700 tabular-nums group-hover:bg-white">#{order.orderNumber}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-sm text-slate-600">{order.customerName || 'Sin nombre'}</div>
                      {order.phone && <div className="text-[11px] text-slate-400">{order.phone}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        order.orderType === 'delivery'
                          ? 'bg-purple-50 text-purple-700'
                          : order.orderType === 'takeaway'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {order.orderType === 'delivery' ? <><FaTruck className="text-[9px]" /> Delivery</> :
                         order.orderType === 'takeaway' ? <><FaShoppingBag className="text-[9px]" /> Llevar</> :
                         <><FaChair className="text-[9px]" /> En sitio</>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        order.orderChannel === 'pos' ? 'bg-slate-100 text-slate-600' :
                        order.orderChannel === 'inapp' ? 'bg-cyan-50 text-cyan-700' :
                        'bg-green-50 text-green-700'
                      }`}>
                        {order.orderChannel === 'pos' ? 'POS' :
                         order.orderChannel === 'inapp' ? 'In-App' : 'WhatsApp'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <span className="text-xs text-slate-600 inline-flex items-center gap-1">
                        {order.paymentMethod === 'cash' || order.paymentMethod === 'efectivo' ? <>{AI.banknotes('w-3.5 h-3.5')} Efectivo</> :
                         order.paymentMethod === 'nequi' ? <>{AI.deviceMobile('w-3.5 h-3.5')} Nequi</> :
                         order.paymentMethod === 'daviplata' ? <>{AI.deviceMobile('w-3.5 h-3.5')} Daviplata</> :
                         order.paymentMethod === 'transfer' || order.paymentMethod === 'transferencia' ? <>{AI.bank('w-3.5 h-3.5')} Transf.</> :
                         order.paymentMethod ? order.paymentMethod : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell max-w-[150px] truncate">
                      {order.orderType === 'delivery'
                        ? (order.deliveryPersonId?.name
                            ? <span className="inline-flex items-center gap-1">{AI.truck('w-3 h-3')} {order.deliveryPersonId.name}</span>
                            : order.address)
                        : order.orderType === 'inSite'
                        ? `${isHotel ? 'Hab.' : 'Mesa'} ${order.tableNumber}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-bold text-emerald-600 tabular-nums">
                      ${(order.finalAmount || order.totalAmount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell tabular-nums">
                      {new Date(order.completedAt || order.createdAt).toLocaleString('es-ES', {
                        day: 'numeric', month: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => showOrderDetails(order)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition-colors"
                        title="Ver detalles"
                      >
                        <FaEye className="text-xs" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="lg:hidden divide-y divide-slate-100/60">
            {filteredOrders.map((order) => (
              <button
                key={order._id}
                onClick={() => showOrderDetails(order)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50/50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  order.orderType === 'delivery' ? 'bg-purple-50' :
                  order.orderType === 'takeaway' ? 'bg-amber-50' : 'bg-blue-50'
                }`}>
                  {order.orderType === 'delivery' ? <FaTruck className="text-purple-500 text-xs" /> :
                   order.orderType === 'takeaway' ? <FaShoppingBag className="text-amber-500 text-xs" /> :
                   <FaChair className="text-blue-500 text-xs" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-slate-900">#{order.orderNumber}</span>
                    <span className="text-[11px] text-slate-400">{order.customerName || 'Sin nombre'}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400">
                      {new Date(order.completedAt || order.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {order.deliveryPersonId?.name && (
                      <span className="text-[11px] text-purple-500">{order.deliveryPersonId.name}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[13px] font-bold text-emerald-600 tabular-nums">${(order.finalAmount || order.totalAmount || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">{order.items?.length || 0} items</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            ))}
          </div>
          </>
        )}

        {/* Pagination — only for history mode */}
        {viewMode === 'all' && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/40">
            <span className="text-xs text-slate-500">
              Página <span className="font-bold text-slate-700">{currentPage}</span> de {totalPages} · <span className="tabular-nums">{totalOrders}</span> pedidos
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { const p = currentPage - 1; setCurrentPage(p); fetchAllCompletedOrders(p); }}
                disabled={currentPage <= 1}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <FaChevronLeft className="text-xs" />
              </button>
              <button
                onClick={() => { const p = currentPage + 1; setCurrentPage(p); fetchAllCompletedOrders(p); }}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <FaChevronRight className="text-xs" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedOrder && <OrderDetailsModal />}
      </AnimatePresence>
      
      {showNoOrdersModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <FaInfoCircle className="mx-auto text-3xl text-blue-400 mb-3" />
            <h3 className="text-base font-semibold text-slate-900 mb-1">Sin pedidos completados</h3>
            <p className="text-sm text-slate-500 mb-5">No hay pedidos para generar el cierre del día.</p>
            <button
              onClick={() => setShowNoOrdersModal(false)}
              className="w-full py-2 rounded-lg text-sm text-white font-medium bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnhancedCompletedOrders;
