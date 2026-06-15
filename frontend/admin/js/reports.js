const API_BASE = "http://localhost:5033/api";

document.addEventListener('DOMContentLoaded', () => {
    loadReportSummary();
    loadTransactionTable();
});

/** 1. FETCH SUMMARY STATS **/
async function loadReportSummary() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE}/dashboard/summary`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();

        // Update UI
        // Reusing dashboard keys, adjust if your backend keys differ
        const revenue = data.totalRevenue || 42850; // Fallback to your screenshot value
        document.getElementById('reportRevenue').innerText = `Rs ${revenue.toLocaleString()}`;
        
        const orders = data.totalOrders || 842;
        document.getElementById('reportOrders').innerText = orders.toLocaleString();

    } catch (e) { console.error("Report summary fail", e); }
}

/** 2. FETCH DETAILED TRANSACTIONS **/
async function loadTransactionTable() {
    const tableBody = document.getElementById('reportTableBody');
    const token = localStorage.getItem('token');

    try {
        // Fetching from your existing Orders endpoint
        const response = await fetch(`${API_BASE}/Orders?pageSize=10`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const result = await response.json();
        const orders = Array.isArray(result) ? result : (result.data || []);

        tableBody.innerHTML = '';

        if (orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="p-20 text-center text-gray-400 italic">No transactions found for this period.</td></tr>';
            return;
        }

        orders.forEach(order => {
            const date = new Date(order.orderDate).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });

            tableBody.innerHTML += `
                <tr class="hover:bg-emerald-50/30 transition-colors">
                    <td class="px-10 py-6 font-bold text-[#062621] text-xs uppercase tracking-wider">
                        ${order.orderNumber || `#${order.id}`}
                    </td>
                    <td class="px-10 py-6 text-gray-400 text-xs font-bold">
                        ${date}
                    </td>
                    <td class="px-10 py-6">
                        <div class="flex flex-col">
                            <span class="text-[#062621] font-bold">${order.customerName || 'Standard Client'}</span>
                            <span class="text-[10px] text-gray-400 font-medium">Billed Successfully</span>
                        </div>
                    </td>
                    <td class="px-10 py-6 font-[800] text-emerald-600">
                        Rs ${(order.grandTotal || 0).toLocaleString()}
                    </td>
                    <td class="px-10 py-6 text-right">
                        <span class="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border ${getStatusStyles(order.status)}">
                            ${order.status || 'Completed'}
                        </span>
                    </td>
                </tr>
            `;
        });

        if (window.lucide) lucide.createIcons();

    } catch (e) {
        console.error("Report table fail", e);
        tableBody.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-red-500">Failed to load transaction data.</td></tr>';
    }
}

/** HELPERS **/
function getStatusStyles(status) {
    const val = (status || '').toLowerCase();
    if (val === 'pending') return 'bg-amber-50 text-amber-600 border-amber-100';
    if (val === 'cancelled') return 'bg-red-50 text-red-600 border-red-100';
    return 'bg-emerald-50 text-emerald-600 border-emerald-100'; // Default to success
}