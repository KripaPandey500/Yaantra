'use strict';

const BASE_URL = "http://localhost:5033";

// ─── CHECK AUTHENTICATION ON PAGE LOAD ───
(function() {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    
    if (!token) {
        window.location.href = '/frontend/auth/login.html?msg=loginfirst';
        return;
    }
    
    if (userRole !== 'Staff' && userRole !== 'Admin') {
        alert('Access denied. This page is for staff only.');
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        window.location.href = '/frontend/auth/login.html';
        return;
    }
})();

/**
 * ─── GLOBAL MODAL & UI CONTROLS ───
 */
window.toggleModal = (show) => {
    const modal = document.getElementById('regModal') || document.getElementById('createModal');
    if (modal) {
        modal.classList.toggle('hidden', !show);
        modal.classList.toggle('active', show);
    }
};

window.openCreateModal = () => {
    const container = document.getElementById("vehicleRows");
    if (container) container.innerHTML = "";
    window.toggleModal(true);
};

window.closeCreateModal = () => window.toggleModal(false);


 // --- 1. VIEW CUSTOMER DETAILS (Fixed Phone Number) ---
 
window.openViewModal = async (id) => {
    const modal = document.getElementById("viewModal");
    const body = document.getElementById("viewModalBody");
    const token = localStorage.getItem("token");

    if (!modal || !body) return;

    modal.classList.add("active");
    modal.classList.remove("hidden");
    body.innerHTML = `<div class="py-20 text-center text-gray-400 italic">Fetching detailed records...</div>`;

    try {
        const res = await fetch(`${BASE_URL}/api/auth/profile/${id}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Could not load profile");

        const c = await res.json();
        const vehicles = c.Vehicles || c.vehicles || [];
        
        // Mapping phone specifically to catch all variants
        const phoneNumber = c.Phone || c.phone || c.PhoneNumber || c.phoneNumber || 'N/A';

        body.innerHTML = `
            <div class="space-y-8 animate-in fade-in zoom-in duration-300">
                <div class="flex items-center gap-6 bg-primary/5 p-6 rounded-[2.5rem] border border-primary/10">
                    <img src="${c.ProfilePicture || c.profilePicture ? BASE_URL + (c.ProfilePicture || c.profilePicture) : 'https://ui-avatars.com/api/?name=' + (c.FirstName || c.firstName)}" 
                         class="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md">
                    <div>
                        <h4 class="text-2xl font-black text-primary">${c.FirstName || c.firstName} ${c.LastName || c.lastName}</h4>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID: #CUS-${c.Id || c.id}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-y-6 gap-x-10 px-4">
                    <div><label class="label-style opacity-50">Email Address</label><p class="font-bold text-primary text-sm">${c.Email || c.email}</p></div>
                    <div><label class="label-style opacity-50">Phone Number</label><p class="font-bold text-primary text-sm">${phoneNumber}</p></div>
                    <div><label class="label-style opacity-50">Gender</label><p class="font-bold text-primary text-sm">${c.Gender || c.gender || 'N/A'}</p></div>
                    <div><label class="label-style opacity-50">Date of Birth</label><p class="font-bold text-primary text-sm">${c.DateOfBirth || c.dateOfBirth ? new Date(c.DateOfBirth || c.dateOfBirth).toLocaleDateString() : 'N/A'}</p></div>
                    <div class="col-span-2"><label class="label-style opacity-50">Residential Address</label><p class="font-bold text-primary text-sm">${c.Address || c.address}</p></div>
                </div>

                <div class="px-4">
                    <div class="flex justify-between items-center mb-4">
                        <label class="label-style mb-0">Registered Garage (${vehicles.length})</label>
                    </div>
                    <div class="space-y-3">
                        ${vehicles.length > 0 ? vehicles.map(v => `
                            <div class="p-4 border border-gray-100 rounded-2xl flex justify-between items-center bg-gray-50/50 hover:bg-white hover:shadow-md transition-all">
                                <div>
                                    <p class="text-xs font-black text-primary font-mono">${v.VehicleNumber || v.vehicleNumber}</p>
                                    <p class="text-[10px] text-gray-400 font-bold uppercase">${v.Brand || v.brand} ${v.Model || v.model}</p>
                                </div>
                                <span class="text-[9px] font-black px-2 py-1 bg-white border border-gray-100 rounded-lg text-primary/40 uppercase">${v.Type || v.type}</span>
                            </div>
                        `).join('') : '<p class="text-center py-6 text-xs text-gray-400 italic bg-gray-50 rounded-2xl border border-dashed border-gray-200">No vehicles linked to this account.</p>'}
                    </div>
                </div>
            </div>`;

        if (window.lucide) lucide.createIcons();

    } catch (err) {
        body.innerHTML = `<div class="py-10 text-center text-red-500 font-bold">Error: ${err.message}</div>`;
    }
};

window.closeViewModal = () => {
    const modal = document.getElementById("viewModal");
    if (modal) {
        modal.classList.remove("active");
        modal.classList.add("hidden");
    }
};

/**
 * --- DYNAMIC VEHICLE ROW GENERATOR ---
 */
window.addVehicleRow = () => {
    const container = document.getElementById("vehicleRows");
    if (!container) return;
    const div = document.createElement("div");
    div.className = "grid grid-cols-2 gap-2 p-4 bg-gray-50 rounded-2xl relative border border-gray-100 mb-3 v-row animate-in fade-in";
    div.innerHTML = `
        <div class="col-span-2 flex justify-between items-center mb-1">
            <span class="text-[9px] font-black text-primary/40 uppercase tracking-widest">Vehicle Details</span>
            <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-red-400 hover:text-red-600 transition-colors">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
        </div>
        <input type="text" placeholder="Brand" class="v_brand boxed-input text-xs" required>
        <input type="text" placeholder="Model" class="v_model boxed-input text-xs" required>
        <input type="text" placeholder="Plate" class="v_number boxed-input text-xs" required>
        <div class="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Year" class="v_year boxed-input text-xs" value="2024">
            <input type="text" placeholder="Color" class="v_color boxed-input text-xs" value="Default">
        </div>
    `;
    container.appendChild(div);
    if (window.lucide) lucide.createIcons();
};

// Initial row on page load
document.addEventListener("DOMContentLoaded", () => {
    includeSidebar();
    loadStaffProfile();

    const path = window.location.pathname;

    if (path.includes("dashboard.html")) {
        loadDashboardData();
    } 
    
    if (path.includes("customer-management.html")) {
        loadCustomers();
        setupCustomerSearch();
        const regForm = document.getElementById('customerRegistrationForm');
        if (regForm) regForm.addEventListener('submit', submitCreateCustomer);
    }
});

// For dynamic modals that may not exist on all pages, we can use event delegation or check existence before attaching events. Example for a search input:
async function loadDashboardData() {
    const token = localStorage.getItem("token");
    const logTableBody = document.getElementById("recentLogsTable");
    if (!token) return;

    try {
        // Fetch customers (already filtered to CUSTOMER role by the endpoint)
        const res = await fetch(`${BASE_URL}/api/auth/customers`, { 
            headers: { "Authorization": `Bearer ${token}` } 
        });
        const customers = await res.json();

        // Active Customers count
        if (document.getElementById("stat-customers")) {
            document.getElementById("stat-customers").innerText = customers.length;
        }

        // Registered Vehicles count
        if (document.getElementById("stat-vehicles")) {
            const vTotal = customers.reduce((s, c) => s + (c.vehicles || c.Vehicles || []).length, 0);
            document.getElementById("stat-vehicles").innerText = vTotal;
        }

        // Total Revenue — fetch from orders
        if (document.getElementById("stat-revenue")) {
            try {
                const ordRes = await fetch(`${BASE_URL}/api/orders`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (ordRes.ok) {
                    const orders = await ordRes.json();
                    const totalRevenue = orders.reduce((sum, o) => sum + (o.grandTotal || o.GrandTotal || 0), 0);
                    document.getElementById("stat-revenue").innerText = 
                        `Rs. ${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                }
            } catch (e) {
                console.error("Revenue fetch error:", e);
                document.getElementById("stat-revenue").innerText = "Rs. 0.00";
            }
        }

        // Recent registrations table
        if (logTableBody) {
            const latest = [...customers]
                .sort((a, b) => (b.id || b.Id) - (a.id || a.Id))
                .slice(0, 5);

            if (latest.length === 0) {
                logTableBody.innerHTML = `<tr><td colspan="3" class="p-10 text-center text-gray-400 italic">No logs.</td></tr>`;
            } else {
                logTableBody.innerHTML = latest.map(c => `
                    <tr class="border-t border-gray-50 hover:bg-gray-50/50 transition-all">
                        <td class="px-8 py-4">
                            <span class="font-bold text-primary text-sm">
                                ${c.firstName || c.FirstName} ${c.lastName || c.LastName}
                            </span>
                        </td>
                        <td class="px-8 py-4 text-gray-500 text-xs">${c.email || c.Email}</td>
                        <td class="px-8 py-4">
                            <span class="text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase">
                                Registered
                            </span>
                        </td>
                    </tr>`).join('');
            }
        }

    } catch (err) { 
        console.error("Dashboard load error:", err);
        if (logTableBody) {
            logTableBody.innerHTML = `<tr><td colspan="3" class="p-10 text-center text-red-400">Failed to load data.</td></tr>`;
        }
    }
}

