// editUser.js - Handles Edit Profile form submission and prefill

const API_BASE = 'http://localhost:5033';

let userProfileCache = {};

function clearProfileFieldError(fieldId) {
    const fieldError = document.getElementById(fieldId);
    if (!fieldError) return;

    clearTimeout(fieldError._timeoutId);
    fieldError.textContent = '';
    fieldError.classList.add('hidden');
}

function showProfileFieldError(fieldId, message) {
    const fieldError = document.getElementById(fieldId);
    if (!fieldError) return;

    clearTimeout(fieldError._timeoutId);
    fieldError.textContent = message;
    fieldError.classList.remove('hidden');
    fieldError._timeoutId = setTimeout(() => {
        fieldError.classList.add('hidden');
    }, 2500);
}

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('editProfileForm');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');

    emailInput?.addEventListener('input', function () {
        clearProfileFieldError('emailError');
    });

    phoneInput?.addEventListener('input', function () {
        clearProfileFieldError('phoneError');
    });

    // Prefill form with current user data
    fetch(API_BASE + '/api/auth/profile', {
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('token')
        }
    })
    .then(async res => {
        if (!res.ok) {
            showAlert('editProfileMsg', 'Failed to load profile: ' + res.status, 'error');
            const errorText = await res.text();
            console.error('Profile fetch error:', res.status, errorText);
            return;
        }
        return res.json();
    })
    .then(data => {
        if (!data) return;
        userProfileCache = data;
        if (data.firstName) document.getElementById('firstName').value = data.firstName;
        if (data.lastName) document.getElementById('lastName').value = data.lastName;
        if (data.email) document.getElementById('email').value = data.email;
        if (data.phone) document.getElementById('phone').value = data.phone;
        if (data.address) document.getElementById('address').value = data.address;
        if (data.gender) document.getElementById('gender').value = data.gender;
        if (data.dateOfBirth) document.getElementById('dateOfBirth').value = data.dateOfBirth.split('T')[0];
        // Always show the profile image if available
        const img = document.getElementById('profileImagePreview');
        if (img) {
            if (data.profilePicture && data.profilePicture.trim() !== '') {
                // Clean up any duplicated paths from API response
                let imagePath = data.profilePicture;
                // Remove duplicate path patterns like /assets/uploads/users//assets/uploads/users/
                imagePath = imagePath.replace(/\/assets\/uploads\/users\/\/assets\/uploads\/users\//, '/assets/uploads/users/');
                
                // Construct full URL for the profile picture
                if (imagePath.startsWith('http')) {
                    img.src = imagePath;
                } else {
                    // Remove leading slashes to avoid duplication
                    imagePath = imagePath.replace(/^\/+/, '');
                    img.src = `${API_BASE}/${imagePath}`;
                }
            } else {
                // Fallback to existing image
                img.src = '/frontend/assets/images/image.png';
            }
            img.style.display = 'block';
        }
    });

    // Handle image preview
    document.getElementById('profileImage').addEventListener('change', function (e) {
        const file = e.target.files[0];
        const img = document.getElementById('profileImagePreview');
        if (file) {
            img.src = URL.createObjectURL(file);
            img.style.display = 'block';
        }
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const msg = document.getElementById('editProfileMsg');
        if (msg) msg.classList.add('hidden');
        clearProfileFieldError('emailError');
        clearProfileFieldError('phoneError');

        
        let profilePicturePath = userProfileCache.profilePicture || '';
        const imageInput = document.getElementById('profileImage');
        if (imageInput.files && imageInput.files[0]) {
            const formData = new FormData();
            formData.append('file', imageInput.files[0]);
            const uploadRes = await fetch(API_BASE + '/api/auth/upload-profile-picture', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                },
                body: formData
            });
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                profilePicturePath = uploadData.profilePicture;
            } else {
                showAlert('editProfileMsg', 'Failed to upload image.', 'error');
                return;
            }
        }

        const payload = {
            firstName: form.firstName.value,
            lastName: form.lastName.value,
            email: form.email.value,
            phone: form.phone.value,
            address: form.address.value,
            gender: form.gender.value,
            dateOfBirth: form.dateOfBirth.value || null,
            profilePicture: profilePicturePath,
            role: userProfileCache.role || ''
        };
        fetch(API_BASE + '/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            },
            body: JSON.stringify(payload)
        })
        .then(async res => {
            if (!res.ok) {
                const errorText = await res.text();
                let result = null;

                try {
                    result = JSON.parse(errorText);
                } catch {
                    result = null;
                }

                if (result?.field === 'email') {
                    showProfileFieldError('emailError', result.error || 'Email is already registered.');
                    return;
                }

                if (result?.field === 'phone') {
                    showProfileFieldError('phoneError', result.error || 'Phone number is already registered.');
                    return;
                }

                showAlert('editProfileMsg', 'Failed to update profile.', 'error');
                console.error('Profile update error:', res.status, errorText);
                return;
            }
            return res.json();
        })
        .then(data => {
            if (!data) return;
            // Redirect to user-profile.html with a success message
            const message = encodeURIComponent('Profile updated successfully.');
            window.location.href = './user-profile.html?msg=' + message + '&type=success';
        })
        .catch(() => {
            showAlert('editProfileMsg', 'Failed to update profile.', 'error');
        });
    });
});
