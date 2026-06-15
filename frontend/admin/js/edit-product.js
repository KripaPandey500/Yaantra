function normalizeCategoriesResponse(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    return [];
}

function clearSkuFieldError() {
    const skuError = document.getElementById('skuError');
    if (!skuError) return;

    clearTimeout(clearSkuFieldError.timeoutId);
    skuError.textContent = '';
    skuError.classList.add('hidden');
}

function showSkuFieldError(message) {
    const skuError = document.getElementById('skuError');
    if (!skuError) return;

    clearTimeout(clearSkuFieldError.timeoutId);
    skuError.textContent = message;
    skuError.classList.remove('hidden');
    clearSkuFieldError.timeoutId = setTimeout(() => {
        skuError.classList.add('hidden');
    }, 2500);
}

function clearProductFieldError(fieldId) {
    const fieldError = document.getElementById(fieldId);
    if (!fieldError) return;

    clearTimeout(fieldError._timeoutId);
    fieldError.textContent = '';
    fieldError.classList.add('hidden');
}

function showProductFieldError(fieldId, message) {
    const fieldError = document.getElementById(fieldId);
    if (!fieldError) return;

    clearTimeout(fieldError._timeoutId);
    fieldError.textContent = message;
    fieldError.classList.remove('hidden');
    fieldError._timeoutId = setTimeout(() => {
        fieldError.classList.add('hidden');
    }, 3000);
}

function clearAllProductFieldErrors() {
    ['nameError', 'skuError', 'priceError', 'stockQtyError', 'categoryIdError', 'descriptionError'].forEach(clearProductFieldError);
}

function validateProductFormData(formData) {
    if (!formData.name) return { field: 'name', message: 'Product name is required.' };
    if (!formData.sku) return { field: 'sku', message: 'SKU is required.' };
    if (formData.sku.length > 100) return { field: 'sku', message: 'SKU cannot exceed 100 characters.' };
    if (Number.isNaN(formData.price) || formData.price <= 0) return { field: 'price', message: 'Price must be greater than 0.' };
    if (Number.isNaN(formData.stockQty) || formData.stockQty < 0) return { field: 'stockQty', message: 'Stock quantity cannot be negative.' };
    if (!formData.categoryId || Number(formData.categoryId) <= 0) return { field: 'categoryId', message: 'Please select a valid category.' };
    if (!formData.description) return { field: 'description', message: 'Description is required.' };
    if (formData.description.length > 1000) return { field: 'description', message: 'Description cannot exceed 1000 characters.' };
    return null;
}

function toFieldErrorId(field) {
    return `${field}Error`;
}

function handleProductApiError(result) {
    if (!result || !result.field) return false;
    showProductFieldError(toFieldErrorId(result.field), result.error || 'Invalid value.');
    return true;
}

// Edit Product Page Logic

// Get productId from query string
function getProductIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Populate dropdowns
async function populateDropdowns(selectedCategoryId) {
    // Category
    const categorySelect = document.getElementById('categoryId');
    if (categorySelect) {
        try {
            const token = localStorage.getItem('token');
            const catRes = await fetch('http://localhost:5033/api/categories', {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const categories = normalizeCategoriesResponse(await catRes.json());
            categorySelect.innerHTML = '<option value="">Select Category</option>';
            categories.forEach(cat => {
                categorySelect.innerHTML += `<option value="${cat.id}"${cat.id == selectedCategoryId ? ' selected' : ''}>${cat.name}</option>`;
            });
        } catch (e) { console.error('Failed to load categories', e); }
    }
}

// Load product data and populate form
async function loadProductData(productId) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:5033/api/products/${productId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Product not found');
        const product = await res.json();
        document.getElementById('productId').value = product.id;
        document.getElementById('name').value = product.name;
        document.getElementById('sku').value = product.sku;
        document.getElementById('price').value = product.price;
        document.getElementById('stockQty').value = product.stockQty;
        document.getElementById('description').value = product.description;
        await populateDropdowns(product.categoryId);

        // Render images with delete buttons
        const imagesDiv = document.getElementById('productImages');
        imagesDiv.innerHTML = '';
        if (product.images && product.images.length > 0) {
            product.images.forEach(imgUrl => {
                const imgId = encodeURIComponent(imgUrl);
                const fullUrl = imgUrl.startsWith('http') ? imgUrl : `http://localhost:5033${imgUrl}`;
                const imgBox = document.createElement('div');
                imgBox.className = 'relative w-16 h-16 flex items-center justify-center';
                imgBox.innerHTML = `
                    <img src="${fullUrl}" alt="Product Image" class="w-16 h-16 object-cover rounded border" />
                    <button data-img-url="${imgId}" class="delete-img-btn absolute top-0.5 right-0.5 bg-white bg-opacity-80 rounded-full p-0.5 shadow hover:bg-red-100 transition" style="z-index:2;">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                `;
                imagesDiv.appendChild(imgBox);
            });
        } else {
            imagesDiv.innerHTML = '<span class="text-gray-500">No images.</span>';
        }
        // Attach delete handlers
        imagesDiv.querySelectorAll('.delete-img-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const imgUrl = decodeURIComponent(this.getAttribute('data-img-url'));
                const token = localStorage.getItem('token');
                // Call backend to delete image (implement endpoint if needed)
                const delRes = await fetch(`http://localhost:5033/api/images/delete`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ ProductId: productId, FileUrl: imgUrl })
                });
                if (delRes.ok) {
                    this.parentElement.remove();
                } else {
                    alert('Failed to delete image.');
                }
            });
        });
    } catch (e) {
        alert('Failed to load product data.');
        window.location.href = 'products.html';
    }
}

