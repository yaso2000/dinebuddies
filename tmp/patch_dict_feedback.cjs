const fs = require('fs');
const path = require('path');

const enJsonPath = path.join(__dirname, '../src/locales/en.json');
const arJsonPath = path.join(__dirname, '../src/locales/ar.json');
let enDict = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arDict = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const updates = {
    // Feedback Modal Toasts
    "feedback_req_message": { en: "Please write your message details", ar: "الرجاء كتابة تفاصيل رسالتك" },
    "feedback_req_phone": { en: "Please enter a phone number to contact you", ar: "الرجاء إدخال رقم هاتف للتواصل معك" },
    "feedback_success": { en: "Your message has been sent successfully. We will contact you soon.", ar: "تم إرسال رسالتك بنجاح. سنتواصل معك قريباً." },
    "feedback_error": { en: "An error occurred while sending, please try again later.", ar: "حدث خطأ أثناء الإرسال، الرجاء المحاولة مرة أخرى لاحقاً." },
    
    // Feedback Modal UI
    "feedback_title": { en: "Feedback & Complaints", ar: "الشكاوي والاقتراحات" },
    "feedback_intro": { en: "Your opinion matters! If you faced an issue, share it with us so we can resolve it. This message is private and goes directly to management.", ar: "رأيك يهمنا! إذا واجهت مشكلة، شاركها معنا لكي نتمكن من حلها. هذه الرسالة خاصة وتذهب مباشرة للإدارة." },
    "feedback_type": { en: "Message Type", ar: "نوع الرسالة" },
    "complaint": { en: "Complaint", ar: "شكوى" },
    "suggestion": { en: "Suggestion", ar: "اقتراح" },
    "feedback_content": { en: "Message Details", ar: "تفاصيل الرسالة" },
    "feedback_ph_complaint": { en: "Tell us about the issue you faced...", ar: "...أخبرنا عن المشكلة التي واجهتك" },
    "feedback_ph_suggestion": { en: "Share your idea to improve the place...", ar: "...شاركنا فكرتك لتطوير المكان" },
    "feedback_phone": { en: "Contact Phone Number", ar: "رقم الهاتف للتواصل" },
    "feedback_phone_ph": { en: "+971 50 123 4567", ar: "+971 50 123 4567" },
    "feedback_phone_hint": { en: "Management will contact you soon.", ar: "سيقوم قسم الإدارة بالتواصل معك قريباً." },
    "sending": { en: "Sending...", ar: "جاري الإرسال..." },
    "send_feedback": { en: "Send", ar: "إرسال" }
};

let dictUpdated = false;
for (const [key, trans] of Object.entries(updates)) {
    if (enDict[key] !== trans.en) {
        enDict[key] = trans.en;
        dictUpdated = true;
    }
    if (arDict[key] !== trans.ar) {
        arDict[key] = trans.ar;
        dictUpdated = true;
    }
}

if (dictUpdated) {
    fs.writeFileSync(enJsonPath, JSON.stringify(enDict, null, 2));
    fs.writeFileSync(arJsonPath, JSON.stringify(arDict, null, 2));
    console.log("Updated ar.json and en.json with Feedback Modal keys.");
} else {
    console.log("No new keys to patch.");
}
