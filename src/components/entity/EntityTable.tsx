
import React from 'react';

interface EntityTableProps<T> {
    data: T[];
    renderRow: (item: T) => React.ReactNode;
    columns: string[];
    emptyMessage?: string;
    isLoading?: boolean;
}

const EntityTable = <T extends unknown>({
    data,
    renderRow,
    columns,
    emptyMessage = "No records found.",
    isLoading = false,
}: EntityTableProps<T>) => {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-800">
            {isLoading ? (
                <div className="flex items-center justify-center p-12">
                    <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mb-4"></div>
                        <p className="text-gray-500 dark:text-gray-400">Loading data...</p>
                    </div>
                </div>
            ) : data.length === 0 ? (
                <div className="text-center py-12 px-6">
                    <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">{emptyMessage}</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                            <tr>
                                {columns.map((col, index) => (
                                    <th
                                        key={index}
                                        className={`px-6 py-4 text-left font-medium uppercase tracking-wider ${col.toLowerCase() === 'actions' ? 'text-right' : ''}`}
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {data.map((item, index) => (
                                <tr
                                    key={index}
                                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors duration-150 group"
                                >
                                    {renderRow(item)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default EntityTable;
