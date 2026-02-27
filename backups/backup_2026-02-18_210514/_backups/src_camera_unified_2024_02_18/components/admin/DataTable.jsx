import React from 'react';

const DataTable = ({
    columns,
    data,
    loading,
    onRowClick,
    emptyMessage = 'No data found'
}) => {
    if (loading) {
        return (
            <div className="bg-slate-900 rounded-2xl p-8 border border-slate-700">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                </div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="bg-slate-900 rounded-2xl p-8 border border-slate-700">
                <div className="text-center text-gray-400">
                    {emptyMessage}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-700">
                            {columns.map((column, index) => (
                                <th
                                    key={index}
                                    className="text-left p-4 text-sm font-semibold text-gray-400 uppercase tracking-wider"
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                onClick={() => onRowClick && onRowClick(row)}
                                className={`
                                    border-b border-slate-800 last:border-0
                                    ${onRowClick ? 'cursor-pointer hover:bg-slate-800' : ''}
                                    transition-colors
                                `}
                            >
                                {columns.map((column, colIndex) => (
                                    <td key={colIndex} className="p-4">
                                        {column.render ? column.render(row) : row[column.key]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-slate-800">
                {data.map((row, index) => (
                    <div
                        key={index}
                        onClick={() => onRowClick && onRowClick(row)}
                        className={`p-4 ${onRowClick ? 'cursor-pointer active:bg-slate-800' : ''}`}
                    >
                        {columns.map((column, colIndex) => (
                            <div key={colIndex} className="mb-2 last:mb-0">
                                <div className="text-xs text-gray-400 mb-1">{column.header}</div>
                                <div>{column.render ? column.render(row) : row[column.key]}</div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DataTable;
