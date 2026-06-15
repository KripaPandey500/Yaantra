const bookingsApiBase = 'http://localhost:5033/api/BookingAppointment/admin/bookings';

let currentPage = 1;
const pageSize = 10;
let totalPages = 1;

function escapeHtml(value) {
    if (value == null) return '-';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
}

function getStatusBadgeClass(status) {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'completed') return 'bg-green-100 text-green-700';
    if (normalized === 'confirmed') return 'bg-blue-100 text-blue-700';
    if (normalized === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-700';
}

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

function hasBookingReviews(booking) {
    // Check multiple possible ways reviews might be stored
    if (booking.reviews && Array.isArray(booking.reviews) && booking.reviews.length > 0) return true;
    if (booking.reviewCount && booking.reviewCount > 0) return true;
    if (booking.hasReviews === true) return true;
    if (booking.numberOfReviews && booking.numberOfReviews > 0) return true;
    if (booking.review && Object.keys(booking.review).length > 0) return true;
    return false;
}

function viewBookingReviews(bookingId) {
    const modal = document.getElementById('reviewsModal');
    if (!modal) {
        console.error('Reviews modal not found');
        alert('Error: Reviews modal not found');
        return;
    }
    
    document.getElementById('reviewsBookingId').value = bookingId;
    modal.classList.remove('hidden');
    
    // Load reviews asynchronously
    loadBookingReviews(bookingId).catch(err => {
        console.error('Error in viewBookingReviews:', err);
    });
}

async function loadBookingReviews(bookingId) {
    const headers = getAuthHeaders();
    const reviewsList = document.getElementById('reviewsList');
    
    if (!headers || !reviewsList) {
        console.error('Missing headers or reviewsList element');
        return;
    }
    
    try {
        reviewsList.innerHTML = `<p class="text-sm text-gray-500 text-center">Loading reviews...</p>`;
        
        const url = `http://localhost:5033/api/Reviews/booking/${bookingId}`;
        console.log('Fetching reviews from:', url);
        
        const response = await fetch(url, { headers });
        console.log('Reviews API status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('Reviews API error:', response.status, errorText);
            reviewsList.innerHTML = `<p class="text-sm text-gray-500 text-center">No reviews available yet. (Status: ${response.status})</p>`;
            return;
        }
        
        const reviews = await response.json();
        console.log('Reviews data:', reviews);
        
        if (!Array.isArray(reviews) || reviews.length === 0) {
            reviewsList.innerHTML = `<p class="text-sm text-gray-500 text-center py-8">No reviews found for this booking.</p>`;
            return;
        }
        
        reviewsList.innerHTML = reviews.map(review => {
            const stars = '★'.repeat(review.rating || 0);
            return `
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <p class="font-bold text-base text-gray-800">${escapeHtml(review.customerName || 'Anonymous')}</p>
                    </div>
                    <div class="text-yellow-500 text-lg font-bold tracking-wide">${stars}</div>
                </div>
                <p class="text-gray-700 text-base leading-relaxed">${escapeHtml(review.comment)}</p>
            </div>
        `;
        }).join('');
    } catch (error) {
        console.error('Error loading reviews:', error);
        reviewsList.innerHTML = `<p class="text-sm text-gray-500 text-center">Error loading reviews. Check console for details.</p>`;
    }
}

