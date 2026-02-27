import React from 'react';
import { useTranslation } from 'react-i18next';

const Terms = () => {
    const { t } = useTranslation();

    return (
        <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">{t('terms_of_service')}</h1>
            <div className="space-y-6 text-gray-700 leading-relaxed text-justify">
                <section>
                    <h2 className="text-xl font-bold mb-2">{t('terms_intro')}</h2>
                    <p>{t('terms_intro_text')}</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">{t('user_account')}</h2>
                    <ul className="list-disc pr-6">
                        <li>{t('account_responsibility')}</li>
                        <li>{t('accurate_info')}</li>
                        <li>{t('suspend_account')}</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">{t('user_conduct')}</h2>
                    <p>{t('user_conduct_text')}</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">{t('intellectual_property')}</h2>
                    <p>{t('intellectual_property_text')}</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">{t('liability_limitation')}</h2>
                    <p>{t('liability_limitation_text')}</p>
                </section>
            </div>
        </div>
    );
};

export default Terms;
