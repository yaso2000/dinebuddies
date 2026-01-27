import React from 'react';

const Privacy = () => {
    return (
        <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">سياسة الخصوصية</h1>
            <div className="space-y-6 text-gray-700 leading-relaxed text-justify">
                <section>
                    <h2 className="text-xl font-bold mb-2">1. المعلومات التي نجمعها</h2>
                    <p>نجمع المعلومات التي تقدمها لنا عند التسجيل (الاسم، البريد الإلكتروني، الصورة). كما نجمع بيانات الموقع الجغرافي لتسهيل العثور على المطاعم القريبة.</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">2. كيف نستخدم معلوماتك</h2>
                    <ul className="list-disc pr-6">
                        <li>لتحسين تجربتك في التطبيق وتخصيص الاقتراحات.</li>
                        <li>للتواصل معك بخصوص تحديثات الحساب أو الإشعارات الهامة.</li>
                        <li>لمنع الاحتيال وضمان أمان المنصة.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">3. مشاركة المعلومات</h2>
                    <p>نحن لا نبيع بياناتك الشخصية لأي طرف ثالث. قد نشارك بعض البيانات العامة (بدون هوية) مع الشركاء لتحسين الخدمات.</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">4. أمان البيانات</h2>
                    <p>نستخدم تقنيات التشفير الحديثة لحماية بياناتك. ومع ذلك، لا يوجد نظام أمني آمن بنسبة 100%.</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">5. حقوقك</h2>
                    <p>يحق لك طلب تعديل أو حذف بياناتك في أي وقت من خلال إعدادات التطبيق أو التواصل مع الدعم الفني.</p>
                </section>
            </div>
        </div>
    );
};

export default Privacy;
