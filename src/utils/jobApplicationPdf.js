import { jsPDF } from 'jspdf';

/**
 * Load an image URL into a base64 data URL so jsPDF can embed it.
 * Firebase Storage download URLs may lack permissive CORS headers, so this can
 * fail — callers must treat a null result as "no photo" and continue.
 * @param {string} url
 * @returns {Promise<{ dataUrl: string, format: string } | null>}
 */
async function loadImageAsDataUrl(url) {
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return null;
        const blob = await res.blob();
        const format = /png/i.test(blob.type) ? 'PNG' : 'JPEG';
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        return dataUrl ? { dataUrl, format } : null;
    } catch {
        return null;
    }
}

/**
 * Build and trigger download of a one-page PDF for a single job application.
 * The document is bilingual-friendly (labels translated by the caller) and the
 * applicant photo is embedded when it can be fetched.
 *
 * @param {object} application  A job_applications document (with applicant fields)
 * @param {object} opts
 * @param {(key: string, fallback?: string) => string} opts.t   i18n translator
 * @param {boolean} [opts.rtl]  Right-to-left layout (Arabic)
 */
export async function downloadJobApplicationPdf(application, { t, rtl = false } = {}) {
    const tr = typeof t === 'function' ? t : (_k, f) => f;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    const contentW = pageW - margin * 2;
    // jsPDF core fonts do not shape Arabic; the document is laid out LTR and any
    // Arabic text still renders as provided by the caller's field values.
    const alignX = rtl ? pageW - margin : margin;
    const align = rtl ? 'right' : 'left';

    let y = margin;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(20, 20, 20);
    doc.text(tr('job_app_pdf_title', 'Job Application'), alignX, y, { align });
    y += 24;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(90, 90, 90);
    if (application.jobTitle) {
        doc.text(`${tr('job_position', 'Position')}: ${application.jobTitle}`, alignX, y, { align });
        y += 18;
    }
    if (application.businessName) {
        doc.text(`${tr('business', 'Business')}: ${application.businessName}`, alignX, y, { align });
        y += 18;
    }
    const created = application.createdAt?.toDate ? application.createdAt.toDate() : null;
    if (created) {
        doc.text(`${tr('job_app_received', 'Received')}: ${created.toLocaleString()}`, alignX, y, { align });
        y += 18;
    }

    y += 8;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 24;

    // Photo (embedded when fetchable)
    const photoUrl = application.applicantPhotoUrl;
    if (photoUrl) {
        const img = await loadImageAsDataUrl(photoUrl);
        if (img) {
            const size = 120;
            const imgX = rtl ? pageW - margin - size : margin;
            try {
                doc.addImage(img.dataUrl, img.format, imgX, y, size, size, undefined, 'FAST');
                y += size + 20;
            } catch {
                // ignore embed failure; fall through to the link line below
            }
        }
    }

    // Applicant fields
    const rows = [
        [tr('job_app_name', 'Name'), application.applicantName],
        [tr('job_app_phone', 'Phone'), application.applicantPhone],
        [tr('job_app_contact', 'Other contact'), application.applicantContact],
    ].filter(([, v]) => v);

    doc.setFontSize(13);
    rows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(`${label}:`, alignX, y, { align });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        const valueLines = doc.splitTextToSize(String(value), contentW);
        doc.text(valueLines, alignX, y + 16, { align });
        y += 16 + valueLines.length * 16 + 8;
    });

    // Bio / note
    if (application.applicantBio) {
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(`${tr('job_app_bio', 'About the applicant')}:`, alignX, y, { align });
        y += 18;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        const bioLines = doc.splitTextToSize(String(application.applicantBio), contentW);
        doc.text(bioLines, alignX, y, { align });
        y += bioLines.length * 16 + 8;
    }

    if (photoUrl) {
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(`${tr('job_app_photo_link', 'Photo')}: ${photoUrl}`, margin, doc.internal.pageSize.getHeight() - margin, {
            maxWidth: contentW,
        });
    }

    const safeName = String(application.applicantName || 'applicant').replace(/[^\w؀-ۿ-]+/g, '_').slice(0, 40);
    doc.save(`job-application-${safeName}.pdf`);
}
