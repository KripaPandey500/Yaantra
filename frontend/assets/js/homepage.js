
// ─── Mobile Menu Toggle ──────────────────────────────────────────────────────

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

function sanitizeIncludedHtml(html) {
    return html.replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/g, '');
}

function extractBodyHtml(html) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    return parsed.body ? parsed.body.innerHTML : html;
}

async function includeStorefrontHeader() {
    const container = document.getElementById('storefront-header-container');
    if (!container) return;

    try {
        const response = await fetch('../includes/header.html');
        if (!response.ok) {
            throw new Error(`Failed to load storefront header: ${response.status}`);
        }

        const raw = await response.text();
        const html = sanitizeIncludedHtml(extractBodyHtml(raw));
        container.innerHTML = html;
        initStorefrontHeader(container);
    } catch (error) {
        console.error('Storefront header include failed:', error);
    }
}

async function includeStorefrontFooter() {
    const container = document.getElementById('storefront-footer-container');
    if (!container) return;

    try {
        const response = await fetch('../includes/footer.html');
        if (!response.ok) {
            throw new Error(`Failed to load storefront footer: ${response.status}`);
        }

        const raw = await response.text();
        const html = sanitizeIncludedHtml(extractBodyHtml(raw));
        container.innerHTML = html;
    } catch (error) {
        console.error('Storefront footer include failed:', error);
    }
}

function initStorefrontHeader(scope = document) {
    highlightActiveStorefrontNav(scope);
    setupStorefrontProfileDropdown(scope);
    loadProfileAndNavbar(scope);
    updateStorefrontCartBadge(scope);
}

function highlightActiveStorefrontNav(scope = document) {
    const path = window.location.pathname.toLowerCase();
    const activePage = path.includes('/shop.html')
        ? 'shop'
        : path.includes('/cart.html')
            ? 'cart'
            : path.includes('/product-details.html')
                ? 'shop'
                : 'home';

    scope.querySelectorAll('[data-nav-link]').forEach(link => {
        const isActive = link.dataset.navLink === activePage;

        if (link.classList.contains('storefront-nav-link')) {
            link.classList.toggle('font-bold', isActive);
            link.classList.toggle('text-white', isActive);
            link.classList.toggle('text-white/95', !isActive);
            link.classList.toggle('border-white/90', isActive);
            link.classList.toggle('border-transparent', !isActive);
            return;
        }

        link.classList.toggle('font-semibold', isActive);
        link.classList.toggle('text-primary', isActive);
        link.classList.toggle('text-gray-700', !isActive);
    });
}

function setupStorefrontProfileDropdown(scope = document) {
    const profileDropdownButton = scope.querySelector('#profileDropdownButton');
    const profileDropdown = scope.querySelector('#profileDropdown');

    if (!profileDropdownButton || !profileDropdown || profileDropdownButton.dataset.bound === 'true') {
        return;
    }

    profileDropdownButton.dataset.bound = 'true';

    profileDropdownButton.addEventListener('click', event => {
        event.stopPropagation();
        profileDropdown.classList.toggle('hidden');
    });

    window.addEventListener('click', event => {
        if (!profileDropdownButton.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.add('hidden');
        }
    });
}

