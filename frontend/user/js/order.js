const apiBase = 'http://localhost:5033/api/Orders';
let currentPage = 1;
let pageSize = 6;
let totalPages = 1;
let currentSearch = '';
let orderToCancel = null;

function isOrderCancellable(status) {
	const normalized = (status || '').toLowerCase();
	// Only allow cancellation for incomplete orders
	return normalized !== 'delivered' && normalized !== 'shipped' && normalized !== 'cancelled';
}

// Alert helper function
function showAlert(elementId, message, type = 'error') {
	const alertBox = document.getElementById(elementId);
	if (!alertBox) return;
	
	alertBox.className = `text-center text-sm rounded-xl padding-4 ${
		type === 'success' 
			? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
			: 'bg-red-50 text-red-700 border border-red-200'
	}`;
	alertBox.textContent = message;
	alertBox.classList.remove('hidden');
	
	// Auto hide after 5 seconds
	setTimeout(() => {
		alertBox.classList.add('hidden');
	}, 5000);
}

function getOrderIdFromQuery() {
	const params = new URLSearchParams(window.location.search);
	const id = Number(params.get('id'));
	return Number.isNaN(id) || id <= 0 ? null : id;
}

function isOrderDetailPage() {
	return !!document.getElementById('viewOrderContent');
}

function setOrderDetailState({ loading = false, error = '', showLayout = false }) {
	const loadingEl = document.getElementById('orderDetailLoading');
	const errorEl = document.getElementById('orderDetailError');
	const layoutEl = document.getElementById('orderDetailLayout');

	if (loadingEl) {
		loadingEl.classList.toggle('hidden', !loading);
	}

	if (errorEl) {
		errorEl.textContent = error;
		errorEl.classList.toggle('hidden', !error);
	}

	if (layoutEl) {
		layoutEl.classList.toggle('hidden', !showLayout);
		if (showLayout && typeof lucide !== 'undefined') {
			lucide.createIcons();
		}
	}
}

function setTextById(id, value) {
	const el = document.getElementById(id);
	if (el) {
		el.textContent = value;
	}
}

function renderOrderItems(items) {
	const tbody = document.getElementById('orderItemsTableBody');
	const emptyEl = document.getElementById('orderItemsEmpty');
	if (!tbody || !emptyEl) return;

	tbody.innerHTML = '';
	if (!Array.isArray(items) || items.length === 0) {
		emptyEl.classList.remove('hidden');
		return;
	}

	emptyEl.classList.add('hidden');
	items.forEach((item) => {
		const row = document.createElement('tr');
		row.className = 'hover:bg-gray-50/50 transition';

		const productCell = document.createElement('td');
		productCell.className = 'px-8 py-5 text-sm font-medium text-gray-900';
		productCell.textContent = item.productName || '-';

		const qtyCell = document.createElement('td');
		qtyCell.className = 'px-8 py-5 text-sm font-medium text-gray-900';
		qtyCell.textContent = String(item.quantity ?? 0);

		const unitPriceCell = document.createElement('td');
		unitPriceCell.className = 'px-8 py-5 text-sm font-medium text-gray-900';
		unitPriceCell.textContent = formatCurrency(item.unitPrice);

		const discountCell = document.createElement('td');
		discountCell.className = 'px-8 py-5 text-sm font-medium text-gray-900';
		discountCell.textContent = formatCurrency(item.discountPerItem ?? 0);

		const totalCell = document.createElement('td');
		totalCell.className = 'px-8 py-5 text-sm font-bold text-emerald-600 text-right';
		totalCell.textContent = formatCurrency(item.totalPrice);

		row.append(productCell, qtyCell, unitPriceCell, discountCell, totalCell);
		tbody.appendChild(row);
	});
}

async function viewOrder(id) {
	window.location.href = `view-order.html?id=${id}`;
}

