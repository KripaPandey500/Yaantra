const apiBase = 'http://localhost:5033/api/Categories';
let currentPage = 1;
let pageSize = 5;
let totalPages = 1;
let currentSearch = "";
let categoryToDelete = null;

document.addEventListener('DOMContentLoaded', function () {
    loadCategories();

    document.getElementById('searchInput')?.addEventListener('input', function () {
        currentSearch = this.value;
        currentPage = 1;
        loadCategories();
    });
});

/** 1. LOAD DATA **/
function loadCategories() {
    const table = document.getElementById('categoryTable');
    if(!table) return;

    fetch(`${apiBase}?page=${currentPage}&pageSize=${pageSize}&search=${encodeURIComponent(currentSearch)}`)
        .then(res => res.json())
        .then(response => {
            totalPages = response.totalPages || 1;
            table.innerHTML = '';

            if(!response.data || response.data.length === 0) {
                table.innerHTML = `<tr><td colspan="4" class="p-20 text-center text-gray-400 italic">No categories found.</td></tr>`;
                renderPagination();
                return;
            }

            response.data.forEach((cat, idx) => {
                const sn = (currentPage - 1) * pageSize + idx + 1;
                // Clean name for JS string safety
                const safeName = cat.name.replace(/'/g, "\\'");

                table.innerHTML += `
                    <tr class="hover:bg-emerald-50/30 transition-colors border-b border-gray-50">
                        <td class="px-8 py-5 font-bold text-gray-400 text-xs">${sn}</td>
                        <td class="px-8 py-5">
                            <span class="text-sm font-bold text-[#062621] uppercase tracking-tight">${cat.name}</span>
                        </td>
                        <td class="px-8 py-5 text-center">
                            <span class="px-3 py-1 rounded-full text-[10px] font-black bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-widest">
                                ${cat.productCount} Products
                            </span>
                        </td>
                        <td class="px-8 py-5 text-right">
                            <div class="flex justify-end gap-1">
                                <!-- EDIT ICON -->
                                <button onclick="openEditCategoryModal('${cat.id}', '${safeName}')" class="p-2 text-gray-400 hover:text-blue-500 transition">
                                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                                </button>
                                <!-- DELETE ICON -->
                                <button onclick="deleteCategory(${cat.id})" class="p-2 text-gray-400 hover:text-red-500 transition">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            if (window.lucide) lucide.createIcons();
            renderPagination();
        });
}

/** 2. ADD LOGIC **/
function openAddCategoryModal() {
    document.getElementById('addCategoryModal').classList.remove('hidden');
    document.getElementById('addCategoryForm').reset();
}
function closeAddCategoryModal() { document.getElementById('addCategoryModal').classList.add('hidden'); }

document.getElementById('addCategoryForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('addCategoryName').value.trim();
    fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    })
    .then(res => {
        if (res.ok) {
            closeAddCategoryModal();
            loadCategories();
            showAlert('Category created successfully!');
        } else { showAlert('Failed to create.', 'error'); }
    });
});

/** 3. EDIT LOGIC **/
function openEditCategoryModal(id, name) {
    document.getElementById('editCategoryId').value = id;
    document.getElementById('editCategoryName').value = name;
    document.getElementById('editCategoryModal').classList.remove('hidden');
}
function closeEditCategoryModal() { document.getElementById('editCategoryModal').classList.add('hidden'); }

document.getElementById('editCategoryForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = document.getElementById('editCategoryId').value;
    const name = document.getElementById('editCategoryName').value.trim();
    fetch(`${apiBase}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    })
    .then(res => {
        if (res.ok) {
            closeEditCategoryModal();
            loadCategories();
            showAlert('Category updated!');
        } else { showAlert('Failed to update.', 'error'); }
    });
});

/** 4. DELETE LOGIC **/
function deleteCategory(id) {
    categoryToDelete = id;
    document.getElementById('deleteCategoryModal').classList.remove('hidden');
}
function closeDeleteCategoryModal() {
    categoryToDelete = null;
    document.getElementById('deleteCategoryModal').classList.add('hidden');
}

document.getElementById('confirmDeleteBtn')?.addEventListener('click', function () {
    if (!categoryToDelete) return;
    fetch(`${apiBase}/${categoryToDelete}`, { method: 'DELETE' })
        .then(res => {
            closeDeleteCategoryModal();
            if (res.ok) {
                loadCategories();
                showAlert('Category removed successfully.');
            } else { showAlert('Failed to delete.', 'error'); }
        });
});

/** 5. PAGINATION & ALERTS **/
function renderPagination() {
    const container = document.getElementById('paginationNumbers');
    if(!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        container.innerHTML += `
            <button onclick="goToPage(${i})"
                class="w-10 h-10 flex items-center justify-center rounded-xl text-xs font-bold transition
                ${i === currentPage ? 'bg-[#062621] text-white shadow-lg' : 'bg-white text-gray-400 hover:bg-gray-100'}">
                ${i}
            </button>`;
    }
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;
}

function goToPage(p) { currentPage = p; loadCategories(); }
function prevPage() { if (currentPage > 1) { currentPage--; loadCategories(); } }
function nextPage() { if (currentPage < totalPages) { currentPage++; loadCategories(); } }

function showAlert(message, type = 'success') {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = type === 'success' ? 'ts-alert-success mb-6 block' : 'ts-alert-error mb-6 block';
    alertBox.classList.remove('hidden');
    setTimeout(() => { alertBox.classList.add('hidden'); }, 3000);
}