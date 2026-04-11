import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Generate and download a professional PDF invoice.
 *
 * @param {Object} invoice - The invoice object from the API
 * @param {Object} [options] - Extra display options
 * @param {string} [options.customerName]
 * @param {string} [options.technicianName]
 * @param {string} [options.issueType]
 */
export default function generateInvoicePDF(invoice, options = {}) {
  if (!invoice) return

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = margin

  /* ── Header ─────────────────────────────────────────── */
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(16, 185, 129) // blue-500
  doc.text('Quick Auto Assist', margin, y + 6)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139) // slate-500
  doc.text('Vehicle Roadside Assistance', margin, y + 13)

  // "INVOICE" label
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59) // slate-800
  doc.text('INVOICE', pageWidth - margin, y + 8, { align: 'right' })

  y += 24

  /* ── Divider ────────────────────────────────────────── */
  doc.setDrawColor(226, 232, 240) // slate-200
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  /* ── Invoice meta ───────────────────────────────────── */
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)

  const metaLeft = [
    ['Invoice ID:', invoice.invoice_id || 'N/A'],
    ['Issued:', invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'],
    ['Payment Status:', (invoice.payment_status || 'N/A').toUpperCase()],
    ...(invoice.payment_method ? [['Payment Method:', invoice.payment_method.toUpperCase()]] : []),
    ...(invoice.paid_at ? [['Paid On:', new Date(invoice.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })]] : []),
    ...(invoice.transaction_id ? [['Transaction ID:', invoice.transaction_id]] : []),
  ]

  const metaRight = [
    ...(options.customerName ? [['Customer:', options.customerName]] : []),
    ...(options.technicianName ? [['Technician:', options.technicianName]] : []),
    ...(options.issueType ? [['Issue Type:', options.issueType.replace(/_/g, ' ')]] : []),
  ]

  metaLeft.forEach(([label, value], i) => {
    const yPos = y + i * 5.5
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105) // slate-600
    doc.text(label, margin, yPos)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59) // slate-800
    doc.text(String(value), margin + 32, yPos)
  })

  metaRight.forEach(([label, value], i) => {
    const yPos = y + i * 5.5
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text(label, pageWidth / 2 + 10, yPos)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    doc.text(String(value), pageWidth / 2 + 40, yPos)
  })

  y += Math.max(metaLeft.length, metaRight.length) * 5.5 + 8

  /* ── Line Items Table ───────────────────────────────── */
  const items = invoice.items || []
  if (items.length > 0) {
    const tableBody = items.map((item, idx) => [
      idx + 1,
      (item.item_type || 'N/A').charAt(0).toUpperCase() + (item.item_type || '').slice(1),
      item.description || 'N/A',
      item.quantity ?? 1,
      `₹${Number(item.unit_price || item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `₹${Number(item.total_price || item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    ])

    autoTable(doc, {
      startY: y,
      head: [['#', 'Type', 'Description', 'Qty', 'Unit Price', 'Total']],
      body: tableBody,
      margin: { left: margin, right: margin },
      theme: 'striped',
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 24 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 28, halign: 'right' },
      },
    })

    y = doc.lastAutoTable.finalY + 8
  }

  /* ── Totals ─────────────────────────────────────────── */
  const totalsX = pageWidth - margin - 60
  const valuesX = pageWidth - margin

  const subtotal = Number(invoice.subtotal ?? 0)
  const tax = Number(invoice.tax ?? 0)
  const total = Number(invoice.total ?? 0)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Subtotal:', totalsX, y, { align: 'left' })
  doc.setTextColor(30, 41, 59)
  doc.text(`₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valuesX, y, { align: 'right' })
  y += 6

  doc.setTextColor(100, 116, 139)
  doc.text('Tax:', totalsX, y, { align: 'left' })
  doc.setTextColor(30, 41, 59)
  doc.text(`₹${tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valuesX, y, { align: 'right' })
  y += 2

  doc.setDrawColor(226, 232, 240)
  doc.line(totalsX, y, pageWidth - margin, y)
  y += 6

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(16, 185, 129)
  doc.text('Total:', totalsX, y, { align: 'left' })
  doc.text(`₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valuesX, y, { align: 'right' })
  y += 14

  /* ── Footer ─────────────────────────────────────────── */
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(148, 163, 184) // slate-400
  doc.text('Thank you for choosing Quick Auto Assist!', pageWidth / 2, y, { align: 'center' })
  doc.text('This is a computer-generated invoice and does not require a signature.', pageWidth / 2, y + 5, { align: 'center' })

  /* ── Save ───────────────────────────────────────────── */
  const shortId = (invoice.invoice_id || 'invoice').slice(0, 8)
  doc.save(`invoice-${shortId}.pdf`)
}
