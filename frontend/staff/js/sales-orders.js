'use strict';

// BASE_URL is already defined in staff.js - do not redeclare
let allOrders = [];

// ─── INITIALIZATION ───
window.addEventListener('load', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    
    // Check authentication
    if (!token) {
        window.location.href = '/frontend/auth/login.html?msg=loginfirst';
        return;
    }
    
    if (userRole !== 'Staff' && userRole !== 'Admin') {
        alert('Access denied. This page is for staff only.');
        window.location.href = '/frontend/auth/login.html';
        return;
    }

    await loadUserProfile();
    await loadOrders();
});

/**
 * ─── LOAD USER PROFILE ───
 */
async function loadUserProfile() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${BASE_URL}/api/auth/user-profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const user = await response.json();
            document.getElementById('userName').textContent = user.firstName || 'Staff';
            document.getElementById('userProfilePic').src = `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}`;
        }
    } catch (e) {
        console.error('Error loading user profile:', e);
    }
}

/**
 * ─── LOAD ORDERS FROM DATABASE ───
 */
async function loadOrders() {
    const token = localStorage.getItem('token');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    if (loadingIndicator) loadingIndicator.style.display = 'flex';

    try {
        console.log('Fetching orders from:', BASE_URL + '/api/sales');
        
        const response = await fetch(`${BASE_URL}/api/sales`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('Orders received:', data);
            console.log('Number of orders:', Array.isArray(data) ? data.length : 'Not an array');
            
            allOrders = Array.isArray(data) ? data : [];
            displayOrders(allOrders);
        } else {
            console.error('Failed to load orders. Status:', response.status);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            
            const tbody = document.getElementById('ordersTableBody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-red-500 font-bold">Failed to load orders (Status: ${response.status})</td></tr>`;
            }
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        const tbody = document.getElementById('ordersTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-red-500 font-bold">Error: ${error.message}</td></tr>`;
        }
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * ─── DISPLAY ORDERS IN TABLE ───
 */
function displayOrders(orders) {
    const tbody = document.getElementById('ordersTableBody');
    
    if (!tbody) {
        console.error('Table body not found');
        return;
    }

    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-12 text-gray-400">No orders found in database</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => {
        const orderId = order.id || '';
        // Backend returns flat customerName, not nested customer object
        const customerName = (order.customerName || 'Walk-in').trim();
        const amount = (order.grandTotal || 0).toFixed(2);
        const itemCount = order.itemCount || 0;
        const date = new Date(order.saleDate).toLocaleDateString();
        const paymentStatus = order.paymentStatus || 'Unknown';
        
        return `
            <tr>
                <td><strong>#${order.invoiceNumber || orderId.substring(0, 8)}</strong></td>
                <td>${customerName}</td>
                <td><strong>Rs. ${amount}</strong></td>
                <td>${itemCount}</td>
                <td>${date}</td>
                <td>${getPaymentBadge(paymentStatus)}</td>
                <td class="flex gap-1">
                    <button onclick="viewOrder('${orderId}')" class="p-2 rounded-full text-gray-400 hover:text-primary hover:bg-gray-100 transition-all" title="View"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    <button onclick="deleteOrder('${orderId}')" class="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </td>
            </tr>
        `;
    }).join('');
    
    if (window.lucide) lucide.createIcons();
}

/**
 * ─── FILTER TABLE BY SEARCH ───
 */
function filterTable() {
    const searchBox = document.getElementById('searchBox');
    if (!searchBox) return;

    const searchTerm = searchBox.value.toLowerCase();
    
    const filtered = allOrders.filter(order => {
        // Backend returns flat structure with customerName
        const orderId = (order.invoiceNumber || order.id || '').toString().toLowerCase();
        const customerName = (order.customerName || '').toLowerCase();
        
        return orderId.includes(searchTerm) || customerName.includes(searchTerm);
    });
    
    displayOrders(filtered);
}

/**
 * ─── GET PAYMENT STATUS BADGE ───
 */
function getPaymentBadge(status) {
    const badges = {
        'Completed': '<span class="badge-green">✓ Completed</span>',
        'Pending': '<span class="badge-yellow">⏱ Pending</span>',
        'Cancelled': '<span class="badge-red">✕ Cancelled</span>'
    };
    return badges[status] || `<span class="badge-blue">${status}</span>`;
}

/**
 * ─── VIEW ORDER DETAILS ───
 */
async function viewOrder(orderId) {
    const token = localStorage.getItem('token');
    const container = document.getElementById('viewOrderModalBody');
    container.innerHTML = `<div style="text-align: center; padding: 2.5rem 0; color: #9ca3af; font-style: italic; font-size: 0.875rem;">Loading profile...</div>`;
    document.getElementById('viewOrderModal').style.display = 'flex';

    try {
        const response = await fetch(`${BASE_URL}/api/sales/${orderId}`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const order = await response.json();
            console.log('Order received:', order);
            
            const customerName = order.customerName || 'Walk-in Customer';
            // Backend returns 'items' (camelCase) from SaleResponseDto.Items
            const items = (order.items || order.saleItems || []);
            console.log('Items array:', items);
            
            const itemsHTML = items.length === 0 
                ? `<p style="font-size: 0.875rem; color: #9ca3af; font-style: italic; text-align: center; padding: 1rem 0; margin: 0;">No items in this order.</p>`
                : items.map(item => `
                    <div style="padding: 1.25rem; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 1.25rem; display: flex; justify-content: space-between; align-items: flex-start; background: #f9fafb;">
                        <div style="flex: 1;">
                            <p style="font-size: 0.9rem; font-weight: 700; color: #062621; margin: 0;">${item.productName || 'Product'}</p>
                            <p style="font-size: 0.8rem; color: #9ca3af; margin-top: 0.5rem; margin-bottom: 0;">Qty: ${item.quantity} × Rs. ${item.unitPrice?.toFixed(2)}</p>
                        </div>
                        <p style="font-size: 0.95rem; font-weight: 900; color: #062621; text-align: right; margin: 0; flex-shrink: 0; margin-left: 1rem;">Rs. ${item.totalPrice?.toFixed(2)}</p>
                    </div>`).join('');

            container.innerHTML = `
                <!-- ORDER HEADER DETAILS -->
                <div style="border-radius: 2.5rem; overflow: hidden; border: 1px solid rgba(16, 185, 129, 0.2);">
                    <div style="padding: 2rem 2rem; border-bottom: 1px solid #f3f4f6;">
                        <h2 style="font-size: 1rem; font-weight: 700; text-transform: uppercase; color: #062621; letter-spacing: -0.02em; margin: 0;">Order Summary</h2>
                    </div>
                    
                    <div style="padding: 2rem; display: grid; grid-cols-1: 1fr; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
                        <div style="space-y: 0.5rem;">
                            <p style="font-size: 9px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin: 0 0 0.5rem 0;">Order Number</p>
                            <p style="font-size: 1rem; font-weight: 700; color: #062621; margin: 0;">${order.invoiceNumber || orderId.substring(0, 8)}</p>
                        </div>
                        <div style="space-y: 0.5rem;">
                            <p style="font-size: 9px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin: 0 0 0.5rem 0;">Order Date</p>
                            <p style="font-size: 1rem; font-weight: 700; color: #062621; margin: 0;">${new Date(order.saleDate).toLocaleDateString()}</p>
                        </div>
                        <div style="space-y: 0.5rem;">
                            <p style="font-size: 9px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin: 0 0 0.5rem 0;">Customer</p>
                            <p style="font-size: 1rem; font-weight: 700; color: #062621; margin: 0;">${customerName}</p>
                        </div>
                        <div style="space-y: 0.5rem;">
                            <p style="font-size: 9px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin: 0 0 0.5rem 0;">Payment Method</p>
                            <p style="font-size: 1rem; font-weight: 700; color: #062621; margin: 0;">${order.paymentMethod || 'N/A'}</p>
                        </div>
                        <div style="space-y: 0.5rem;">
                            <p style="font-size: 9px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin: 0 0 0.5rem 0;">Payment Status</p>
                            <p style="font-size: 1rem; font-weight: 700; color: #062621; margin: 0;">${order.paymentStatus || 'N/A'}</p>
                        </div>
                        <div style="space-y: 0.5rem;">
                            <p style="font-size: 9px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin: 0 0 0.5rem 0;">Total Amount</p>
                            <p style="font-size: 1.125rem; font-weight: 900; color: #10b981; margin: 0;">Rs. ${(order.grandTotal || 0).toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                <!-- ORDER ITEMS TABLE -->
                <div style="border-radius: 2.5rem; overflow: hidden; border: 1px solid rgba(16, 185, 129, 0.2); margin-top: 1.5rem;">
                    <div style="padding: 2rem; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between;">
                        <h2 style="font-size: 1rem; font-weight: 700; text-transform: uppercase; color: #062621; letter-spacing: -0.02em; margin: 0;">Order Items</h2>
                        <p style="font-size: 0.875rem; font-weight: 700; color: #10b981; margin: 0;">Items: <span>${items.length}</span></p>
                    </div>
                    <div style="padding: 2rem; display: flex; flex-direction: column; gap: 1rem;">
                        ${itemsHTML}
                    </div>
                </div>

                <!-- PAYMENT SUMMARY -->
                <div style="border-radius: 2.5rem; overflow: hidden; border: 1px solid rgba(16, 185, 129, 0.2); margin-top: 1.5rem;">
                    <div style="padding: 2rem; border-bottom: 1px solid #f3f4f6;">
                        <h2 style="font-size: 1rem; font-weight: 700; text-transform: uppercase; color: #062621; letter-spacing: -0.02em; margin: 0;">Payment Summary</h2>
                    </div>
                    <div style="padding: 2rem; space-y: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 1rem; border-bottom: 1px solid #f3f4f6;">
                            <span style="font-size: 0.875rem; font-weight: 600; color: #062621;">Subtotal</span>
                            <span style="font-weight: 700; color: #062621; font-size: 0.875rem;">Rs. ${(order.subTotal || 0).toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 1rem; padding-top: 1rem; border-bottom: 1px solid #f3f4f6;">
                            <span style="font-size: 0.875rem; font-weight: 600; color: #062621;">Discount</span>
                            <span style="font-weight: 700; color: #062621; font-size: 0.875rem;">-Rs. ${(order.discountAmount || 0).toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 1rem;">
                            <span style="font-size: 1rem; font-weight: 700; color: #062621;">Grand Total</span>
                            <span style="font-size: 1.25rem; font-weight: 900; color: #10b981;">Rs. ${(order.grandTotal || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `<p style="text-align: center; padding: 2.5rem 0; color: #dc2626;">Failed to load order details.</p>`;
        }
    } catch (error) {
        console.error('Error loading order details:', error);
        container.innerHTML = `<p style="text-align: center; padding: 2.5rem 0; color: #dc2626;">Error: ${error.message}</p>`;
    }
}

function closeViewOrderModal() { 
    document.getElementById('viewOrderModal').style.display = 'none'; 
}

/**
 * ─── DELETE ORDER ───
 */
async function deleteOrder(orderId) {
    if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
        return;
    }

    const token = localStorage.getItem('token');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    if (loadingIndicator) loadingIndicator.style.display = 'flex';

    try {
        const response = await fetch(`${BASE_URL}/api/sales/${orderId}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            alert('Order deleted successfully');
            await loadOrders();
        } else {
            const errorText = await response.text();
            console.error('Delete error:', response.status, errorText);
            alert('Failed to delete order. Status: ' + response.status);
        }
    } catch (error) {
        console.error('Error deleting order:', error);
        alert('Error deleting order: ' + error.message);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}
