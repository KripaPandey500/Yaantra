// Review Modal Logic
function openReviewModal(bookingId) {
	document.getElementById('reviewBookingId').value = bookingId;
	document.getElementById('reviewModal').classList.remove('hidden');
	resetStars();
}
function closeReviewModal() {
	document.getElementById('reviewModal').classList.add('hidden');
}
function resetStars() {
	document.querySelectorAll('#reviewModal .star').forEach(star => {
		star.classList.remove('text-yellow-400');
		star.classList.add('text-gray-300');
	});
	document.getElementById('reviewRating').value = '';
}

// Combine all DOMContentLoaded logic into one listener
document.addEventListener('DOMContentLoaded', function () {
	
	document.querySelectorAll('#reviewModal .star').forEach(star => {
		star.addEventListener('click', function() {
			const value = this.getAttribute('data-value');
			document.getElementById('reviewRating').value = value;
			document.querySelectorAll('#reviewModal .star').forEach((s, idx) => {
				if (idx < value) {
					s.classList.add('text-yellow-400');
					s.classList.remove('text-gray-300');
				} else {
					s.classList.remove('text-yellow-400');
					s.classList.add('text-gray-300');
				}
			});
		});
	});

	// Review form submission logic
	const reviewForm = document.getElementById('reviewForm');
	if (!reviewForm) return;

	reviewForm.addEventListener('submit', async function(e) {
		e.preventDefault();

		const bookingId = document.getElementById('reviewBookingId').value;
		const rating = document.getElementById('reviewRating').value;
		const comment = document.getElementById('reviewComment').value;
		const token = localStorage.getItem('token');

		if (!token) {
			alert('You must be logged in to submit a review.');
			return;
		}
		if (!bookingId || !rating || !comment) {
			alert('Please provide all review details.');
			return;
		}

		try {
			const response = await fetch('http://localhost:5033/api/Reviews/booking', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					bookingId: parseInt(bookingId, 10),
					rating: parseInt(rating, 10),
					comment: comment
				})
			});

			let result = {};
			try {
				result = await response.json();
			} catch (jsonErr) {
				
			}

			if (!response.ok) {
				// Try to show the most relevant error message
				let msg = result.error || result.message || response.statusText || 'Failed to submit review.';
				// If ModelState errors
				if (result.errors) {
					msg = Object.values(result.errors).flat().join('\n');
				}
				alert(msg);
				// Log full error for debugging
				console.error('Review submission error:', result);
				return;
			}

			   closeReviewModal();
			   alert('Thank you for your review!');
			   
			   const reviewBtn = document.querySelector(`button[onclick="openReviewModal(${bookingId})"]`);
			   if (reviewBtn) {
				   reviewBtn.remove();
			   }
			   if (typeof loadUserBookings === 'function') {
				   loadUserBookings(document.getElementById('bookingTable'));
			   }
		} catch (err) {
			alert('Review already done.');
			   console.error('Review submission failed or already done.', err);
		}
	});
});
