import React from 'react';

const StatCard = ({ icon: Icon, title, value, trend, color = 'indigo', onClick }) => {
    const colorClasses = {
        indigo: 'from-indigo-600 to-indigo-700',
        purple: 'from-purple-600 to-purple-700',
        green: 'from-green-600 to-green-700',
        amber: 'from-amber-600 to-amber-700',
        red: 'from-red-600 to-red-700',
        blue: 'from-blue-600 to-blue-700'
    };

    return (
        <div
            onClick={onClick}
            className={`
                bg-gradient-to-br ${colorClasses[color]}
                rounded-2xl p-6 shadow-xl
                transform transition-all duration-300
                hover:scale-105 hover:shadow-2xl
                ${onClick ? 'cursor-pointer' : ''}
            `}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-white/80 text-sm font-medium mb-2">{title}</p>
                    <h3 className="text-3xl font-bold text-white mb-2">{value}</h3>
                    {trend && (
                        <p className={`text-sm font-medium ${trend.positive ? 'text-green-200' : 'text-red-200'}`}>
                            {trend.positive ? '↑' : '↓'} {trend.value}
                        </p>
                    )}
                </div>
                <div className="bg-white/20 p-3 rounded-xl">
                    <Icon className="text-2xl text-white" />
                </div>
            </div>
        </div>
    );
};

export default StatCard;
