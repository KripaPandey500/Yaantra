'use strict';


const API_URL = `${BASE_URL}/api/auth`;

//  INITIALIZATION

document.addEventListener("DOMContentLoaded", async () => {
    // Validate token and fetch user ID
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/frontend/auth/login.html?msg=loginfirst';
        return;
    }

    let userId = localStorage.getItem('userId');
    if (!userId) {
        // Fetch profile to get integer userId
        try {
            const res = await fetch(`${BASE_URL}/api/auth/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
            const profile = await res.json();
            userId = profile.id || profile.userId;
            if (!userId) throw new Error('No userId in profile');
            localStorage.setItem('userId', userId);
        } catch (err) {
            console.error('Profile fetch error:', err);
            alert('Failed to get your profile. Please login again.');
            localStorage.removeItem('token');
            window.location.href = '/frontend/auth/login.html?msg=loginfirst';
            return;
        }
    }

    loadCustomers();
});


//  LOAD & RENDER TABLE

async function loadCustomers() {
    const tbody = document.getElementById('customerTableBody');
    const token = localStorage.getItem('token');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" class="py-20 text-center text-gray-400 italic text-sm">Loading customers...</td></tr>`;

    try {
        const res = await fetch(`${API_URL}/customers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        // Handle plain array OR paginated { total, customers }
        const customers = Array.isArray(data) ? data : (data.customers || []);

        if (customers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-20 text-center text-gray-400 italic text-sm">No customers found.</td></tr>`;
            return;
        }

        renderTable(customers);

    } catch (e) {
        console.error("loadCustomers error:", e);
        tbody.innerHTML = `<tr><td colspan='8' class='text-center py-10 text-red-500'>Error loading data: ${e.message}</td></tr>`;
    }
}

function renderTable(customers) {
    const tbody = document.getElementById("customerTableBody");

    if (!customers || customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-20 text-center text-gray-400">No customers found.</td></tr>`;
        return;
    }

    tbody.innerHTML = customers.map((c, i) => {
        const id = c.id || c.Id;
        const pic = c.profilePicture || c.ProfilePicture;
        const picUrl = pic
            ? `${BASE_URL}${pic}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent((c.firstName||'') + '+' + (c.lastName||''))}&background=062621&color=fff`;
        const vehicleCount = c.vehicles?.length || c.Vehicles?.length || 0;

        return `
        <tr class="border-t border-gray-50 hover:bg-gray-50/50 transition-all group">
            <td class="px-8 py-6 text-gray-400 font-semibold text-xs">${String(i + 1).padStart(2, '0')}</td>
            <td class="px-8 py-6">
                <div class="flex items-center gap-3">
                    <img src="${picUrl}" class="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm"
                         onerror="this.src='https://ui-avatars.com/api/?name=User&background=062621&color=fff'">
                    <p class="font-bold text-primary text-sm">${c.firstName} ${c.lastName || ''}</p>
                </div>
            </td>
            <td class="px-8 py-6 text-gray-500 text-xs">${c.email}</td>
            <td class="px-8 py-6 text-gray-500 text-xs">${c.phone || '---'}</td>
            <td class="px-8 py-6 text-[10px] font-bold uppercase text-gray-400">${c.gender || '---'}</td>
            <td class="px-8 py-6 text-center">
                <span class="bg-primary/5 text-primary text-[10px] font-bold px-3 py-1 rounded-full border border-primary/10">
                    ${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''}
                </span>
            </td>
            <td class="px-8 py-6 text-emerald-600 font-bold text-xs text-center">
    Rs. ${(c.totalSpent || c.TotalSpent || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
</td>
            <td class="px-8 py-6 text-right">
                <div class="flex items-center justify-end gap-1">
                    <button onclick="openViewModal(${id})"   class="p-2 rounded-full text-gray-400 hover:text-primary hover:bg-gray-100 transition-all" title="View"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    <button onclick="openEditModal(${id})"   class="p-2 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Edit"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="openDeleteModal(${id})" class="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
}


//  CREATE MODAL

function openCreateModal() {
    ['c_firstName','c_lastName','c_email','c_phone','c_password','c_dob','c_address'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('c_gender').value = '';
    document.getElementById('c_fileName').innerText = 'Choose Image';
    document.getElementById('c_profilePicture').value = '';
    document.getElementById('vehicleRows').innerHTML = '';
    document.getElementById('createModal').classList.add('active');
}
function closeCreateModal() { document.getElementById('createModal').classList.remove('active'); }


//  ADD VEHICLE ROW (Create modal)

window.addVehicleRow = function () {
    createVehicleRow('vehicleRows');
};


//  SHARED VEHICLE ROW BUILDER

window.createVehicleRow = function (containerId, vehicle = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'v-row p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-3';
    
    // Handle both PascalCase (from API) and camelCase property names
    const vehicleId = vehicle?.id || vehicle?.Id;
    const brand = vehicle?.brand || vehicle?.Brand || '';
    const model = vehicle?.model || vehicle?.Model || '';
    const vehicleNumber = vehicle?.vehicleNumber || vehicle?.VehicleNumber || '';
    const manufactureYear = vehicle?.manufactureYear || vehicle?.ManufactureYear || 2024;
    const color = vehicle?.color || vehicle?.Color || '';
    const type = vehicle?.type || vehicle?.Type || 'Car';
    const engineNumber = vehicle?.engineNumber || vehicle?.EngineNumber || '';
    const chassisNumber = vehicle?.chassisNumber || vehicle?.ChassisNumber || '';
    
    if (vehicleId) div.dataset.vehicleId = vehicleId;

    div.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <span class="text-[9px] font-black text-primary/40 uppercase tracking-widest">Vehicle Details</span>
            <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-red-400 hover:text-red-600">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
            <input type="text"   placeholder="Type *"         class="v_type   boxed-input text-xs" value="${type}">
            <input type="text"   placeholder="Brand *"        class="v_brand  boxed-input text-xs" value="${brand}">
            <input type="text"   placeholder="Model *"        class="v_model  boxed-input text-xs" value="${model}">
            <input type="text"   placeholder="Plate Number *" class="v_number boxed-input text-xs" value="${vehicleNumber}">
            <input type="number" placeholder="Year"           class="v_year   boxed-input text-xs" value="${manufactureYear}">
            <input type="text"   placeholder="Color"          class="v_color  boxed-input text-xs" value="${color}">
            <input type="text"   placeholder="Engine Number"  class="v_engine boxed-input text-xs" value="${engineNumber}">
            <input type="text"   placeholder="Chassis Number" class="v_chassis boxed-input text-xs" value="${chassisNumber}">
        </div>`;

    container.appendChild(div);
    if (window.lucide) lucide.createIcons();
};


//  SUBMIT CREATE CUSTOMER

async function submitCreateCustomer() {
    const btn = document.getElementById('btnRegisterCustomer');

    const fName = document.getElementById('c_firstName').value.trim();
    const lName = document.getElementById('c_lastName').value.trim();
    const email = document.getElementById('c_email').value.trim();
    const pass  = document.getElementById('c_password').value;

    if (!fName || !email || !pass) {
        alert('Please fill in First Name, Email, and Password.');
        return;
    }

    const fd = new FormData();
    fd.append('FirstName', fName);
    fd.append('LastName',  lName);
    fd.append('Email',     email);
    fd.append('Password',  pass);
    fd.append('Phone',   document.getElementById('c_phone').value);
    fd.append('Address', document.getElementById('c_address').value);
    fd.append('Gender',  document.getElementById('c_gender').value);

    const dob = document.getElementById('c_dob').value;
    if (dob) fd.append('DateOfBirth', dob);

    const pic = document.getElementById('c_profilePicture').files[0];
    if (pic) fd.append('ProfilePicture', pic);

    const originalText = btn.innerText;
    btn.innerText = 'Processing...';
    btn.disabled = true;

    try {
        // STEP 1: Register customer
        const userRes = await fetch(`${API_URL}/register-customer`, { method: 'POST', body: fd });
        const userResult = await userRes.json();

        if (!userRes.ok) {
            let errorMsg = userResult.message || 'Registration failed.';
            if (userResult.error) errorMsg += `\nDetail: ${userResult.error}`;
            if (Array.isArray(userResult)) errorMsg = userResult.map(e => e.description).join('\n');
            alert('Error:\n' + errorMsg);
            return;
        }

        const newUserId = userResult.userId;
        const token = localStorage.getItem('token');

        // STEP 2: Register vehicles
        const vehicleRows = document.querySelectorAll('#vehicleRows .v-row');
        let vehicleFailed = false;

        for (const row of vehicleRows) {
            const plate = row.querySelector('.v_number').value.trim();
            if (!plate) continue;

            const vehiclePayload = {
                Type:            row.querySelector('.v_type').value  || 'Car',
                VehicleNumber:   plate,
                Brand:           row.querySelector('.v_brand').value || 'N/A',
                Model:           row.querySelector('.v_model').value || 'N/A',
                ManufactureYear: parseInt(row.querySelector('.v_year').value) || 2024,
                Color:           row.querySelector('.v_color').value || '',
                EngineNumber:    row.querySelector('.v_engine').value || 'N/A',
                ChassisNumber:   row.querySelector('.v_chassis').value || 'N/A'
            };

            const vRes = await fetch(`${BASE_URL}/api/Vehicles/admin/${newUserId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(vehiclePayload)
            });

            if (!vRes.ok) {
                console.error('Vehicle POST failed:', vRes.status, await vRes.text());
                vehicleFailed = true;
            }
        }

        if (vehicleFailed) {
            alert('✓ Customer registered, but one or more vehicles failed to save. Check console.');
        } else {
            alert('✓ Customer and vehicles registered successfully!');
        }

        closeCreateModal();
        await loadCustomers();

    } catch (e) {
        console.error('Registration error:', e);
        alert('Server connection failed. Check if API is running.');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}


//  VIEW MODAL

async function openViewModal(id) {
    const token = localStorage.getItem('token');
    const container = document.getElementById('viewModalBody');
    container.innerHTML = `<div class="text-center py-10 italic text-gray-400">Loading profile...</div>`;
    document.getElementById('viewModal').classList.add('active');

    try {
        const res = await fetch(`${BASE_URL}/api/auth/profile/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const c = await res.json();
        const vehicles = c.vehicles || c.Vehicles || [];
        const picUrl = c.profilePicture
            ? `${BASE_URL}${c.profilePicture}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.firstName)}&background=062621&color=fff`;

        container.innerHTML = `
            <div class="flex items-center gap-5 mb-8 bg-gray-50 p-6 rounded-[2rem]">
                <img src="${picUrl}" class="w-20 h-20 rounded-full border-4 border-white shadow-md object-cover"
                     onerror="this.src='https://ui-avatars.com/api/?name=User&background=062621&color=fff'">
                <div>
                    <h4 class="text-xl font-black text-primary">${c.firstName} ${c.lastName || ''}</h4>
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">CUSTOMER</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-6 text-sm px-4">
                <div><label class="label-style">Email</label><p class="font-bold">${c.email}</p></div>
                <div><label class="label-style">Phone</label><p class="font-bold">${c.phone || 'N/A'}</p></div>
                <div><label class="label-style">Gender</label><p class="font-bold">${c.gender || 'N/A'}</p></div>
                <div><label class="label-style">Date of Birth</label><p class="font-bold">${c.dateOfBirth ? c.dateOfBirth.split('T')[0] : 'N/A'}</p></div>
                <div class="col-span-2"><label class="label-style">Address</label><p class="font-bold">${c.address || 'N/A'}</p></div>
            </div>
            <div class="mt-8 px-4">
                <label class="label-style mb-3">Vehicles (${vehicles.length})</label>
                <div class="space-y-2">
                    ${vehicles.length === 0
                        ? `<p class="text-xs text-gray-400 italic">No vehicles registered.</p>`
                        : vehicles.map(v => `
                            <div class="p-3 border border-gray-100 rounded-xl flex justify-between bg-gray-50/50">
                                <span class="text-xs font-bold text-primary">${v.vehicleNumber}</span>
                                <span class="text-[10px] text-gray-400 font-black uppercase">${v.brand} ${v.model} · ${v.color}</span>
                            </div>`).join('')
                    }
                </div>
            </div>`;
    } catch (e) {
        container.innerHTML = `<p class="text-center py-10 text-red-500">Failed to load profile.</p>`;
    }
}
function closeViewModal() { document.getElementById('viewModal').classList.remove('active'); }


//  EDIT MODAL

async function openEditModal(id) {
    const token = localStorage.getItem('token');
    try {
        // Fetch customer data
        const res = await fetch(`${BASE_URL}/api/auth/profile/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const c = await res.json();

        document.getElementById('e_id').value        = id;
        document.getElementById('e_firstName').value = c.firstName  || '';
        document.getElementById('e_lastName').value  = c.lastName   || '';
        document.getElementById('e_email').value     = c.email      || '';
        document.getElementById('e_phone').value     = c.phone      || '';
        document.getElementById('e_address').value   = c.address    || '';
        document.getElementById('e_gender').value    = c.gender     || '';
        document.getElementById('e_dob').value       = c.dateOfBirth ? c.dateOfBirth.split('T')[0] : '';

        // Load existing vehicles
        const vehicleContainer = document.getElementById('editVehicleRows');
        vehicleContainer.innerHTML = '';
        
        // Fetch vehicles for this user
        try {
            const vehiclesRes = await fetch(`${BASE_URL}/api/Vehicles/user/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (vehiclesRes.ok) {
                const vehicles = await vehiclesRes.json();
                if (Array.isArray(vehicles)) {
                    vehicles.forEach(v => createVehicleRow('editVehicleRows', v));
                }
            }
        } catch (e) {
            console.warn('Failed to load vehicles:', e);
        }

        document.getElementById('editModal').classList.add('active');
    } catch (e) {
        console.error('openEditModal error:', e);
        alert('Error loading customer data.');
    }
}

function closeEditModal() { document.getElementById('editModal').classList.remove('active'); }

async function submitEditCustomer() {
    const id    = document.getElementById('e_id').value;
    const token = localStorage.getItem('token');

    // Create FormData for multipart/form-data (required by backend)
    const formData = new FormData();
    formData.append('FirstName',   document.getElementById('e_firstName').value.trim());
    formData.append('LastName',    document.getElementById('e_lastName').value.trim());
    formData.append('Email',       document.getElementById('e_email').value.trim());
    formData.append('Phone',       document.getElementById('e_phone').value.trim());
    formData.append('Address',     document.getElementById('e_address').value.trim());
    formData.append('Gender',      document.getElementById('e_gender').value);
    formData.append('DateOfBirth', document.getElementById('e_dob').value || '');
    formData.append('Role',        'CUSTOMER');

    try {
        const res = await fetch(`${BASE_URL}/api/users/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert('Update failed: ' + (err.message || res.status));
            return;
        }

        // Handle vehicles
        const vehicleRows = document.querySelectorAll('#editVehicleRows .v-row');
        for (const row of vehicleRows) {
            const vehicleId = row.dataset.vehicleId;
            const plate = row.querySelector('.v_number').value.trim();
            if (!plate) continue;

            const vehiclePayload = {
                Type:            row.querySelector('.v_type').value  || 'Car',
                VehicleNumber:   plate,
                Brand:           row.querySelector('.v_brand').value || 'N/A',
                Model:           row.querySelector('.v_model').value || 'N/A',
                ManufactureYear: parseInt(row.querySelector('.v_year').value) || 2024,
                Color:           row.querySelector('.v_color').value || '',
                EngineNumber:    row.querySelector('.v_engine').value || 'N/A',
                ChassisNumber:   row.querySelector('.v_chassis').value || 'N/A'
            };

            if (vehicleId) {
                // Update existing
                await fetch(`${BASE_URL}/api/Vehicles/${vehicleId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(vehiclePayload)
                });
            } else {
                // Add new
                await fetch(`${BASE_URL}/api/Vehicles/admin/${id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(vehiclePayload)
                });
            }
        }

        alert('✓ Customer updated successfully!');
        closeEditModal();
        await loadCustomers();

    } catch (e) {
        console.error('submitEditCustomer error:', e);
        alert('Server error. Check console.');
    }
}

//  DELETE MODAL

function openDeleteModal(id) {
    document.getElementById('deleteCustomerId').value = id;
    document.getElementById('deleteModal').classList.add('active');
}
function closeDeleteModal() { document.getElementById('deleteModal').classList.remove('active'); }

async function confirmDelete() {
    const id    = document.getElementById('deleteCustomerId').value;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/delete/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            closeDeleteModal();
            await loadCustomers();
        } else {
            alert('Delete failed.');
        }
    } catch (e) { alert('Server Error.'); }
}


//  SEARCH

async function searchCustomers() {
    const query      = document.getElementById('searchInput').value.trim();
    const searchType = document.getElementById('searchType').value;
    const token      = localStorage.getItem('token');

    if (!query) { loadCustomers(); return; }

    try {
        const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}&type=${searchType}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const results = await res.json();
        renderTable(Array.isArray(results) ? results : (results.customers || []));
    } catch (e) {
        document.getElementById('customerTableBody').innerHTML =
            "<tr><td colspan='8' class='text-center py-10 text-red-500'>Error searching data.</td></tr>";
    }
}