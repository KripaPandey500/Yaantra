(() => {
    const API_BASE = 'http://localhost:5033/api';


    async function fetchCart() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/frontend/auth/login.html?msg=loginfirst';
            return;
        }
        let userId = localStorage.getItem('userId');
        if (!userId) {
            // Fetch profile to get integer userId
            try {
                const res = await fetch('http://localhost:5033/api/auth/profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to fetch profile');
                const profile = await res.json();
                userId = profile.id || profile.userId;
                if (!userId) throw new Error('No userId in profile');
                localStorage.setItem('userId', userId);
            } catch (err) {
                alert('Failed to get user profile. Please login again.');
                localStorage.removeItem('token');
                window.location.href = '/frontend/auth/login.html?msg=loginfirst';
                return;
            }
        }
        try {
            const res = await fetch(`${API_BASE}/Cart/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/frontend/auth/login.html?msg=loginfirst';
                return;
            }
            if (!res.ok) throw new Error('Failed to fetch cart');
            return await res.json(); // CartResponseDto
        } catch (err) {
            document.getElementById('cart-items-container').innerHTML = '<div class="text-red-500">Failed to load cart.';
            return null;
        }
    }


    // Helper to show/hide steps
    function showStep(step) {
        ["step-summary", "step-orderform", "step-payment"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add("hidden");
        });
        const showEl = document.getElementById(step);
        if (showEl) showEl.classList.remove("hidden");
    }

    // Navigate to specific checkout step
    window.goToStep = function(stepNum) {
        const stepMap = { 1: "step-summary", 2: "step-orderform", 3: "step-payment" };
        if (stepMap[stepNum]) showStep(stepMap[stepNum]);
        
        // Update active tab
        ["tab-1", "tab-2", "tab-3"].forEach((id, idx) => {
            const el = document.getElementById(id);
            if (el) {
                if (idx + 1 === stepNum) {
                    el.classList.add("bg-[var(--color-primary)]", "text-white");
                    el.classList.remove("text-gray-600", "hover:bg-white");
                } else {
                    el.classList.remove("bg-[var(--color-primary)]", "text-white");
                    el.classList.add("text-gray-600", "hover:bg-white");
                }
            }
        });
    };

    // Expose for HTML
    window.showOrderForm = function() { 
        showStep("step-orderform");
        goToStep(2);
    };
    window.showSummary = function() { 
        showStep("step-summary");
        goToStep(1);
    };
    window.showPaymentOptions = function() { 
        showStep("step-payment");
        goToStep(3);
    };

    // Show toast notification (success or error)
    function showToast(message, success = true) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.remove('opacity-0', 'bg-red-600');
        toast.classList.add('opacity-100');
        toast.classList.toggle('bg-green-600', success);
        toast.classList.toggle('bg-red-600', !success);
        setTimeout(() => {
            toast.classList.remove('opacity-100');
            toast.classList.add('opacity-0');
        }, 2000);
    }

    // Clear all order form errors
    function clearOrderFormErrors() {
        const errorIds = ['fullnameError', 'emailError', 'phoneError', 'addressError'];
        errorIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = '';
                el.classList.add('hidden');
            }
        });
    }

    // Show error for a specific field
    function showOrderFormError(fieldId, message) {
        const errorEl = document.getElementById(fieldId + 'Error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    // Validate order form by calling backend API
    async function validateOrderForm() {
        clearOrderFormErrors();
        const fullName = document.getElementById('order-fullname').value;
        const email = document.getElementById('order-email').value;
        const phone = document.getElementById('order-phone').value;
        const address = document.getElementById('order-address').value;

        // Client-side phone digit validation (enforce exactly 10 digits)
        if (phone && !/^\d{10}$/.test(phone)) {
            showOrderFormError('phone', 'Phone Number must be exactly 10 digits.');
            return false;
        }

        try {
            const response = await fetch(`${API_BASE}/Orders/validate-details`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fullName: fullName,
                    email: email,
                    phone: phone,
                    address: address
                })
            });

            if (!response.ok) {
                console.error('Validation request failed:', response.status);
                return false;
            }

            const result = await response.json();

            if (!result.isValid) {
                // Display validation errors
                Object.keys(result.errors).forEach(key => {
                    const fieldMap = {
                        'fullName': 'fullname',
                        'email': 'email',
                        'phone': 'phone',
                        'address': 'address'
                    };
                    const fieldName = fieldMap[key] || key.toLowerCase();
                    showOrderFormError(fieldName, result.errors[key]);
                });
                return false;
            }

            return true;
        } catch (error) {
            console.error('Validation error:', error);
            showToast('Error validating form. Please try again.', false);
            return false;
        }
    }

    // Handle order form submit
    document.addEventListener('DOMContentLoaded', function() {
        const form = document.getElementById('order-details-form');
        if (form) {
            form.onsubmit = async function(e) {
                e.preventDefault();
                const isValid = await validateOrderForm();
                if (isValid) {
                    showStep("step-payment");
                    goToStep(3);
                }
            };
        }

        // Phone input handler: enforce digits only and max 10 length
        const phoneInput = document.getElementById('order-phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', function() {
                // Remove non-digit characters
                this.value = this.value.replace(/\D/g, '');
                // Enforce max 10 digits
                if (this.value.length > 10) {
                    this.value = this.value.slice(0, 10);
                }
                // Clear error when user starts typing
                const phoneError = document.getElementById('phoneError');
                if (phoneError && this.value) {
                    phoneError.classList.add('hidden');
                }
            });
        }

        // Clear errors on input
        const orderInputs = ['order-fullname', 'order-email', 'order-phone', 'order-address'];
        orderInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', function() {
                    const errorMap = {
                        'order-fullname': 'fullname',
                        'order-email': 'email',
                        'order-phone': 'phone',
                        'order-address': 'address'
                    };
                    const errorField = errorMap[inputId];
                    if (errorField) {
                        const errorEl = document.getElementById(errorField + 'Error');
                        if (errorEl && !errorEl.classList.contains('hidden')) {
                            errorEl.classList.add('hidden');
                        }
                    }
                });
            }
        });
    });

    // Place order
    window.placeOrder = async function(e) {

        if (e) e.preventDefault();
        
        // Validate order form by calling backend validation endpoint
        const isValid = await validateOrderForm();
        if (!isValid) {
            showToast('Please fix the errors in the form before proceeding.', false);
            return;
        }
        
        // Gather order info
        const fullName = document.getElementById('order-fullname').value;
        const email = document.getElementById('order-email').value;
        const phone = document.getElementById('order-phone').value;
        const address = document.getElementById('order-address').value;
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;

        const token = localStorage.getItem('token');
        let userId = localStorage.getItem('userId');
        if (!token || !userId) return alert('Please login first.');

        // Get cart for items
        const cartRes = await fetch(`${API_BASE}/Cart/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!cartRes.ok) return alert('Could not fetch cart.');
        const cart = await cartRes.json();
        if (!cart.items || cart.items.length === 0) return alert('Cart is empty.');

        // Prepare order payload
        const items = cart.items.map(item => ({
            ProductId: item.productId,
            Quantity: item.quantity,
            UnitPrice: item.price,
            DiscountPerItem: 0
        }));
        const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        let discount = subtotal >= 5000 ? subtotal * 0.10 : 0;

        if (paymentMethod === 'Khalti') {
            // Prepare checkout request for NEW endpoint
            const checkoutPayload = {
                userId: parseInt(userId),
                items: items,
                discountAmount: discount,
                shippingAddress: address,
                customerName: fullName,
                customerEmail: email,
                customerPhone: phone,
                returnUrl: 'http://localhost:5033/frontend/pages/khalti-return.html',
                websiteUrl: 'http://localhost:5033'
            };

            let retries = 0;
            const maxRetries = 2;
            const timeoutMs = 60000; // 60 seconds timeout

            async function attemptCheckout() {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                    // Call NEW endpoint: /api/payment/checkout
                    const checkoutRes = await fetch(`${API_BASE}/payment/checkout`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(checkoutPayload),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!checkoutRes.ok) {
                        const error = await checkoutRes.json().catch(() => ({}));
                        
                        // Retry on 504 or 503 gateway errors
                        if ((checkoutRes.status === 504 || checkoutRes.status === 503) && retries < maxRetries) {
                            retries++;
                            showToast(`Gateway timeout. Retrying... (${retries}/${maxRetries})`, true);
                            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                            return attemptCheckout();
                        }
                        
                        showToast(`Checkout failed: ${error.error || checkoutRes.statusText}`, false);
                        return false;
                    }

                    const checkoutData = await checkoutRes.json();
                    
                    if (!checkoutData.paymentUrl || !checkoutData.pidx) {
                        showToast('Failed to get payment URL from gateway', false);
                        return false;
                    }

                    // Store PIDX in sessionStorage for verification later
                    sessionStorage.setItem('khaltiPidx', checkoutData.pidx);
                    sessionStorage.setItem('pendingOrderId', checkoutData.pendingOrderId);

                    showToast('Redirecting to Khalti payment...', true);
                    
                    // Redirect to Khalti payment page
                    setTimeout(() => {
                        window.location.href = checkoutData.paymentUrl;
                    }, 1000);
                    
                    return true;
                } catch (err) {
                    clearTimeout(timeoutId);
                    
                    // Retry on timeout or network errors
                    if ((err.name === 'AbortError' || !navigator.onLine) && retries < maxRetries) {
                        retries++;
                        showToast(`Request timeout. Retrying... (${retries}/${maxRetries})`, true);
                        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                        return attemptCheckout();
                    }
                    
                    console.error('Khalti initiation error:', err);
                    const errorMsg = err.name === 'AbortError' 
                        ? 'Payment request timeout. Please check your connection and try again.' 
                        : `Payment error: ${err.message}`;
                    showToast(errorMsg, false);
                    return false;
                }
            }

            await attemptCheckout();
            return;
        }

        // Pay Later or Cash on Delivery logic (place order immediately)
        if (paymentMethod === 'Pay Later' || paymentMethod === 'Cash on Delivery') {
            const orderPayload = {
                UserId: parseInt(userId),
                ShippingAddress: address,
                PaymentMethod: paymentMethod,
                DiscountAmount: discount,
                Items: items
            };
            const orderRes = await fetch(`${API_BASE}/Orders`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderPayload)
            });
            if (!orderRes.ok) {
                const err = await orderRes.json().catch(() => ({}));
                showToast('Order failed: ' + (err.error || orderRes.statusText), false);
                return;
            }
            // Clear cart after order
            await clearCart(userId, token);
            showToast('Order placed successfully!', true);
            setTimeout(() => {
                window.location.href = '/frontend/user/pages/orderHistory/order.html';
            }, 1500);
            return;
        }
        // Clear cart and cart items after order
        async function clearCart(userId, token) {
            // Use new clear endpoint for efficiency
            await fetch(`${API_BASE}/Cart/${userId}/clear`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            loadCart();
        }
    };
    // Render cart and summary
    function renderCart(cartResponse) {
        const container = document.getElementById('cart-items-container');
        const empty = document.getElementById('empty-cart');
        const summaryItems = document.getElementById('summary-items');
        const subtotalEl = document.getElementById('summary-subtotal');
        const totalEl = document.getElementById('summary-total');
        const taxEl = document.getElementById('summary-tax');
        const countBadge = document.getElementById('cart-count-badge');
        const headerBadge = document.getElementById('cart-badge');
        // Shipping is static in HTML

        if (!cartResponse || !cartResponse.items || cartResponse.items.length === 0) {
            container.innerHTML = '';
            if (summaryItems) summaryItems.innerHTML = '';
            if (subtotalEl) subtotalEl.textContent = 'Rs 0.00';
            if (taxEl) taxEl.textContent = 'Rs 0.00';
            if (totalEl) totalEl.textContent = 'Rs 0.00';
            if (countBadge) countBadge.textContent = '0';
            if (headerBadge) {
                headerBadge.textContent = '0';
            }
            // Sync to localStorage to update header badge on all pages
            localStorage.setItem('yaantra_cart', JSON.stringify([]));
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');
        
        // Update both cart count badges
        const itemCount = cartResponse.items.length;
        if (countBadge) {
            countBadge.textContent = itemCount;
        }
        if (headerBadge) {
            headerBadge.textContent = itemCount;
            headerBadge.classList.remove('hidden');
        }

        // Sync cart data to localStorage for header badge visibility on all pages
        try {
            const cartForStorage = cartResponse.items.map(item => ({
                id: item.id,
                productId: item.productId,
                productName: item.productName,
                qty: item.quantity,
                price: item.price
            }));
            localStorage.setItem('yaantra_cart', JSON.stringify(cartForStorage));
        } catch (e) {
            console.error('Failed to sync cart to localStorage:', e);
        }
        
        // Render all cart items inside a single card container with smaller size
        container.innerHTML = `
            <div class="bg-white rounded-2xl border border-[#e5e7eb] shadow-sm p-4 space-y-4">
                ${cartResponse.items.map(item => `
                    <div class="flex items-center gap-4">
                        <div class="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border flex-shrink-0">
                            <img src="${item.productImageUrl}" alt="${item.productName}"
                                class="object-cover w-full h-full rounded-lg" onerror="this.onerror=null;this.src='http://localhost:5033/assets/img/no-image.png';" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-base truncate">${item.productName}</div>
                            <div class="flex items-center gap-2 mt-2">
                                <button class="bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm" onclick="updateCartQuantity(${item.id}, ${item.quantity === 1 ? 0 : item.quantity - 1})">−</button>
                                <span class="font-semibold text-sm w-6 text-center">${item.quantity}</span>
                                <button class="bg-green-500 hover:bg-green-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm" onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})">+</button>
                            </div>
                            <div class="text-gray-600 text-sm mt-2"><span class="font-semibold">Rs. ${item.price}</span></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        // Update cart item quantity (removes item if newQuantity is 0)
        window.updateCartQuantity = async function(itemId, newQuantity) {
            const token = localStorage.getItem('token');
            let userId = localStorage.getItem('userId');
            if (!token || !userId) return;
            await fetch(`${API_BASE}/Cart/${userId}/items/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ quantity: newQuantity })
            });
            loadCart();
        };
        // Render summary panel
        if (summaryItems) {
            summaryItems.innerHTML = cartResponse.items.map(item => `
                <div class="flex justify-between">
                    <span class="text-gray-600">${item.productName} x${item.quantity}</span>
                    <span class="font-semibold text-gray-900">Rs. ${(item.price * item.quantity).toFixed(2)}</span>
                </div>
            `).join('');
        }

        // Calculate subtotal and discount for display
        const subtotal = cartResponse.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        let discount = 0;
        if (subtotal >= 5000) {
            discount = subtotal * 0.10;
        }
        if (subtotalEl) subtotalEl.textContent = `Rs. ${subtotal.toFixed(2)}`;
        // Show discount row if applicable
        let discountRow = document.getElementById('summary-discount-row');
        if (discountRow) {
            if (discount > 0) {
                discountRow.classList.remove('hidden');
                const discountSpan = discountRow.querySelector('span:last-child');
                if (discountSpan) discountSpan.textContent = `- Rs. ${discount.toFixed(2)}`;
            } else {
                discountRow.classList.add('hidden');
            }
        }
        // No tax or shipping displayed
        if (taxEl) taxEl.textContent = '';
        if (totalEl) {
            const total = (cartResponse.totalAmount ?? subtotal - discount);
            totalEl.textContent = `Rs. ${Number(total).toFixed(2)}`;
        }
    }

    // Load cart on page load
    async function loadCart() {
        const cartResponse = await fetchCart();
        renderCart(cartResponse);
    }

    document.addEventListener('DOMContentLoaded', loadCart);
})();
