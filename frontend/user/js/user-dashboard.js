// ── Sidebar ──────────────────────────────────────────────────────────────────

function initUserSidebar(container) {
	if (!container) return;
	const currentPath = window.location.pathname.replace(/\/+$/, '');
	container.querySelectorAll('[data-nav-link]').forEach((link) => {
		const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/+$/, '');
		if (linkPath === currentPath) {
			link.classList.add('bg-[#1f6b58]', 'border-l-white', 'font-bold');
		}
	});
	initLogout(container);
}

function initLogout(container) {
	const modal = container.querySelector('#logoutModal');
	if (!modal) return;
	const open  = () => modal.classList.remove('hidden');
	const close = () => modal.classList.add('hidden');
	container.querySelector('#logoutBtn')?.addEventListener('click', open);
	container.querySelector('#cancelLogoutBtn')?.addEventListener('click', close);
	container.querySelector('#closeLogoutModalBtn')?.addEventListener('click', close);
	modal.addEventListener('click', e => { if (e.target === modal) close(); });
	container.querySelector('#confirmLogoutBtn')?.addEventListener('click', () => {
		['token', 'userEmail', 'firstName', 'lastName', 'userRole', 'profilePic'].forEach(k => localStorage.removeItem(k));
		window.location.href = '/frontend/auth/login.html?logout=1';
	});
	if (new URLSearchParams(window.location.search).get('logout') === '1') open();
}

fetch('includes/sidebar-user.html')
	.then(response => response.text())
	.then(data => {
		const sidebarContainer = document.getElementById('sidebar-container');
		sidebarContainer.innerHTML = data;
		initUserSidebar(sidebarContainer);
	});

// ── Dashboard Data ────────────────────────────────────────────────────────────

const API = 'http://localhost:5033/api';

function statusBadge(status) {
	const map = {
		pending:   'bg-yellow-100 text-yellow-700',
		confirmed: 'bg-blue-100 text-blue-700',
		completed: 'bg-green-100 text-green-700',
		cancelled: 'bg-red-100 text-red-700',
		shipped:   'bg-purple-100 text-purple-700',
		paid:      'bg-green-100 text-green-700',
		unpaid:    'bg-red-100 text-red-700',
	};
	const cls = map[(status || '').toLowerCase()] || 'bg-gray-100 text-gray-600';
	return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${cls}">${status || '—'}</span>`;
}

function formatDate(d) {
	if (!d) return '—';
	return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function loadDashboard() {
	const token = localStorage.getItem('token');
	if (!token) {
		window.location.href = '/frontend/auth/login.html';
		return;
	}

	const firstName = localStorage.getItem('firstName') || '';
	const lastName  = localStorage.getItem('lastName') || '';
	const name = (firstName + ' ' + lastName).trim();
	if (name) document.getElementById('welcomeText').textContent = `Welcome back, ${name}!`;

	const headers = { 'Authorization': `Bearer ${token}` };

	const [ordersRes, bookingsRes, requestsRes] = await Promise.allSettled([
		fetch(`${API}/Orders/user-orders`, { headers }),
		fetch(`${API}/BookingAppointment/bookings`, { headers }),
		fetch(`${API}/PartRequest/my`, { headers }),
	]);

	// ---- Orders ----
	let orders = [];
	if (ordersRes.status === 'fulfilled' && ordersRes.value.ok) {
		orders = await ordersRes.value.json();
	}
	document.getElementById('statOrders').textContent = orders.length;
	document.getElementById('statCompleted').textContent = orders.filter(o => o.status?.toLowerCase() === 'completed').length;

	const recentOrdersEl = document.getElementById('recentOrdersList');
	if (orders.length === 0) {
		recentOrdersEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">No orders yet.</p>';
	} else {
		recentOrdersEl.innerHTML = orders.slice(0, 5).map(o => `
			<div class="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-[#eaf4f1] hover:border-[#1f6b58]/30 transition-all duration-200">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-[#0a2e26]/10 flex items-center justify-center">
						<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-[#0a2e26]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
					</div>
					<div>
						<p class="text-sm font-semibold text-gray-800">${o.orderNumber || '#' + o.id}</p>
						<p class="text-xs text-gray-400">${formatDate(o.orderDate)}</p>
					</div>
				</div>
				<div class="flex items-center gap-3">
					${statusBadge(o.status)}
					<span class="text-sm font-bold text-[#0a2e26]">Rs ${(o.grandTotal ?? o.totalAmount ?? 0).toLocaleString()}</span>
				</div>
			</div>`).join('');
	}

	// ---- Bookings ----
	let bookings = [];
	if (bookingsRes.status === 'fulfilled' && bookingsRes.value.ok) {
		bookings = await bookingsRes.value.json();
	}
	document.getElementById('statBookings').textContent = bookings.length;

	const recentBookingsEl = document.getElementById('recentBookingsList');
	if (bookings.length === 0) {
		recentBookingsEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">No bookings yet.</p>';
	} else {
		recentBookingsEl.innerHTML = bookings.slice(0, 5).map(b => `
			<div class="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-[#eaf4f1] hover:border-[#1f6b58]/30 transition-all duration-200">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-[#0a2e26]/10 flex items-center justify-center">
						<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-[#0a2e26]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
					</div>
					<div>
						<p class="text-sm font-semibold text-gray-800">${b.serviceType || 'Service'}</p>
						<p class="text-xs text-gray-400">${b.vehicleName || '—'} · ${formatDate(b.serviceDate || b.bookingDate)}</p>
					</div>
				</div>
				${statusBadge(b.status)}
			</div>`).join('');
	}

	// ---- Part Requests ----
	let requests = [];
	if (requestsRes.status === 'fulfilled' && requestsRes.value.ok) {
		requests = await requestsRes.value.json();
	}
	document.getElementById('statRequests').textContent = requests.length;

	const recentRequestsEl = document.getElementById('recentRequestsList');
	if (requests.length === 0) {
		recentRequestsEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">No part requests yet.</p>';
	} else {
		recentRequestsEl.innerHTML = `
			<table class="w-full text-sm">
				<thead>
					<tr class="text-left text-xs text-gray-500 border-b">
						<th class="pb-2 font-semibold">Part Name</th>
						<th class="pb-2 font-semibold">Qty</th>
						<th class="pb-2 font-semibold">Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					${requests.slice(0, 5).map(r => `
						<tr class="hover:bg-gray-50">
							<td class="py-2 pr-4 font-medium text-gray-800">${r.partName}</td>
							<td class="py-2 pr-4 text-gray-600">${r.quantity}</td>
							<td class="py-2">${statusBadge(r.status)}</td>
						</tr>`).join('')}
				</tbody>
			</table>`;
	}
}

loadDashboard();
