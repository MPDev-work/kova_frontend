import { useState } from 'react';
import { Download, Loader2, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { SellerOrderItem } from '../services/dashboardApi';
import { DashboardModal } from './DashboardPrimitives';
import { formatKhr, formatRiel } from '../utils/currency';

export interface PosReceiptStoreInfo {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface PosOrderReceiptModalProps {
  open: boolean;
  onClose: () => void;
  order: SellerOrderItem | null;
  store?: PosReceiptStoreInfo | null;
  operatorName?: string | null;
  khrRate: number;
  carrierOverride?: string;
  trackingOverride?: string;
}

function formatReceiptDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return `${datePart} · ${timePart}`;
}

function formatPaymentMethod(method?: string | null): string {
  const m = (method || '').toLowerCase();
  if (!m || m === 'bakong_khqr' || m === 'khqr') return 'Bakong KHQR';
  if (m === 'cod' || m === 'cash_on_delivery') return 'Cash on Delivery';
  return m
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatStatusLabel(value?: string | null): string {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatAddressLines(order: SellerOrderItem): string[] {
  const addr = order.shipping_address;
  if (!addr) return ['—'];
  const line1 = (addr.address_line_1 || '').trim();
  const locality = [addr.commune, addr.district, addr.province]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(', ');
  const lines = [line1, locality].filter(Boolean);
  return lines.length > 0 ? lines : ['—'];
}

function loadImageAsPngDataUrl(
  src: string,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface ReceiptDataModel {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  dateTime: string;
  orderNumber: string;
  childOrderNumber: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  khqrBillNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressLines: string[];
  deliveryName: string;
  shippingMethodName: string;
  trackingNumber: string;
  items: {
    id: number;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  totalRiel: string;
  totalKhrAscii: string;
  operator: string;
}

function buildReceiptModel(
  order: SellerOrderItem,
  store: PosReceiptStoreInfo | null | undefined,
  operatorName: string | null | undefined,
  khrRate: number,
  carrierOverride?: string,
  trackingOverride?: string,
): ReceiptDataModel {
  const storeName = (store?.name || 'KOVA Official Store').trim();
  const deliveryName =
    (carrierOverride || '').trim() ||
    (order.shipping_carrier || '').trim() ||
    (order.shipping_method_name || '').trim() ||
    'Standard Delivery';
  const shippingMethodName = (order.shipping_method_name || '').trim();
  const trackingNumber =
    (trackingOverride || '').trim() || (order.tracking_number || '').trim();
  const subtotal = Number(order.subtotal_amount || 0);
  const shipping = Number(order.shipping_amount || 0);
  const discount = Number(order.discount_amount || 0);
  const total = Number(order.total_amount || 0);

  const purchaseTimestamp =
    order.paid_at || order.bakong_transaction?.verified_at || order.created_at;

  return {
    storeName,
    storePhone: (store?.phone || '').trim(),
    storeAddress: (store?.address || '').trim(),
    dateTime: formatReceiptDateTime(purchaseTimestamp),
    orderNumber: order.order_number,
    childOrderNumber:
      order.child_order_number && order.child_order_number !== order.order_number
        ? order.child_order_number
        : '',
    paymentMethod: formatPaymentMethod(order.payment_method),
    paymentStatus: formatStatusLabel(order.payment_status),
    orderStatus: formatStatusLabel(order.status),
    khqrBillNumber: order.bakong_transaction?.bill_number || '',
    customerName:
      order.customer_name || order.shipping_address?.full_name || 'Customer',
    customerPhone:
      order.customer_phone || order.shipping_address?.phone || '—',
    customerEmail: (order.customer_email || '').trim(),
    addressLines: formatAddressLines(order),
    deliveryName,
    shippingMethodName:
      shippingMethodName &&
      shippingMethodName.toLowerCase() !== deliveryName.toLowerCase()
        ? shippingMethodName
        : '',
    trackingNumber,
    items: (order.items || []).map((item) => ({
      id: item.id,
      name: item.product_name,
      sku: item.product_sku || '',
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price || 0),
      total: Number(item.total || 0),
    })),
    subtotal,
    shipping,
    discount,
    total,
    totalRiel: formatRiel(total, khrRate),
    totalKhrAscii: formatKhr(total, false, khrRate),
    operator: (operatorName || storeName || 'Store Owner').trim(),
  };
}

/**
 * Generates an authentic 80mm thermal POS slip PDF using jsPDF.
 * Uses a two-pass layout calculation so the page height fits the content cleanly.
 */
async function exportPosReceiptPdf(model: ReceiptDataModel): Promise<void> {
  const PAGE_W = 80; // 80mm thermal POS receipt roll
  const MARGIN_X = 5;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;
  const RIGHT_X = PAGE_W - MARGIN_X;
  const LINE_H = 3.7;

  const logoAsset = await loadImageAsPngDataUrl('/images/kova-logo.png');

  const drawReceipt = (doc: jsPDF, dryRun: boolean): number => {
    let y = 7;

    const drawDottedDivider = () => {
      y += 1.8;
      if (!dryRun) {
        doc.setDrawColor(165, 165, 165);
        doc.setLineWidth(0.25);
        doc.setLineDashPattern([0.7, 0.9], 0);
        doc.line(MARGIN_X, y, RIGHT_X, y);
        doc.setLineDashPattern([], 0);
      }
      y += 3.6;
    };

    const drawKeyValue = (
      label: string,
      value: string,
      opts?: { boldValue?: boolean; valueColor?: [number, number, number] },
    ) => {
      const labelMaxW = 26;
      const valueMaxW = CONTENT_W - labelMaxW - 2;
      doc.setFont('courier', opts?.boldValue ? 'bold' : 'normal');
      doc.setFontSize(7.8);
      const wrapped = doc.splitTextToSize(value || '—', valueMaxW) as string[];

      if (!dryRun) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.6);
        doc.setTextColor(115, 115, 115);
        doc.text(label, MARGIN_X, y);

        doc.setFont('courier', opts?.boldValue ? 'bold' : 'normal');
        doc.setFontSize(7.8);
        if (opts?.valueColor) {
          doc.setTextColor(
            opts.valueColor[0],
            opts.valueColor[1],
            opts.valueColor[2],
          );
        } else {
          doc.setTextColor(20, 20, 20);
        }
        wrapped.forEach((line, idx) => {
          doc.text(line, RIGHT_X, y + idx * LINE_H, { align: 'right' });
        });
      }
      y += Math.max(1, wrapped.length) * LINE_H + 0.9;
    };

    // 1. Store Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const storeLines = doc.splitTextToSize(
      model.storeName.toUpperCase(),
      CONTENT_W,
    ) as string[];
    if (!dryRun) {
      doc.setTextColor(17, 17, 17);
      storeLines.forEach((line, i) => {
        doc.text(line, PAGE_W / 2, y + i * 4.6, { align: 'center' });
      });
    }
    y += storeLines.length * 4.6 + 0.4;

    if (model.storePhone || model.storeAddress) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(6.8);
      const storeMeta = [model.storePhone, model.storeAddress]
        .filter(Boolean)
        .join(' · ');
      const metaLines = doc.splitTextToSize(storeMeta, CONTENT_W) as string[];
      if (!dryRun) {
        doc.setTextColor(105, 105, 105);
        metaLines.forEach((line, i) => {
          doc.text(line, PAGE_W / 2, y + i * 3.1, { align: 'center' });
        });
      }
      y += metaLines.length * 3.1 + 0.8;
    }

    // Order timestamp
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    if (!dryRun) {
      doc.setTextColor(75, 75, 75);
      doc.text(model.dateTime, PAGE_W / 2, y, { align: 'center' });
    }
    y += 4.5;

    // 2. Dashed Rounded Order ID Box
    const boxTop = y;
    const boxH = model.childOrderNumber ? 15.5 : 12.5;
    if (!dryRun) {
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([1.3, 1.0], 0);
      doc.roundedRect(MARGIN_X, boxTop, CONTENT_W, boxH, 2.2, 2.2, 'S');
      doc.setLineDashPattern([], 0);

      // White label pill breaking top border
      const pillW = 19;
      doc.setFillColor(255, 255, 255);
      doc.rect(PAGE_W / 2 - pillW / 2, boxTop - 1.6, pillW, 3.2, 'F');

      doc.setFont('courier', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(45, 45, 45);
      doc.text('Order ID', PAGE_W / 2, boxTop + 0.8, { align: 'center' });

      // Main order number
      doc.setFont('courier', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 15, 15);
      doc.text(`#${model.orderNumber}`, PAGE_W / 2, boxTop + 7.6, {
        align: 'center',
      });

      if (model.childOrderNumber) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(6.6);
        doc.setTextColor(110, 110, 110);
        doc.text(
          `Pkg: ${model.childOrderNumber}`,
          PAGE_W / 2,
          boxTop + 12.2,
          { align: 'center' },
        );
      }
    }
    y = boxTop + boxH + 4.5;

    // 3. Payment & Order Status
    drawKeyValue('Payment', model.paymentMethod);
    drawKeyValue('Pay Status', model.paymentStatus, { boldValue: true });
    drawKeyValue('Order Status', model.orderStatus, { boldValue: true });
    if (model.khqrBillNumber) {
      drawKeyValue('Bill Ref', model.khqrBillNumber);
    }

    drawDottedDivider();

    // 4. Customer Details (Ordered by)
    drawKeyValue('Ordered By', model.customerName, { boldValue: true });
    drawKeyValue('Phone', model.customerPhone);
    if (model.customerEmail) {
      drawKeyValue('Email', model.customerEmail);
    }
    drawKeyValue('Address', model.addressLines.join(', '));

    drawDottedDivider();

    // 5. Delivery Details
    drawKeyValue('Delivery', model.deliveryName, { boldValue: true });
    if (model.shippingMethodName) {
      drawKeyValue('Method', model.shippingMethodName);
    }
    drawKeyValue('Tracking No', model.trackingNumber || 'Pending');

    drawDottedDivider();

    // 6. Itemized Order Items
    const totalQty = model.items.reduce((sum, it) => sum + it.quantity, 0);
    if (!dryRun) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.4);
      doc.setTextColor(90, 90, 90);
      doc.text(`ITEMS (${totalQty})`, MARGIN_X, y);
      doc.text('AMOUNT', RIGHT_X, y, { align: 'right' });
    }
    y += 4;

    if (model.items.length === 0) {
      if (!dryRun) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text('No line items', MARGIN_X, y);
      }
      y += LINE_H + 1;
    } else {
      for (const item of model.items) {
        const priceStr = `$${item.total.toFixed(2)}`;
        const nameMaxW = CONTENT_W - 18;
        doc.setFont('courier', 'bold');
        doc.setFontSize(7.6);
        const nameLines = doc.splitTextToSize(
          `${item.quantity}x ${item.name}`,
          nameMaxW,
        ) as string[];

        if (!dryRun) {
          doc.setTextColor(20, 20, 20);
          nameLines.forEach((line, idx) => {
            doc.text(line, MARGIN_X, y + idx * 3.4);
          });
          doc.text(priceStr, RIGHT_X, y, { align: 'right' });
        }
        y += nameLines.length * 3.4;

        const subline = [
          item.sku || null,
          `$${item.unitPrice.toFixed(2)} each`,
        ]
          .filter(Boolean)
          .join(' · ');
        if (!dryRun) {
          doc.setFont('courier', 'normal');
          doc.setFontSize(6.7);
          doc.setTextColor(120, 120, 120);
          doc.text(subline, MARGIN_X, y);
        }
        y += 3.8;
      }
    }

    drawDottedDivider();

    // 7. Totals
    drawKeyValue('Subtotal', `$${model.subtotal.toFixed(2)}`);
    drawKeyValue(
      'Shipping',
      model.shipping > 0 ? `$${model.shipping.toFixed(2)}` : 'FREE',
    );
    if (model.discount > 0) {
      drawKeyValue('Discount', `-$${model.discount.toFixed(2)}`, {
        valueColor: [215, 45, 45],
      });
    }
    y += 0.6;
    drawKeyValue('Total (USD)', `$${model.total.toFixed(2)}`, {
      boldValue: true,
    });
    drawKeyValue('Total (KHR)', model.totalKhrAscii, { boldValue: true });

    drawDottedDivider();

    // 8. Store & Operator
    drawKeyValue('Store', model.storeName);
    drawKeyValue('Operator', model.operator);

    // 9. Bottom KOVA Brand Logo
    y += 3;
    if (logoAsset) {
      const logoW = 26;
      const logoH = logoW * (logoAsset.height / logoAsset.width);
      if (!dryRun) {
        doc.addImage(
          logoAsset.dataUrl,
          'PNG',
          (PAGE_W - logoW) / 2,
          y,
          logoW,
          logoH,
        );
      }
      y += logoH + 3.2;
    } else {
      if (!dryRun) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(255, 110, 32);
        doc.text('KOVA', PAGE_W / 2, y + 4.5, { align: 'center' });
      }
      y += 8.5;
    }

    if (!dryRun) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(130, 130, 130);
      doc.text('Thank you for shopping on KOVA', PAGE_W / 2, y, {
        align: 'center',
      });
    }
    y += 5;

    // Subtle serrated zig-zag bottom edge guide
    if (!dryRun) {
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.22);
      const toothW = 3.2;
      const toothH = 1.6;
      const startX = 2;
      const endX = PAGE_W - 2;
      let cx = startX;
      while (cx + toothW <= endX + 0.1) {
        doc.line(cx, y, cx + toothW / 2, y + toothH);
        doc.line(cx + toothW / 2, y + toothH, cx + toothW, y);
        cx += toothW;
      }
    }
    y += 4;

    return y;
  };

  // Pass 1: measure height
  const measureDoc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PAGE_W, 400],
  });
  const requiredHeight = Math.max(125, Math.ceil(drawReceipt(measureDoc, true)));

  // Pass 2: render exact 80mm POS slip height
  const finalDoc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PAGE_W, requiredHeight],
  });
  finalDoc.setFillColor(255, 255, 255);
  finalDoc.rect(0, 0, PAGE_W, requiredHeight, 'F');
  drawReceipt(finalDoc, false);

  const safeOrderNum = model.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '');
  finalDoc.save(`KOVA-Receipt-${safeOrderNum || 'order'}.pdf`);
}