async function loadOrderDetailPage() {
	const orderId = getOrderIdFromQuery();
	const token = localStorage.getItem('token');
	const content = document.getElementById('viewOrderContent');
	if (!content || !orderId) {
		setOrderDetailState({ loading: false, error: 'Invalid order selected.', showLayout: false });
		return;
	}

	if (!token) {
		showAlert('alertBox', 'Please login first.', 'error');
		return;
	}

	setOrderDetailState({ loading: true, error: '', showLayout: false });

	try {
		const response = await fetch(`${apiBase}/user-orders/${orderId}`, {
			headers: {
				'Authorization': `Bearer ${token}`
			}
		});

		const result = await response.json().catch(() => ({}));
		if (!response.ok) {
			setOrderDetailState({
				loading: false,
				error: result.error || 'Failed to load order details.',
				showLayout: false
			});
			return;
		}

		setTextById('detailOrderNumber', result.orderNumber || '-');
		setTextById('detailOrderDate', formatDate(result.orderDate));
		setTextById('detailStatus', result.status || '-');
		setTextById('detailPaymentStatus', result.paymentStatus || '-');
		setTextById('detailPaymentMethod', result.paymentMethod || '-');
		setTextById('detailShippingAddress', result.shippingAddress || '-');
		setTextById('detailTotalAmount', formatCurrency(result.totalAmount));
		setTextById('detailDiscountAmount', formatCurrency(result.discountAmount ?? 0));
		setTextById('detailGrandTotal', formatCurrency(result.grandTotal));
		renderOrderItems(result.orderItems);
		setOrderDetailState({ loading: false, error: '', showLayout: true });
	} catch (error) {
		console.error('Failed to load order details:', error);
		setOrderDetailState({ loading: false, error: 'Failed to load order details.', showLayout: false });
	}
}

function formatDate(value) {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toLocaleDateString();
}

function formatCurrency(value) {
	const n = Number(value);
	if (Number.isNaN(n)) return 'Rs. 0.00';
	return 'Rs. ' + n.toFixed(2);
}

