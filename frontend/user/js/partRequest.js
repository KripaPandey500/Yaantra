const PART_REQUEST_API_BASE = 'http://localhost:5033/api/PartRequest';

const requestFieldIds = [
	'partNameError',
	'quantityError',
	'descriptionError'
];

function clearRequestFieldError(fieldId) {
	const fieldError = document.getElementById(fieldId);
	if (!fieldError) return;

	clearTimeout(fieldError._timeoutId);
	fieldError.textContent = '';
	fieldError.classList.add('hidden');
}

function clearAllRequestFieldErrors() {
	requestFieldIds.forEach(clearRequestFieldError);
}

function showRequestFieldError(fieldId, message) {
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

function buildPartRequestPayload(form) {
	return {
		partName: form.partName.value.trim(),
		quantity: parseInt(form.quantity.value, 10),
		description: form.description.value.trim()
	};
}

function validatePartRequestPayload(payload) {
	if (!payload.partName) {
		return { field: 'partName', message: 'Part name is required.' };
	}

	if (payload.partName.length > 200) {
		return { field: 'partName', message: 'Part name must not exceed 200 characters.' };
	}

	if (!payload.quantity || Number.isNaN(payload.quantity)) {
		return { field: 'quantity', message: 'Quantity is required.' };
	}

	if (payload.quantity < 1 || payload.quantity > 1000) {
		return { field: 'quantity', message: 'Quantity must be between 1 and 1000.' };
	}

	if (!payload.description) {
		return { field: 'description', message: 'Description is required.' };
	}

	if (payload.description.length > 1000) {
		return { field: 'description', message: 'Description must not exceed 1000 characters.' };
	}

	return { field: '', message: '' };
}

function handleRequestValidationErrors(result) {
	if (!result) return false;

	if (result.field && result.error) {
		showRequestFieldError(mapFieldToErrorId(result.field), result.error);
		return true;
	}

	if (result.errors && typeof result.errors === 'object') {
		const firstKey = Object.keys(result.errors)[0];
		if (!firstKey) return false;

		const message = Array.isArray(result.errors[firstKey]) ? result.errors[firstKey][0] : 'Invalid value.';
		const normalizedField = firstKey.charAt(0).toLowerCase() + firstKey.slice(1);
		showRequestFieldError(mapFieldToErrorId(normalizedField), message);
		return true;
	}

	return false;
}

function getStatusBadgeClass(status) {
	const normalized = (status || '').toLowerCase();
	if (normalized === 'confirmed') return 'bg-green-100 text-green-700 border border-green-300 font-semibold';
	if (normalized === 'completed') return 'bg-blue-100 text-blue-700 border border-blue-300 font-semibold';
	if (normalized === 'cancelled') return 'bg-red-100 text-red-700 border border-red-300 font-semibold';
	if (normalized === 'pending') return 'bg-orange-100 text-orange-700 border border-orange-300 font-semibold';
	return 'bg-gray-100 text-gray-700 border border-gray-300 font-semibold';
}

function renderRequestList(requests) {
	const list = document.getElementById('requestsList');
	if (!list) return;

	if (!Array.isArray(requests) || requests.length === 0) {
		list.innerHTML = '<p class="text-sm text-gray-600">No requests submitted yet.</p>';
		return;
	}

	list.innerHTML = requests.map(request => {
		const partName = request.partName ?? request.PartName ?? '-';
		const quantity = request.quantity ?? request.Quantity ?? '-';
		const description = request.description ?? request.Description ?? '-';
		const status = request.status ?? request.Status ?? 'Pending';
		const statusClass = getStatusBadgeClass(status);

		return `
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
				<div class="flex items-center justify-between gap-3 mb-2">
					<h4 class="text-lg font-semibold text-[var(--color-primary)]">${partName}</h4>
					<span class="text-xs font-semibold px-2 py-1 rounded-full ${statusClass}">${status}</span>
				</div>
				<p class="text-sm text-gray-700 mb-1"><span class="font-semibold">Quantity:</span> <span class="font-normal">${quantity}</span></p>
				<p class="text-sm text-gray-700"><span class="font-semibold">Description:</span> <span class="font-normal">${description}</span></p>
			</div>
		`;
	}).join('');
}

async function loadMyRequests(token) {
	try {
		const response = await fetch(`${PART_REQUEST_API_BASE}/my`, {
			headers: {
				'Authorization': `Bearer ${token}`
			}
		});

		if (!response.ok) {
			renderRequestList([]);
			return;
		}

		const requests = await response.json();
		renderRequestList(requests);
	} catch (error) {
		console.error('Failed to load requests:', error);
		renderRequestList([]);
	}
}

document.addEventListener('DOMContentLoaded', function () {
	const form = document.getElementById('part-request-form');
	if (!form) return;

	['partName', 'quantity', 'description'].forEach(field => {
		const input = form[field];
		input?.addEventListener('input', () => clearRequestFieldError(mapFieldToErrorId(field)));
		input?.addEventListener('change', () => clearRequestFieldError(mapFieldToErrorId(field)));
	});

	form.addEventListener('reset', function () {
		clearAllRequestFieldErrors();
	});

	form.addEventListener('submit', async function (e) {
		e.preventDefault();
		clearAllRequestFieldErrors();

		const token = localStorage.getItem('token');
		if (!token) {
			showAlert('alertBox', 'Please login to submit a request.', 'error');
			return;
		}

		const payload = buildPartRequestPayload(form);
		const validationError = validatePartRequestPayload(payload);
		if (validationError.field) {
			showRequestFieldError(mapFieldToErrorId(validationError.field), validationError.message);
			return;
		}

		try {
			const response = await fetch(PART_REQUEST_API_BASE, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify(payload)
			});

			const result = await response.json().catch(() => ({}));

			if (!response.ok) {
				if (handleRequestValidationErrors(result)) {
					return;
				}
				showAlert('alertBox', result.error || result.message || 'Failed to submit request.', 'error');
				return;
			}

			// Show success message inside form
			const successBox = document.getElementById('formSuccessBox');
			if (successBox) {
				successBox.classList.remove('hidden');
				// Auto-hide and reset after 3 seconds
				setTimeout(() => {
					successBox.classList.add('hidden');
					form.reset();
					clearAllRequestFieldErrors();
					if (typeof lucide !== 'undefined') lucide.createIcons();
				}, 3000);
			} else {
				// Fallback if element not found
				form.reset();
			}
			
			await loadMyRequests(token);
		} catch (error) {
			console.error('Request submit failed:', error);
			showAlert('alertBox', 'An error occurred. Please try again.', 'error');
		}
	});

	const token = localStorage.getItem('token');
	if (!token) {
		showAlert('alertBox', 'Please login to view and submit your requests.', 'error');
		renderRequestList([]);
		return;
	}

	loadMyRequests(token);
});
