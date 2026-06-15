const API_BASE = 'http://localhost:5033/api/BookingAppointment';
const VEHICLE_API_BASE = 'http://localhost:5033/api/Vehicles';
let currentPage = 1;
let pageSize = 4;
let totalPages = 1;
let currentSearch = '';
let bookingToCancel = null;
let bookingToDelete = null;

function isAddBookingPage() {
    return window.location.pathname.toLowerCase().endsWith('/frontend/user/pages/bookappointment/add-booking.html')
        || window.location.pathname.toLowerCase().endsWith('/add-booking.html');
}

function showBookingStatusFromQuery() {
    const alertId = 'bookingAlert';
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');

    if (status === 'added') {
        showAlert(alertId, 'Appointment booked successfully!', 'success');
        params.delete('status');
        const query = params.toString();
        const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', newUrl);
    }
}

const bookingFieldIds = [
    'vehicleIdError',
    'serviceTypeError',
    'serviceDateError',
    'problemDescriptionError',
    'noteError'
];

function clearBookingFieldError(fieldId) {
    const fieldError = document.getElementById(fieldId);
    if (!fieldError) return;

    clearTimeout(fieldError._timeoutId);
    fieldError.textContent = '';
    fieldError.classList.add('hidden');
}

function clearAllBookingFieldErrors() {
    bookingFieldIds.forEach(clearBookingFieldError);
}

function showBookingFieldError(fieldId, message) {
    const fieldError = document.getElementById(fieldId);
    if (!fieldError) return;

    clearTimeout(fieldError._timeoutId);
    fieldError.textContent = message;
    fieldError.classList.remove('hidden');
    fieldError._timeoutId = setTimeout(() => {
        fieldError.classList.add('hidden');
    }, 3500);
}

function mapFieldToErrorId(field) {
    return `${field}Error`;
}

function buildBookingPayload(form) {
    return {
        vehicleId: parseInt(form.vehicleId.value, 10),
        serviceType: form.serviceType.value.trim(),
        serviceDate: form.serviceDate.value || null,
        problemDescription: form.problemDescription.value.trim() || null,
        note: form.note.value.trim() || null
    };
}

function validateBookingPayload(payload) {
    if (!payload.vehicleId || Number.isNaN(payload.vehicleId)) {
        return { field: 'vehicleId', message: 'Please select a vehicle.' };
    }

    if (!payload.serviceType) {
        return { field: 'serviceType', message: 'Service type is required.' };
    }

    if (payload.serviceType.length > 100) {
        return { field: 'serviceType', message: 'Service type must not exceed 100 characters.' };
    }

    if (payload.serviceDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const serviceDate = new Date(payload.serviceDate);
        if (serviceDate < today) {
            return { field: 'serviceDate', message: 'Service date cannot be earlier than booking date.' };
        }
    }

    if (payload.problemDescription && payload.problemDescription.length > 1000) {
        return { field: 'problemDescription', message: 'Problem description must not exceed 1000 characters.' };
    }

    if (payload.note && payload.note.length > 500) {
        return { field: 'note', message: 'Note must not exceed 500 characters.' };
    }

    return { field: '', message: '' };
}

function handleBookingValidationErrors(result) {
    if (!result) return false;

    if (result.field && result.error) {
        showBookingFieldError(mapFieldToErrorId(result.field), result.error);
        return true;
    }

    if (result.errors && typeof result.errors === 'object') {
        const firstKey = Object.keys(result.errors)[0];
        if (!firstKey) return false;

        const message = Array.isArray(result.errors[firstKey]) ? result.errors[firstKey][0] : 'Invalid value.';
        const normalizedField = firstKey.charAt(0).toLowerCase() + firstKey.slice(1);
        showBookingFieldError(mapFieldToErrorId(normalizedField), message);
        return true;
    }

    return false;
}

function getBookingStatusBadgeClass(status) {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'confirmed' || normalized === 'completed') {
        return 'bg-green-100 text-green-700';
    }
    if (normalized === 'cancelled' || normalized === 'rejected') {
        return 'bg-red-100 text-red-700';
    }
    return 'bg-yellow-100 text-yellow-700';
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

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
}

