(() => {
    const _API_BASE = 'http://localhost:5033/api';
    const _CART_KEY = 'yaantra_cart';


    // Toast utility
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(80px)';
        }, 2000);
    }


    // Get product ID from URL
    function getProductIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }


    // Normalize image URLs
    function getImageUrls(product) {
        const paths = Array.isArray(product.images)
            ? product.images
            : (Array.isArray(product.Images) ? product.Images : []);
        const host = _API_BASE.replace('/api', '');
        return paths
            .filter(Boolean)
            .map(path => path.startsWith('http') ? path : `${host}${path}`);
    }


    // Render image gallery
    function renderImageGallery(imageUrls, productName) {
        const imgEl = document.getElementById('detail-image');
        const wrapEl = imgEl.closest('.detail-image-wrap');
        const thumbsEl = document.getElementById('detail-thumbnails');

        if (!imageUrls.length) {
            wrapEl.innerHTML = `
                <div class="w-full h-full flex items-center justify-center bg-[var(--color-secondary)] rounded-xl min-h-[300px]">
                    <span class="text-gray-400 text-sm">No image available</span>
                </div>`;
            thumbsEl.innerHTML = '';
            return null;
        }

        imgEl.src = imageUrls[0];
        imgEl.alt = productName;
        thumbsEl.innerHTML = '';

        imageUrls.forEach((url, index) => {
            const thumb = document.createElement('button');
            thumb.type = 'button';
            thumb.className = `shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden ${index === 0 ? 'border-[var(--color-primary)]' : 'border-transparent'}`;
            thumb.innerHTML = `<img src="${url}" alt="${productName} image ${index + 1}" class="w-full h-full object-cover">`;
            thumb.onclick = () => {
                imgEl.src = url;
                imgEl.alt = productName;
                thumbsEl.querySelectorAll('button').forEach(btn => btn.classList.remove('border-[var(--color-primary)]'));
                thumb.classList.add('border-[var(--color-primary)]');
            };
            thumbsEl.appendChild(thumb);
        });

        return imageUrls[0];
    }


    function updateProductView(product) {
        const name = product.name || product.Name || 'Unknown Product';
        const imageUrls = getImageUrls(product);
        renderImageGallery(imageUrls, name);
        const category = product.categoryName || product.CategoryName || 'Vehicle Part';
        const description = product.description || product.Description || 'Premium quality part for your vehicle.';
        const price = Number(product.price ?? product.Price ?? 0);
        const discountPrice = product.discountPrice ?? product.DiscountPrice ?? null;
        const stock = Number(product.stockQty ?? product.StockQty ?? 0);

        document.title = `YAANTRA - ${name}`;
        document.getElementById('detail-name').textContent = name;
        document.getElementById('detail-category').textContent = category;
        document.getElementById('detail-description').textContent = description;

        const priceEl = document.getElementById('detail-price');
        const discEl = document.getElementById('detail-discount');
        if (discountPrice && discountPrice < price) {
            priceEl.textContent = `Rs. ${Number(discountPrice).toFixed(2)}`;
            discEl.textContent = `Rs. ${price.toFixed(2)}`;
            discEl.classList.remove('hidden');
        } else {
            priceEl.textContent = `Rs. ${price.toFixed(2)}`;
            discEl.classList.add('hidden');
        }

        const addBtn = document.getElementById('add-cart-btn');
        if (stock <= 0) {
            addBtn.disabled = true;
            addBtn.textContent = 'Out of Stock';
            addBtn.classList.remove('btn-primary');
            addBtn.classList.add('bg-gray-300', 'text-gray-600', 'cursor-not-allowed');
            addBtn.onclick = null;
            return;
        }

        addBtn.onclick = async () => {
            const qty = Math.max(1, parseInt(document.getElementById('qty-input').value || '1', 10));
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/frontend/auth/login.html?msg=loginfirst';
                return;
            }

            // Always fetch userId from profile using token
            let userId;
            try {
                const res = await fetch(`${_API_BASE.replace('/api','')}/api/auth/profile`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to fetch profile');
                const profile = await res.json();
                userId = profile.id || profile.userId;
                if (!userId) throw new Error('No userId in profile');
            } catch (err) {
                showToast('Failed to get user profile. Please login again.');
                localStorage.removeItem('token');
                window.location.href = '/frontend/auth/login.html?msg=loginfirst';
                return;
            }

            // Call backend API to add to cart
            try {
                const response = await fetch(`${_API_BASE}/cart/${userId}/items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        ProductId: Number(product.id ?? product.Id),
                        Quantity: qty
                    })
                });
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/frontend/auth/login.html?msg=loginfirst';
                    return;
                }
                if (!response.ok) throw new Error('Failed to add to cart');
            } catch (err) {
                showToast('Failed to add to cart. Please try again.');
                return;
            }

            if (typeof updateStorefrontCartBadge === 'function') updateStorefrontCartBadge();

            const original = addBtn.textContent;
            addBtn.textContent = 'Added!';
            addBtn.classList.add('!bg-green-600');
            addBtn.disabled = true;
            setTimeout(() => {
                addBtn.textContent = original;
                addBtn.classList.remove('!bg-green-600');
                addBtn.disabled = false;
            }, 1500);

            showToast(`${name} added to cart`);
        };
    }

    async function loadProduct() {
        const id = getProductIdFromUrl();
        const nameEl = document.getElementById('detail-name');
        const descEl = document.getElementById('detail-description');

        if (!id) {
            nameEl.textContent = 'Product not found';
            descEl.textContent = 'No product ID was provided in the URL.';
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${_API_BASE}/Products/${id}`, { headers });
            if (!response.ok) throw new Error('Not found');
            const product = await response.json();
            updateProductView(product);
        } catch {
            nameEl.textContent = 'Product not found';
            descEl.textContent = 'We could not load this product right now.';
        }
    }

    document.addEventListener('DOMContentLoaded', loadProduct);
})();
