import React from 'react';

const Terms = () => {
    return (
        <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">اتفاقية الترخيص وشروط الاستخدام</h1>
            <div className="space-y-6 text-gray-700 leading-relaxed text-justify">
                <section>
                    <h2 className="text-xl font-bold mb-2">1. مقدمة</h2>
                    <p>أهلاً بكم في تطبيق DineBuddies. باستخداك لهذا التطبيق، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء منها، فلا يحق لك استخدام التطبيق.</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">2. حساب المستخدم</h2>
                    <ul className="list-disc pr-6">
                        <li>أنت مسؤول عن الحفاظ على سرية معلومات حسابك.</li>
                        <li>يجب أن تكون المعلومات المسجلة دقيقة وصحيحة.</li>
                        <li>يحق للإدارة إيقاف أي حساب ينتهك المعايير الأخلاقية.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">3. سلوك المستخدم</h2>
                    <p>يمنع استخدام التطبيق لأي أغراض غير قانونية أو مسيئة. يجب احترام جميع الأعضاء وعدم إرسال رسائل مزعجة أو دعوات وهمية.</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">4. حقوق الملكية الفكرية</h2>
                    <p>جميع حقوق التصميم والشعارات والمحتوى مملوكة لتطبيق DineBuddies ولا يجوز نسخها أو استخدامها دون إذن.</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">5. تحديد المسؤولية</h2>
                    <p>التطبيق يوفر منصة للتواصل بين الأفراد لتنسيق اللقاءات. نحن لسنا مسؤولين عن جودة الطعام في المطاعم أو تصرفات الأفراد خارج التطبيق.</p>
                </section>
            </div>
        </div>
    );
};

export default Terms;
