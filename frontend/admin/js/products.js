const API_BASE = "http://localhost:5033";
const FALLBACK_IMAGE = '/frontend/assets/images/no-image.png';
let currentPage = 1;
const pageSize = 5;
let totalPages = 1;
let currentSearch = '';
let deleteId = null;

/** IMAGE PATH HELPER - Based on controller response **/
function getImageUrl(product) {
    // Check if product has images array and it's not empty
    if (!product || !product.images || !Array.isArray(product.images) || product.images.length === 0) {
        return null;  // Return null instead of fallback image
    }
    
    const imagePath = product.images[0];
    
    
    if (imagePath) {
        return `${API_BASE}${imagePath}`;
    }
    
    return null;  // Return null if no image
}

/** 1. CATEGORY LOGIC (Fixes the "Not showing" bug) **/
function normalizeCategoriesResponse(payload) {
    let raw = Array.isArray(payload) ? payload : (payload.data || payload.value || []);
    return raw.map(c => ({ id: c.id || c.Id, name: c.name || c.Name }));
}

async function populateCategoryDropdown() {
    const categorySelect = document.getElementById('categoryId');
    if (!categorySelect) return;
    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${API_BASE}/api/categories`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const result = await res.json();
        const categories = normalizeCategoriesResponse(result);

        categorySelect.innerHTML = '<option value="">Select Category</option>';
        categories.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    } catch (e) { console.error('Category load fail', e); }
}

/** 2. ADD PRODUCT (Fixes the "Not adding" bug) **/
if (document.getElementById('productForm')) {
    document.getElementById('productForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const token = localStorage.getItem("token");
        const form = e.target;

        const formData = {
            Name: form.name.value.trim(),
            SKU: form.sku.value.trim(),
            Price: parseFloat(form.price.value),
            StockQty: parseInt(form.stockQty.value),
            CategoryId: parseInt(form.categoryId.value), // Ensure integer
            Description: form.description.value.trim()
        };

        try {
            const res = await fetch(`${API_BASE}/api/products`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(formData)
            });

            const result = await res.json();

            if (res.ok) {
                const productId = result.id || result.productId;
                if (form.images.files.length > 0) {
                    const imgForm = new FormData();
                    for (const file of form.images.files) imgForm.append('files', file);
                    await fetch(`${API_BASE}/api/products/${productId}/images`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: imgForm
                    });
                }
                window.location.href = 'products.html?status=added';
            } else {
                showAlert(result.message || "Error adding product", "error");
            }
        } catch (err) { showAlert("Server connection error", "error"); }
    });
}

/** 3. LOADING CATALOG **/
async function loadProducts(page = 1) {
    const table = document.getElementById("productTable");
    if(!table) return;
    currentPage = page;

    try {
        const catRes = await fetch(`${API_BASE}/api/categories`, { headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }});
        const categories = normalizeCategoriesResponse(await catRes.json());
        const catMap = {};
        categories.forEach(c => catMap[c.id] = c.name);

        const response = await fetch(`${API_BASE}/api/products?page=${currentPage}&pageSize=${pageSize}&search=${encodeURIComponent(currentSearch)}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        const products = data.data || [];
        totalPages = data.totalPages || 1;
        
        table.innerHTML = "";
        if (products.length === 0) {
            table.innerHTML = `<tr><td colspan="6" class="p-20 text-center text-gray-400 italic">Inventory is empty.</td></tr>`;
            return;
        }

        products.forEach((product, idx) => {
            const sn = (currentPage - 1) * pageSize + idx + 1;
            const imgUrl = getImageUrl(product);
            const hasImage = product.images && product.images.length > 0;
            const productObj = JSON.stringify(product).replace(/"/g, '&quot;');

            table.innerHTML += `
                <tr class="hover:bg-emerald-50/30 transition-colors border-b border-gray-50">
                    <td class="px-8 py-5 font-bold text-gray-300 text-xs">${sn}</td>
                    <td class="px-8 py-5">
                        ${hasImage ? `<img src="${imgUrl}" class="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-sm" alt="${product.name}" loading="lazy">` : ''}
                    </td>
                    <td class="px-8 py-5">
                        <div class="flex flex-col">
                            <span class="text-sm font-bold text-[#062621] leading-tight">${product.name}</span>
                            <span class="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1">${catMap[product.categoryId] || 'General'}</span>
                        </div>
                    </td>
                    <td class="px-8 py-5 text-[#062621] font-bold text-xs">Rs ${product.price.toLocaleString()}</td>
                    <td class="px-8 py-5 text-center">
                        <span class="px-3 py-1 rounded-full text-[10px] font-black border ${product.stockQty > 5 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}">${product.stockQty} UNITS</span>
                    </td>
                    <td class="px-8 py-5 text-right">
                        <div class="flex justify-end gap-1">
                            <button onclick='openViewProductModal(${productObj})' class="p-2 text-gray-400 hover:text-emerald-500 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                            <a href="edit-product.html?id=${product.id}" class="p-2 text-gray-400 hover:text-blue-500 transition"><i data-lucide="edit-3" class="w-4 h-4"></i></a>
                            <button onclick="openDeleteModal(${product.id})" class="p-2 text-gray-400 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </td>
                </tr>`;
        });
        renderPagination();
        if (window.lucide) lucide.createIcons();
    } catch (e) { console.error(e); }
}

/** 4. HELPERS **/
function openViewProductModal(p) {
    document.getElementById("vProductName").innerText = p.name;
    document.getElementById("vProductSku").innerText = p.sku;
    document.getElementById("vProductPrice").innerText = `Rs ${p.price.toLocaleString()}`;
    document.getElementById("vProductStock").innerText = `${p.stockQty} Units`;
    document.getElementById("vProductCategory").innerText = "Item Record";
    
    // Handle image - show only if exists
    const hasImage = p.images && p.images.length > 0;
    const imgElement = document.getElementById("vProductImg");
    
    if (hasImage) {
        imgElement.src = getImageUrl(p);
        imgElement.alt = p.name;
        imgElement.style.display = 'block';
    } else {
        imgElement.style.display = 'none';
    }
    
    document.getElementById("viewProductModal").classList.remove('hidden');
}

function openDeleteModal(id) { deleteId = id; document.getElementById("deleteConfirmModal").classList.remove('hidden'); }
document.getElementById("confirmDeleteBtn")?.addEventListener('click', async () => {
    const res = await fetch(`${API_BASE}/api/products/${deleteId}`, { method: 'DELETE', headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }});
    if (res.ok) { document.getElementById("deleteConfirmModal").classList.add('hidden'); loadProducts(currentPage); }
});

function renderPagination() {
    const container = document.getElementById('paginationNumbers');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        container.innerHTML += `<button onclick="loadProducts(${i})" class="w-10 h-10 flex items-center justify-center rounded-xl text-xs font-bold ${i === currentPage ? 'bg-[#062621] text-white' : 'bg-white text-gray-400'}">${i}</button>`;
    }
}

function showAlert(msg, type) {
    const b = document.getElementById('alertBox');
    if(!b) return;
    b.innerText = msg; b.className = type === 'error' ? 'p-4 bg-red-50 text-red-500 rounded-2xl mb-4 font-bold' : 'ts-alert-success mb-6 block';
    b.classList.remove('hidden'); setTimeout(() => b.classList.add('hidden'), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('productTable')) loadProducts();
    if(document.getElementById('categoryId')) populateCategoryDropdown();
    document.getElementById('searchInput')?.addEventListener('input', (e) => { currentSearch = e.target.value; clearTimeout(window.sT); window.sT = setTimeout(() => loadProducts(1), 400); });
});