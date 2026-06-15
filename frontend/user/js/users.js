async function renderUserDetails() {
    const token = localStorage.getItem('token');
    const API_BASE = "http://localhost:5033"; 

    if (!token) {
        window.location.href = '/frontend/auth/login.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/profile`, {
            method: "GET",
            headers: {
               
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: Unauthorized or Server Error`);
        }

        const user = await response.json();
        console.log("Profile loaded:", user);

        document.getElementById('user-fullname').textContent = `${user.firstName} ${user.lastName}`;
        document.getElementById('user-email').textContent = user.email;
        document.getElementById('user-phone').textContent = user.phone || "N/A";
        document.getElementById('user-address').textContent = user.address || "N/A";
        document.getElementById('user-role').textContent = user.role || "User";

        const memberSinceEl = document.getElementById('user-member-since');
        if (memberSinceEl) {
            const sourceDate = user.createdAt || user.dateOfBirth;
            if (sourceDate) {
                const date = new Date(sourceDate);
                const options = { day: '2-digit', month: 'short', year: 'numeric' };
                memberSinceEl.textContent = date.toLocaleDateString('en-US', options);
            } else {
                memberSinceEl.textContent = 'N/A';
            }
        }

        const statusEl = document.getElementById('user-status');
        if (statusEl) {
            statusEl.textContent = (user.status || 'active').toString().toLowerCase();
        }

        const picElement = document.getElementById('profile-picture');
        if (user.profilePicture && user.profilePicture.trim() !== '') {
            // Clean up any duplicated paths from API response
            let imagePath = user.profilePicture;
            // Remove duplicate path patterns like /assets/uploads/users//assets/uploads/users/
            imagePath = imagePath.replace(/(\/assets\/uploads\/users\/)\1+/, '$1');
            
            // Construct full URL for the profile picture
            if (imagePath.startsWith('http')) {
                picElement.src = imagePath;
            } else {
                // Remove leading slashes to avoid duplication
                imagePath = imagePath.replace(/^\/+/, '');
                picElement.src = `${API_BASE}/${imagePath}`;
            }
        } else {
            // Fallback to existing image
            picElement.src = '/frontend/assets/images/image.png';
        }

    } catch (err) {
        console.error("Fetch Error:", err);
        showAlert('userProfileMsg', 'Failed to load profile. Please login again or try later.', 'error');
    }
}

function showProfileMessage() {
    const params = new URLSearchParams(window.location.search);
    const msg = params.get('msg');
    const type = params.get('type') || 'success';
    if (msg) {
        showAlert('userProfileMsg', msg, type);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    showProfileMessage();
    renderUserDetails();

    const editProfileBtn = document.getElementById('edit-profile-btn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', function () {
            window.location.href = '/frontend/user/pages/profile/edit-profile.html';
        });
    }
});