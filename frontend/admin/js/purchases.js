const API_BASE = "http://localhost:5033/api";
let currentPage = 1;
const pageSize = 5;

document.addEventListener('DOMContentLoaded', async () => {
    await loadLowStockAlerts();
    loadPurchases();
});

/** 1. LOAD LOW STOCK ALERTS **/
async function loadLowStockAlerts() {
    const alertBtn = document.getElementById('alertBtn');
    const alertBadge = document.getElementById('alertBadge');
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.warn("Token not found");
        return;
    }

    try {
        console.log("Fetching low stock notifications...");
        const response = await fetch(`${API_BASE}/notifications/admin/low-stock`, {
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json"
            }
        });
        
        console.log("Notifications response:", response.status);
        
        if (!response.ok) {
            console.error("Failed to fetch notifications:", response.status);
            if (alertBtn) alertBtn.classList.add('hidden');
            return;
        }
        
        const result = await response.json();
        console.log("Notifications data:", result);
        
        const lowStockAlerts = Array.isArray(result) ? result : (result.data || []);
        console.log("Low stock alerts found:", lowStockAlerts.length);

        // Update badge count
        if (alertBadge) {
            alertBadge.textContent = lowStockAlerts.length;
        }

        if (lowStockAlerts.length === 0) {
            console.log("No alerts to display");
            if (alertBtn) alertBtn.classList.add('hidden');
            return;
        }

        // Show alert button
        if (alertBtn) {
            alertBtn.classList.remove('hidden');
        }

        // Store alerts in global state for modal display
        window.lowStockAlerts = lowStockAlerts;
        
        if (window.lucide) lucide.createIcons();
    } catch (e) { 
        console.error("Low stock alert fetch error:", e);
        console.error("Error details:", e.message);
        if (alertBtn) alertBtn.classList.add('hidden');
    }
}

function dismissLowStockAlert() {
    const alertBox = document.getElementById('alertBox');
    if (alertBox) {
        alertBox.classList.add('hidden');
    }
}