// Handle form submit
if (document.getElementById('editProductForm')) {
    const editProductForm = document.getElementById('editProductForm');
    ['name', 'sku', 'price', 'stockQty', 'categoryId', 'description'].forEach(field => {
        editProductForm[field]?.addEventListener('input', () => clearProductFieldError(toFieldErrorId(field)));
        editProductForm[field]?.addEventListener('change', () => clearProductFieldError(toFieldErrorId(field)));
    });

    document.getElementById('editProductForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const alertBox = document.getElementById('alertBox');
        alertBox.classList.add('hidden');
        alertBox.textContent = '';
        clearAllProductFieldErrors();
        const productId = document.getElementById('productId').value;
        const form = e.target;
        const formData = {
            name: form.name.value.trim(),
            sku: form.sku.value.trim(),
            price: parseFloat(form.price.value),
            stockQty: parseInt(form.stockQty.value),
            categoryId: form.categoryId.value,
            description: form.description.value.trim(),
            discountPrice: null // Add if you have a field for this
        };
        // Basic validation
        const clientValidationError = validateProductFormData(formData);
        if (clientValidationError) {
            showProductFieldError(toFieldErrorId(clientValidationError.field), clientValidationError.message);
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:5033/api/products/${productId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            const result = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (handleProductApiError(result)) {
                    return;
                }
                alertBox.textContent = result.error || 'Failed to update product.';
                alertBox.classList.remove('hidden');
                alertBox.classList.remove('ts-alert-success');
                alertBox.classList.add('ts-alert-error');
                if (typeof hideAlert === 'function') hideAlert('alertBox');
                return;
            }
            // --- Image upload logic (like add product) ---
            const imagesInput = form.images;
            if (imagesInput && imagesInput.files.length > 0) {
                const imgForm = new FormData();
                for (const file of imagesInput.files) {
                    imgForm.append('files', file);
                }
                const imgRes = await fetch(`http://localhost:5033/api/products/${productId}/images`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: imgForm
                });
                if (!imgRes.ok) {
                    alertBox.textContent = 'Product updated, but image upload failed.';
                    alertBox.classList.remove('hidden');
                    alertBox.classList.remove('ts-alert-success');
                    alertBox.classList.add('ts-alert-error');
                    return;
                }
            }
            window.location.href = 'products.html?status=updated';
        } catch (err) {
            alertBox.textContent = 'An error occurred. Please try again.';
            alertBox.classList.remove('hidden');
            alertBox.classList.remove('ts-alert-success');
            alertBox.classList.add('ts-alert-error');
                if (typeof hideAlert === 'function') hideAlert('alertBox');
        }
    });
}

// On page load
const productId = getProductIdFromUrl();
if (productId) {
    loadProductData(productId);
} else {
    alert('No product ID specified.');
    window.location.href = 'products.html';
}
