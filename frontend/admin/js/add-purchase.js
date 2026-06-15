const purchasesApiBase = 'http://localhost:5033/api/purchases';
const productsApiBase = 'http://localhost:5033/api/products/all-for-purchase';
const vendorsApiBase = 'http://localhost:5033/api/products/vendors';

const purchaseState = {
    products: [],
    vendors: [],
    formItems: [],
    editingPurchaseId: null
};

const currencyFormatter = new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 2
});

document.addEventListener('DOMContentLoaded', async () => {
    await loadReferenceData();
    initializeForm();
    bindFormEvents();
});

async function loadReferenceData() {
    try {
        const token = localStorage.getItem('token');
        const headers = { "Authorization": `Bearer ${token}` };
        
        const [productsResponse, vendorsResponse] = await Promise.all([
            fetch(productsApiBase, { headers }),
            fetch(vendorsApiBase, { headers })
        ]);

        if (!productsResponse.ok || !vendorsResponse.ok) {
            throw new Error('Failed to load reference data.');
        }

        purchaseState.products = await productsResponse.json();
        purchaseState.vendors = await vendorsResponse.json();
        renderVendorOptions();
    } catch (error) {
        console.error(error);
        showAlert('Failed to load vendors and products.', 'error');
    }
}

function initializeForm() {
    purchaseState.formItems = [createDefaultFormItem()];
    renderPurchaseItemRows();
}

function bindFormEvents() {
    const form = document.getElementById('purchaseForm');
    const addItemBtn = document.getElementById('addPurchaseItemBtn');
    const itemsContainer = document.getElementById('purchaseItemsContainer');

    if (form) {
        form.addEventListener('submit', submitPurchaseForm);
    }

    if (addItemBtn) {
        addItemBtn.addEventListener('click', addPurchaseItemRow);
    }

    if (itemsContainer) {
        itemsContainer.addEventListener('click', event => {
            const removeButton = event.target.closest('button');
            if (removeButton && removeButton.textContent.includes('Remove')) {
                const index = Array.from(itemsContainer.querySelectorAll('tr')).indexOf(
                    removeButton.closest('tr')
                );
                if (index !== -1) {
                    removePurchaseItemRow(index);
                }
            }
        });

        itemsContainer.addEventListener('change', event => {
            const row = event.target.closest('tr');
            if (row) {
                const rows = itemsContainer.querySelectorAll('tr');
                const index = Array.from(rows).indexOf(row);
                if (index !== -1) {
                    updateFormItemFromRow(index, row, event.target);
                }
            }
        });

        itemsContainer.addEventListener('input', event => {
            const row = event.target.closest('tr');
            if (row) {
                const rows = itemsContainer.querySelectorAll('tr');
                const index = Array.from(rows).indexOf(row);
                if (index !== -1) {
                    updateFormItemFromRow(index, row, event.target);
                }
            }
        });
    }
}

function renderVendorOptions(selectedVendorId = '') {
    const vendorSelect = document.getElementById('vendorUserId');
    if (!vendorSelect) {
        return;
    }

    vendorSelect.innerHTML = `
        <option value="">-- Choose a vendor --</option>
        ${purchaseState.vendors.map(vendor => `
            <option value="${escapeAttribute(vendor.id)}" ${vendor.id === selectedVendorId ? 'selected' : ''}>${escapeHtml(vendor.name)}</option>
        `).join('')}
    `;
}

function addPurchaseItemRow() {
    purchaseState.formItems.push(createDefaultFormItem());
    renderPurchaseItemRows();
}

function removePurchaseItemRow(index) {
    if (purchaseState.formItems.length === 1) {
        showAlert('A purchase must contain at least one item.', 'error');
        return;
    }

    purchaseState.formItems.splice(index, 1);
    renderPurchaseItemRows();
}