function scrollToAlerts() {
    const alertBox = document.getElementById('alertBox');
    if (alertBox) {
        alertBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function openLowStockPopupModal() {
    const modal = document.getElementById('lowStockPopupModal');
    const list = document.getElementById('lowStockPopupList');
    
    if (!modal || !list) return;
    
    const alerts = window.lowStockAlerts || [];
    
    if (alerts.length === 0) {
        list.innerHTML = `
            <div class="px-8 py-16 text-center">
                <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <p class="text-sm font-semibold text-gray-900">All products have sufficient stock</p>
                <p class="text-xs text-gray-500 mt-1">No low stock alerts at this time.</p>
            </div>
        `;
    } else {
        list.innerHTML = alerts.map((alert, index) => {
            const createdAt = new Date(alert.createdAt).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            return `
                <div class="bg-gradient-to-r from-red-50 to-red-50 border border-red-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-red-900 mb-1">${alert.message}</p>
                            <p class="text-xs text-red-600 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M12 6v6l4 2" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"></path>
                                </svg>
                                ${createdAt}
                            </p>
                        </div>
                        <div class="flex-shrink-0 w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeLowStockPopupModal() {
    const modal = document.getElementById('lowStockPopupModal');
    if (modal) modal.classList.add('hidden');
}

/** 2. LOAD PURCHASES FROM API **/
async function loadPurchases() {
    const table = document.getElementById('purchaseTable');
    const token = localStorage.getItem('token');
    
    if (!table) return;

    try {
        const response = await fetch(`${API_BASE}/Purchases`, {
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json"
            }
        });
        
        const result = await response.json();
        // Adjusting based on standard API wrapping { data: [...] }
        const logs = result.data || result || [];

        if (logs.length === 0) {
            table.innerHTML = '<tr><td colspan="6" class="p-20 text-center text-gray-400 italic">No purchase records found in database.</td></tr>';
            return;
        }

        table.innerHTML = logs.map((p, idx) => {
            const date = new Date(p.purchaseDate).toLocaleDateString('en-GB', { 
                day: '2-digit', month: 'short', year: 'numeric' 
            });
            
            // Clean up Vendor ID display (take first 8 chars if it's a GUID)
            const vendorDisplay = p.vendorUserId.length > 15 
                ? p.vendorUserId.substring(0, 8) + '...' 
                : p.vendorUserId;

            return `
                <tr class="hover:bg-emerald-50/30 transition-colors border-b border-gray-50">
                    <td class="px-8 py-5 font-bold text-gray-300 text-xs">${idx + 1}</td>
                    <td class="px-8 py-5">
                        <span class="text-xs font-black text-[#062621] bg-gray-50 px-2 py-1 rounded border border-gray-100">
                            PI-${p.purchaseId}
                        </span>
                    </td>
                    <td class="px-8 py-5">
                        <div class="flex flex-col">
                            <span class="font-bold text-[#062621] leading-tight">Supplier Account</span>
                            <span class="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1">${vendorDisplay}</span>
                        </div>
                    </td>
                    <td class="px-8 py-5 text-center text-gray-400 font-bold text-xs">
                        ${date}
                    </td>
                    <td class="px-8 py-5 font-black text-[#062621]">
                        Rs ${Number(p.totalAmount).toLocaleString()}
                    </td>
                    <td class="px-8 py-5 text-right">
                        <div class="flex justify-end gap-1">
                            <button onclick="viewPurchaseDetails(${p.purchaseId})" class="p-2 text-gray-400 hover:text-emerald-500 transition">
                                <i data-lucide="eye" class="w-4 h-4"></i>
                            </button>
                             <!-- EDIT: Leads to edit-purchase.html -->
                            <a href="edit-purchase.html?id=${p.purchaseId}" class="p-2 text-gray-400 hover:text-blue-500 transition">
                                <i data-lucide="edit-3" class="w-4 h-4"></i>
                            </a>
                            <button onclick="deletePurchase(${p.purchaseId})" class="p-2 text-gray-400 hover:text-red-500 transition">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Refresh icons after HTML injection
        if (window.lucide) lucide.createIcons();
        
    } catch (e) { 
        console.error("Fetch Error:", e);
        table.innerHTML = '<tr><td colspan="6" class="p-20 text-center text-red-500 font-bold">Failed to load procurement data. Check connection.</td></tr>';
    }
}

/** 3. VIEW PURCHASE DETAILS **/
async function viewPurchaseDetails(id) {
    const content = document.getElementById('viewContent');
    const modal = document.getElementById('viewPurchaseModal');
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`${API_BASE}/Purchases/${id}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const p = await res.json();

        content.innerHTML = `
            <div class="space-y-6 pt-4">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-2xl font-black text-[#062621]">PI-${p.purchaseId}</h3>
                        <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">${new Date(p.purchaseDate).toDateString()}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 uppercase">Settled</span>
                    </div>
                </div>

                <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Vendor Account UID</p>
                    <p class="text-sm font-bold text-[#062621] break-all">${p.vendorUserId}</p>
                </div>

                <div class="bg-[#062621] p-8 rounded-[2rem] text-white">
                    <p class="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-1">Grand Total Amount</p>
                    <h4 class="text-4xl font-black">Rs ${Number(p.totalAmount).toLocaleString()}</h4>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } catch (e) {
        alert("Could not load details.");
    }
}

/** 4. DELETE PURCHASE **/
async function deletePurchase(id) {
    if (!confirm("Are you sure you want to delete this invoice record?")) return;
    
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE}/Purchases/${id}`, {
            method: 'DELETE',
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) {
            loadPurchases();
        } else {
            alert("Delete failed. Check server logs.");
        }
    } catch (e) {
        console.error(e);
    }
}

// Pagination placeholder functions (matching your HTML)
function prevPage() { if (currentPage > 1) { currentPage--; loadPurchases(); } }
function nextPage() { currentPage++; loadPurchases(); }