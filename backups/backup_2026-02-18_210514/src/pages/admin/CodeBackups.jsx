import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSave, FaUndo, FaTrash, FaCheckCircle, FaExclamationTriangle, FaBoxOpen } from 'react-icons/fa';

const CodeBackups = () => {
    const { t } = useTranslation();
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [restoreStatus, setRestoreStatus] = useState(null); // 'success', 'error', 'none'
    const [statusMessage, setStatusMessage] = useState('');

    // Fetch existing backups
    const fetchBackups = async () => {
        try {
            const response = await fetch('/__dev/backups');
            if (response.ok) {
                const data = await response.json();
                setBackups(data);
            }
        } catch (error) {
            console.error('Failed to fetch backups:', error);
        }
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    // Create Backup
    const handleCreateBackup = async () => {
        setLoading(true);
        setStatusMessage('Creating a snapshot of the current codebase...');
        try {
            const response = await fetch('/__dev/create-backup', { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                setRestoreStatus('success');
                setStatusMessage(`Snapshot created successfully: ${data.backupId}`);
                await fetchBackups(); // Refresh list
            } else {
                setRestoreStatus('error');
                setStatusMessage('Failed to create snapshot.');
            }
        } catch (error) {
            setRestoreStatus('error');
            setStatusMessage('Error contacting dev server.');
        } finally {
            setLoading(false);
            // Clear message after 3 seconds
            setTimeout(() => {
                setRestoreStatus(null);
                setStatusMessage('');
            }, 3000);
        }
    };

    // Restore Backup
    const handleRestoreBackup = async (backupId) => {
        if (!window.confirm(`⚠️ WARNING: This will overwrite your current codebase with the version from ${backupId}.\n\nAre you absolutely sure?`)) {
            return;
        }

        setLoading(true);
        setStatusMessage(`Restoring codebase to ${backupId}... PLEASE WAIT.`);
        try {
            const response = await fetch('/__dev/restore-backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backupId })
            });

            if (response.ok) {
                setRestoreStatus('success');
                setStatusMessage('System restored successfully! Reloading page...');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                setRestoreStatus('error');
                setStatusMessage('Restore failed. Check server console.');
            }
        } catch (error) {
            setRestoreStatus('error');
            setStatusMessage('Error communicating with dev server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                            <FaBoxOpen className="text-indigo-600" />
                            {t('code_snapshots', { defaultValue: 'Code Snapshots & Restore' })}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                            {t('code_backup_desc', { defaultValue: 'Create restore points for your codebase and revert changes instantly.' })}
                        </p>
                    </div>

                    <button
                        onClick={handleCreateBackup}
                        disabled={loading}
                        className={`
                            px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all
                            flex items-center gap-2
                            ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'}
                        `}
                    >
                        {loading ? 'Processing...' : (
                            <>
                                <FaSave /> {t('create_snapshot', { defaultValue: 'Create New Snapshot' })}
                            </>
                        )}
                    </button>
                </div>

                {/* Status Message */}
                {statusMessage && (
                    <div className={`
                        mb-6 p-4 rounded-xl border flex items-center gap-3
                        ${restoreStatus === 'success' ? 'bg-green-50 border-green-200 text-green-700' : ''}
                        ${restoreStatus === 'error' ? 'bg-red-50 border-red-200 text-red-700' : ''}
                        ${!restoreStatus ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}
                    `}>
                        {restoreStatus === 'success' && <FaCheckCircle />}
                        {restoreStatus === 'error' && <FaExclamationTriangle />}
                        <span className="font-medium">{statusMessage}</span>
                    </div>
                )}

                {/* Snapshots List */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                            {t('available_snapshots', { defaultValue: 'Available Snapshots' })}
                        </h2>
                    </div>

                    {backups.length === 0 ? (
                        <div className="p-10 text-center text-gray-400">
                            <FaBoxOpen className="mx-auto text-4xl mb-4 opacity-30" />
                            <p>No snapshots found. Create one to get started.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {backups.map((backup) => (
                                <div key={backup.id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                                            <FaBoxOpen size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 dark:text-white text-lg">
                                                {backup.id.replace('backup_', 'Snapshot ')}
                                            </h3>
                                            <div className="text-sm text-gray-500 flex items-center gap-4 mt-1">
                                                <span>📅 {new Date(backup.timestamp).toLocaleString()}</span>
                                                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs font-mono">
                                                    {backup.id}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleRestoreBackup(backup.id)}
                                            disabled={loading}
                                            className="px-4 py-2 rounded-lg border-2 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 font-medium transition-colors flex items-center gap-2"
                                            title="Restore this version"
                                        >
                                            <FaUndo />
                                            {t('restore', { defaultValue: 'Restore' })}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-xl text-yellow-800 dark:text-yellow-200 text-sm">
                    <div className="flex gap-2">
                        <FaExclamationTriangle className="mt-1" />
                        <div>
                            <strong>Note:</strong> While restoring, the application interface might reload. Make sure to save any unsaved work before creating a snapshot or restoring.
                            <br />
                            Snapshots include the `src`, `public` folders, and configuration files.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodeBackups;
