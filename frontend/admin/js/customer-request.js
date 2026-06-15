const apiBase = 'http://localhost:5033/api/PartRequest';
let deleteId = null;
let allRequests = [];

document.addEventListener('DOMContentLoaded', () => {
    loadAllRequests();
    setupSearchHandler();
    setupEditFormHandler();
});

function setupEditFormHandler() {
    document.getElementById('editForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        showAlert("Edit feature coming soon", "info");
        closeModal('editModal');
    });
}

function setupSearchHandler() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            filterRequests(query);
        });
    }
}

function filterRequests(query) {
    const tableBody = document.getElementById('requestsTable');
    if (!query) {
        renderRequests(allRequests);
        return;
    }
    const filtered = allRequests.filter(req =>
        req.userName?.toLowerCase().includes(query) ||
        req.partName?.toLowerCase().includes(query) ||
        req.userEmail?.toLowerCase().includes(query)
    );
    renderRequests(filtered);
}

/** 1. DATA LOADING **/
async function loadAllRequests() {
    const tableBody = document.getElementById('requestsTable');
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`${apiBase}/all`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!res.ok) {
            console.error(`Failed to load requests: ${res.status}`);
            tableBody.innerHTML = '<tr><td colspan="6" class="p-20 text-center text-red-400 italic">Failed to load inquiries. Status: ' + res.status + '</td></tr>';
            return;
        }
        
        allRequests = await res.json();
        renderRequests(allRequests);
    } catch (e) { 
        console.error(e); 
    }
}

function renderRequests(requests) {
    const tableBody = document.getElementById('requestsTable');
    tableBody.innerHTML = "";

    if (!requests || requests.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="p-20 text-center text-gray-400 italic">No inquiries found.</td></tr>';
        return;
    }

    requests.forEach((req, idx) => {
        const reqObj = JSON.stringify(req).replace(/"/g, '&quot;');
        const initials = req.userName ? req.userName.charAt(0).toUpperCase() : 'CU';
        
        // Only show dropdown if status is Pending
        let statusCell = '';
        if (req.status === 'Pending') {
            statusCell = `
                <select onchange="updateStatus(${req.id}, this.value)" class="status-select border ${getStatusColor(req.status)}">
                    <option value="Pending" ${req.status === 'Pending' ? 'selected' : ''}>PENDING</option>
                    <option value="Approved" ${req.status === 'Approved' ? 'selected' : ''}>APPROVE</option>
                    <option value="Rejected" ${req.status === 'Rejected' ? 'selected' : ''}>REJECT</option>
                </select>
            `;
        } else {
            // Show as read-only text if not Pending
            const statusClass = getStatusColorClass(req.status);
            statusCell = `<span class="${statusClass} px-4 py-2 rounded-lg text-xs font-bold uppercase">${req.status}</span>`;
        }

        tableBody.innerHTML += `
            <tr class="hover:bg-emerald-50/30 transition-colors border-b border-gray-50">
                <td class="px-8 py-5 font-bold text-gray-300 text-xs">${idx + 1}</td>
                <td class="px-8 py-5">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-emerald-50 text-[#062621] flex items-center justify-center text-[10px] font-bold border border-emerald-100">${initials}</div>
                        <div class="flex flex-col">
                            <span class="text-sm font-bold text-[#062621] leading-tight">${req.userName || 'Client'}</span>
                            <span class="text-[10px] text-gray-400 font-medium">${req.userEmail}</span>
                        </div>
                    </div>
                </td>
                <td class="px-8 py-5 text-[#062621] font-bold">${req.partName}</td>
                <td class="px-8 py-5 text-center font-bold text-gray-600">${req.quantity}</td>
                <td class="px-8 py-5">
                    ${statusCell}
                </td>
                <td class="px-8 py-5 text-right">
                    <div class="flex justify-end gap-1">
                        <button onclick='openViewModal(${reqObj})' class="p-2 text-gray-400 hover:text-emerald-500 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                        <button onclick='openEditModal(${reqObj})' class="p-2 text-gray-400 hover:text-blue-500 transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                        <button onclick='openDeleteModal(${req.id})' class="p-2 text-gray-400 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </td>
            </tr>`;
    });
    if (window.lucide) lucide.createIcons();
}

/** 2. STATUS MANAGEMENT **/
async function updateStatus(id, newStatus) {
    const token = localStorage.getItem('token');
    if (!token) {
        showAlert("Authentication token not found. Please log in.", "error");
        return;
    }

    try {
        console.log(`Updating request ${id} to status: ${newStatus}`);
        
        const res = await fetch(`${apiBase}/${id}/status`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ status: newStatus })
        });

        console.log(`Response status: ${res.status}`);
        
        if (!res.ok) {
            const errorData = await res.text();
            console.error(`Failed to update status: ${res.status} - ${errorData}`);
            showAlert(`Failed to update status (${res.status}). Please try again.`, "error");
            loadAllRequests();
            return;
        }

        const responseData = await res.json();
        console.log("Status update response:", responseData);
        
        showAlert(`Status successfully changed to ${newStatus}!`);
        await loadAllRequests();
    } catch (e) { 
        console.error("Error updating status:", e);
        showAlert(`Error: ${e.message}`, "error"); 
        loadAllRequests();
    }
}

/** 3. DELETE MANAGEMENT **/
async function deleteRequest(id) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${apiBase}/${id}`, { 
            method: 'DELETE', 
            headers: { "Authorization": `Bearer ${token}` } 
        });
        if (res.ok) { 
            closeModal('deleteConfirmModal'); 
            loadAllRequests(); 
            showAlert("Request deleted successfully.");
        } else {
            showAlert("Failed to delete request.", "error");
        }
    } catch (e) {
        console.error(e);
        showAlert("Error deleting request.", "error");
    }
}

/** 4. MODAL HANDLERS **/
function openViewModal(req) {
    document.getElementById('vName').innerText = req.userName || "Client";
    document.getElementById('vPartName').innerText = req.partName;
    document.getElementById('vQty').innerText = req.quantity;
    document.getElementById('vDesc').innerText = req.description || "None";
    document.getElementById('viewModal').classList.remove('hidden');
}

function openEditModal(req) {
    document.getElementById('editRequestId').value = req.id;
    document.getElementById('editPartName').value = req.partName;
    document.getElementById('editQty').value = req.quantity;
    document.getElementById('editModal').classList.remove('hidden');
}

function openDeleteModal(id) {
    deleteId = id;
    document.getElementById('deleteConfirmModal').classList.remove('hidden');
}

document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
    deleteRequest(deleteId);
});

/** 5. UTILITY FUNCTIONS **/
function getStatusColor(s) {
    if (s === 'Approved') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (s === 'Rejected') return 'bg-red-50 text-red-600 border-red-100';
    return 'bg-amber-50 text-amber-600 border-amber-100';
}

function getStatusColorClass(s) {
    if (s === 'Approved') return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    if (s === 'Rejected') return 'bg-red-50 text-red-600 border border-red-100';
    return 'bg-amber-50 text-amber-600 border border-amber-100';
}

function showAlert(message, type = "success") {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;
    alertBox.innerText = message;
    alertBox.className = `mb-6 block p-4 rounded-lg text-sm font-semibold ${
        type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
    }`;
    setTimeout(() => alertBox.classList.add('hidden'), 3000);
}

function closeModal(id) { 
    document.getElementById(id)?.classList.add('hidden'); 
}