import React, { memo, useCallback } from 'react';
import ProfileInvitationListItem from './ProfileInvitationListItem';

function ProfileInvitationsPanel({
    t,
    activeTab,
    setActiveTab,
    publicPosted,
    privatePosted,
    receivedPrivate,
    myJoinedInvitations,
    activeList,
    navigate,
    deleteInvitation,
    privateInvitations,
}) {
    const clearAllPrivate = useCallback(async () => {
        if (
            !window.confirm(t('confirm_delete_all_private', 'Are you sure you want to delete all your private invitations?'))
        ) {
            return;
        }
        for (const inv of privatePosted) {
            const inPrivateColl = (privateInvitations || []).some((p) => p.id === inv.id);
            await deleteInvitation(inv.id, inPrivateColl);
        }
    }, [privatePosted, privateInvitations, deleteInvitation, t]);

    return (
        <div className="ui-card">
            <div className="ui-card-header ui-tabs hide-scrollbar">
                <button
                    type="button"
                    onClick={() => setActiveTab('public')}
                    className={`ui-tab ${activeTab === 'public' ? 'ui-tab--active' : ''}`}
                >
                    <span>{t('stats_public')}</span>
                    <span className="profile-stat-label" style={{ opacity: 0.8 }}>
                        ({publicPosted.length})
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('private')}
                    className={`ui-tab ${activeTab === 'private' ? 'ui-tab--active' : ''}`}
                >
                    <span>{t('stats_private')}</span>
                    <span className="profile-stat-label" style={{ opacity: 0.8 }}>
                        ({privatePosted.length + receivedPrivate.length})
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('joined')}
                    className={`ui-tab ${activeTab === 'joined' ? 'ui-tab--active' : ''}`}
                >
                    <span>{t('stats_joined')}</span>
                    <span className="profile-stat-label" style={{ opacity: 0.8 }}>
                        ({myJoinedInvitations.length})
                    </span>
                </button>
            </div>

            <div className="profile-section-body">
                {activeTab === 'private' && (
                    <>
                        {privatePosted.length > 0 && (
                            <div style={{ marginBottom: 'var(--profile-stack-gap)' }}>
                                <div className="profile-meta-row profile-meta-row--sm" style={{ padding: '0 5px' }}>
                                    <h4 className="profile-stat-label" style={{ margin: 0 }}>
                                        {t('my_private_posts', 'My Private Posts')}
                                    </h4>
                                    <button
                                        type="button"
                                        className="ui-btn ui-btn--danger-outline"
                                        onClick={async () => {
                                            if (
                                                window.confirm(
                                                    t('confirm_delete_all_private', 'Are you sure you want to delete all your private invitations?')
                                                )
                                            ) {
                                                for (const inv of privatePosted) {
                                                    const inPrivateColl = (privateInvitations || []).some((p) => p.id === inv.id);
                                                    await deleteInvitation(inv.id, inPrivateColl);
                                                }
                                            }
                                        }}
                                    >
                                        {t('clear_all', 'Clear All')}
                                    </button>
                                </div>
                                {privatePosted.map((inv) => (
                                    <ProfileInvitationListItem key={inv.id} inv={inv} navigate={navigate} t={t} />
                                ))}
                            </div>
                        )}

                        {receivedPrivate.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                <h4 className="profile-stat-label" style={{ marginBottom: '10px', marginLeft: '5px' }}>
                                    {t('received_invitations')}
                                </h4>
                                {receivedPrivate.map((inv) => (
                                    <ProfileInvitationListItem key={inv.id} inv={inv} navigate={navigate} t={t} />
                                ))}
                            </div>
                        )}

                        {privatePosted.length === 0 && receivedPrivate.length === 0 && (
                            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {t('nothing_to_show')}
                            </p>
                        )}
                    </>
                )}

                {activeTab !== 'private' && (
                    <>
                        {activeList.map((inv) => (
                            <ProfileInvitationListItem key={inv.id} inv={inv} navigate={navigate} t={t} />
                        ))}

                        {activeList.length === 0 && (
                            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {t('nothing_to_show')}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default memo(ProfileInvitationsPanel);
