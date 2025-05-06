import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Convert an image URL to base64
 * @param {string} url - The image URL to convert
 * @returns {Promise<string>} - Base64 encoded image
 */
const convertImageToBase64 = (url) => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous'; // Handle CORS issues
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Get base64 data
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      };
      
      img.onerror = (error) => {
        console.error('Error loading image:', error);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    } catch (error) {
      console.error('Error converting image:', error);
      reject(error);
    }
  });
};

/**
 * Format currency values for Colombian Peso without decimal places
 * @param {number} value - The value to format
 * @returns {string} - Formatted currency string
 */
const formatCurrency = (value) => {
  // Ensure value is a number
  const amount = parseFloat(value) || 0;
  // Format with thousands separator and no decimals
  return '$ ' + amount.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
};

/**
 * Generate a PDF report for daily sales
 * @param {Object} data - The report data from API
 * @param {Object} businessConfig - The business configuration
 * @returns {Promise<void>}
 */
export const generateDailyReportPDF = async (data, businessConfig) => {
  try {
    console.log('Generating PDF with data:', data);
    console.log('Business config:', businessConfig);
    
    // Validate required data
    if (!data || !data.stats) {
      throw new Error('Datos de reporte incompletos');
    }

    const { stats, orders, reportDate } = data;
    
    // Create PDF document with autotable support
    const doc = new jsPDF();
    
    // Format date
    let formattedDate;
    try {
      const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
      formattedDate = new Date(reportDate).toLocaleDateString('es-ES', dateOptions);
    } catch (dateErr) {
      console.error('Error formatting date:', dateErr);
      formattedDate = new Date().toLocaleDateString('es-ES');
    }
    
    // Extract business information
    const businessName = businessConfig?.businessName || 'Reporte de Ventas';
    const businessAddress = businessConfig?.address || '';
    const businessPhone = businessConfig?.phone || '';
    const logoUrl = businessConfig?.logo || ''; // Get logo URL from business config
    
    console.log('Using logo URL:', logoUrl);
    
    // --- FIRST PAGE HEADER ---
    
    // Add logo placeholder
    doc.setDrawColor(66, 135, 245);
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(14, 10, 40, 20, 2, 2, 'FD');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text('LOGO', 34, 25, { align: 'center' });
    
    // Try to add logo if URL exists
    if (logoUrl) {
      try {
        // Create an image element to load the logo
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        // Wait for image to load or fail
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = logoUrl;
        });
        
        // Create a canvas to convert the image to base64
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the image on the canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Get the base64 data URL
        const base64 = canvas.toDataURL('image/png');
        
        // Add image to PDF
        doc.addImage(base64, 'PNG', 14, 10, 40, 20, undefined, 'FAST');
      } catch (logoErr) {
        console.error('Error adding logo to PDF:', logoErr);
        // Logo placeholder was already added above, so no need to add it again
      }
    }
    
    // Add business info on the right side
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(businessName, 150, 20, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    if (businessAddress) {
      doc.text(businessAddress, 150, 25, { align: 'right' });
    }
    if (businessPhone) {
      doc.text(businessPhone, 150, 30, { align: 'right' });
    }
    
    // Add horizontal line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 35, 196, 35);
    
    // Report title
    doc.setFontSize(18);
    doc.setTextColor(66, 135, 245);
    doc.text('REPORTE DE VENTAS DIARIAS', 105, 45, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text(`Fecha: ${formattedDate}`, 105, 55, { align: 'center' });
    
    // --- SUMMARY SECTION ---
    
    // Add a background rectangle for the summary section
    doc.setFillColor(248, 248, 248);
    doc.rect(14, 65, 182, 30, 'F');
    
    // Summary section
    doc.setFontSize(16);
    doc.setTextColor(66, 135, 245);
    doc.text('RESUMEN DE VENTAS', 20, 75);
    
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text(`Total de Pedidos: ${stats.totalOrders || 0}`, 20, 85);
    doc.text(`Ventas Totales: ${formatCurrency(stats.totalSales || 0)}`, 120, 85);
    
    // --- ORDER TYPES SECTION ---
    
    // Ensure ordersByType has the correct structure
    const ordersByType = stats.ordersByType || {
      inSite: { count: 0, total: 0 },
      takeaway: { count: 0, total: 0 },
      delivery: { count: 0, total: 0 }
    };
    
    // Orders by type heading
    doc.setFontSize(16);
    doc.setTextColor(66, 135, 245);
    doc.text('PEDIDOS POR TIPO', 20, 110);
    
    // Orders by type table data
    const typeData = [
      ['Tipo', 'Cantidad', 'Total'],
      ['En Sitio', ordersByType.inSite?.count || 0, formatCurrency(ordersByType.inSite?.total || 0)],
      ['Para Llevar', ordersByType.takeaway?.count || 0, formatCurrency(ordersByType.takeaway?.total || 0)],
      ['A Domicilio', ordersByType.delivery?.count || 0, formatCurrency(ordersByType.delivery?.total || 0)],
      ['TOTAL', stats.totalOrders || 0, formatCurrency(stats.totalSales || 0)]
    ];
    
    // Draw orders by type table with autoTable plugin
    autoTable(doc, {
      startY: 115,
      head: [typeData[0]],
      body: typeData.slice(1),
      theme: 'grid',
      styles: { 
        cellPadding: 5,
        fontSize: 11
      },
      headStyles: { 
        fillColor: [66, 135, 245],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 50, halign: 'right' }
      },
      margin: { left: 20, right: 20 }
    });
    
    let currentY = doc.lastAutoTable.finalY + 15;
    
    // --- TOP SELLING ITEMS SECTION ---
    
    // Only draw if there's data
    if (stats.topSellingItems && Array.isArray(stats.topSellingItems) && stats.topSellingItems.length > 0) {
      // Top selling items heading
      doc.setFontSize(16);
      doc.setTextColor(66, 135, 245);
      doc.text('PRODUCTOS MÁS VENDIDOS', 20, currentY);
      
      // Top selling items table data
      const itemsData = [
        ['Producto', 'Cantidad', 'Total'],
        ...stats.topSellingItems.map(item => [
          item.name || 'Sin nombre',
          item.count || 0,
          formatCurrency(item.total || 0)
        ])
      ];
      
      // Draw top selling items table with autoTable plugin
      autoTable(doc, {
        startY: currentY + 5,
        head: [itemsData[0]],
        body: itemsData.slice(1),
        theme: 'grid',
        styles: { 
          cellPadding: 5,
          fontSize: 11
        },
        headStyles: { 
          fillColor: [66, 135, 245],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 110 },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 40, halign: 'right' }
        },
        margin: { left: 20, right: 20 }
      });
    }
    
    // --- ORDER DETAILS PAGE ---
    
    // Only add second page if we have orders
    if (Array.isArray(orders) && orders.length > 0) {
      doc.addPage();
      
      // --- SECOND PAGE HEADER ---
      
      // Add logo placeholder
      doc.setDrawColor(66, 135, 245);
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(14, 10, 40, 20, 2, 2, 'FD');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text('LOGO', 34, 25, { align: 'center' });
      
      // Try to add logo again on second page
      if (logoUrl) {
        try {
          // Create an image element to load the logo
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          
          // Wait for image to load or fail
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = logoUrl;
          });
          
          // Create a canvas to convert the image to base64
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw the image on the canvas
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          // Get the base64 data URL
          const base64 = canvas.toDataURL('image/png');
          
          // Add image to PDF
          doc.addImage(base64, 'PNG', 14, 10, 40, 20, undefined, 'FAST');
        } catch (logoErr) {
          console.error('Error adding logo to PDF on second page:', logoErr);
          // Logo placeholder was already added above, so no need to add it again
        }
      }
      
      // Add business name on second page
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text(businessName, 150, 20, { align: 'right' });
      
      // Add horizontal line
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 35, 196, 35);
      
      // Order details title
      doc.setFontSize(16);
      doc.setTextColor(66, 135, 245);
      doc.text('DETALLES DE PEDIDOS', 20, 45);
      
      // Order details table data
      const orderData = [
        ['Pedido #', 'Cliente', 'Tipo', 'Items', 'Total'],
        ...orders.map(order => [
          order.orderNumber || 'N/A',
          order.customerName || 'N/A',
          order.orderType === 'inSite' ? `Mesa ${order.tableNumber || 'N/A'}` :
          order.orderType === 'takeaway' ? 'Para Llevar' : 'Domicilio',
          (order.items && Array.isArray(order.items)) ? order.items.length : 0,
          formatCurrency(order.totalAmount || 0)
        ])
      ];
      
      // Draw order details table with autoTable plugin
      autoTable(doc, {
        startY: 50,
        head: [orderData[0]],
        body: orderData.slice(1),
        theme: 'grid',
        styles: { 
          cellPadding: 5,
          fontSize: 11
        },
        headStyles: { 
          fillColor: [66, 135, 245],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 60 },
          2: { cellWidth: 40 },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 40, halign: 'right' }
        },
        margin: { left: 14, right: 14 }
      });
    }
    
    // --- FOOTER FOR ALL PAGES ---
    
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Add horizontal line
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 280, 196, 280);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Página ${i} de ${pageCount}`, 105, 287, { align: 'center' });
      
      const footerText = `${businessName} - Reporte generado el ${new Date().toLocaleString('es-ES')}`;
      doc.text(footerText, 105, 294, { align: 'center' });
    }
    
    // --- SAVE PDF ---
    
    const fileName = `Reporte_Diario_${formattedDate.replace(/ /g, '_').replace(/,/g, '')}.pdf`;
    doc.save(fileName);
    console.log('PDF successfully generated:', fileName);
    return fileName;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}; 