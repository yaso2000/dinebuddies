import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

const FAQItem = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 flex justify-between items-center text-right font-medium text-gray-800 hover:bg-gray-50"
            >
                <span>{question}</span>
                {isOpen ? <FaChevronUp /> : <FaChevronDown />}
            </button>
            {isOpen && (
                <div className="p-4 bg-gray-50 text-gray-600 border-t border-gray-100 leading-relaxed">
                    {answer}
                </div>
            )}
        </div>
    );
};

const SupportPage = () => {
    return (
        <div className="max-w-4xl mx-auto p-6 md:p-8 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">كيف يمكننا مساعدتك؟</h1>
            <p className="text-gray-500 mb-8">اعثر على إجابات للأسئلة الشائعة أو تواصل معنا مباشرة.</p>

            <div className="grid md:grid-cols-2 gap-8">
                {/* FAQs */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">الأسئلة الشائعة</h2>
                    <FAQItem
                        question="كيف أقوم بإنشاء دعوة جديدة؟"
                        answer="يمكنك إنشاء دعوة جديدة بالضغط على زر (+) في القائمة السفلية، ثم اختيار المطعم وتحديد الوقت وعدد الضيوف."
                    />
                    <FAQItem
                        question="هل التطبيق مجاني؟"
                        answer="نعم، التطبيق مجاني للاستخدام الأساسي. يمكن الاشتراك في الباقات المميزة للحصول على ميزات إضافية."
                    />
                    <FAQItem
                        question="كيف أحذف حسابي؟"
                        answer="يمكنك حذف حسابك من خلال صفحة الإعدادات في البروفايل، أو التواصل مع الدعم الفني."
                    />
                    <FAQItem
                        question="ما هي نقاط السمعة؟"
                        answer="نقاط السمعة هي مقياس لمصداقيتك في التطبيق. تزيد عند التزامك بالدعوات وتقييم الآخرين لك، وتنقص عند التغيب المتكرر."
                    />
                </div>

                {/* Contact Form */}
                <div className="bg-white p-6 rounded-xl shadow-sm h-fit">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">تواصل معنا</h2>
                    <form className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
                            <input type="text" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                            <input type="email" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الرسالة</label>
                            <textarea rows="4" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
                        </div>
                        <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-bold">
                            إرسال
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SupportPage;
