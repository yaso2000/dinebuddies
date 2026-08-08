const fs = require('fs');
const path = require('path');

const enJsonPath = path.join(__dirname, '../src/locales/en.json');
const arJsonPath = path.join(__dirname, '../src/locales/ar.json');
let enDict = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arDict = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const newTranslations = {
    // EnhancedReviews existing keys
    "reviews": { en: "Reviews", ar: "التقييمات" },
    "filter": { en: "Filter", ar: "تصفية" },
    "all_ratings": { en: "All Ratings", ar: "جميع التقييمات" },
    "stars": { en: "Stars", ar: "نجوم" },
    "sort": { en: "Sort", ar: "ترتيب" },
    "recent": { en: "Most Recent", ar: "الأحدث" },
    "highest": { en: "Highest Rating", ar: "الأعلى تقييماً" },
    "lowest": { en: "Lowest Rating", ar: "الأقل تقييماً" },
    "no_reviews_filter": { en: "No reviews for this rating yet", ar: "لا توجد تقييمات بهذا العدد من النجوم" },
    "no_reviews": { en: "No reviews yet. Be the first to review!", ar: "لا توجد تقييمات بعد. كن أول من يقيّم!" },
    "business_response": { en: "Business Response", ar: "رد المنشأة" },
    "write_reply": { en: "Write your response...", ar: "اكتب ردك..." },
    "posting": { en: "Posting...", ar: "جاري النشر..." },
    "post_reply": { en: "Post Reply", ar: "نشر الرد" },
    "reply": { en: "Reply", ar: "رد" },
    "show_all_reviews": { en: "Show All Reviews", ar: "عرض كافة التقييمات" },
    "page": { en: "Page", ar: "صفحة" },
    "of": { en: "of", ar: "من" },
    "show_less": { en: "Show Less", ar: "عرض أقل" },
    
    // Some general keys for Business Profile Action Modal
    "profile_saved": { en: "Profile Saved", ar: "تم حفظ الملف" },
    "business_cannot_join_community": { en: "Businesses cannot join communities", ar: "لا يمكن للمنشآت الانضمام للمجتمعات" },
    "login_to_submit_review": { en: "Login to submit a review", ar: "قم بتسجيل الدخول لإضافة تقييم" },
    "business_cannot_review": { en: "Businesses cannot review themselves", ar: "لا يمكن للمنشآت إضافة تقييمات" },
    "please_write_comment": { en: "Please write a comment", ar: "يرجى كتابة تعليق" },
    "already_reviewed": { en: "You have already reviewed this", ar: "لقد قمت بتقييم هذه المنشأة مسبقاً" },
    "review_submitted_success": { en: "Review submitted successfully", ar: "تم إرسال التقييم بنجاح" },
    "review_submit_failed": { en: "Failed to submit review", ar: "فشل إرسال التقييم" },
    "upload_image_failed": { en: "Failed to upload image", ar: "فشل رفع الصورة" },
    "confirm_delete_image": { en: "Are you sure you want to delete this image?", ar: "هل أنت متأكد أنك تريد حذف هذه الصورة؟" },
    "delete_image_failed": { en: "Failed to delete image", ar: "فشل حذف الصورة" }
};

let dictUpdated = false;
for (const [key, trans] of Object.entries(newTranslations)) {
    if (!enDict[key]) {
        enDict[key] = trans.en;
        dictUpdated = true;
    }
    if (!arDict[key]) {
        arDict[key] = trans.ar;
        dictUpdated = true;
    }
}

if (dictUpdated) {
    fs.writeFileSync(enJsonPath, JSON.stringify(enDict, null, 2));
    fs.writeFileSync(arJsonPath, JSON.stringify(arDict, null, 2));
    console.log("Updated ar.json and en.json with EnhancedReviews and missing BP keys.");
} else {
    console.log("No new keys needed.");
}

// Ensure `i18n.language` works for placeholders in EnhancedReviews.jsx that used Template Literals natively
function processComponent(relPath, replacements) {
    const fullPath = path.join(__dirname, '..', relPath);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');

    for (let r of replacements) {
        content = content.replace(r.search, r.replace);
    }

    fs.writeFileSync(fullPath, content);
    console.log(`Patched specific localized features in ${relPath}`);
}

processComponent('src/components/EnhancedReviews.jsx', [
    // Change template literals to just use standard translations since template literals with variables inside t('..', `..`) break if not passed explicitly as an interpolator object. The Arabic localization won't insert variables magically unless we set it up. So we just use generic text.
    { search: /t\('no_reviews_filter',\s*`No \$\{filterRating\}-star reviews yet`\)/g, replace: "t('no_reviews_filter', 'No reviews for this rating yet')" },
    { search: /t\('show_all_reviews',\s*`Show All \$\{filteredReviews\.length\} Reviews`\)/g, replace: "t('show_all_reviews', 'Show All Reviews')" }
]);

