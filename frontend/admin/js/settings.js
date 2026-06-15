const API_BASE = "http://localhost:5033";

document.addEventListener('DOMContentLoaded', () => {
    loadCurrentAdminData();
    
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
    document.getElementById('securityForm').addEventListener('submit', updatePassword);
});

/** 1. POPULATE INITIAL DATA **/
function loadCurrentAdminData() {
    const firstName = localStorage.getItem('firstName') || '';
    const lastName = localStorage.getItem('lastName') || '';
    const email = localStorage.getItem('userEmail') || '';

    document.getElementById('setFirstName').value = firstName;
    document.getElementById('setLastName').value = lastName;
    document.getElementById('setEmail').value = email;

    
    const initials = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase();
    document.getElementById('navProfileInitials').innerText = initials || 'AD';
}

/** 2. UPDATE PROFILE LOGIC **/
async function updateProfile(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId'); 

    if (!userId) {
        showAlert("User ID not found. Please log in again.", "error");
        return;
    }

  
    const formData = new FormData();
    formData.append("FirstName", document.getElementById('setFirstName').value);
    formData.append("LastName", document.getElementById('setLastName').value);
    formData.append("Email", document.getElementById('setEmail').value);
    formData.append("Role", "Admin"); 

    try {
       
        const res = await fetch(`${API_BASE}/api/users/${userId}`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}` 
            },
            body: formData
        });

        if (res.ok) {
            
            localStorage.setItem('firstName', document.getElementById('setFirstName').value);
            localStorage.setItem('lastName', document.getElementById('setLastName').value);
            
            showAlert("Profile synchronized with system successfully.", "success");
            loadCurrentAdminData();
        } else {
            const errData = await res.json().catch(() => ({}));
            showAlert(errData.message || "Backend rejected update. Check data format.", "error");
        }
    } catch (err) {
        console.error(err);
        showAlert("Network connection failed. Is the server online?", "error");
    }
}

/** 3. UPDATE PASSWORD **/
async function updatePassword(e) {
    e.preventDefault();
    showAlert("Password reset requested. Check backend implementation.", "success");
}

/** ALERT HELPER **/
function showAlert(msg, type = 'success') {
    const box = document.getElementById('alertBox');
    box.innerText = msg;
    box.className = type === 'success' ? 'ts-alert-success mb-8 block' : 'ts-alert-error mb-8 block';
    box.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => box.classList.add('hidden'), 4000);
}