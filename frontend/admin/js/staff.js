const API_BASE = "http://localhost:5033";
let currentPage = 1;
const pageSize = 5;
let totalPages = 1;
let deleteId = null;


// 1. DATA LOADING & RENDERING

async function loadStaff(page = 1) {
    const search = document.getElementById("searchInput")?.value?.trim() || "";
    const table = document.getElementById("staffTable");
    const token = localStorage.getItem("token");

    currentPage = page;

    try {
        const url = new URL(`${API_BASE}/api/users/staff`);
        url.searchParams.append("page", page);
        url.searchParams.append("pageSize", pageSize);
        url.searchParams.append("search", search);

        const res = await fetch(url.toString(), {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        table.innerHTML = "";
        const staffList = data.data || [];
        totalPages = data.totalPages || 1;

        if (staffList.length === 0) {
            table.innerHTML = `<tr><td colspan="6" class="p-20 text-center text-gray-400 italic font-medium">No personnel records found.</td></tr>`;
            renderPagination();
            return;
        }

        staffList.forEach((staff, idx) => {
            const sn = (page - 1) * pageSize + idx + 1;
            const pic = staff.profilePicture 
                ? `${API_BASE}/assets/uploads/users/${staff.profilePicture}` 
                : `https://ui-avatars.com/api/?name=${staff.firstName}+${staff.lastName}&background=062621&color=fff`;

            const staffObj = JSON.stringify(staff).replace(/"/g, '&quot;');

            table.innerHTML += `
                <tr class="hover:bg-gray-50/80 transition-colors border-b border-gray-50">
                    <td class="p-4 pl-10 font-bold text-gray-400 text-xs">${sn}</td>
                    <td class="p-4">
                        <img src="${pic}" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" onerror="this.src='https://ui-avatars.com/api/?name=User&background=062621&color=fff'">
                    </td>
                    <td class="p-4">
                        <div class="flex flex-col">
                            <span class="text-sm font-bold text-[#062621] leading-tight">${staff.firstName} ${staff.lastName}</span>
                            <span class="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1">Verified Personnel</span>
                        </div>
                    </td>
                    <td class="p-4 text-gray-500 font-medium text-xs">${staff.email}</td>
                    <td class="p-4 text-gray-500 font-medium text-xs">${staff.phone || '---'}</td>
                    <td class="p-4 text-right">
                        <div class="flex justify-end gap-1">
                            <button onclick='openViewModal(${staffObj})' class="p-2 text-gray-400 hover:text-emerald-500 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                            <button onclick='openEditModal(${staffObj})' class="p-2 text-gray-400 hover:text-blue-500 transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                            <button onclick="openDeleteModal(${staff.id})" class="p-2 text-gray-400 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </td>
                </tr>`;
        });

        renderPagination();
        if (window.lucide) lucide.createIcons();
    } catch (e) { console.error(e); }
}

// 2. REGISTRATION (FIXED LOGIC)

async function registerStaffByAdmin() {
    const token = localStorage.getItem("token");
    const form = document.getElementById("staffRegForm");
    const alertBox = document.getElementById("staffFormAlertBox");
    const btn = document.querySelector('button[onclick="registerStaffByAdmin()"]');
    
    // Clear alert and prepare UI
    alertBox.classList.add("hidden");
    alertBox.innerHTML = "";

    const formData = new FormData();
    formData.append("FirstName", document.getElementById("sFirstName").value.trim());
    formData.append("LastName", document.getElementById("sLastName").value.trim());
    formData.append("Email", document.getElementById("sEmail").value.trim());
    formData.append("Phone", document.getElementById("sPhone").value.trim());
    formData.append("Password", document.getElementById("sPassword").value);
    formData.append("Address", document.getElementById("sAddress").value.trim());
    formData.append("Role", "Staff"); // FIXED: Changed "STAFF" to "Staff" to match DB

    const fileInput = document.getElementById("sProfilePicture");
    if (fileInput.files[0]) {
        formData.append("profilePicture", fileInput.files[0]);
    }

    try {
        btn.disabled = true;
        btn.innerText = "Processing...";

        const response = await fetch(`${API_BASE}/api/auth/register-staff`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            form.reset();
            toggleModal('staffModal', false);
            showAlert("Staff registered successfully!");
            loadStaff(1);
        } else {
            // DEEP ERROR PARSING
            let msg = "";
            if (Array.isArray(result)) { // Identity Error Array
                msg = result.map(e => e.description).join("<br>");
            } else if (result.errors) { // Validation Object
                msg = Object.values(result.errors).flat().join("<br>");
            } else {
                msg = result.message || "Email exists or password is too weak (Needs: A-Z, 1-9, @#$).";
            }

            alertBox.innerHTML = msg;
            alertBox.className = "ts-alert-error mb-4 block";
            alertBox.classList.remove("hidden");
        }
    } catch (e) {
        alertBox.innerText = "Cannot connect to server.";
        alertBox.classList.remove("hidden");
    } finally {
        btn.disabled = false;
        btn.innerText = "Register Member";
    }
}


// 3. EDIT, VIEW, DELETE (Logic preserved)

function openEditModal(staff) {
    document.getElementById("editStaffId").value = staff.id;
    document.getElementById("eFirstName").value = staff.firstName;
    document.getElementById("eLastName").value = staff.lastName;
    document.getElementById("eEmail").value = staff.email;
    document.getElementById("ePhone").value = staff.phone || "";
    document.getElementById("eAddress").value = staff.address || "";
    const picRow = document.getElementById("existingProfilePictureRow");
    if (staff.profilePicture) {
        picRow.classList.remove('hidden');
        document.getElementById("eProfilePic").src = `${API_BASE}/assets/uploads/users/${staff.profilePicture}`;
    } else picRow.classList.add('hidden');
    toggleModal("editModal", true);
}

async function submitStaffUpdate() {
    const id = document.getElementById("editStaffId").value;
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("FirstName", document.getElementById("eFirstName").value);
    formData.append("LastName", document.getElementById("eLastName").value);
    formData.append("Email", document.getElementById("eEmail").value);
    formData.append("Phone", document.getElementById("ePhone").value);
    formData.append("Address", document.getElementById("eAddress").value);
    formData.append("Role", "Staff");

    const fileInput = document.getElementById("eProfilePicture");
    if (fileInput.files[0]) formData.append("profilePicture", fileInput.files[0]);

    const res = await fetch(`${API_BASE}/api/users/${id}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
    });
    if (res.ok) { toggleModal('editModal', false); loadStaff(currentPage); showAlert("Updated!"); }
}

function openViewModal(staff) {
    document.getElementById("vName").innerText = `${staff.firstName} ${staff.lastName}`;
    document.getElementById("vEmail").innerText = staff.email;
    document.getElementById("vPhone").innerText = staff.phone || "---";
    document.getElementById("vAddress").innerText = staff.address || "---";
    document.getElementById("vProfilePic").src = staff.profilePicture ? `${API_BASE}/assets/uploads/users/${staff.profilePicture}` : `https://ui-avatars.com/api/?name=${staff.firstName}&background=062621&color=fff`;
    toggleModal("viewModal", true);
}

function openDeleteModal(id) { deleteId = id; toggleModal("deleteConfirmModal", true); }
async function confirmDelete() {
    const res = await fetch(`${API_BASE}/api/users/${deleteId}`, { method: 'DELETE', headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
    if (res.ok) { toggleModal("deleteConfirmModal", false); loadStaff(currentPage); showAlert("Deleted!"); }
}


// 4. HELPERS

function toggleModal(id, show) { const m = document.getElementById(id); if (show) m.classList.remove('hidden'); else m.classList.add('hidden'); }
function closeModal(id) { toggleModal(id, false); }
function renderPagination() {
    const container = document.getElementById('paginationNumbers');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        container.innerHTML += `<button onclick="goToPage(${i})" class="w-10 h-10 flex items-center justify-center rounded-xl text-xs font-bold ${i === currentPage ? 'bg-[#062621] text-white shadow-lg' : 'bg-white text-gray-400'}">${i}</button>`;
    }
}
function goToPage(p) { loadStaff(p); }
function prevPage() { if (currentPage > 1) loadStaff(currentPage - 1); }
function nextPage() { if (currentPage < totalPages) loadStaff(currentPage + 1); }
function showAlert(msg) {
    const box = document.getElementById('alertBox');
    if (!box) return;
    box.innerText = msg;
    box.className = 'ts-alert-success mb-6 block';
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 3000);
}

document.addEventListener("DOMContentLoaded", () => {
    loadStaff();
    document.getElementById("searchInput")?.addEventListener("input", () => {
        clearTimeout(window.sT);
        window.sT = setTimeout(() => loadStaff(1), 400);
    });
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', confirmDelete);
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => toggleModal("deleteConfirmModal", false));
});