function renderBookingDetails(tableBody, bookings) {
    if (!tableBody) return;

    if (!Array.isArray(bookings) || bookings.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="p-4 text-sm text-gray-500 text-center">No bookings found.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = bookings.map((b, index) => {
        const serialNumber = (currentPage - 1) * pageSize + index + 1;
        const serviceDate = formatDate(b.serviceDate);
        const vehicleName = b.vehicleName || '-';
        const serviceType = b.serviceType || '-';
        const problemDescription = b.problemDescription || '-';
        const note = b.note || '-';
        const status = b.status || 'Pending';
        const statusClass = getBookingStatusBadgeClass(status);
        const isCompleted = status.toLowerCase() === 'completed';
        // Always show Review icon if status is completed
        let reviewBtn = '';
        if (isCompleted) {
            reviewBtn = `<button type="button" onclick="openReviewModal(${b.id})" class="text-emerald-600 hover:text-emerald-700 transition">
                <i data-lucide="star" class="w-5 h-5"></i>
            </button>`;
        }

        // Only show Cancel icon if not completed
        let cancelBtn = '';
        if (!isCompleted) {
            cancelBtn = `<button type="button" onclick="cancelBooking(${b.id})" class="text-yellow-600 hover:text-yellow-700 transition">
                <i data-lucide="x-circle" class="w-5 h-5"></i>
            </button>`;
        }

        return `
            <tr class="border-b hover:bg-gray-50 align-top transition">
                <td class="px-8 py-5 font-medium">${serialNumber}</td>
                <td class="px-8 py-5 font-semibold text-emerald-600">${escapeHtml(vehicleName)}</td>
                <td class="px-8 py-5 text-gray-600">${escapeHtml(serviceType)}</td>
                <td class="px-8 py-5 text-gray-600">${escapeHtml(serviceDate)}</td>
                <td class="px-8 py-5">
                    <span class="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide ${statusClass}">${escapeHtml(status)}</span>
                </td>
                <td class="px-8 py-5 text-right space-x-2 flex justify-end gap-3">
                    ${reviewBtn}
                    ${cancelBtn}
                    <button type="button" onclick="deleteBooking(${b.id})" class="text-slate-700 hover:text-red-600 transition">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>
                </td>
            </tr>
        `;
        
        
        setTimeout(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }, 0);
    }).join('');
}

function renderPagination() {
    const container = document.getElementById('paginationNumbers');
    if (!container) return;

    container.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        container.innerHTML += `
            <button onclick="goToPage(${i})"
                class="w-10 h-10 flex items-center justify-center rounded-full
                ${i === currentPage ? 'bg-[#23412a] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
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
    loadUserBookings(document.getElementById('bookingTable'));
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        loadUserBookings(document.getElementById('bookingTable'));
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadUserBookings(document.getElementById('bookingTable'));
    }
}

async function loadUserBookings(tableBody) {
    const token = localStorage.getItem('token');
    if (!token) {
        renderBookingDetails(tableBody, []);
        totalPages = 1;
        renderPagination();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/bookings/history?page=${currentPage}&pageSize=${pageSize}&search=${encodeURIComponent(currentSearch)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            renderBookingDetails(tableBody, []);
            totalPages = 1;
            renderPagination();
            return;
        }

        const result = await response.json();
        totalPages = result.totalPages || 1;
        renderBookingDetails(tableBody, result.data || []);
        renderPagination();
        
     
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } catch (err) {
        console.error('Error loading bookings:', err);
        renderBookingDetails(tableBody, []);
        totalPages = 1;
        renderPagination();
    }
}

function openCancelBookingModal(id) {
    bookingToCancel = id;
    document.getElementById('cancelBookingModal')?.classList.remove('hidden');
}

function closeCancelBookingModal() {
    bookingToCancel = null;
    document.getElementById('cancelBookingModal')?.classList.add('hidden');
}

function cancelBooking(id) {
    openCancelBookingModal(id);
}

async function confirmCancelBooking() {
    if (!bookingToCancel) return;

    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('bookingAlert', 'Please login first.', 'error');
        closeCancelBookingModal();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/bookings/${bookingToCancel}/cancel`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json().catch(() => ({}));
        closeCancelBookingModal();

        if (!response.ok) {
            showAlert('bookingAlert', result.error || 'Failed to cancel booking.', 'error');
            return;
        }

        showAlert('bookingAlert', result.message || 'Booking cancelled successfully!', 'success');
        loadUserBookings(document.getElementById('bookingTable'));
    } catch (error) {
        console.error('Cancel booking failed:', error);
        closeCancelBookingModal();
        showAlert('bookingAlert', 'Failed to cancel booking.', 'error');
    }
}

function openDeleteBookingModal(id) {
    bookingToDelete = id;
    document.getElementById('deleteBookingModal')?.classList.remove('hidden');
}

function closeDeleteBookingModal() {
    bookingToDelete = null;
    document.getElementById('deleteBookingModal')?.classList.add('hidden');
}

function deleteBooking(id) {
    openDeleteBookingModal(id);
}

