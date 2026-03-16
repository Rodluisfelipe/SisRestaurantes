import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/socket';
import { logSystem } from '../utils/systemLogger';
import { generateDailyReportPDF } from './DailyReportPDF';
import ExcelJS from 'exceljs';
import {
  FaClipboardList, FaDollarSign, FaChartBar, FaHamburger,
  FaCalendarDay, FaHistory, FaSync, FaSearch,
  FaTrophy, FaLightbulb, FaTruck, FaChair, FaShoppingBag,
  FaUser, FaPhone, FaMapMarkerAlt, FaTimes, FaEye,
  FaFileInvoiceDollar, FaInfoCircle, FaArrowUp, FaArrowDown,
  FaFilePdf, FaFileExcel, FaFilter, FaDownload, FaChevronLeft, FaChevronRight,
  FaWhatsapp, FaMobileAlt, FaCashRegister, FaMoneyBillWave
} from 'react-icons/fa';

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
  const PAGE_SIZE = 50;

  // Export states
  const [exportingPDF, setExportingPDF] = useState(false);
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
      const params = new URLSearchParams({ businessId });
      if (viewMode === 'today') {
        const today = new Date().toISOString().split('T')[0];
        params.append('from', today);
        params.append('to', today);
      } else {
        if (dateFrom) params.append('from', dateFrom);
        if (dateTo) params.append('to', dateTo);
      }
      if (filterOrderType) params.append('orderType', filterOrderType);
      if (filterChannel) params.append('orderChannel', filterChannel);
      if (filterPayment) params.append('paymentMethod', filterPayment);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const response = await api.get(`/orders/completed?${params.toString()}`);
      const orders = response.data?.orders || (Array.isArray(response.data) ? response.data : []);

      if (orders.length === 0) {
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
      ws.mergeCells('A1:P1');
      const titleCell = ws.getCell('A1');
      titleCell.value = `${businessConfig?.businessName || 'Reporte'} — Pedidos Completados`;
      titleCell.font = { bold: true, size: 16, color: { argb: brandColor } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 32;

      // Subtitle
      ws.mergeCells('A2:P2');
      const subtitleCell = ws.getCell('A2');
      const dateLabel = viewMode === 'today'
        ? new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
        : `${dateFrom || '—'} a ${dateTo || '—'}`;
      subtitleCell.value = `Fecha: ${dateLabel}  |  Total: ${orders.length} pedidos  |  Generado: ${new Date().toLocaleString('es-CO')}`;
      subtitleCell.font = { size: 10, color: { argb: 'FF6B7280' }, italic: true };
      subtitleCell.alignment = { horizontal: 'center' };
      ws.getRow(2).height = 20;

      // Headers
      const headers = ['# Pedido', 'Fecha', 'Hora', 'Cliente', 'Teléfono', 'Tipo', 'Canal', 'Método de Pago', 'Mesa/Hab', 'Dirección', 'Productos', 'Cant. Items', 'Subtotal', 'Descuento', 'Envío', 'Total'];
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
        { width: 40 }, { width: 10 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 14 },
      ];

      const typeColors = { 'En sitio': 'FFDBEAFE', 'Para llevar': 'FFFEF3C7', 'Domicilio': 'FFF3E8FF' };

      // Data rows
      orders.forEach((o, idx) => {
        const date = new Date(o.completedAt || o.createdAt);
        const itemsSummary = (o.items || []).map(i => `${i.quantity}x ${i.name}`).join('\n');
        const totalItems = (o.items || []).reduce((s, i) => s + i.quantity, 0);
        const typeLabel = orderTypeLabel(o.orderType);

        const row = ws.addRow([
          o.orderNumber,
          date.toLocaleDateString('es-CO'),
          date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          o.customerName || '', o.phone || '', typeLabel, channelLabel(o.orderChannel),
          paymentLabel(o.paymentMethod), o.tableNumber || '', o.address || '',
          itemsSummary, totalItems,
          o.totalAmount || 0, o.discountAmount || 0, o.deliveryFee || 0, o.finalAmount || o.totalAmount || 0,
        ]);

        const rowFill = idx % 2 === 0
          ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
          : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

        row.eachCell((cell, colNumber) => {
          cell.border = allBorders;
          cell.fill = rowFill;
          cell.alignment = { vertical: 'middle', wrapText: colNumber === 11 };
          if ([13, 14, 15, 16].includes(colNumber)) {
            cell.numFmt = currencyFormat;
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }
          if ([1, 2, 3, 6, 7, 9, 12].includes(colNumber)) {
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

      // Sheet 2: Por Tipo
      const ws2 = wb.addWorksheet('Por Tipo');
      ws2.columns = [{ width: 18 }, { width: 14 }, { width: 18 }];
      const typeHeader = ws2.addRow(['Tipo de Pedido', 'Cantidad', 'Total']);
      typeHeader.eachCell((cell) => { cell.fill = headerFill; cell.font = headerFont; cell.border = allBorders; cell.alignment = { horizontal: 'center', vertical: 'middle' }; });
      const typeCounts = { 'En sitio': { count: 0, total: 0 }, 'Para llevar': { count: 0, total: 0 }, 'Domicilio': { count: 0, total: 0 } };
      orders.forEach(o => { const l = orderTypeLabel(o.orderType); if (typeCounts[l]) { typeCounts[l].count++; typeCounts[l].total += (o.finalAmount || o.totalAmount || 0); } });
      Object.entries(typeCounts).forEach(([label, data], idx) => {
        const r = ws2.addRow([label, data.count, data.total]);
        r.eachCell((cell, col) => {
          cell.border = allBorders;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF' } };
          if (col === 2) cell.alignment = { horizontal: 'center' };
          if (col === 3) { cell.numFmt = currencyFormat; cell.alignment = { horizontal: 'right' }; }
        });
      });
      const totalTypeRow = ws2.addRow(['TOTAL', orders.length, totalRevenue]);
      totalTypeRow.eachCell((cell, col) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
        cell.font = { bold: true, size: 11 };
        cell.border = allBorders;
        if (col === 2) cell.alignment = { horizontal: 'center' };
        if (col === 3) { cell.numFmt = currencyFormat; cell.alignment = { horizontal: 'right' }; }
      });

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

  // --- Export: PDF ---
  const exportPDF = async () => {
    setExportingPDF(true);
    try {
      let data;
      if (viewMode === 'today') {
        // Use the already-loaded today data
        data = { stats, orders: completedOrders, reportDate: new Date().toISOString() };
      } else {
        // Fetch filtered data for PDF
        const params = new URLSearchParams({ businessId });
        if (dateFrom) params.append('from', dateFrom);
        if (dateTo) params.append('to', dateTo);
        if (filterOrderType) params.append('orderType', filterOrderType);
        if (filterChannel) params.append('orderChannel', filterChannel);
        if (filterPayment) params.append('paymentMethod', filterPayment);
        if (searchTerm.trim()) params.append('search', searchTerm.trim());

        const response = await api.get(`/orders/completed?${params.toString()}`);
        const orders = response.data?.orders || (Array.isArray(response.data) ? response.data : []);
        if (orders.length === 0) {
          alert('No hay pedidos para generar el PDF');
          return;
        }

        // Build stats from fetched orders
        const pdfStats = {
          totalOrders: orders.length,
          totalSales: orders.reduce((s, o) => s + (o.finalAmount || o.totalAmount || 0), 0),
          totalAmount: orders.reduce((s, o) => s + (o.totalAmount || 0), 0),
          ordersByType: { inSite: { count: 0, total: 0 }, takeaway: { count: 0, total: 0 }, delivery: { count: 0, total: 0 } },
          topSellingItems: [],
        };
        const itemCounts = {};
        orders.forEach(o => {
          const type = o.orderType || 'inSite';
          if (pdfStats.ordersByType[type]) {
            pdfStats.ordersByType[type].count++;
            pdfStats.ordersByType[type].total += (o.finalAmount || o.totalAmount || 0);
          }
          (o.items || []).forEach(item => {
            if (!itemCounts[item.name]) itemCounts[item.name] = { count: 0, total: 0 };
            itemCounts[item.name].count += item.quantity;
            itemCounts[item.name].total += item.price * item.quantity;
          });
        });
        pdfStats.topSellingItems = Object.entries(itemCounts)
          .map(([name, d]) => ({ name, ...d }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        data = { stats: pdfStats, orders, reportDate: dateFrom || new Date().toISOString() };
      }

      await generateDailyReportPDF(data, businessConfig);
    } catch (err) {
      logSystem('Error exporting PDF: ' + err.message, 'error');
      alert('Error al generar el PDF');
    } finally {
      setExportingPDF(false);
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
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
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
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{selectedOrder.isBooking ? 'Servicios' : 'Productos'}</h3>
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
                    <span className="text-sm font-medium text-slate-700">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between items-center pt-3 border-t border-slate-200">
                <span className="text-sm font-semibold text-slate-900">Total</span>
                <span className="text-base font-bold text-slate-900">
                  ${selectedOrder.totalAmount.toFixed(2)}
                </span>
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
                <p className="text-[11px] text-slate-400 mt-1">{insight.recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const filteredOrders = getFilteredOrders();

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
          {/* View mode pills */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('today')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'today'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FaCalendarDay className="text-[10px]" />
              <span>Cierre del Día</span>
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
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
              <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                placeholder="Buscar cliente o #..."
                className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                hasActiveFilters
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FaFilter className="text-[10px]" />
              <span>Filtros</span>
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
            </button>

            {/* Export buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={exportPDF}
                disabled={exportingPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                title="Exportar PDF"
              >
                {exportingPDF ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-500" /> : <FaFilePdf className="text-[10px]" />}
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button
                onClick={exportExcel}
                disabled={exportingExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                title="Exportar Excel"
              >
                {exportingExcel ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-500" /> : <FaFileExcel className="text-[10px]" />}
                <span className="hidden sm:inline">Excel</span>
              </button>
            </div>

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
        {showFilters && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Date From */}
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {/* Date To */}
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {/* Order Type */}
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">Tipo</label>
                <select value={filterOrderType} onChange={(e) => setFilterOrderType(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-500">
                  <option value="">Todos</option>
                  <option value="inSite">En sitio</option>
                  <option value="takeaway">Para llevar</option>
                  <option value="delivery">Domicilio</option>
                </select>
              </div>
              {/* Channel */}
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">Canal</label>
                <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-500">
                  <option value="">Todos</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="inapp">In-App</option>
                  <option value="pos">POS</option>
                </select>
              </div>
              {/* Payment */}
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">Pago</label>
                <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-500">
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
                  className="w-full px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                  Limpiar filtros
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Row — compact flat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <FaClipboardList className="text-blue-500 text-sm" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-medium">{isService ? 'Citas' : 'Pedidos'}</p>
            <p className="text-lg font-bold text-slate-900">{filteredOrders.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
            <FaDollarSign className="text-emerald-500 text-sm" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-medium">Ventas</p>
            <p className="text-lg font-bold text-slate-900">
              ${filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
            <FaChartBar className="text-violet-500 text-sm" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-medium">Promedio</p>
            <p className="text-lg font-bold text-slate-900">
              ${(filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0) / (filteredOrders.length || 1)).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
            <FaHamburger className="text-orange-500 text-sm" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-medium">{isService ? 'Servicios' : 'Productos'}</p>
            <p className="text-lg font-bold text-slate-900">
              {filteredOrders.reduce((sum, order) => sum + order.items.reduce((s, item) => s + item.quantity, 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Insights + Top Selling — side by side on larger screens */}
      {viewMode === 'today' && (insights.length > 0 || topSellingItems.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InsightsSection />
          <TopSellingItems />
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Table header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">
            {viewMode === 'today' ? (isService ? 'Citas del Día' : 'Pedidos del Día') : (isService ? 'Todas las Citas' : 'Todos los Pedidos')}
          </h2>
          <span className="text-xs text-slate-500">
            {viewMode === 'all' ? `${totalOrders} total` : `${filteredOrders.length}`} {isService ? 'citas' : 'pedidos'}
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FaShoppingBag className="text-3xl text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 font-medium">{isService ? 'Sin citas completadas' : 'Sin pedidos completados'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {hasActiveFilters ? 'Intenta ajustar los filtros' : (isService ? 'Las citas completadas aparecerán aquí' : 'Los pedidos completados aparecerán aquí')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                  <tr key={order._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-800">
                      #{order.orderNumber}
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
                      <span className="text-xs text-slate-600">
                        {order.paymentMethod === 'cash' || order.paymentMethod === 'efectivo' ? '💵 Efectivo' :
                         order.paymentMethod === 'nequi' ? '📱 Nequi' :
                         order.paymentMethod === 'daviplata' ? '📱 Daviplata' :
                         order.paymentMethod === 'transfer' || order.paymentMethod === 'transferencia' ? '🏦 Transf.' :
                         order.paymentMethod ? order.paymentMethod : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell max-w-[150px] truncate">
                      {order.orderType === 'delivery'
                        ? order.address
                        : order.orderType === 'inSite'
                        ? `${isHotel ? 'Hab.' : 'Mesa'} ${order.tableNumber}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-800">
                      ${(order.finalAmount || order.totalAmount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell">
                      {new Date(order.completedAt || order.createdAt).toLocaleString('es-ES', {
                        day: 'numeric', month: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => showOrderDetails(order)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
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
        )}

        {/* Pagination — only for history mode */}
        {viewMode === 'all' && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Página {currentPage} de {totalPages} ({totalOrders} pedidos)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { const p = currentPage - 1; setCurrentPage(p); fetchAllCompletedOrders(p); }}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <FaChevronLeft className="text-xs" />
              </button>
              <button
                onClick={() => { const p = currentPage + 1; setCurrentPage(p); fetchAllCompletedOrders(p); }}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
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