function escapeHtml(text) {
	if (text == null) return '-';
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function getStatusBadge(status) {
	const normalized = (status || '').toLowerCase();
	if (normalized === 'delivered' || normalized === 'shipped') {
		return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
	}
	if (normalized === 'cancelled') {
		return 'bg-red-100 text-red-700 border border-red-200';
	}
	if (normalized === 'processing') {
		return 'bg-blue-100 text-blue-700 border border-blue-200';
	}
	return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
}

async function loadOrders() {
	const table = document.getElementById('orderTable');
	if (!table) return;

	const token = localStorage.getItem('token');
	if (!token) {
		showAlert('alertBox', 'Please login first.', 'error');
		table.innerHTML = '';
		return;
	}

	try {
		const url = `${apiBase}/user-orders/history?page=${currentPage}&pageSize=${pageSize}&search=${encodeURIComponent(currentSearch)}`;
		console.log('📡 Fetching orders from:', url);
		
		const response = await fetch(url, {
			headers: {
				'Authorization': `Bearer ${token}`
			}
		});

		console.log('📦 Response Status:', response.status);
		
		const result = await response.json().catch(() => ({}));
		console.log('📋 Response Data:', result);
		
		if (!response.ok) {
			console.error('❌ API Error:', result);
			showAlert('alertBox', result.error || 'Failed to load orders.', 'error');
			table.innerHTML = '';
			return;
		}

		totalPages = result.totalPages || 1;
		const rows = result.data || [];
		console.log(`✅ Loaded ${rows.length} orders from API`);
		
		table.innerHTML = '';

		if (rows.length === 0) {
			console.log('ℹ️ No orders found, showing empty state');
			const emptyTemplate = document.getElementById('orderEmptyRowTemplate');
			if (emptyTemplate) {
				table.appendChild(emptyTemplate.content.cloneNode(true));
			}
			renderPagination();
			return;
		}

		rows.forEach((order, idx) => {
			const rowTemplate = document.getElementById('orderRowTemplate');
			if (!rowTemplate) return;

			const sn = (currentPage - 1) * pageSize + idx + 1;
			const statusClass = getStatusBadge(order.status);
			const fragment = rowTemplate.content.cloneNode(true);
			const row = fragment.querySelector('tr');
			if (!row) return;

			const statusEl = row.querySelector('.order-status');
			const viewLink = row.querySelector('.order-view-link');
			const cancelBtn = row.querySelector('.order-cancel-btn');

			row.querySelector('.order-sn').textContent = String(sn);
			row.querySelector('.order-number').textContent = order.orderNumber || '-';
			row.querySelector('.order-date').textContent = formatDate(order.orderDate);
			row.querySelector('.order-item-count').textContent = String(order.itemCount ?? 0);
			row.querySelector('.order-grand-total').textContent = formatCurrency(order.grandTotal);

			if (statusEl) {
				statusEl.classList.add(...statusClass.split(' '));
				statusEl.textContent = order.status || '-';
			}

			if (viewLink) {
				viewLink.setAttribute('href', `view-order.html?id=${order.id}`);
			}

			// Show cancel button only for cancellable orders
			if (cancelBtn) {
				if (isOrderCancellable(order.status)) {
					cancelBtn.classList.remove('hidden');
					cancelBtn.addEventListener('click', () => openCancelOrderModal(order.id));
				} else {
					cancelBtn.classList.add('hidden');
				}
			}

			table.appendChild(fragment);
		});

		renderPagination();
		
		if (typeof lucide !== 'undefined') {
			lucide.createIcons();
		}
	} catch (error) {
		console.error('🔥 Failed to load orders:', error);
		showAlert('alertBox', 'Failed to load orders. Check browser console for details.', 'error');
	}
}

function renderPagination() {
	const container = document.getElementById('paginationNumbers');
	if (!container) return;

	container.innerHTML = '';
	for (let i = 1; i <= totalPages; i++) {
		container.innerHTML += `
			<button onclick="goToPage(${i})"
				class="w-10 h-10 flex items-center justify-center rounded-xl font-bold text-[10px]
				${i === currentPage ? 'bg-[#062621] text-white shadow-lg' : 'bg-white border border-gray-100 text-gray-600 hover:bg-emerald-50 transition'}">
				${i}
			</button>
		`;
	}

	const prevBtn = document.getElementById('prevBtn');
	const nextBtn = document.getElementById('nextBtn');
	if (prevBtn) prevBtn.disabled = currentPage === 1;
	if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

function goToPage(page) {
	currentPage = page;
	loadOrders();
}

function nextPage() {
	if (currentPage < totalPages) {
		currentPage++;
		loadOrders();
	}
}

function prevPage() {
	if (currentPage > 1) {
		currentPage--;
		loadOrders();
	}
}

function openCancelOrderModal(id) {
	orderToCancel = id;
	document.getElementById('cancelOrderModal')?.classList.remove('hidden');
}

function closeCancelOrderModal() {
	orderToCancel = null;
	document.getElementById('cancelOrderModal')?.classList.add('hidden');
}

async function confirmCancelOrder() {
	if (!orderToCancel) return;

	const token = localStorage.getItem('token');
	if (!token) {
		showAlert('alertBox', 'Please login first.', 'error');
		closeCancelOrderModal();
		return;
	}

	try {
		// Call the cancel order endpoint
		const response = await fetch(`${apiBase}/${orderToCancel}/cancel`, {
			method: 'PUT',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'
			}
		});

		const result = await response.json().catch(() => ({}));
		closeCancelOrderModal();

		if (!response.ok) {
			showAlert('alertBox', result.error || 'Failed to cancel order.', 'error');
			return;
		}

		showAlert('alertBox', 'Order cancelled successfully!', 'success');
		loadOrders();
	} catch (error) {
		console.error('Failed to cancel order:', error);
		closeCancelOrderModal();
		showAlert('alertBox', 'Failed to cancel order.', 'error');
	}
}

document.addEventListener('DOMContentLoaded', function () {
	console.log('🚀 Order page initialized');
	
	if (isOrderDetailPage()) {
		console.log('📄 Order detail page detected');
		loadOrderDetailPage();
		return;
	}

	const searchInput = document.getElementById('searchInput');
	if (searchInput) {
		searchInput.addEventListener('input', function () {
			currentSearch = this.value.trim();
			currentPage = 1;
			console.log('🔍 Search input changed:', currentSearch);
			loadOrders();
		});
	}

	const confirmCancelBtn = document.getElementById('confirmCancelBtn');
	if (confirmCancelBtn) {
		confirmCancelBtn.onclick = confirmCancelOrder;
	}

	console.log('📥 Calling loadOrders()...');
	loadOrders();
	
	
	if (typeof lucide !== 'undefined') {
		lucide.createIcons();
	}
});