function printPosSlip(model: ReceiptDataModel): void {
  const logoUrl = `${window.location.origin}/images/kova-logo.png`;
  const totalQty = model.items.reduce((sum, it) => sum + it.quantity, 0);
  const itemsHtml = model.items
    .map(
      (it) => `
      <div class="item-row">
        <div class="item-main">
          <span class="item-name">${it.quantity}x ${escapeHtml(it.name)}</span>
          <span class="item-amt">$${it.total.toFixed(2)}</span>
        </div>
        <div class="item-sub">${escapeHtml(
          [it.sku || null, `$${it.unitPrice.toFixed(2)} ea`]
            .filter(Boolean)
            .join(' · '),
        )}</div>
      </div>`,
    )
    .join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>KOVA Receipt #${escapeHtml(model.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111111;
    font-family: 'Courier New', Courier, monospace;
    width: 80mm;
  }
  .slip { width: 80mm; padding: 6mm 5mm 8mm; }
  .center { text-align: center; }
  .store { font-family: Arial, Helvetica, sans-serif; font-weight: 800; font-size: 15px; letter-spacing: 0.4px; margin: 0; }
  .meta { font-size: 9.5px; color: #555; margin-top: 2px; }
  .box {
    position: relative;
    border: 1.2px dashed #333;
    border-radius: 8px;
    padding: 10px 8px 8px;
    margin: 12px 0;
    text-align: center;
  }
  .box-label {
    position: absolute;
    top: -7px;
    left: 50%;
    transform: translateX(-50%);
    background: #fff;
    padding: 0 7px;
    font-size: 10px;
    font-weight: 700;
  }
  .order-id { font-size: 13.5px; font-weight: 700; letter-spacing: 0.5px; }
  .sub-id { font-size: 9px; color: #666; margin-top: 2px; }
  .divider { border-top: 1px dashed #aaa; margin: 8px 0; }
  .kv { display: flex; justify-content: space-between; gap: 8px; font-size: 10.5px; line-height: 1.45; margin-bottom: 3px; }
  .kv .k { color: #666; flex-shrink: 0; }
  .kv .v { text-align: right; color: #111; word-break: break-word; }
  .kv .v.bold { font-weight: 700; }
  .items-hdr { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; color: #555; margin-bottom: 5px; }
  .item-row { margin-bottom: 5px; }
  .item-main { display: flex; justify-content: space-between; gap: 6px; font-size: 10.5px; font-weight: 700; }
  .item-name { flex: 1; }
  .item-amt { flex-shrink: 0; }
  .item-sub { font-size: 9.5px; color: #666; }
  .logo-wrap { text-align: center; margin-top: 12px; }
  .logo-wrap img { height: 26px; width: auto; }
  .thanks { text-align: center; font-size: 9.5px; color: #666; margin-top: 6px; }
</style>
</head>
<body>
  <div class="slip">
    <div class="center">
      <p class="store">${escapeHtml(model.storeName.toUpperCase())}</p>
      ${
        model.storePhone || model.storeAddress
          ? `<div class="meta">${escapeHtml(
              [model.storePhone, model.storeAddress].filter(Boolean).join(' · '),
            )}</div>`
          : ''
      }
      <div class="meta">${escapeHtml(model.dateTime)}</div>
    </div>

    <div class="box">
      <span class="box-label">Order ID</span>
      <div class="order-id">#${escapeHtml(model.orderNumber)}</div>
      ${
        model.childOrderNumber
          ? `<div class="sub-id">Pkg: ${escapeHtml(model.childOrderNumber)}</div>`
          : ''
      }
    </div>

    <div class="kv"><span class="k">Payment</span><span class="v">${escapeHtml(model.paymentMethod)}</span></div>
    <div class="kv"><span class="k">Pay Status</span><span class="v bold">${escapeHtml(model.paymentStatus)}</span></div>
    <div class="kv"><span class="k">Order Status</span><span class="v bold">${escapeHtml(model.orderStatus)}</span></div>
    ${
      model.khqrBillNumber
        ? `<div class="kv"><span class="k">Bill Ref</span><span class="v">${escapeHtml(model.khqrBillNumber)}</span></div>`
        : ''
    }

    <div class="divider"></div>

    <div class="kv"><span class="k">Ordered By</span><span class="v bold">${escapeHtml(model.customerName)}</span></div>
    <div class="kv"><span class="k">Phone</span><span class="v">${escapeHtml(model.customerPhone)}</span></div>
    ${
      model.customerEmail
        ? `<div class="kv"><span class="k">Email</span><span class="v">${escapeHtml(model.customerEmail)}</span></div>`
        : ''
    }
    <div class="kv"><span class="k">Address</span><span class="v">${model.addressLines.map(escapeHtml).join('<br/>')}</span></div>

    <div class="divider"></div>

    <div class="kv"><span class="k">Delivery</span><span class="v bold">${escapeHtml(model.deliveryName)}</span></div>
    ${
      model.shippingMethodName
        ? `<div class="kv"><span class="k">Method</span><span class="v">${escapeHtml(model.shippingMethodName)}</span></div>`
        : ''
    }
    <div class="kv"><span class="k">Tracking No</span><span class="v">${escapeHtml(model.trackingNumber || 'Pending')}</span></div>

    <div class="divider"></div>

    <div class="items-hdr"><span>ITEMS (${totalQty})</span><span>AMOUNT</span></div>
    ${itemsHtml || '<div class="meta">No line items</div>'}

    <div class="divider"></div>

    <div class="kv"><span class="k">Subtotal</span><span class="v">$${model.subtotal.toFixed(2)}</span></div>
    <div class="kv"><span class="k">Shipping</span><span class="v">${model.shipping > 0 ? `$${model.shipping.toFixed(2)}` : 'FREE'}</span></div>
    ${
      model.discount > 0
        ? `<div class="kv"><span class="k">Discount</span><span class="v">-$${model.discount.toFixed(2)}</span></div>`
        : ''
    }
    <div class="kv"><span class="k">Total (USD)</span><span class="v bold">$${model.total.toFixed(2)}</span></div>
    <div class="kv"><span class="k">Total (KHR)</span><span class="v bold">${escapeHtml(model.totalRiel)}</span></div>

    <div class="divider"></div>

    <div class="kv"><span class="k">Store</span><span class="v">${escapeHtml(model.storeName)}</span></div>
    <div class="kv"><span class="k">Operator</span><span class="v">${escapeHtml(model.operator)}</span></div>

    <div class="logo-wrap">
      <img src="${logoUrl}" alt="KOVA" />
    </div>
    <div class="thanks">Thank you for shopping on KOVA</div>
  </div>
</body>
</html>`;

  const printWin = window.open('', '_blank', 'width=380,height=720');
  if (!printWin) return;
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => {
    printWin.print();
  }, 250);
}

export function PosOrderReceiptModal({
  open,
  onClose,
  order,
  store,
  operatorName,
  khrRate,
  carrierOverride,
  trackingOverride,
}: PosOrderReceiptModalProps) {
  const [exporting, setExporting] = useState(false);

  if (!order) return null;

  const model = buildReceiptModel(
    order,
    store,
    operatorName,
    khrRate,
    carrierOverride,
    trackingOverride,
  );
  const totalQty = model.items.reduce((sum, it) => sum + it.quantity, 0);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportPosReceiptPdf(model);
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardModal
      open={open}
      onClose={onClose}
      title="Order Receipt (80mm POS Slip)"
      subtitle={`Order #${model.orderNumber} · Thermal POS format ready for PDF export or printing`}
      widthClass="max-w-[460px]"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="bg-white border border-[#ececec] hover:border-black text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => printPosSlip(model)}
            className="inline-flex items-center gap-1.5 bg-white border border-[#ececec] hover:border-[#ff6e20] hover:text-[#ff6e20] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExportPdf()}
            className="inline-flex items-center gap-1.5 bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full transition-colors cursor-pointer"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </>
      }
    >
      <div className="bg-[#f2f3f5] rounded-[16px] py-6 px-4 flex justify-center">
        {/* Authentic 80mm Thermal POS Paper Slip (~304px width) */}
        <div className="kova-pos-slip w-full max-w-[316px] relative drop-shadow-[0_14px_28px_rgba(0,0,0,0.16)]">
          <div className="kova-pos-paper px-5 pt-6 pb-5 font-mono text-[11.5px] leading-[1.45]">
            {/* Store Name & Timestamp */}
            <div className="text-center">
              <p className="font-sans text-[16px] font-extrabold tracking-wide uppercase kova-pos-ink">
                {model.storeName}
              </p>
              {(model.storePhone || model.storeAddress) && (
                <p className="text-[10px] kova-pos-muted mt-0.5 leading-snug">
                  {[model.storePhone, model.storeAddress]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              <p className="text-[10.5px] kova-pos-muted mt-1">
                {model.dateTime}
              </p>
            </div>

            {/* Dashed Rounded Order ID Box */}
            <div className="relative mt-5 mb-4 border border-dashed kova-pos-box-border rounded-[10px] px-3 pt-3.5 pb-2.5 text-center">
              <span className="kova-pos-paper kova-pos-ink absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 text-[10.5px] font-bold">
                Order ID
              </span>
              <p className="text-[14px] font-bold tracking-[0.04em] kova-pos-ink break-all">
                #{model.orderNumber}
              </p>
              {model.childOrderNumber && (
                <p className="text-[9.5px] kova-pos-muted mt-0.5">
                  Pkg: {model.childOrderNumber}
                </p>
              )}
            </div>

            {/* Payment & Status */}
            <div className="flex flex-col gap-1.5">
              <PosRow label="Payment" value={model.paymentMethod} />
              <PosRow label="Pay Status" value={model.paymentStatus} bold />
              <PosRow label="Order Status" value={model.orderStatus} bold />
              {model.khqrBillNumber && (
                <PosRow label="Bill Ref" value={model.khqrBillNumber} />
              )}
            </div>

            <div className="kova-pos-divider my-3.5" />

            {/* Customer Info (Who was ordering) */}
            <div className="flex flex-col gap-1.5">
              <PosRow label="Ordered By" value={model.customerName} bold />
              <PosRow label="Phone" value={model.customerPhone} />
              {model.customerEmail && (
                <PosRow label="Email" value={model.customerEmail} />
              )}
              <div className="flex items-start justify-between gap-3">
                <span className="kova-pos-muted shrink-0">Address</span>
                <span className="kova-pos-ink text-right break-words">
                  {model.addressLines.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </div>
            </div>

            <div className="kova-pos-divider my-3.5" />

            {/* Delivery Info */}
            <div className="flex flex-col gap-1.5">
              <PosRow label="Delivery" value={model.deliveryName} bold />
              {model.shippingMethodName && (
                <PosRow label="Method" value={model.shippingMethodName} />
              )}
              <PosRow
                label="Tracking No"
                value={model.trackingNumber || 'Pending'}
              />
            </div>

            <div className="kova-pos-divider my-3.5" />

            {/* Itemized Order Items */}
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider kova-pos-muted mb-2">
              <span>Items ({totalQty})</span>
              <span>Amount</span>
            </div>
            <div className="flex flex-col gap-2">
              {model.items.length > 0 ? (
                model.items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <span className="kova-pos-ink font-bold leading-snug">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="kova-pos-ink font-bold shrink-0">
                        ${item.total.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] kova-pos-muted">
                      {[item.sku || null, `$${item.unitPrice.toFixed(2)} each`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[10.5px] kova-pos-muted">No line items</p>
              )}
            </div>

            <div className="kova-pos-divider my-3.5" />

            {/* Totals */}
            <div className="flex flex-col gap-1.5">
              <PosRow label="Subtotal" value={`$${model.subtotal.toFixed(2)}`} />
              <PosRow
                label="Shipping"
                value={
                  model.shipping > 0 ? `$${model.shipping.toFixed(2)}` : 'FREE'
                }
              />
              {model.discount > 0 && (
                <PosRow
                  label="Discount"
                  value={`-$${model.discount.toFixed(2)}`}
                />
              )}
              <div className="pt-1 flex flex-col gap-1">
                <PosRow
                  label="Total (USD)"
                  value={`$${model.total.toFixed(2)}`}
                  bold
                />
                <PosRow label="Total (KHR)" value={model.totalRiel} bold />
              </div>
            </div>

            <div className="kova-pos-divider my-3.5" />

            {/* Store & Operator */}
            <div className="flex flex-col gap-1.5">
              <PosRow label="Store" value={model.storeName} />
              <PosRow label="Operator" value={model.operator} />
            </div>

            {/* Bottom KOVA Brand Logo */}
            <div className="mt-5 flex flex-col items-center gap-1.5">
              <img
                src="/images/kova-logo.png"
                alt="KOVA"
                className="h-[26px] w-auto object-contain"
              />
              <p className="text-[9.5px] kova-pos-muted">
                Thank you for shopping on KOVA
              </p>
            </div>
          </div>

          {/* Crisp Serrated Zig-Zag Bottom Tear Edge */}
          <svg
            viewBox="0 0 320 12"
            preserveAspectRatio="none"
            className="block w-full h-[11px]"
            aria-hidden="true"
          >
            <polygon
              fill="#ffffff"
              points="0,0 320,0 320,2 312,11 304,2 296,11 288,2 280,11 272,2 264,11 256,2 248,11 240,2 232,11 224,2 216,11 208,2 200,11 192,2 184,11 176,2 168,11 160,2 152,11 144,2 136,11 128,2 120,11 112,2 104,11 96,2 88,11 80,2 72,11 64,2 56,11 48,2 40,11 32,2 24,11 16,2 8,11 0,2"
            />
          </svg>
        </div>
      </div>
    </DashboardModal>
  );
}

function PosRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="kova-pos-muted shrink-0">{label}</span>
      <span
        className={`kova-pos-ink text-right break-words ${
          bold ? 'font-bold' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}
