/**
 * Elite Activity Report — fetch data and generate PDF with charts, tables, and visuals (Elite plan only).
 * Designed to render correctly even when data is empty (ready for when data exists).
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const PERIODS = [
    { value: 7, label: 'Last 7 days' },
    { value: 30, label: 'Last 30 days' },
    { value: 90, label: 'Last 90 days' },
    { value: 365, label: 'Last 12 months' }
];

const MARGIN = 14;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - 2 * MARGIN;

function toDate(v) {
    if (!v) return null;
    if (v.toDate) return v.toDate();
    if (typeof v === 'string' || typeof v === 'number') return new Date(v);
    return null;
}

/**
 * Fetch report data for a business and date range.
 */
export async function fetchReportData(businessId, startDate, endDate, businessName, getCommunityMembers) {
    const start = startDate.getTime();
    const end = endDate.getTime();

    const [membersResult, invSnap, revSnap] = await Promise.all([
        getCommunityMembers(businessId, { includeMembers: true, limit: 500 }),
        getDocs(query(
            collection(db, 'invitations'),
            where('restaurantId', '==', businessId)
        )),
        getDocs(query(
            collection(db, 'reviews'),
            where('partnerId', '==', businessId)
        ))
    ]);

    const memberCount = Number(membersResult?.memberCount || 0);
    const now = new Date();
    let invitationsInPeriod = 0;
    let activeInvitations = 0;
    const invList = [];
    invSnap.docs.forEach(d => {
        const data = d.data();
        const createdAt = toDate(data.createdAt);
        const eventDate = data.date ? new Date(`${data.date}T${data.time || '00:00'}`) : null;
        if (eventDate && eventDate > now) activeInvitations++;
        if (createdAt && createdAt.getTime() >= start && createdAt.getTime() <= end) invitationsInPeriod++;
        invList.push({ id: d.id, ...data, createdAt, eventDate });
    });

    let reviewCount = 0;
    let ratingSum = 0;
    let reviewsInPeriod = 0;
    const revList = [];
    revSnap.docs.forEach(d => {
        const data = d.data();
        const createdAt = toDate(data.createdAt) || toDate(data.timestamp);
        const r = data.rating || 0;
        reviewCount++;
        ratingSum += r;
        if (createdAt && createdAt.getTime() >= start && createdAt.getTime() <= end) reviewsInPeriod++;
        revList.push({ id: d.id, ...data, createdAt, rating: r });
    });
    const rating = reviewCount > 0 ? (ratingSum / reviewCount).toFixed(1) : '0';

    const recentInvitations = invList
        .filter(i => i.createdAt)
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, 10)
        .map(i => ({
            title: i.title || '—',
            date: i.eventDate ? i.eventDate.toLocaleDateString() : '—',
            active: i.eventDate && i.eventDate > now
        }));

    const recentReviews = revList
        .filter(r => r.createdAt)
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, 10)
        .map(r => ({
            rating: r.rating,
            comment: (r.comment || '').slice(0, 80) + ((r.comment || '').length > 80 ? '…' : ''),
            date: r.createdAt ? r.createdAt.toLocaleDateString() : '—'
        }));

    return {
        businessName: businessName || 'Business',
        periodLabel: `${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}`,
        generatedAt: new Date().toLocaleString(),
        memberCount,
        activeInvitations,
        totalInvitations: invSnap.size,
        invitationsInPeriod,
        rating,
        reviewCount,
        reviewsInPeriod,
        recentInvitations,
        recentReviews
    };
}

/**
 * Draw a horizontal bar chart (works with zero values).
 */
function drawBarChart(doc, x, y, width, height, labels, values, colors) {
    const maxVal = Math.max(...values, 1);
    const barHeight = (height - 10) / values.length - 2;
    const barMaxWidth = width - 55;

    labels.forEach((label, i) => {
        const barY = y + 4 + i * (barHeight + 2);
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(label, x, barY + barHeight / 2 + 1);
        doc.setTextColor(0, 0, 0);

        const barWidth = maxVal > 0 ? (values[i] / maxVal) * barMaxWidth : 2;
        const c = colors[i] || [139, 92, 246];
        doc.setFillColor(c[0], c[1], c[2]);
        doc.roundedRect(x + 52, barY, Math.max(barWidth, 1), barHeight, 1, 1, 'F');

        doc.setFontSize(8);
        doc.text(String(values[i]), x + 52 + barMaxWidth + 4, barY + barHeight / 2 + 1);
    });
}

/**
 * Draw summary metric boxes (card-style).
 */
