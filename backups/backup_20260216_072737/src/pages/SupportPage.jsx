import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
    return (
        <div className="max-w-4xl mx-auto p-6 md:p-8 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{t('how_can_we_help')}</h1>
            <p className="text-gray-500 mb-8">{t('faq_description')}</p>

            <div className="grid md:grid-cols-2 gap-8">
                {/* FAQs */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">{t('faq_title')}</h2>
                    <FAQItem
                        question={t('faq_create_invitation')}
                        answer={t('faq_create_answer')}
                    />
                    <FAQItem
                        question={t('faq_is_free')}
                        answer={t('faq_free_answer')}
                    />
                    <FAQItem
                        question={t('faq_delete_account')}
                        answer={t('faq_delete_answer')}
                    />
                    <FAQItem
                        question={t('faq_reputation')}
                        answer={t('faq_reputation_answer')}
                    />
                </div>

                {/* Contact Form */}
                <div className="bg-white p-6 rounded-xl shadow-sm h-fit">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">{t('contact_us')}</h2>
                    <form className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')}</label>
                            <input type="text" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
                            <input type="email" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('message_label')}</label>
                            <textarea rows="4" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
                        </div>
                        <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-bold">
                            {t('send')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SupportPage;
