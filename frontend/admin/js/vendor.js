const API_BASE = "http://localhost:5033";
let currentPage = 1;
const pageSize = 5;
let totalPages = 1;
let deleteId = null;

function displayFileName(input) {
    const display = document.getElementById('fileNameDisplay');
    if (display && input.files[0]) display.textContent = input.files[0].name;
}
function displayEditFileName(input) {
    const display = document.getElementById('editFileNameDisplay');
    if (display && input.files[0]) display.textContent = input.files[0].name;
}
function showAlert(message, type = 'success') {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = type === 'success' ? 'ts-alert-success mb-6 block' : 'ts-alert-error mb-6 block';
    alertBox.classList.remove('hidden');
    setTimeout(() => alertBox.classList.add('hidden'), 3000);
}

/** 1. DATA LOADING **/
async function loadVendors(page = 1) {
    currentPage = page;
    const tableBody = document.getElementById("vendorTable");
    const token = localStorage.getItem("token");
    const search = document.getElementById("searchInput")?.value || "";

    try {
        const url = new URL(`${API_BASE}/api/users/vendors`);
        url.searchParams.append("page", page);
        url.searchParams.append("pageSize", pageSize);
        url.searchParams.append("search", search);

        const response = await fetch(url.toString(), {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const vendors = data.data || [];
            tableBody.innerHTML = "";
            totalPages = data.totalPages || 1;

            if (vendors.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="6" class="p-20 text-center text-gray-400 italic font-medium">No partners found in network.</td></tr>`;
                renderPagination();
                return;
            }

            vendors.forEach((vendor, idx) => {
                const sn = (page - 1) * pageSize + idx + 1;
                const pic = vendor.profilePicture 
                    ? `${API_BASE}/assets/uploads/users/${vendor.profilePicture}` 
                    : `https://ui-avatars.com/api/?name=${vendor.firstName}&background=062621&color=fff`;
                const vendorObj = JSON.stringify(vendor).replace(/"/g, '&quot;');

                tableBody.innerHTML += `
                    <tr class="hover:bg-emerald-50/30 transition-colors border-b border-gray-50">
                        <td class="px-8 py-5 font-bold text-gray-300 text-xs">${sn}</td>
                        <td class="px-8 py-5"><img src="${pic}" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"></td>
                        <td class="px-8 py-5">
                            <div class="flex flex-col">
                                <span class="text-sm font-bold text-[#062621] leading-tight">${vendor.firstName}</span>
                                <span class="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1">Authorized Partner</span>
                            </div>
                        </td>
                        <td class="px-8 py-5 text-gray-500">${vendor.email}</td>
                        <td class="px-8 py-5 text-gray-500 font-medium">${vendor.phone || '---'}</td>
                        <td class="px-8 py-5 text-right">
                            <div class="flex justify-end gap-1">
                                <button onclick='openViewModal(${vendorObj})' class="p-2 text-gray-400 hover:text-emerald-500 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                                <button onclick='openEditModal(${vendorObj})' class="p-2 text-gray-400 hover:text-blue-500 transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                                <button onclick="openDeleteModal(${vendor.id})" class="p-2 text-gray-400 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                            </div>
                        </td>
                    </tr>`;
            });
            if (window.lucide) lucide.createIcons();
            renderPagination();
        }
    } catch (err) { console.error(err); }
}

/** 2. REGISTRATION **/
async function registerVendorByAdmin() {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("FirstName", document.getElementById("vFirstName").value);
    formData.append("LastName", document.getElementById("vLastName").value);
    formData.append("Email", document.getElementById("vEmail").value);
    formData.append("Phone", document.getElementById("vPhone").value);
    formData.append("Password", document.getElementById("vPassword").value);
    formData.append("Address", document.getElementById("vAddress").value);
    formData.append("Role", "Vendor");

    const pic = document.getElementById("vProfilePicture").files[0];
    if (pic) formData.append("profilePicture", pic);

    try {
        const res = await fetch(`${API_BASE}/api/auth/register-vendor`, {
            method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: formData
        });
        if (res.ok) { toggleModal('vendorModal', false); loadVendors(1); showAlert("Partner registered!"); }
        else { showAlert("Registration failed. Email might exist.", "error"); }
    } catch (e) { showAlert("Network error", "error"); }
}

/** 3. UPDATE **/
async function updateVendorByAdmin() {
    const id = document.getElementById("editVId").value;
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("FirstName", document.getElementById("editVFirstName").value);
    formData.append("LastName", document.getElementById("editVLastName").value);
    formData.append("Email", document.getElementById("editVEmail").value);
    formData.append("Phone", document.getElementById("editVPhone").value);
    formData.append("Address", document.getElementById("editVAddress").value);
    formData.append("Role", "Vendor");

    const pic = document.getElementById("editVProfilePictureFile").files[0];
    if (pic) formData.append("profilePicture", pic);

    try {
        const res = await fetch(`${API_BASE}/api/users/${id}`, {
            method: "PUT", headers: { "Authorization": `Bearer ${token}` }, body: formData
        });
        if (res.ok) { toggleModal('editVendorModal', false); loadVendors(currentPage); showAlert("Partner updated!"); }
    } catch (e) { showAlert("Error updating", "error"); }
}

/** 4. VIEW & DELETE **/
function openViewModal(v) {
    document.getElementById("viewCompName").innerText = v.firstName;
    document.getElementById("viewContact").innerText = v.lastName;
    document.getElementById("viewEmail").innerText = v.email;
    document.getElementById("viewPhone").innerText = v.phone || "---";
    document.getElementById("viewAddress").innerText = v.address || "---";
    document.getElementById("viewLogo").src = v.profilePicture ? `${API_BASE}/assets/uploads/users/${v.profilePicture}` : `https://ui-avatars.com/api/?name=${v.firstName}`;
    toggleModal('viewVendorModal', true);
}

function openEditModal(v) {
    document.getElementById("editVId").value = v.id;
    document.getElementById("editVFirstName").value = v.firstName;
    document.getElementById("editVLastName").value = v.lastName;
    document.getElementById("editVEmail").value = v.email;
    document.getElementById("editVPhone").value = v.phone || "";
    document.getElementById("editVAddress").value = v.address || "";
    if (v.profilePicture) {
        document.getElementById("existingCompanyLogoRow").classList.remove('hidden');
        document.getElementById("editVLogo").src = `${API_BASE}/assets/uploads/users/${v.profilePicture}`;
    } else { document.getElementById("existingCompanyLogoRow").classList.add('hidden'); }
    toggleModal('editVendorModal', true);
}

function openDeleteModal(id) { deleteId = id; toggleModal('deleteConfirmModal', true); }

document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
    const res = await fetch(`${API_BASE}/api/users/${deleteId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
    if (res.ok) { toggleModal('deleteConfirmModal', false); loadVendors(currentPage); showAlert("Deleted!"); }
});

/** 5. HELPERS **/
function renderPagination() {
    const container = document.getElementById('paginationNumbers');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        container.innerHTML += `<button onclick="loadVendors(${i})" class="w-10 h-10 flex items-center justify-center rounded-xl text-xs font-bold transition ${i === currentPage ? 'bg-[#062621] text-white shadow-lg' : 'bg-white text-gray-400 hover:bg-gray-100'}">${i}</button>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadVendors();
    document.getElementById('searchInput')?.addEventListener('input', () => {
        clearTimeout(window.sT);
        window.sT = setTimeout(() => loadVendors(1), 400);
    });
});