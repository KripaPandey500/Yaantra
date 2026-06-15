const VEHICLE_API_BASE = 'http://localhost:5033/api/Vehicles';
let hasExistingVehicles = false;

const vehicleFieldIds = [
    'typeError',
    'vehicleNumberError',
    'brandError',
    'modelError',
    'manufactureYearError',
    'colorError',
    'registrationDateError',
    'engineNumberError',
    'chassisNumberError'
];

function clearVehicleFieldError(fieldId) {
    const fieldError = document.getElementById(fieldId);
    if (!fieldError) return;

    clearTimeout(fieldError._timeoutId);
    fieldError.textContent = '';
    fieldError.classList.add('hidden');
}

function clearAllVehicleFieldErrors() {
    vehicleFieldIds.forEach(clearVehicleFieldError);
}

function showVehicleFieldError(fieldId, message) {
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

function buildVehiclePayload(form) {
    const registrationDateValue = form.registrationDate.value;
    return {
        type: form.type.value.trim(),
        vehicleNumber: form.vehicleNumber.value.trim(),
        brand: form.brand.value.trim(),
        model: form.model.value.trim(),
        manufactureYear: parseInt(form.manufactureYear.value, 10),
        color: form.color.value.trim(),
        registrationDate: registrationDateValue ? registrationDateValue : null,
        engineNumber: form.engineNumber.value.trim(),
        chassisNumber: form.chassisNumber.value.trim()
    };
}

function validateVehiclePayload(payload) {
    if (!payload.type) return { field: 'type', message: 'Vehicle type is required.' };
    if (!payload.vehicleNumber) return { field: 'vehicleNumber', message: 'Vehicle number is required.' };
    if (!payload.brand) return { field: 'brand', message: 'Brand is required.' };
    if (!payload.model) return { field: 'model', message: 'Model is required.' };
    if (!payload.color) return { field: 'color', message: 'Color is required.' };
    if (!payload.engineNumber) return { field: 'engineNumber', message: 'Engine number is required.' };
    if (!payload.chassisNumber) return { field: 'chassisNumber', message: 'Chassis number is required.' };

    if (!payload.manufactureYear || Number.isNaN(payload.manufactureYear)) {
        return { field: 'manufactureYear', message: 'Please enter a valid manufacture year.' };
    }

    const currentYear = new Date().getFullYear() + 1;
    if (payload.manufactureYear < 1900 || payload.manufactureYear > currentYear) {
        return { field: 'manufactureYear', message: 'Manufacture year is out of valid range.' };
    }

    if (payload.registrationDate) {
        const registrationDate = new Date(payload.registrationDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (registrationDate > today) {
            return { field: 'registrationDate', message: 'Registration date cannot be in the future.' };
        }
    }

    return { field: '', message: '' };
}

function handleValidationErrors(result) {
    if (!result) return false;

    if (result.field && result.error) {
        showVehicleFieldError(mapFieldToErrorId(result.field), result.error);
        return true;
    }

    if (result.errors && typeof result.errors === 'object') {
        const firstKey = Object.keys(result.errors)[0];
        if (!firstKey) return false;

        const message = Array.isArray(result.errors[firstKey]) ? result.errors[firstKey][0] : 'Invalid value.';
        const normalizedField = firstKey.charAt(0).toLowerCase() + firstKey.slice(1);
        showVehicleFieldError(mapFieldToErrorId(normalizedField), message);
        return true;
    }

    return false;
}

function normalizeVehicle(vehicle) {
    return {
        id: vehicle.id ?? vehicle.Id,
        type: vehicle.type ?? vehicle.Type ?? '-',
        vehicleNumber: vehicle.vehicleNumber ?? vehicle.VehicleNumber ?? '-',
        brand: vehicle.brand ?? vehicle.Brand ?? '-',
        model: vehicle.model ?? vehicle.Model ?? '-',
        manufactureYear: vehicle.manufactureYear ?? vehicle.ManufactureYear ?? '-',
        color: vehicle.color ?? vehicle.Color ?? '-',
        registrationDate: vehicle.registrationDate ?? vehicle.RegistrationDate ?? null,
        engineNumber: vehicle.engineNumber ?? vehicle.EngineNumber ?? '-',
        chassisNumber: vehicle.chassisNumber ?? vehicle.ChassisNumber ?? '-'
    };
}

function renderVehiclesList(vehicles) {
    const list = document.getElementById('vehiclesList');
    if (!list) return;

    list.innerHTML = vehicles.map((v, index) => {
        const vehicle = normalizeVehicle(v);
        const regDate = vehicle.registrationDate
            ? new Date(vehicle.registrationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
            : 'N/A';

        return `
            <div class="bg-white rounded-2xl shadow-md border border-gray-100 p-7 hover:shadow-lg transition">
                <div class="flex items-start justify-between mb-5">
                    <div>
                        <span class="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wide inline-block">${vehicle.type}</span>
                        <h3 class="text-lg font-black text-[#062621] mt-3">${vehicle.brand} ${vehicle.model}</h3>
                        <p class="text-sm text-gray-400 font-bold tracking-wider uppercase mt-1">${vehicle.vehicleNumber}</p>
                    </div>
                    <button type="button" onclick="openDeleteVehicleModal(${vehicle.id})" class="text-gray-400 hover:text-red-600 transition">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="grid grid-cols-4 gap-3">
                    <div class="bg-gray-50 rounded-xl p-3">
                        <p class="text-gray-400 font-bold uppercase tracking-wide mb-2 text-[9px]">Year</p>
                        <p class="font-semibold text-[#062621] text-sm">${vehicle.manufactureYear}</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-3">
                        <p class="text-gray-400 font-bold uppercase tracking-wide mb-2 text-[9px]">Color</p>
                        <p class="font-semibold text-[#062621] text-sm">${vehicle.color}</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-3">
                        <p class="text-gray-400 font-bold uppercase tracking-wide mb-2 text-[9px]">Reg. Date</p>
                        <p class="font-semibold text-[#062621] text-sm">${regDate}</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-3">
                        <p class="text-gray-400 font-bold uppercase tracking-wide mb-2 text-[9px]">Engine</p>
                        <p class="font-mono font-semibold text-[#062621] text-sm">${vehicle.engineNumber}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

let vehicleToDelete = null;

// Open delete vehicle modal
function openDeleteVehicleModal(vehicleId) {
    vehicleToDelete = vehicleId;
    document.getElementById('deleteVehicleModal').classList.remove('hidden');
}

// Close delete vehicle modal
function closeDeleteVehicleModal() {
    vehicleToDelete = null;
    document.getElementById('deleteVehicleModal').classList.add('hidden');
}

// Delete vehicle function (called from modal confirmation)
async function confirmDeleteVehicle() {
    if (!vehicleToDelete) return;
    
    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('vehicleAlert', 'Please login to delete your vehicle.', 'error');
        closeDeleteVehicleModal();
        return;
    }

    try {
        console.log('Delete URL:', `${VEHICLE_API_BASE}/${vehicleToDelete}`);
        
        const response = await fetch(`${VEHICLE_API_BASE}/${vehicleToDelete}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Delete response status:', response.status);
        
        // Handle 204 No Content response (successful deletion)
        if (response.status === 204) {
            closeDeleteVehicleModal();
            showAlert('vehicleAlert', 'Vehicle deleted successfully.', 'success');
            await loadMyVehicles(token);
            return;
        }
        
        // If response is ok but not 204, treat as success
        if (response.ok) {
            const result = await response.json().catch(() => ({}));
            closeDeleteVehicleModal();
            showAlert('vehicleAlert', result.message || 'Vehicle deleted successfully.', 'success');
            await loadMyVehicles(token);
            return;
        }
        
        // Handle error responses
        let errorMessage = 'Failed to delete vehicle.';
        
        try {
            const result = await response.json();
            console.log('Delete error response:', result);
            
            if (result.error) {
                errorMessage = result.error;
            } else if (result.message) {
                errorMessage = result.message;
            }
        } catch (e) {
            console.log('Could not parse error response');
        }
        
        // Provide user-friendly error messages based on status
        if (response.status === 400) {
            errorMessage = 'Cannot delete this vehicle. It may have active bookings or other associated records.';
        } else if (response.status === 409) {
            errorMessage = 'Cannot delete this vehicle because it has active bookings. Please cancel or complete all bookings first.';
        } else if (response.status === 404) {
            errorMessage = 'Vehicle not found.';
        } else if (response.status === 401) {
            errorMessage = 'You are not authorized to delete this vehicle.';
        }
        
        closeDeleteVehicleModal();
        showAlert('vehicleAlert', errorMessage, 'error');
    } catch (error) {
        console.error('Delete vehicle error:', error);
        closeDeleteVehicleModal();
        showAlert('vehicleAlert', error.message || 'An error occurred. Please try again.', 'error');
    }
}

// Wrapper function for inline onclick (updated to use modal)
function deleteVehicle(vehicleId) {
    openDeleteVehicleModal(vehicleId);
}

function setViewMode(mode) {
    console.log('setViewMode called with:', mode);
    
    const listSection = document.getElementById('vehiclesListSection');
    const formSection = document.getElementById('addVehicleFormSection');

    console.log('listSection:', listSection ? 'found' : 'NOT FOUND');
    console.log('formSection:', formSection ? 'found' : 'NOT FOUND');

    if (!listSection || !formSection) {
        console.error('Cannot set view mode - sections not found');
        return;
    }

    if (mode === 'list') {
        listSection.classList.remove('hidden');
        formSection.classList.add('hidden');
        console.log('Switched to LIST view');
    } else {
        listSection.classList.add('hidden');
        formSection.classList.remove('hidden');
        console.log('Switched to FORM view');
    }
}



async function loadMyVehicles(token) {
    try {
        const response = await fetch(`${VEHICLE_API_BASE}/my`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            setViewMode('form');
            return [];
        }

        const vehicles = await response.json();
        if (Array.isArray(vehicles) && vehicles.length > 0) {
            hasExistingVehicles = true;
            renderVehiclesList(vehicles);
            setViewMode('list');
            return vehicles;
        }

        hasExistingVehicles = false;
        setViewMode('form');
        return [];
    } catch (error) {
        console.error('Failed to load vehicles:', error);
        hasExistingVehicles = false;
        setViewMode('form');
        return [];
    }
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('Add Vehicle page DOMContentLoaded');
    
    const form = document.getElementById('addVehicleForm');
    if (!form) {
        console.error('addVehicleForm not found');
        return;
    }

    const addVehicleHeaderBtn = document.getElementById('addVehicleHeaderBtn');
    const cancelAddVehicleBtn = document.getElementById('cancelAddVehicleBtn');
    
    console.log('Header btn:', addVehicleHeaderBtn ? 'found' : 'NOT FOUND');
    console.log('Cancel btn:', cancelAddVehicleBtn ? 'found' : 'NOT FOUND');
    
    addVehicleHeaderBtn?.addEventListener('click', function () {
        console.log('Add Vehicle header button clicked');
        setViewMode('form');
    });

    cancelAddVehicleBtn?.addEventListener('click', function () {
        window.location.href = '/frontend/user/pages/profile/user-profile.html';
    });

    ['type', 'vehicleNumber', 'brand', 'model', 'manufactureYear', 'color', 'registrationDate', 'engineNumber', 'chassisNumber'].forEach(field => {
        const input = form[field];
        input?.addEventListener('input', () => clearVehicleFieldError(mapFieldToErrorId(field)));
        input?.addEventListener('change', () => clearVehicleFieldError(mapFieldToErrorId(field)));
    });

    form.addEventListener('reset', function () {
        clearAllVehicleFieldErrors();
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        clearAllVehicleFieldErrors();

        const token = localStorage.getItem('token');
        if (!token) {
            showAlert('vehicleAlert', 'Please login to add your vehicle.', 'error');
            return;
        }

        const payload = buildVehiclePayload(form);
        const validationError = validateVehiclePayload(payload);
        if (validationError.field) {
            showVehicleFieldError(mapFieldToErrorId(validationError.field), validationError.message);
            showAlert('vehicleAlert', 'Please fill all fields.', 'error');
            return;
        }

        try {
            const response = await fetch(VEHICLE_API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (handleValidationErrors(result)) {
                    showAlert('vehicleAlert', 'Please fix the highlighted errors.', 'error');
                    return;
                }
                showAlert('vehicleAlert', result.error || result.message || 'Failed to add vehicle.', 'error');
                console.error('Vehicle add error:', result); // Debug: log backend error response
                return;
            }

            showAlert('vehicleAlert', result.message || 'Vehicle added successfully!', 'success');
            form.reset();
            await loadMyVehicles(token);
        } catch (error) {
            console.error('Add vehicle failed:', error);
            showAlert('vehicleAlert', 'An error occurred. Please try again.', 'error');
        }
    });

    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('vehicleAlert', 'Please login to manage your vehicles.', 'error');
        setViewMode('form');
        return;
    }

    console.log('Initializing: loadMyVehicles...');
    loadMyVehicles(token);
    console.log('Add Vehicle page initialization complete');
});