function renderPurchaseItemRows() {
    const container = document.getElementById('purchaseItemsContainer');
    if (!container) {
        return;
    }

    container.innerHTML = purchaseState.formItems.map((item, index) => {
        const product = purchaseState.products.find(entry => String(entry.id) === String(item.productId));
        const unitPrice = product ? Number(product.price || 0) : 0;
        const subTotal = Number(item.quantity || 0) * unitPrice;

        return `
            <tr class="border-b border-gray-100 hover:bg-gray-100" data-item-index="${index}">
                <td class="p-4 min-w-[240px]">
                    <select data-field="productId" class="purchase-item-input w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition shadow-sm bg-white">
                        <option value="">Select Product</option>
                        ${purchaseState.products.map(productOption => `
                            <option value="${productOption.id}" ${String(productOption.id) === String(item.productId) ? 'selected' : ''}>${escapeHtml(productOption.name)}</option>
                        `).join('')}
                    </select>
                </td>
                <td class="p-4 text-sm text-gray-700 font-medium" data-stock-cell>${product ? product.stockQty : 0}</td>
                <td class="p-4 min-w-[80px]">
                    <input data-field="quantity" type="number" min="1" value="${escapeAttribute(item.quantity)}" class="purchase-item-input rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition shadow-sm">
                </td>
                <td class="p-4 text-sm font-semibold text-primary" data-unitprice-cell>${formatCurrency(unitPrice)}</td>
                <td class="p-4 font-bold text-primary" data-subtotal-cell>${formatCurrency(subTotal)}</td>
                <td class="p-4 text-center">
                    <button type="button" class="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-semibold text-sm border border-red-200">Remove</button>
                </td>
            </tr>
        `;
    }).join('');

    updateGrandTotal();
}

function updateFormItemFromRow(index, row, changedElement) {
    const productId = row.querySelector('[data-field="productId"]')?.value || '';
    const quantityInput = row.querySelector('[data-field="quantity"]');
    const quantity = Number(quantityInput?.value || 0);
    const selectedProduct = purchaseState.products.find(product => String(product.id) === String(productId));

    purchaseState.formItems[index] = {
        productId,
        quantity
    };

    const stockCell = row.querySelector('[data-stock-cell]');
    const unitPriceCell = row.querySelector('[data-unitprice-cell]');
    const subtotalCell = row.querySelector('[data-subtotal-cell]');

    if (stockCell) {
        stockCell.textContent = selectedProduct ? selectedProduct.stockQty : '0';
    }

    if (unitPriceCell && selectedProduct) {
        const unitPrice = Number(selectedProduct.price || 0);
        unitPriceCell.textContent = formatCurrency(unitPrice);
    }

    if (subtotalCell && selectedProduct) {
        const unitPrice = Number(selectedProduct.price || 0);
        subtotalCell.textContent = formatCurrency(quantity * unitPrice);
    }

    updateGrandTotal();
}

function updateGrandTotal() {
    const purchaseItems = purchaseState.purchaseDetails || purchaseState.formItems;
    const products = purchaseState.products || [];
    
    const grandTotal = purchaseItems.reduce((sum, item) => {
        const product = products.find(p => p.id === Number(item.productId));
        const unitPrice = product ? Number(product.price || 0) : 0;
        return sum + (Number(item.quantity || 0) * unitPrice);
    }, 0);

    const totalElement = document.getElementById('totalAmount');
    if (totalElement) {
        totalElement.textContent = formatCurrency(grandTotal);
    }
}

async function submitPurchaseForm(event) {
    event.preventDefault();

    const payload = buildPurchasePayload();
    if (!payload) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(purchasesApiBase, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to create purchase invoice.');
        }

        window.location.href = 'purchases.html?status=added';
    } catch (error) {
        console.error(error);
        showAlert(error.message || 'Failed to create purchase invoice.', 'error');
    }
}

function buildPurchasePayload() {
    const vendorUserId = document.getElementById('vendorUserId')?.value || '';

    if (!vendorUserId) {
        showAlert('Please select a vendor.', 'error');
        return null;
    }

    const purchaseItems = purchaseState.formItems.map(item => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity)
    }));

    const invalidItem = purchaseItems.find(item => !item.productId || item.quantity < 1);
    if (!purchaseItems.length || invalidItem) {
        showAlert('Each line item must have a product and quantity should be at least 1.', 'error');
        return null;
    }

    return {
        vendorUserId,
        purchaseDate: new Date().toISOString(),
        purchaseItems
    };
}

function createDefaultFormItem() {
    return {
        productId: '',
        quantity: 1
    };
}

function formatCurrency(value) {
    return 'Rs ' + Number(value || 0).toFixed(2);
}

function showAlert(message, type = 'success') {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;

    alertBox.textContent = message;
    alertBox.className = 'mb-4 text-center text-sm';
    alertBox.classList.add(type === 'success' ? 'ts-alert-success' : 'ts-alert-error');
    alertBox.classList.remove('hidden');

    clearTimeout(showAlert.timeoutId);
    showAlert.timeoutId = setTimeout(() => {
        alertBox.classList.add('hidden');
    }, 2000);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, char => map[char]);
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
}
