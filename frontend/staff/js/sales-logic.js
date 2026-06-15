// ─── VALIDATE AUTHENTICATION ON INIT ───
(function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/frontend/auth/login.html?msg=loginfirst';
        return;
    }

    let userId = localStorage.getItem('userId');
    if (!userId) {
        // Fetch profile to get integer userId
        fetch(`${BASE_URL}/api/auth/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => {
            if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
            return res.json();
        })
        .then(profile => {
            userId = profile.id || profile.userId;
            if (!userId) throw new Error('No userId in profile');
            localStorage.setItem('userId', userId);
        })
        .catch(err => {
            console.error('Profile fetch error:', err);
            alert('Failed to get your profile. Please login again.');
            localStorage.removeItem('token');
            window.location.href = '/frontend/auth/login.html?msg=loginfirst';
        });
    }
})();

function calculateTotals() {
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    let discount = 0;

    // Requirement #16: 10% discount if spend > 5000
    if (subtotal > 5000) {
        discount = subtotal * 0.10;
        document.getElementById('discountRow').classList.remove('hidden');
        document.getElementById('discountAmt').innerText = `-$${discount.toFixed(2)}`;
    } else {
        document.getElementById('discountRow').classList.add('hidden');
    }

    const total = subtotal - discount;
    document.getElementById('subtotal').innerText = `$${subtotal.toFixed(2)}`;
    document.getElementById('grandTotal').innerText = `$${total.toFixed(2)}`;
}

async function processCheckout() {
    if(!selectedCustomer) return alert("Select a customer");
    
    const payload = {
        customerId: selectedCustomer.id,
        items: cart.map(i => ({ id: i.id, price: i.price, qty: i.qty }))
    };

    const res = await fetch(`http://localhost:5033/api/sales`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
    });

    if(res.ok) {
        alert("Success! Invoice generated and emailed.");
        location.reload();
    }
}