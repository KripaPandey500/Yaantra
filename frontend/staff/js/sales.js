// ─── SALES PAGE - COUNTER SALES & BILLING ───
'use strict';

let allProducts = [];
let cartItems = [];
let selectedCustomer = null;
let currentInvoice = null;

// ─── INIT ───
document.addEventListener('DOMContentLoaded', async () => {
    // Validate token and fetch user ID
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/frontend/auth/login.html?msg=loginfirst';
        return;
    }

    let userId = localStorage.getItem('userId');
    if (!userId) {
        // Fetch profile to get integer userId
        try {
            const res = await fetch(`${BASE_URL}/api/auth/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
            const profile = await res.json();
            userId = profile.id || profile.userId;
            if (!userId) throw new Error('No userId in profile');
            localStorage.setItem('userId', userId);
        } catch (err) {
            console.error('Profile fetch error:', err);
            alert('Failed to get your profile. Please login again.');
            localStorage.removeItem('token');
            window.location.href = '/frontend/auth/login.html?msg=loginfirst';
            return;
        }
    }

    // Ensure walk-in fields are visible by default (no customer selected)
    document.getElementById('walkInFields').classList.remove('hidden');
    
    await loadStaffProfile();
    await loadAllProducts();
    await loadRegisteredCustomers();
    calculateTotals();

    // Handle Khalti return success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
        const invoice = urlParams.get('invoice');
        showToast(`✓ Invoice #${invoice} generated successfully!`, true);
        
        // Clear cart and reset form
        cartItems = [];
        selectedCustomer = null;
        renderCart();
        calculateTotals();
        document.getElementById('saleCustomer').value = '';
        document.getElementById('walkInName').value = '';
        document.getElementById('walkInPhone').value = '';
        document.getElementById('walkInEmail').value = '';
        document.getElementById('saleDiscount').value = '0';
        document.getElementById('walkInFields').classList.remove('hidden');
        
        // Remove query params from URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// ─── LOAD STAFF PROFILE ───
async function loadStaffProfile() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch(`${BASE_URL}/api/auth/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const staff = await res.json();
            document.getElementById('userName').textContent = `${staff.firstName} ${staff.lastName}`;
            if (staff.profilePicture) {
                document.getElementById('userProfilePic').src = `${BASE_URL}${staff.profilePicture}`;
            }
        }
    } catch (e) {
        console.error('Profile load error:', e);
    }
}

// ─── LOAD ALL PRODUCTS ───
async function loadAllProducts() {
    const token = localStorage.getItem('token');
    const grid = document.getElementById('partsGrid');
    
    if (!token) {
        grid.innerHTML = '<p class="text-orange-500 text-xs italic">Please login to load products</p>';
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/products?pageSize=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${res.status}`);
        }

        const response = await res.json();
        
        // Handle paginated response - extract 'data' array
        allProducts = response.data || response || [];
        
        if (allProducts.length === 0) {
            grid.innerHTML = '<p class="text-gray-400 text-xs italic">No products available in database</p>';
        } else {
            renderProducts(allProducts);
        }
    } catch (e) {
        console.error('Products load error:', e);
        grid.innerHTML = `<p class="text-red-500 text-xs">Error: ${e.message}</p>`;
    }
}

// ─── LOAD REGISTERED CUSTOMERS ───
async function loadRegisteredCustomers() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch(`${BASE_URL}/api/auth/customers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch customers');

        const customers = await res.json();
        const select = document.getElementById('saleCustomer');

        customers.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = `${c.firstName} ${c.lastName} (${c.phone})`;
            option.dataset.customer = JSON.stringify(c);
            select.appendChild(option);
        });
    } catch (e) {
        console.error('Customers load error:', e);
    }
}

// ─── RENDER PRODUCTS ───
function renderProducts(products) {
    const grid = document.getElementById('partsGrid');
    if (!products || products.length === 0) {
        grid.innerHTML = '<p class="text-gray-400 text-xs italic">No products available</p>';
        return;
    }

    grid.innerHTML = products.map(p => {
        // Handle both camelCase and PascalCase field names
        const id = p.id || p.Id;
        const name = p.name || p.Name || 'Unknown';
        const sku = p.sku || p.SKU || 'N/A';
        const price = p.price || p.Price || 0;
        const stock = p.stockQty || p.StockQty || 0;
        
        return `
        <div class="border border-gray-100 rounded-2xl p-4 bg-white hover:shadow-md hover:border-primary transition-all cursor-pointer"
             onclick="addToCart(${id}, '${name.replace(/'/g, "\\'")}', ${price}, ${stock})">
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <h4 class="text-sm font-bold text-primary">${name}</h4>
                    <p class="text-[9px] text-gray-400 font-mono">${sku}</p>
                </div>
                <span class="text-[9px] font-bold px-2 py-1 bg-primary/5 text-primary rounded">
                    ${stock} in stock
                </span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-lg font-black text-primary">Rs. ${price.toFixed(2)}</span>
                <button class="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-sm hover:bg-primary-light transition-all">
                    +
                </button>
            </div>
        </div>
        `;
    }).join('');
}

// ─── FILTER PRODUCTS ───
window.filterParts = function(query) {
    const filtered = allProducts.filter(p => {
        const name = (p.name || p.Name || '').toLowerCase();
        const sku = (p.sku || p.SKU || '').toLowerCase();
        const searchQuery = query.toLowerCase();
        
        return name.includes(searchQuery) || sku.includes(searchQuery);
    });
    renderProducts(filtered);
};

// ─── ADD TO CART ───
window.addToCart = function(productId, name, price, stock) {
    if (stock <= 0) {
        alert('Out of stock');
        return;
    }

    const existing = cartItems.find(item => item.id === productId);
    if (existing) {
        if (existing.qty < stock) {
            existing.qty++;
        } else {
            alert('Not enough stock');
            return;
        }
    } else {
        cartItems.push({ id: productId, name, price, qty: 1, stock });
    }

    renderCart();
    calculateTotals();
};

// ─── RENDER CART ───
function renderCart() {
    const container = document.getElementById('invoiceItems');
    
    if (cartItems.length === 0) {
        container.innerHTML = '<p class="text-center py-10 text-gray-300 italic text-xs border-2 border-dashed border-gray-50 rounded-2xl">Your cart is empty</p>';
        return;
    }

    container.innerHTML = cartItems.map((item, idx) => `
        <div class="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl">
            <div class="flex-1">
                <p class="text-xs font-bold text-primary">${item.name}</p>
                <p class="text-[9px] text-gray-400">Rs. ${item.price.toFixed(2)} × ${item.qty}</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="changeQty(${idx}, -1)" class="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs hover:bg-red-200">−</button>
                <span class="w-8 text-center text-xs font-bold">${item.qty}</span>
                <button onclick="changeQty(${idx}, 1)" class="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs hover:bg-green-200">+</button>
                <button onclick="removeFromCart(${idx})" class="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs hover:bg-gray-300 ml-2">✕</button>
            </div>
        </div>
    `).join('');
}

// ─── CHANGE QUANTITY ───
window.changeQty = function(idx, delta) {
    const item = cartItems[idx];
    const newQty = item.qty + delta;
    
    if (newQty <= 0) {
        removeFromCart(idx);
    } else if (newQty <= item.stock) {
        item.qty = newQty;
        renderCart();
        calculateTotals();
    } else {
        alert('Not enough stock');
    }
};

// ─── REMOVE FROM CART ───
window.removeFromCart = function(idx) {
    cartItems.splice(idx, 1);
    renderCart();
    calculateTotals();
};

// ─── HANDLE CUSTOMER SELECT ───
window.handleCustomerSelect = function() {
    const select = document.getElementById('saleCustomer');
    const walkInFields = document.getElementById('walkInFields');
    
    if (select.value) {
        const option = select.options[select.selectedIndex];
        selectedCustomer = JSON.parse(option.dataset.customer);
        walkInFields.classList.add('hidden');
    } else {
        selectedCustomer = null;
        walkInFields.classList.remove('hidden');
    }
};

// ─── CALCULATE TOTALS WITH LOYALTY DISCOUNT ───
window.calculateTotals = function() {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    // LOYALTY DISCOUNT: 10% if subtotal > Rs. 5000
    let loyaltyDiscount = 0;
    if (subtotal > 5000) {
        loyaltyDiscount = subtotal * 0.10;
    }
    
    // MANUAL DISCOUNT (if staff adds additional discount)
    const manualDiscount = parseFloat(document.getElementById('saleDiscount').value) || 0;
    
    // TOTAL DISCOUNT
    const totalDiscount = loyaltyDiscount + manualDiscount;
    const grandTotal = subtotal - totalDiscount;

    // Display subtotal
    document.getElementById('lblSubtotal').textContent = `Rs. ${subtotal.toFixed(2)}`;
    
    // Show/hide and update discount display
    const discountRow = document.querySelector('[data-discount-row]');
    if (discountRow) {
        if (totalDiscount > 0) {
            discountRow.classList.remove('hidden');
            discountRow.querySelector('[data-discount-amount]').textContent = `-Rs. ${totalDiscount.toFixed(2)}`;
            if (loyaltyDiscount > 0) {
                discountRow.title = `Loyalty Discount: Rs. ${loyaltyDiscount.toFixed(2)} + Manual: Rs. ${manualDiscount.toFixed(2)}`;
            }
        } else {
            discountRow.classList.add('hidden');
        }
    }
    
    // Display grand total
    document.getElementById('lblGrandTotal').textContent = `Rs. ${grandTotal.toFixed(2)}`;
    
    // Store totals for later use
    window.currentTotals = { subtotal, loyaltyDiscount, manualDiscount, totalDiscount, grandTotal };
};

// ─── SHOW TOAST NOTIFICATION ───
function showToast(message, isSuccess = true) {
    const toast = document.createElement('div');
    toast.className = `fixed top-6 right-6 px-6 py-3 rounded-xl font-bold text-white z-[200] animate-bounce ${
        isSuccess ? 'bg-emerald-500' : 'bg-red-500'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ─── PROCESS SALE - WITH KHALTI & PAYMENT METHODS ───
window.processSale = async function() {
    // Validate token first
    const token = localStorage.getItem('token');
    if (!token) {
        showToast('Session expired. Please login again.', false);
        window.location.href = '/frontend/auth/login.html';
        return;
    }

    if (cartItems.length === 0) {
        showToast('Cart is empty', false);
        return;
    }

    if (!selectedCustomer) {
        const name = document.getElementById('walkInName').value.trim();
        if (!name) {
            showToast('Enter customer name', false);
            return;
        }
    }

    const paymentMethod = document.getElementById('paymentMethod').value;
   
    // STANDARD PAYMENT FLOW (Cash, FonePay, Card)
 
    try {
        document.getElementById('btnProcess').disabled = true;
        showToast('Processing sale...', true);

        // Get logged-in staff ID
        const profileRes = await fetch(`${BASE_URL}/api/auth/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!profileRes.ok) {
            const errorData = await profileRes.json().catch(() => ({}));
            console.error('Profile error:', profileRes.status, errorData);
            throw new Error(errorData.message || `Profile fetch failed (${profileRes.status})`);
        }
        const staff = await profileRes.json();
        if (!staff || !staff.id) throw new Error('Invalid staff profile data');

        const totals = window.currentTotals;

        // Build payload with correct DTO field names (PascalCase)
        const payload = {
            StaffId: staff.id,
            CustomerId: selectedCustomer ? selectedCustomer.id : null,
            Items: cartItems.map(item => ({
                ProductId: item.id,
                Quantity: item.qty,
                UnitPrice: item.price,
                DiscountPerItem: 0
            })),
            DiscountAmount: totals.totalDiscount,
            PaymentMethod: paymentMethod,
            PaymentStatus: document.getElementById('paymentStatus').value,
            WalkInCustomerName: !selectedCustomer ? document.getElementById('walkInName').value : null,
            Notes: `${paymentMethod} payment - ${new Date().toLocaleString()}`
        };

        console.log("Sending sale payload:", payload);

        // Create sale
        const saleRes = await fetch(`${BASE_URL}/api/sales`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!saleRes.ok) {
            const error = await saleRes.json().catch(() => ({ message: 'Unknown error' }));
            console.error('Sale error:', error);
            throw new Error(error.message || 'Failed to create sale');
        }

        const sale = await saleRes.json();
        console.log('Sale created:', sale);
        console.log('Sale ID:', sale.id || sale.Id);
        
        currentInvoice = sale;
        
        showToast('✓ Sale created successfully!', true);
        
        // Display invoice
        showInvoice(sale);
        
        // Auto-send email if customer has email
        const customerEmail = selectedCustomer ? selectedCustomer.email : document.getElementById('walkInEmail').value;
        if (customerEmail && (sale.id || sale.Id)) {
            const saleId = sale.id || sale.Id;
            console.log('Sending invoice email to:', customerEmail, 'for sale ID:', saleId);
            setTimeout(() => {
                sendInvoiceEmail(saleId, customerEmail, true);
            }, 1000);
        } else {
            console.warn('Email not sent - missing email:', customerEmail, 'or sale ID:', sale.id || sale.Id);
        }
        
    } catch (e) {
        console.error('Sale processing error:', e);
        showToast(`Error: ${e.message}`, false);
    } finally {
        document.getElementById('btnProcess').disabled = false;
    }
};

// ─── SHOW INVOICE MODAL ───
function showInvoice(sale) {
    const modal = document.getElementById('invoiceModal');
    
    // Use both PascalCase and camelCase to be safe
    const invoiceNum = sale.InvoiceNumber || sale.invoiceNumber;
    const saleDate = sale.SaleDate || sale.createdAt;
    
    // Populate invoice details
    document.getElementById('inv-number').textContent = `#${invoiceNum}`;
    document.getElementById('inv-date').textContent = `Date: ${new Date(saleDate).toLocaleDateString()}`;
    
    const customer = selectedCustomer;
    document.getElementById('inv-customer-name').textContent = customer 
        ? `${customer.firstName} ${customer.lastName}`
        : document.getElementById('walkInName').value;
    document.getElementById('inv-customer-phone').textContent = customer
        ? (customer.phone || 'N/A')
        : (document.getElementById('walkInPhone').value || 'N/A');

    document.getElementById('inv-payment-method').textContent = `Method: ${document.getElementById('paymentMethod').value}`;
    document.getElementById('inv-payment-status').textContent = `Status: ${document.getElementById('paymentStatus').value}`;

    // Populate items
    const itemsBody = document.getElementById('inv-items-body');
    const totals = window.currentTotals;

    itemsBody.innerHTML = cartItems.map(item => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-size: 13px; color: #111827; font-weight: 500;">${item.name}</td>
            <td style="padding: 12px; text-align: center; font-size: 13px; color: #6b7280;">${item.qty}</td>
            <td style="padding: 12px; text-align: right; font-size: 13px; color: #6b7280;">Rs. ${item.price.toFixed(2)}</td>
            <td style="padding: 12px; text-align: right; font-size: 13px; color: #111827; font-weight: 600;">Rs. ${(item.price * item.qty).toFixed(2)}</td>
        </tr>
    `).join('');

    // Display totals with proper discount breakdown
    const subtotal = sale.SubTotal || totals.subtotal;
    const discount = sale.DiscountAmount || totals.totalDiscount;
    const grandTotal = sale.GrandTotal || totals.grandTotal;
    
    document.getElementById('inv-subtotal').textContent = `Rs. ${subtotal.toFixed(2)}`;
    
    // Show discount with breakdown
    let discountText = `-Rs. ${discount.toFixed(2)}`;
    if (totals.loyaltyDiscount > 0 && totals.manualDiscount > 0) {
        discountText += ` (Loyalty: Rs. ${totals.loyaltyDiscount.toFixed(2)} + Manual: Rs. ${totals.manualDiscount.toFixed(2)})`;
    } else if (totals.loyaltyDiscount > 0) {
        discountText += ` (10% Loyalty Discount)`;
    }
    document.getElementById('inv-discount').textContent = discountText;
    
    document.getElementById('inv-total').textContent = `Rs. ${grandTotal.toFixed(2)}`;

    // Show modal
    modal.classList.add('active');
}

// ─── PRINT RECEIPT ───
window.printReceipt = function() {
    const printArea = document.getElementById('printableInvoice');
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(printArea.innerHTML);
    printWindow.document.close();
    printWindow.print();
};

// ─── SEND INVOICE EMAIL (Helper) ───
async function sendInvoiceEmail(saleId, email, isAutomatic = false) {
    const token = localStorage.getItem('token');
    try {
        if (!saleId || !email) {
            console.error('Missing saleId or email:', { saleId, email });
            throw new Error('Missing sale ID or email address');
        }
        
        const url = `${BASE_URL}/api/sales/${saleId}/send-email?manualEmail=${encodeURIComponent(email)}`;
        console.log('Sending email to:', url);
        
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Email response status:', res.status, res.statusText);

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Unknown error' }));
            console.error('Email error response:', error);
            throw new Error(error.message || `Failed to send email (${res.status})`);
        }

        if (!isAutomatic) {
            showToast(`✓ Invoice sent to ${email}`, true);
        } else {
            console.log('Invoice auto-sent to:', email);
        }
    } catch (e) {
        console.error('Email error:', e);
        if (!isAutomatic) {
            showToast(`Email error: ${e.message}`, false);
        }
    }
}

// ─── EMAIL INVOICE (Button Handler) ───
window.emailInvoice = async function() {
    if (!currentInvoice) {
        showToast('No invoice to send', false);
        return;
    }

    const token = localStorage.getItem('token');
    const email = selectedCustomer 
        ? selectedCustomer.email 
        : document.getElementById('walkInEmail').value;

    if (!email) {
        showToast('No email address provided', false);
        return;
    }

    try {
        document.getElementById('btnEmailInvoice').disabled = true;
        document.getElementById('btnEmailInvoice').textContent = 'Sending...';

        await sendInvoiceEmail(currentInvoice.id, email);
        
    } catch (e) {
        console.error('Email error:', e);
        showToast('Error sending email', false);
    } finally {
        document.getElementById('btnEmailInvoice').disabled = false;
        document.getElementById('btnEmailInvoice').innerHTML = '<i data-lucide="mail" class="w-4 h-4"></i> Send to Email';
        if (window.lucide) lucide.createIcons();
    }
};