function loadProfileAndNavbar(scope = document) {
    const firstName = localStorage.getItem('firstName') || '';
    const lastName = localStorage.getItem('lastName') || '';
    const email = localStorage.getItem('userEmail') || '';
    const profilePic = localStorage.getItem('profilePic');
    const token = localStorage.getItem('token');

    const loggedInProfileDropdown = scope.querySelector('#loggedInProfileDropdown');
    const loggedOutSignIn = scope.querySelector('#loggedOutSignIn');
    const topBarAccountLink = scope.querySelector('#topBarAccountLink');
    const topBarSignInLink = scope.querySelector('#topBarSignInLink');

    if (token) {
        const fullName = `${firstName} ${lastName}`.trim();
        const initials = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase() || 'CU';

        loggedInProfileDropdown?.classList.remove('hidden');
        loggedOutSignIn?.classList.add('hidden');
        topBarAccountLink?.classList.add('hidden');
        topBarSignInLink?.classList.add('hidden');

        const navProfileInitials = scope.querySelector('#navProfileInitials');
        const dropdownUserName = scope.querySelector('#dropdownUserName');
        const dropdownUserEmail = scope.querySelector('#dropdownUserEmail');
        const avatarContainer = document.getElementById('avatarContainer');
        const welcomeName = document.getElementById('welcomeName');
        const welcomeEmail = document.getElementById('welcomeEmail');
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');

        if (navProfileInitials) navProfileInitials.textContent = initials;
        if (dropdownUserName) dropdownUserName.textContent = fullName || 'Customer';
        if (dropdownUserEmail) dropdownUserEmail.textContent = email || 'N/A';
        if (welcomeName) welcomeName.textContent = fullName || 'Customer';
        if (welcomeEmail) welcomeEmail.textContent = email;
        if (profileName) profileName.textContent = fullName || '—';
        if (profileEmail) profileEmail.textContent = email || '—';

        if (avatarContainer) {
            if (profilePic && profilePic !== 'null' && profilePic !== '') {
                avatarContainer.innerHTML = `<img src="http://localhost:5033${profilePic}" class="w-full h-full object-cover" alt="${fullName}">`;
            } else {
                avatarContainer.textContent = initials;
            }
        }
    } else {
        loggedInProfileDropdown?.classList.add('hidden');
        loggedOutSignIn?.classList.remove('hidden');
        topBarAccountLink?.classList.remove('hidden');
        topBarSignInLink?.classList.remove('hidden');
    }
}