// For customer search on dashboard
async function loadCustomers() {
    const tableBody = document.getElementById('customerTableBody');
    if (!tableBody) return;
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`${BASE_URL}/api/auth/customers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const all = await res.json();
        const customers = all.filter(u => (u.Role || u.role || "").toUpperCase() === 'CUSTOMER');

        tableBody.innerHTML = customers.map((c, i) => {
            const fName = c.FirstName || c.firstName || "User";
            const lName = c.LastName || c.lastName || "";
            const vCount = (c.Vehicles || c.vehicles || []).length;
            const pic = c.ProfilePicture || c.profilePicture;
            const phone = c.Phone || c.phone || c.PhoneNumber || c.phoneNumber || '---';
            
            const picUrl = pic 
                ? (pic.startsWith('http') ? pic : `${BASE_URL}${pic}`) 
                : `https://ui-avatars.com/api/?name=${fName}+${lName}&background=062621&color=fff`;

            return `
                <tr class="hover:bg-gray-50/50 transition-all border-b border-gray-100">
                    <td class="p-6 text-gray-400 font-bold text-xs">${String(i + 1).padStart(2, '0')}</td>
                    <td class="p-6">
                        <div class="flex items-center gap-4">
                            <img src="${picUrl}" class="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm" onerror="this.src='https://ui-avatars.com/api/?name=User'">
                            <div>
                                <p class="text-sm font-bold text-primary">${fName} ${lName}</p>
                                <p class="text-[9px] text-gray-400 font-bold">ID: #CUS-${c.Id || c.id}</p>
                            </div>
                        </div>
                    </td>
                    <td class="p-6 text-xs text-gray-500">${c.Email || c.email}</td>
                    <td class="p-6 text-xs text-gray-500">${phone}</td>
                    <td class="p-6 text-center text-xs font-bold text-gray-400">${c.Gender || c.gender || '---'}</td>
                    <td class="p-6 text-center"><span class="bg-primary/5 text-primary text-[10px] font-bold px-3 py-1 rounded-full">${vCount} vehicles</span></td>
                    <td class="p-6 text-emerald-600 font-bold text-xs text-center">Rs. 0.00</td>
                    <td class="p-6 text-right">
                        <div class="flex justify-end gap-2">
                            <button onclick="openViewModal(${c.Id || c.id})" class="p-2 text-gray-400 hover:text-primary transition-all"><i data-lucide="eye" class="w-4 h-4"></i></button>
                            <button onclick="deleteCustomer(${c.Id || c.id})" class="p-2 text-gray-400 hover:text-red-500 transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
        if (window.lucide) lucide.createIcons();
    } catch (e) { tableBody.innerHTML = "Error loading customers."; }
}

// For customer search on dashboard
async function loadStaffProfile() {
    const token = localStorage.getItem('token');
    const firstName = localStorage.getItem('firstName') || '';
    const lastName = localStorage.getItem('lastName') || '';
    const profilePic = localStorage.getItem('profilePic') || '';
    
    // Display cached data immediately
    if (firstName || lastName) {
        console.log("Using cached profile data:", `${firstName} ${lastName}`);
        if (document.getElementById("userName")) document.getElementById("userName").innerText = `${firstName} ${lastName}`;
        if (document.getElementById("welcomeName")) document.getElementById("welcomeName").innerText = firstName;
        if (profilePic && document.getElementById("userProfilePic")) {
            document.getElementById("userProfilePic").src = profilePic.startsWith('http') ? profilePic : `${BASE_URL}${profilePic}`;
        }
    }
    
    if (!token) {
        console.warn("No token found in localStorage");
        return;
    }
    
    try {
        console.log("Fetching fresh profile from:", `${BASE_URL}/api/auth/profile`);
        console.log("Token preview:", token.substring(0, 20) + "...");
        
        const res = await fetch(`${BASE_URL}/api/auth/profile`, { 
            method: 'GET',
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        console.log("Profile response status:", res.status, res.statusText);
        
        if (res.ok) {
            const u = await res.json();
            console.log("Fresh profile data received:", u);
            
            const fName = u.FirstName || u.firstName || u.first_name || firstName || '';
            const lName = u.LastName || u.lastName || u.last_name || lastName || '';
            const pic = u.ProfilePicture || u.profilePicture || u.profile_picture || profilePic || '';
            
            // Update localStorage with fresh data
            localStorage.setItem("firstName", fName);
            localStorage.setItem("lastName", lName);
            localStorage.setItem("profilePic", pic);
            
            console.log("Updated profile to:", `${fName} ${lName}`);
            
            // Update UI with fresh data
            if (document.getElementById("userName")) document.getElementById("userName").innerText = `${fName} ${lName}`;
            if (document.getElementById("welcomeName")) document.getElementById("welcomeName").innerText = fName;
            if (pic && document.getElementById("userProfilePic")) {
                const picUrl = pic.startsWith('http') ? pic : `${BASE_URL}${pic}`;
                document.getElementById("userProfilePic").src = picUrl;
            }
        } else {
            const errText = await res.text();
            console.error("Profile request failed:", res.status, res.statusText, errText);
        }
    } catch (e) { 
        console.error("Error loading profile (using cache):", e);
    }
}

async function includeSidebar() {
    const container = document.getElementById("sidebar-placeholder");
    if (!container) return;
    try {
        const response = await fetch("sidebar-staff.html");
        if (response.ok) {
            container.innerHTML = await response.text();
            if (window.lucide) lucide.createIcons();
            
            // Use the same active link highlighting as user pages
            function highlightActiveLink() {
                const currentPath = window.location.pathname;
                document.querySelectorAll('.sidebar-link').forEach(link => {
                    const href = link.getAttribute('href');
                    if (href && currentPath.includes(href.split('/').pop())) {
                        // ACTIVE STATE - Emerald/Teal background with white text
                        link.classList.remove('text-white/60', 'hover:bg-white/10');
                        link.classList.add('bg-emerald-600', 'text-white', 'shadow-lg', 'font-semibold');
                        // Ensure icon also turns bright
                        const icon = link.querySelector('i');
                        if(icon) icon.classList.add('text-white');
                    }
                });
            }
            
            // Setup sidebar handlers for mobile
            window.openStaffSidebar = function() {
                document.getElementById('staffSidebar').classList.remove('-translate-x-full');
                document.getElementById('sidebarOverlay').classList.remove('hidden');
            }
            window.closeStaffSidebar = function() {
                document.getElementById('staffSidebar').classList.add('-translate-x-full');
                document.getElementById('sidebarOverlay').classList.add('hidden');
            }
            
            // Close sidebar on overlay click
            document.getElementById('sidebarOverlay')?.addEventListener('click', closeStaffSidebar);
            
            highlightActiveLink();
        }
    } catch (e) { console.error(e); }
}

function setupCustomerSearch() {
    document.getElementById('customerSearch')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#customerTableBody tr').forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(term) ? '' : 'none';
        });
    });
}

async function deleteCustomer(id) {
    if (!confirm("Delete record?")) return;
    const res = await fetch(`${BASE_URL}/api/auth/delete/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) loadCustomers();
}

function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "../pages/homepage.html";
}