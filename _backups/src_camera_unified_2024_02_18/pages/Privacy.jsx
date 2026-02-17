import React from 'react';
import { useTranslation } from 'react-i18next';

const Privacy = () => {
    const { t } = useTranslation();

    return (
        <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">{t('privacy_policy')}</h1>
            <div className="space-y-6 text-gray-700 leading-relaxed text-justify">
                <section>
                    <h2 className="text-xl font-bold mb-2">{t('info_we_collect')}</h2>
                    <p>{t('info_we_collect_text')}</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">{t('how_we_use')}</h2>
                    <ul className="list-disc pr-6">
                        <li>{t('improve_experience')}</li>
                        <li>{t('communicate')}</li>
                        <li>{t('prevent_fraud')}</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">{t('sharing_info')}</h2>
                    <p>{t('sharing_info_text')}</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">{t('data_security')}</h2>
                    <p>{t('data_security_text')}</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-2">{t('your_rights')}</h2>
                    <p>{t('your_rights_text')}</p>
                </section>
            </div>
        </div>
    );
};

export default Privacy;