async function confirmDeleteBooking() {
    if (!bookingToDelete) return;

    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('bookingAlert', 'Please login first.', 'error');
        closeDeleteBookingModal();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/bookings/${bookingToDelete}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Handle 204 NoContent or other success responses
        if (response.ok) {
            const result = response.status === 204 ? {} : await response.json().catch(() => ({}));
            closeDeleteBookingModal();
            showAlert('bookingAlert', 'Booking deleted successfully!', 'success');
            loadUserBookings(document.getElementById('bookingTable'));
            return;
        }

        // Handle error responses
        const result = await response.json().catch(() => ({}));
        closeDeleteBookingModal();
        showAlert('bookingAlert', result.error || 'Failed to delete booking.', 'error');
    } catch (error) {
        console.error('Delete booking failed:', error);
        closeDeleteBookingModal();
        showAlert('bookingAlert', 'Failed to delete booking.', 'error');
    }
}

async function loadVehicleOptions() {
    const vehicleSelect = document.getElementById('vehicleId');
    if (!vehicleSelect) return;

    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('bookingAlert', 'Please login to book an appointment.', 'error');
        return;
    }

    try {
        const response = await fetch(`${VEHICLE_API_BASE}/my`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                showAlert('bookingAlert', 'Please login to book an appointment.', 'error');
                return;
            }
            showAlert('bookingAlert', 'Failed to load your vehicles.', 'error');
            return;
        }

        const vehicles = await response.json();
        vehicleSelect.innerHTML = '<option value="">Select Vehicle</option>';

        vehicles.forEach(vehicle => {
            const id = vehicle.id ?? vehicle.Id;
            const brand = vehicle.brand ?? vehicle.Brand ?? '';
            const model = vehicle.model ?? vehicle.Model ?? '';
            const vehicleNumber = vehicle.vehicleNumber ?? vehicle.VehicleNumber ?? '';
            const name = `${brand} ${model} (${vehicleNumber})`.trim();

            if (!id) return;
            vehicleSelect.innerHTML += `<option value="${id}">${name}</option>`;
        });

        if (vehicles.length === 0) {
            showAlert('bookingAlert', 'No vehicles found. Please add a vehicle first.', 'error');
        }
    } catch (err) {
        console.error('Failed to load vehicles:', err);
        showAlert('bookingAlert', 'Failed to load your vehicles.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const bookingForm = document.getElementById('booking-form');
    const tableBody = document.getElementById('bookingTable');

    showBookingStatusFromQuery();

    if (bookingForm) {
        loadVehicleOptions();

        ['vehicleId', 'serviceType', 'serviceDate', 'problemDescription', 'note'].forEach(field => {
            const input = bookingForm[field];
            input?.addEventListener('input', () => clearBookingFieldError(mapFieldToErrorId(field)));
            input?.addEventListener('change', () => clearBookingFieldError(mapFieldToErrorId(field)));
        });

        bookingForm.addEventListener('reset', function () {
            clearAllBookingFieldErrors();
        });

        bookingForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            clearAllBookingFieldErrors();

            const formData = buildBookingPayload(bookingForm);
            const validationError = validateBookingPayload(formData);
            if (validationError.field) {
                showBookingFieldError(mapFieldToErrorId(validationError.field), validationError.message);
                return;
            }

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE}/bookings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(formData)
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    if (handleBookingValidationErrors(err)) {
                        return;
                    }
                    showAlert('bookingAlert', err.error || err.message || 'Failed to book appointment.', 'error');
                    return;
                }

                bookingForm.reset();

                if (isAddBookingPage()) {
                    window.location.href = 'bookings.html?status=added';
                    return;
                }

                showAlert('bookingAlert', 'Appointment booked successfully!', 'success');
                await loadUserBookings(tableBody);
            } catch (err) {
                showAlert('bookingAlert', 'An error occurred. Please try again.', 'error');
                console.error(err);
            }
        });
    }

    const searchInput = document.getElementById('searchInput');
    searchInput?.addEventListener('input', function () {
        currentSearch = this.value.trim();
        currentPage = 1;
        loadUserBookings(tableBody);
    });

    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    if (confirmCancelBtn) {
        confirmCancelBtn.onclick = confirmCancelBooking;
    }

    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.onclick = confirmDeleteBooking;
    }

    const addBookingBtn = document.getElementById('addBookingBtn');
    if (addBookingBtn) {
        addBookingBtn.addEventListener('click', function () {
            window.location.href = 'add-booking.html';
        });
    }

    
    if (tableBody) {
        loadUserBookings(tableBody);
    }
});