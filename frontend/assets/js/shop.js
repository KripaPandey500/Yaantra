(() => {
    const CART_KEY = 'yaantra_cart';
    const API_BASE = 'http://localhost:5033/api';
    const ITEMS_PER_PAGE = 6;

    let allProducts = [];
    let filteredProducts = [];
    let currentPage = 1;
    let selectedCategory = '';
    let categoryNames = [];

    function getCart() {
        try {
            return JSON.parse(localStorage.getItem(CART_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }

    function formatPrice(amount) {
        return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    }

    function updateCartBadge() {
        const cart = getCart();
        const totalQty = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
        const badge = document.getElementById('cart-badge');
        if (!badge) return;

        if (totalQty > 0) {
            badge.textContent = totalQty > 99 ? '99+' : totalQty;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }


    window.addToCart = async function(btn) {
        if (btn.disabled) return;

        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/frontend/auth/login.html?msg=loginfirst';
            return;
        }

        // Get integer userId from profile (not from JWT)
        let userId = localStorage.getItem('userId');
        if (!userId) {
            // Fetch profile to get integer userId
            try {
                const res = await fetch(`${API_BASE.replace('/api','')}/api/auth/profile`, {
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

        const productId = btn.dataset.productId;
        const qty = 1;

        // Call backend API to add to cart
        try {
            const response = await fetch(`${API_BASE}/cart/${userId}/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ProductId: Number(productId),
                    Quantity: qty
                })
            });
            if (response.status === 401) {
                // Token invalid/expired, force login
                localStorage.removeItem('token');
                window.location.href = '/frontend/auth/login.html?msg=loginfirst';
                return;
            }
            if (!response.ok) throw new Error('Failed to add to cart');
            // Optionally update UI, show success, etc.
        } catch (err) {
            alert('Failed to add to cart. Please try again.');
            return;
        }

        updateCartBadge();

        const original = btn.textContent;
        btn.textContent = 'Added';
        btn.classList.add('bg-green-600');
        btn.disabled = true;

        setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('bg-green-600');
            btn.disabled = false;
        }, 1500);
    };

    function normalizeProduct(product) {
        const productId = product.id ?? product.Id;
        const productName = product.name ?? product.Name ?? 'Unnamed Product';
        const categoryName = product.categoryName ?? product.CategoryName ?? 'Uncategorized';
        const productPrice = Number(product.price ?? product.Price ?? 0);
        const productStock = Number(product.stockQty ?? product.StockQty ?? 0);
        const isOutOfStock = productStock <= 0;

        const imagePath = Array.isArray(product.images) && product.images.length
            ? product.images[0]
            : Array.isArray(product.Images) && product.Images.length
                ? product.Images[0]
                : null;

        const productImage = imagePath
            ? `http://localhost:5033${imagePath}`
            : 'https://via.placeholder.com/400x300.png?text=No+Image';

        return {
            id: productId,
            name: productName,
            category: categoryName,
            price: productPrice,
            stock: productStock,
            isOutOfStock,
            image: productImage
        };
    }

    function extractCategoryNamesFromProducts(products) {
        return [...new Set(products.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    }

    async function fetchCategoryNames() {
        try {
            const response = await fetch(`${API_BASE}/Categories?page=1&pageSize=1000`);
            if (!response.ok) return [];

            const payload = await response.json();
            const items = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);

            return [...new Set(items
                .map(item => item.name ?? item.Name)
                .filter(Boolean))]
                .sort((a, b) => a.localeCompare(b));
        } catch {
            return [];
        }
    }

    function renderProducts(products) {
        const productGrid = document.getElementById('product-grid');
        if (!productGrid) return;

        if (!products.length) {
            productGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 italic">No products match your filters.</p>';
            return;
        }

        productGrid.innerHTML = '';

        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card bg-[var(--color-secondary)] rounded-xl shadow-md overflow-hidden border border-[#e8ebe9] hover:shadow-lg transition flex flex-col';

            productCard.innerHTML = `
                <a href="product-details.html?id=${product.id}" class="block relative h-48 overflow-hidden group">
                    <img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 rounded-xl border"
                        onerror="this.onerror=null;this.src='/assets/img/no-image.png';">
                    ${product.isOutOfStock ? `
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <span class="bg-red-600 text-white text-base font-bold py-2 px-5 rounded-xl shadow-lg">Out of Stock</span>
                    </div>
                    ` : ''}
                    <div class="absolute inset-0 bg-black bg-opacity-25 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none group-hover:pointer-events-auto z-20">
                        <a href="product-details.html?id=${product.id}" class="btn-primary py-2 px-4 rounded-lg text-sm font-semibold">Quick View</a>
                    </div>
                </a>
                <div class="p-4 flex-grow flex flex-col justify-between">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-1">${product.name}</h3>
                        <p class="text-sm text-gray-600 mb-3">${product.category}</p>
                    </div>
                    <div class="mt-auto space-y-3">
                        <div>
                            <span class="text-xl font-bold text-[var(--color-primary)]">Rs. ${formatPrice(product.price)}</span>
                        </div>
                        <div class="flex gap-2">
                            <a href="product-details.html?id=${product.id}" class="flex-1 btn btn-secondary py-2 px-3 rounded-lg text-sm font-semibold text-center">View Details</a>
                            <button
                                class="flex-1 ${product.isOutOfStock ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'btn-primary'} py-2 px-3 rounded-lg text-sm font-semibold transition"
                                data-product-id="${product.id}"
                                data-product-name="${product.name}"
                                data-product-price="${product.price}"
                                data-product-image="${product.image}"
                                data-product-category="${product.category}"
                                ${product.isOutOfStock ? 'disabled' : ''}
                                onclick="addToCart(this)">
                                ${product.isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                            </button>
                        </div>
                    </div>
                </div>
            `;

            productGrid.appendChild(productCard);
        });
    }

    function populateCategoryFilter(categoryNames) {
        const categoryList = document.getElementById('filter-category-list');
        if (!categoryList) return;

        const buttons = ['All Categories', ...categoryNames]
            .map(label => {
                const value = label === 'All Categories' ? '' : label;
                const isActive = value === selectedCategory;
                const safeValue = value.replace(/"/g, '&quot;');
                return `
                    <button
                        type="button"
                        class="category-chip w-full text-left px-4 py-2 rounded-lg text-sm font-semibold border transition duration-200 ${isActive ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm' : 'bg-white text-gray-700 border-[#d9dfdc] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'}"
                        data-category="${safeValue}">
                        ${label}
                    </button>`;
            })
            .join('');

        categoryList.innerHTML = buttons;
    }

    function renderPagination() {
        const wrapper = document.getElementById('shop-pagination');
        const numbers = document.getElementById('shop-pagination-numbers');
        const prevBtn = document.getElementById('shop-prev-btn');
        const nextBtn = document.getElementById('shop-next-btn');
        if (!wrapper || !numbers || !prevBtn || !nextBtn) return;

        const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));

        if (!filteredProducts.length || totalPages <= 1) {
            wrapper.classList.add('hidden');
            numbers.innerHTML = '';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }

        wrapper.classList.remove('hidden');
        numbers.innerHTML = '';

        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `w-10 h-10 flex items-center justify-center rounded-full ${i === currentPage ? 'bg-[#23412a] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;
            btn.textContent = String(i);
            btn.addEventListener('click', () => {
                currentPage = i;
                renderCurrentPage();
            });
            numbers.appendChild(btn);
        }

        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
    }

    function renderCurrentPage() {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        renderProducts(filteredProducts.slice(start, end));
        renderPagination();
    }

    function applyFilters(resetPage = true) {
        const category = selectedCategory;
        const minPrice = Number(document.getElementById('filter-min-price')?.value || 0);
        const maxInput = document.getElementById('filter-max-price')?.value;
        const maxPrice = maxInput === '' ? Number.POSITIVE_INFINITY : Number(maxInput);

        filteredProducts = allProducts.filter(product => {
            const matchesCategory = !category || product.category === category;
            const matchesMin = product.price >= minPrice;
            const matchesMax = product.price <= maxPrice;
            return matchesCategory && matchesMin && matchesMax;
        });

        if (resetPage) currentPage = 1;
        renderCurrentPage();
    }

    function bindFilterEvents() {
        const categoryList = document.getElementById('filter-category-list');
        const minPrice = document.getElementById('filter-min-price');
        const maxPrice = document.getElementById('filter-max-price');
        const resetBtn = document.getElementById('filter-reset');
        const prevBtn = document.getElementById('shop-prev-btn');
        const nextBtn = document.getElementById('shop-next-btn');

        [minPrice, maxPrice].forEach(el => {
            if (!el) return;
            el.addEventListener('input', () => applyFilters(true));
            el.addEventListener('change', () => applyFilters(true));
        });

        if (categoryList) {
            categoryList.addEventListener('click', (event) => {
                const button = event.target.closest('.category-chip');
                if (!button) return;
                selectedCategory = button.dataset.category || '';
                populateCategoryFilter(categoryNames);
                applyFilters(true);
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderCurrentPage();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
                if (currentPage < totalPages) {
                    currentPage++;
                    renderCurrentPage();
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (minPrice) minPrice.value = '';
                if (maxPrice) maxPrice.value = '';
                selectedCategory = '';
                populateCategoryFilter(categoryNames);

                applyFilters(true);
            });
        }
    }

    async function fetchProducts() {
        const productGrid = document.getElementById('product-grid');
        const loadingMessage = document.getElementById('loading-message');
        const errorMessage = document.getElementById('error-message');
        if (!productGrid || !loadingMessage || !errorMessage) return;

        try {
            const token = localStorage.getItem('token');
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${API_BASE}/Products?page=1&pageSize=100`, { headers });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const payload = await response.json();
            const products = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);

            if (!products.length) {
                productGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 italic">No products found at the moment.</p>';
                return;
            }

            allProducts = products.map(normalizeProduct);
            const apiCategoryNames = await fetchCategoryNames();
            const fallbackCategoryNames = extractCategoryNamesFromProducts(allProducts);
            categoryNames = apiCategoryNames.length ? apiCategoryNames : fallbackCategoryNames;
            populateCategoryFilter(categoryNames);
            applyFilters(true);
        } catch (error) {
            console.error('Error fetching products:', error);
            errorMessage.classList.remove('hidden');
            productGrid.innerHTML = '';
        } finally {
            loadingMessage.classList.add('hidden');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindFilterEvents();
        fetchProducts();
        updateCartBadge();
    });
})();