function updateStorefrontCartBadge(scope = document) {
    const badge = scope.querySelector('#cart-badge');
    if (!badge) return;

    try {
        const cart = JSON.parse(localStorage.getItem('yaantra_cart')) || [];
        const total = cart.reduce((sum, item) => sum + (item.qty || 1), 0);

        if (total > 0) {
            badge.textContent = total > 99 ? '99+' : total;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch {
        badge.classList.add('hidden');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('firstName');
    localStorage.removeItem('lastName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('profilePic');
    window.location.href = '../auth/login.html';
}

window.logout = logout;
window.loadProfileAndNavbar = loadProfileAndNavbar;
window.updateStorefrontCartBadge = updateStorefrontCartBadge;


// ─── Homepage Live Data Loaders ─────────────────────────────────────────────

const API_BASE = 'http://localhost:5033/api';
const STORE_API_BASE_CANDIDATES = [API_BASE];

function toApiUrl(base, pathWithQuery) {
    const path = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
    return `${base}${path}`;
}

function toOriginFromApiBase(base) {
    try {
        return new URL(base, window.location.origin).origin;
    } catch {
        return window.location.origin;
    }
}

async function fetchFromStoreApi(pathWithQuery) {
    let lastError = null;

    for (const base of STORE_API_BASE_CANDIDATES) {
        const url = toApiUrl(base, pathWithQuery);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                lastError = new Error(`API request failed (${response.status}) for ${url}`);
                continue;
            }

            const data = await response.json();
            return { data, apiBase: base };
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Unable to reach store API.');
}

function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toCurrency(value) {
    const n = Number(value || 0);
    return `Rs ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function getStars(rating) {
    const r = Math.max(1, Math.min(5, Number(rating || 5)));
    return '&#9733;'.repeat(r) + '<span class="text-gray-300">' + '&#9733;'.repeat(5 - r) + '</span>';
}

function getInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

async function loadLatestProducts() {
    const grid = document.getElementById('latest-products-grid');
    if (!grid) return;

    try {
        const { data: payload, apiBase } = await fetchFromStoreApi('/Products?page=1&pageSize=4');
        const products = Array.isArray(payload.data) ? payload.data : [];
        const apiOrigin = toOriginFromApiBase(apiBase);

        if (!products.length) {
            grid.innerHTML = '<p class="col-span-full text-center text-gray-500 italic">No products available right now.</p>';
            return;
        }

        grid.innerHTML = products.map(product => {
            const imagePath = Array.isArray(product.Images) && product.Images.length
                ? product.Images[0]
                : Array.isArray(product.images) && product.images.length
                    ? product.images[0]
                    : null;

            const image = imagePath
                ? `${apiOrigin}${imagePath}`
                : '../assets/images/placeholder-product.png';

            const productId = product.Id ?? product.id;
            const productName = product.Name ?? product.name;
            const productDescription = product.Description ?? product.description;
            const priceValue = product.Price ?? product.price;
            const discountValue = product.DiscountPrice ?? product.discountPrice;

            const price = discountValue != null && Number(discountValue) > 0
                ? `<span class="text-sm text-gray-400 line-through mr-2">${toCurrency(priceValue)}</span><span class="text-lg font-bold text-[var(--color-primary)]">${toCurrency(discountValue)}</span>`
                : `<span class="text-lg font-bold text-[var(--color-primary)]">${toCurrency(priceValue)}</span>`;

            return `
                <a href="product-details.html?id=${productId}" class="group bg-[var(--color-secondary)] rounded-xl border border-[#e8ebe9] overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(10,46,38,0.1)]">
                    <div class="relative h-52 overflow-hidden">
                        <img src="${image}" alt="${escapeHtml(productName)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                    </div>
                    <div class="p-5 space-y-2">
                        <h3 class="font-semibold text-gray-900 line-clamp-2">${escapeHtml(productName)}</h3>
                        <p class="text-sm text-gray-600 line-clamp-2">${escapeHtml(productDescription || '')}</p>
                        <div class="pt-1">${price}</div>
                    </div>
                </a>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading latest products:', error);
        grid.innerHTML = '<p class="col-span-full text-center text-red-500 italic">Unable to load latest products.</p>';
    }
}

async function loadHomepageReviews() {
    const grid = document.getElementById('testimonials-grid');
    if (!grid) return;

    try {
        const { data: payload } = await fetchFromStoreApi('/Reviews/public?limit=3');
        const reviews = Array.isArray(payload.data) ? payload.data : [];

        if (!reviews.length) {
            grid.innerHTML = '<p class="col-span-full text-center text-gray-500 italic">No customer reviews yet.</p>';
            return;
        }

        grid.innerHTML = reviews.map(review => {
            const name = review.UserFullName || review.userFullName || 'Verified Buyer';
            const rating = review.Rating ?? review.rating;
            const comment = review.Comment ?? review.comment;
            return `
                <div class="bg-[var(--color-secondary)] p-8 rounded-xl border border-[#e8ebe9] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(10,46,38,0.1)]">
                    <div class="flex items-center mb-4"><div class="text-yellow-400">${getStars(rating)}</div></div>
                    <p class="text-gray-700 mb-4 text-base leading-relaxed">"${escapeHtml(comment || '')}"</p>
                    <div class="flex items-center space-x-4">
                        <div class="w-12 h-12 bg-[var(--color-primary)] rounded-full flex items-center justify-center text-white font-bold text-lg">${escapeHtml(getInitials(name))}</div>
                        <div>
                            <p class="font-semibold text-gray-900">${escapeHtml(name)}</p>
                            <p class="text-sm text-gray-600">Verified Buyer</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading homepage reviews:', error);
        grid.innerHTML = '<p class="col-span-full text-center text-red-500 italic">Unable to load customer reviews.</p>';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    includeStorefrontHeader();
    includeStorefrontFooter();
    loadLatestProducts();
    loadHomepageReviews();
});

window.addEventListener('storage', function (event) {
    if (event.key === 'yaantra_cart') {
        updateStorefrontCartBadge();
    }
});