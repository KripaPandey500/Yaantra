let currentPage = 1;
const pageSize = 10;
let totalPages = 1;
let allUsers = [];

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;

    const alertBox = document.createElement('div');
    alertBox.className = `p-4 rounded-lg mb-4 ${type === 'success' ? 'ts-alert-success' : 'ts-alert-error'}`;
    alertBox.textContent = message;
    alertContainer.appendChild(alertBox);

    setTimeout(() => alertBox.remove(), 3000);
}

function renderPagination() {
    const container = document.getElementById('paginationNumbers');
    if (!container) return;

    container.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        container.innerHTML += `
            <button onclick="goToPage(${i})"
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

function goToPage(page) {
    currentPage = page;
    renderUsers();
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderUsers();
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        renderUsers();
    }
}

function getFilteredUsers() {
    const search = document.getElementById('searchInput')?.value?.trim().toLowerCase() || '';
    const roleFilter = document.getElementById('roleFilter')?.value || '';

    let filtered = allUsers;

    if (search) {
        filtered = filtered.filter(u =>
            u.firstName.toLowerCase().includes(search) ||
            u.lastName.toLowerCase().includes(search) ||
            u.email.toLowerCase().includes(search)
        );
    }

    if (roleFilter) {
        filtered = filtered.filter(u => u.role === roleFilter);
    }

    return filtered;
}

function renderUsers() {
    const filtered = getFilteredUsers();
    const table = document.getElementById('usersTable');
    if (!table) return;

    totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageUsers = filtered.slice(start, end);

    table.innerHTML = '';

    if (pageUsers.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="p-4 text-sm text-gray-500 text-center">No users found.</td>
            </tr>
        `;
        renderPagination();
        return;
    }

    pageUsers.forEach((user, idx) => {
        const sn = start + idx + 1;
        const profilePic = user.profilePicture
            ? `<img src="/backend-api/assets/uploads/users/${user.profilePicture}" alt="Profile" class="w-10 h-10 rounded-full object-cover" />`
            : `<div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">N/A</div>`;
        table.innerHTML += `
            <tr class="border-b hover:bg-gray-100">
                <td class="p-3">${sn}</td>
                <td class="p-3">${profilePic}</td>
                <td class="p-3">${user.firstName} ${user.lastName}</td>
                <td class="p-3">${user.email}</td>
                <td class="p-3">${user.phone || 'N/A'}</td>
                <td class="p-3"><span class="px-2 py-1 rounded text-xs font-semibold ${getRoleBadgeClass(user.role)}">${user.role}</span></td>
                <td class="p-3 space-x-2">
                    <button class="btn text-xs px-3 py-1 bg-blue-600 text-white border-none transition duration-300 transform hover:bg-blue-700 hover:-translate-y-0.5 hover:scale-105 shadow-sm">View</button>
                    <button class="btn btn-danger text-xs px-3 py-1" data-action="delete" data-user-id="${user.id}">Delete</button>
                </td>
            </tr>
        `;
    });

    renderPagination();
}

function getRoleBadgeClass(role) {
    switch (role?.toLowerCase()) {
        case 'admin':
            return 'bg-red-100 text-red-700';
        case 'staff':
            return 'bg-blue-100 text-blue-700';
        case 'vendor':
            return 'bg-purple-100 text-purple-700';
        case 'customer':
            return 'bg-green-100 text-green-700';
        default:
            return 'bg-gray-100 text-gray-700';
    }
}

async function loadUsers() {
    try {
        const response = await fetch('http://localhost:5033/api/users');
        if (!response.ok) throw new Error('Failed to load users');

        const users = await response.json();
        allUsers = Array.isArray(users) ? users : [];
        currentPage = 1;
        renderUsers();
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Failed to load users', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const roleFilter = document.getElementById('roleFilter');

    searchInput?.addEventListener('input', () => {
        currentPage = 1;
        renderUsers();
    });

    roleFilter?.addEventListener('change', () => {
        currentPage = 1;
        renderUsers();
    });

    document.getElementById('usersTable')?.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('[data-action="delete"]');
        if (deleteBtn) {
            const userId = deleteBtn.dataset.userId;
            if (confirm('Are you sure you want to delete this user?')) {
                try {
                    const response = await fetch(`http://localhost:5033/api/users/${userId}`, {
                        method: 'DELETE'
                    });
                    if (response.ok) {
                        showAlert('User deleted successfully', 'success');
                        loadUsers();
                    } else {
                        showAlert('Failed to delete user', 'error');
                    }
                } catch (error) {
                    console.error('Error deleting user:', error);
                    showAlert('Error deleting user', 'error');
                }
            }
        }
    });

    loadUsers();
});