function closeReviewsModal() {
    const modal = document.getElementById('reviewsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function renderPagination() {
    const container = document.getElementById('paginationNumbers');
    if (!container) return;

    container.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        container.innerHTML += `
            <button data-page="${i}"
                class="w-10 h-10 flex items-center justify-center rounded-full ${i === currentPage ? 'bg-[#23412a] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                ${i}
            </button>
        `;
    }

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

async function loadBookings(page = 1) {
    currentPage = page;

    const headers = getAuthHeaders();
    const table = document.getElementById('bookingTable');
    if (!table) return;

    if (!headers) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="p-4 text-sm text-red-600 text-center">Login required to access admin bookings.</td>
            </tr>
        `;
        return;
    }

    const search = document.getElementById('searchInput')?.value?.trim() || '';

    const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search
    });

    try {
        console.log('Loading bookings from:', `${bookingsApiBase}?${query.toString()}`);
        const response = await fetch(`${bookingsApiBase}?${query.toString()}`, { headers });
        console.log('Bookings API response status:', response.status);
        
        if (!response.ok) {
            const message = response.status === 403
                ? 'Only ADMIN users can manage bookings.'
                : 'Failed to load bookings.';
            table.innerHTML = `
                <tr>
                    <td colspan="7" class="p-4 text-sm text-red-600 text-center">${message}</td>
                </tr>
            `;
            return;
        }

        const payload = await response.json();
        const bookings = Array.isArray(payload.data) ? payload.data : [];
        
        console.log('Bookings received:', bookings);

        totalPages = Math.max(1, payload.totalPages || 1);
        table.innerHTML = '';

        if (bookings.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="7" class="p-4 text-sm text-gray-500 text-center">No bookings found.</td>
                </tr>
            `;
            renderPagination();
            return;
        }

        bookings.forEach((booking, idx) => {
            const serialNumber = (page - 1) * pageSize + idx + 1;
            const statusClass = getStatusBadgeClass(booking.status);
            const statusValue = (booking.status || 'Pending').toLowerCase();

            table.innerHTML += `
                <tr class="border-b hover:bg-gray-100 align-top">
                    <td class="p-3 text-sm">${serialNumber}</td>
                    <td class="p-3 text-sm">
                        <div class="font-semibold text-gray-800">${escapeHtml(booking.customerName)}</div>
                    </td>
                    <td class="p-3 text-sm">${escapeHtml(booking.vehicleName)}</td>
                    <td class="p-3 text-sm">
                        <div class="font-medium text-gray-800">${escapeHtml(booking.serviceType)}</div>
                        <div class="text-xs text-gray-500">${escapeHtml(booking.problemDescription || '-')}</div>
                    </td>
                    <td class="p-3 text-sm">${escapeHtml(formatDate(booking.bookingDate))}</td>
                    <td class="p-3 text-sm">
                        <span class="px-2 py-1 rounded text-xs font-bold ${statusClass}">${escapeHtml(booking.status || 'Pending')}</span>
                    </td>
                    <td class="p-3 text-sm">
                        ${statusValue === 'completed' ? `
                        <button class="btn text-xs px-3 py-1 bg-[#23412a] text-white border-none transition duration-300 transform hover:bg-green-800 hover:-translate-y-0.5 hover:scale-105 shadow-sm" onclick="viewBookingReviews(${booking.id})">
                            View Reviews
                        </button>
                        ` : statusValue !== 'completed' && statusValue !== 'rejected' ? `
                        <div class="flex items-center gap-2">
                            <select id="statusSelect-${booking.id}" class="border rounded px-2 py-1 text-xs bg-white">
                                <option value="pending" ${statusValue === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="confirmed" ${statusValue === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                                <option value="completed" ${statusValue === 'completed' ? 'selected' : ''}>Completed</option>
                                <option value="rejected" ${statusValue === 'rejected' ? 'selected' : ''}>Rejected</option>
                            </select>
                            <button class="btn text-xs px-3 py-1 bg-[#23412a] text-white border-none transition duration-300 transform hover:bg-green-800 hover:-translate-y-0.5 hover:scale-105 shadow-sm" data-booking-id="${booking.id}">
                                Update
                            </button>
                        </div>
                        ` : `
                        <span class="px-2 py-1 text-xs text-gray-500 italic">-</span>
                        `}
                    </td>
                </tr>
            `;
        });

        renderPagination();
    } catch (error) {
        console.error('Error loading admin bookings:', error);
        table.innerHTML = `
            <tr>
                <td colspan="7" class="p-4 text-sm text-red-600 text-center">loading bookings.</td>
            </tr>
        `;
    }
}

async function updateBookingStatus(bookingId) {
    const headers = getAuthHeaders();
    if (!headers) {
        alert('Please login first.');
        return;
    }

    const select = document.getElementById(`statusSelect-${bookingId}`);
    if (!select) return;

    const selectedStatus = select.value;
    try {
        const response = await fetch(`${bookingsApiBase}/${bookingId}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status: selectedStatus })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            alert(payload.error || 'Failed to update booking status.');
            return;
        }

        await loadBookings(currentPage);
    } catch (error) {
        console.error('Error updating booking status:', error);
        alert('Something went wrong while updating status.');
    }
}



document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput')?.addEventListener('input', () => loadBookings(1));

    document.getElementById('prevBtn')?.addEventListener('click', () => {
        if (currentPage > 1) loadBookings(currentPage - 1);
    });

    document.getElementById('nextBtn')?.addEventListener('click', () => {
        if (currentPage < totalPages) loadBookings(currentPage + 1);
    });

    document.getElementById('paginationNumbers')?.addEventListener('click', event => {
        const button = event.target.closest('[data-page]');
        if (!button) return;
        const page = Number(button.getAttribute('data-page'));
        if (page >= 1) loadBookings(page);
    });

    document.getElementById('bookingTable')?.addEventListener('click', event => {
        const button = event.target.closest('[data-booking-id]');
        if (!button) return;
        const bookingId = Number(button.getAttribute('data-booking-id'));
        if (bookingId > 0) updateBookingStatus(bookingId);
    });

    loadBookings(1);
});