function drawMetricBox(doc, x, y, w, h, label, value, colorRgb) {
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 248, 252);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont(undefined, 'normal');
    doc.text(label, x + 4, y + 8);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(colorRgb[0], colorRgb[1], colorRgb[2]);
    doc.text(String(value), x + 4, y + h - 6);
    doc.setTextColor(0, 0, 0);
}

/**
 * Generate and download PDF report with charts, tables, and visuals.
 * Renders all sections even when data is empty (shows 0 or "No data").
 */
export function generateReportPdf(data) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 16;

    // —— Header / Cover ——
    doc.setFillColor(139, 92, 246);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Activity Report', pageW / 2, 14, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(data.businessName, pageW / 2, 22, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y = 36;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${data.periodLabel}  •  Generated: ${data.generatedAt}`, pageW / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 14;

    // —— Key metrics boxes (5 cards in one row; if too narrow, they wrap visually) ——
    const boxW = (CONTENT_W - 8) / 5;
    const boxH = 22;
    const metrics = [
        { label: 'Community Members', value: data.memberCount, color: [99, 102, 241] },
        { label: 'Active Invitations', value: data.activeInvitations, color: [249, 115, 22] },
        { label: 'Total Invitations', value: data.totalInvitations, color: [59, 130, 246] },
        { label: 'Rating', value: data.rating, color: [34, 197, 94] },
        { label: 'Reviews (total)', value: data.reviewCount, color: [139, 92, 246] }
    ];
    metrics.forEach((m, i) => {
        drawMetricBox(doc, MARGIN + (i % 5) * (boxW + 2), y + Math.floor(i / 5) * (boxH + 4), boxW, boxH, m.label, m.value, m.color);
    });
    y += boxH + 8;

    // —— Summary table (key figures) ——
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Summary', MARGIN, y);
    y += 6;

    doc.autoTable({
        startY: y,
        head: [['Metric', 'Value']],
        body: [
            ['Community members', String(data.memberCount)],
            ['Active invitations', String(data.activeInvitations)],
            ['Total invitations', String(data.totalInvitations)],
            ['Invitations created in period', String(data.invitationsInPeriod)],
            ['Average rating', String(data.rating)],
            ['Total reviews', String(data.reviewCount)],
            ['New reviews in period', String(data.reviewsInPeriod)]
        ],
        margin: { left: MARGIN, right: MARGIN },
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 'auto' } }
    });
    y = doc.lastAutoTable.finalY + 12;

    // —— Bar chart: Activity in period ——
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Activity in period (overview)', MARGIN, y);
    y += 6;

    const chartLabels = ['Community members (total)', 'Invitations created in period', 'Reviews in period'];
    const chartValues = [
        data.memberCount,
        data.invitationsInPeriod,
        data.reviewsInPeriod
    ];
    const chartColors = [[99, 102, 241], [249, 115, 22], [34, 197, 94]];
    drawBarChart(doc, MARGIN, y, CONTENT_W, 28, chartLabels, chartValues, chartColors);
    y += 32;

    // —— Recent Invitations table (always show; empty = one row "No data") ——
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Recent invitations', MARGIN, y);
    y += 6;

    const invBody = data.recentInvitations.length > 0
        ? data.recentInvitations.map(i => [i.title, i.date, i.active ? 'Active' : 'Past'])
        : [['No invitations in this period', '—', '—']];
    doc.autoTable({
        startY: y,
        head: [['Title', 'Date', 'Status']],
        body: invBody,
        margin: { left: MARGIN, right: MARGIN },
        theme: 'grid',
        headStyles: { fillColor: [55, 65, 81], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 35 }, 2: { cellWidth: 25 } }
    });
    y = doc.lastAutoTable.finalY + 12;

    // —— Recent Reviews table (always show; empty = one row "No data") ——
    if (y > pageH - 50) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Recent reviews', MARGIN, y);
    y += 6;

    const revBody = data.recentReviews.length > 0
        ? data.recentReviews.map(r => [String(r.rating), r.comment || '—', r.date])
        : [['—', 'No reviews in this period', '—']];
    doc.autoTable({
        startY: y,
        head: [['Rating', 'Comment', 'Date']],
        body: revBody,
        margin: { left: MARGIN, right: MARGIN },
        theme: 'grid',
        headStyles: { fillColor: [55, 65, 81], fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 28 } }
    });
    y = doc.lastAutoTable.finalY + 14;

    // —— Footer on first page (and add footer helper for multi-page) ——
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
            `Generated by DineBuddies  •  Page ${p} of ${totalPages}`,
            pageW / 2,
            pageH - 8,
            { align: 'center' }
        );
        doc.setTextColor(0, 0, 0);
    }

    doc.save(`activity-report-${Date.now()}.pdf`);
}

export { PERIODS };
