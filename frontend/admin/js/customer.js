const API_BASE = "http://localhost:5033";
let currentPage = 1;
const pageSize = 5;
let totalPages = 1;
let deleteId = null;

/** 1. DATA LOADING & RENDERING **/
async function loadCustomers(page = 1) {
    const table = document.getElementById("customerTable");
    const token = localStorage.getItem("token");
    currentPage = page;

    try {
        const response = await fetch(`${API_BASE}/api/users/customers?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(document.getElementById('searchInput')?.value || '')}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();
        totalPages = data.totalPages || 1;
        table.innerHTML = '';

        if (!data.data || data.data.length === 0) {
            table.innerHTML = '<tr><td colspan="6" class="p-20 text-center text-gray-400 italic">No customer records found.</td></tr>';
            return;
        }

        data.data.forEach((customer, idx) => {
            const sn = (page - 1) * pageSize + idx + 1;
            const pic = customer.profilePicture ? `${API_BASE}/assets/uploads/users/${customer.profilePicture}` : `https://ui-avatars.com/api/?name=${customer.firstName}+${customer.lastName}&background=062621&color=fff`;
            const customerObj = JSON.stringify(customer).replace(/"/g, '&quot;');

            table.innerHTML += `
                <tr class="hover:bg-emerald-50/30 transition-colors border-b border-gray-50">
                    <td class="px-8 py-5 font-bold text-gray-300 text-xs">${sn}</td>
                    <td class="px-8 py-5"><img src="${pic}" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"></td>
                    <td class="px-8 py-5">
                        <div class="flex flex-col">
                            <span class="text-sm font-bold text-[#062621] leading-tight">${customer.firstName} ${customer.lastName}</span>
                            <span class="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1">Verified Client</span>
                        </div>
                    </td>
                    <td class="px-8 py-5 text-gray-500">${customer.email}</td>
                    <td class="px-8 py-5 text-gray-500">${customer.phone || '---'}</td>
                    <td class="px-8 py-5 text-right">
                        <div class="flex justify-end gap-1">
                            <button onclick='openViewCustomerModal(${customerObj})' class="p-2 text-gray-400 hover:text-emerald-500 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                            <button onclick='openEditCustomerModal(${customerObj})' class="p-2 text-gray-400 hover:text-blue-500 transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                            <button onclick="openDeleteModal(${customer.id})" class="p-2 text-gray-400 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </td>
                </tr>`;
        });
        if (window.lucide) lucide.createIcons();
        renderPagination();
    } catch (e) { console.error(e); }
}

/** 2. ADD / EDIT LOGIC **/
function openAddCustomerModal() {
    document.getElementById("modalTitle").innerText = "Customer Registration";
    document.getElementById("customerForm").reset();
    document.getElementById("customerId").value = "";
    document.getElementById("passwordField").style.display = "block";
    document.getElementById("modalAlert").className = "hidden";
    document.getElementById("customerModal").classList.remove("hidden");
}

function openEditCustomerModal(customer) {
    document.getElementById("modalTitle").innerText = "Update Client Detail";
    document.getElementById("customerId").value = customer.id;
    document.getElementById("cFirstName").value = customer.firstName;
    document.getElementById("cLastName").value = customer.lastName;
    document.getElementById("cEmail").value = customer.email;
    document.getElementById("cPhone").value = customer.phone || "";
    document.getElementById("passwordField").style.display = "none"; 
    document.getElementById("modalAlert").className = "hidden";
    document.getElementById("customerModal").classList.remove("hidden");
}

document.getElementById("customerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("customerId").value;
    const token = localStorage.getItem("token");
    const mAlert = document.getElementById("modalAlert");
    
    const formData = new FormData();
    formData.append("FirstName", document.getElementById("cFirstName").value);
    formData.append("LastName", document.getElementById("cLastName").value);
    formData.append("Email", document.getElementById("cEmail").value);
    formData.append("Phone", document.getElementById("cPhone").value);
    formData.append("Role", "CUSTOMER");

    if (!id) formData.append("Password", document.getElementById("cPassword").value);
    
    const picFile = document.getElementById("cProfilePicture").files[0];
    if (picFile) formData.append("profilePicture", picFile);

    // Using register-staff endpoint as it usually handles admin creation
    const url = id ? `${API_BASE}/api/users/${id}` : `${API_BASE}/api/auth/register-staff`;
    const method = id ? "PUT" : "POST";

    try {
        const res = await fetch(url, { method, headers: { "Authorization": `Bearer ${token}` }, body: formData });
        const result = await res.json();

        if (res.ok) {
            document.getElementById("customerModal").classList.add("hidden");
            showAlert(id ? "Customer Profile Updated" : "Customer Successfully Registered");
            loadCustomers(currentPage);
        } else {
            mAlert.innerText = result.message || "Error: Check if email exists.";
            mAlert.className = "ts-alert-error mb-4 block text-xs";
        }
    } catch (e) { 
        mAlert.innerText = "Connection failed.";
        mAlert.className = "ts-alert-error mb-4 block text-xs";
    }
});

/** 3. HELPERS **/
function showAlert(msg) {
    const el = document.getElementById("alertBox");
    el.innerText = msg;
    el.className = "ts-alert-success mb-6 block";
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 3000);
}

function openViewCustomerModal(customer) {
    document.getElementById('vCustomerName').innerText = `${customer.firstName} ${customer.lastName}`;
    document.getElementById('vCustomerEmail').innerText = customer.email;
    document.getElementById('vCustomerPhone').innerText = customer.phone || '---';
    const pic = customer.profilePicture ? `${API_BASE}/assets/uploads/users/${customer.profilePicture}` : `https://ui-avatars.com/api/?name=${customer.firstName}`;
    document.getElementById('vCustomerProfilePic').src = pic;
    document.getElementById('viewCustomerModal').classList.remove('hidden');
}

function openDeleteModal(id) { deleteId = id; document.getElementById('deleteConfirmModal').classList.remove('hidden'); }

document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
    await fetch(`${API_BASE}/api/users/${deleteId}`, { method: 'DELETE', headers: { "Authorization": `Bearer ${localStorage.getItem('token')}` } });
    document.getElementById('deleteConfirmModal').classList.add('hidden');
    loadCustomers(currentPage);
    showAlert("Record deleted.");
});

function renderPagination() {
    const container = document.getElementById('paginationNumbers');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        container.innerHTML += `<button onclick="loadCustomers(${i})" class="w-10 h-10 flex items-center justify-center rounded-xl text-xs font-bold ${i === currentPage ? 'bg-[#062621] text-white shadow-lg' : 'bg-white text-gray-400'}">${i}</button>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadCustomers(1);
    document.getElementById('searchInput')?.addEventListener('input', () => {
        clearTimeout(window.sT);
        window.sT = setTimeout(() => loadCustomers(1), 400);
    });
});