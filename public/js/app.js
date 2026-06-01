document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const scheduleGrid = document.getElementById('schedule-grid');
  const bookingModal = document.getElementById('booking-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelBookingBtn = document.getElementById('cancel-booking-btn');
  const bookingForm = document.getElementById('booking-form');
  const submitBookingBtn = document.getElementById('submit-booking-btn');
  
  // Modal Fields
  const modalTourTitle = document.getElementById('modal-tour-title');
  const modalTourDate = document.getElementById('modal-tour-date');
  const modalTourTime = document.getElementById('modal-tour-time');
  const formTourId = document.getElementById('form-tour-id');
  const formTimeslotId = document.getElementById('form-timeslot-id');
  const slotsLeftWarning = document.getElementById('slots-left-warning');
  
  // Ticket Modal Elements (Vertical layout)
  const ticketModal = document.getElementById('ticket-modal');
  const ticketPassengerName = document.getElementById('ticket-passenger-name');
  const ticketTourTitle = document.getElementById('ticket-tour-title');
  const ticketTourDate = document.getElementById('ticket-tour-date');
  const ticketTourTime = document.getElementById('ticket-tour-time');
  const ticketBookingCode = document.getElementById('ticket-booking-code');
  const ticketQrCode = document.getElementById('ticket-qr-code');
  
  const closeTicketBtn = document.getElementById('close-ticket-btn');
  const downloadTicketImgBtn = document.getElementById('download-ticket-img-btn');
  const openWalletBtn = document.getElementById('open-wallet-btn');

  let activeTours = [];
  let selectedSlots = {}; // Tracks selected timeslotId per tourId
  let currentBookingData = null; // Stores last booking for wallet/download

  // --- Fetch and Load Tours ---
  async function fetchSchedule() {
    try {
      showLoading();
      const response = await fetch('/api/schedule');
      if (!response.ok) {
        throw new Error("Failed to load active schedule");
      }
      activeTours = await response.json();
      renderSchedule(activeTours);
    } catch (error) {
      console.error(error);
      scheduleGrid.innerHTML = `
        <div class="loading-spinner-wrapper" style="color: #8C4040;">
          <div style="font-size: 32px;">⚠️</div>
          <p>Unable to retrieve current departure files.</p>
          <p style="font-size: 12px; margin-top: -8px;">Please verify that the agency server is running on local port.</p>
          <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry Connection</button>
        </div>
      `;
    }
  }

  function showLoading() {
    scheduleGrid.innerHTML = `
      <div class="loading-spinner-wrapper">
        <div class="classic-spinner"></div>
        <p>Consulting agency archives...</p>
      </div>
    `;
  }

  function renderSchedule(tours) {
    if (tours.length === 0) {
      scheduleGrid.innerHTML = `
        <div class="loading-spinner-wrapper">
          <div style="font-size: 32px;">📭</div>
          <p>No departures scheduled at this time.</p>
          <p style="font-size: 12px; margin-top: -8px;">Please check back later or consult administrator.</p>
        </div>
      `;
      return;
    }

    scheduleGrid.innerHTML = '';
    
    tours.forEach(tour => {
      const card = document.createElement('article');
      card.className = 'tour-card big-brochure-card'; // spacious layout!
      
      // Render timeslots as a grid of retro stamp buttons!
      let timeslotsHtml = '';
      if (!tour.timeslots || tour.timeslots.length === 0) {
        timeslotsHtml = `<p class="no-slots-help">No active departures scheduled for this route.</p>`;
      } else {
        timeslotsHtml = `
          <div class="timeslot-selector-label">Select Your Departure Session:</div>
          <div class="timeslot-buttons-grid">
        `;
        
        tour.timeslots.forEach(slot => {
          const isFullyBooked = slot.remainingSlots <= 0;
          let badgeText = '';
          if (isFullyBooked) {
            badgeText = ' (Full)';
          } else if (slot.remainingSlots <= 2) {
            badgeText = ` (${slot.remainingSlots} left)`;
          }
          
          const isSelected = selectedSlots[tour.id] === slot.id;
          const activeClass = isSelected ? 'selected' : '';
          const disabledAttr = isFullyBooked ? 'disabled' : '';
          
          timeslotsHtml += `
            <button class="timeslot-stamp-btn ${activeClass}" 
              data-tour-id="${tour.id}" 
              data-slot-id="${slot.id}" 
              ${disabledAttr}>
              <span class="slot-time">${slot.time}</span>
              <span class="slot-date">${formatDateCompact(slot.date)}${badgeText}</span>
            </button>
          `;
        });
        
        timeslotsHtml += `</div>`;
      }

      // Check if checkout button should be active
      const hasSlots = tour.timeslots && tour.timeslots.length > 0;
      const checkoutSelected = selectedSlots[tour.id];

      card.innerHTML = `
        <div class="tour-postcard-image-wrapper">
          <!-- Double border framing representation -->
          <div class="postcard-image-inner">
            <div class="vintage-camera-placeholder">
              <svg width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1v6zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 2.172 4H2z"/><path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg>
              <span>DUST2 HERITAGE SITE</span>
            </div>
            <div class="postcard-stamp-flair">PASSPORTS APPROVED</div>
          </div>
        </div>
        
        <div class="tour-card-header">
          <h4 class="tour-title">${tour.title}</h4>
        </div>
        <div class="tour-card-body">
          <p class="tour-description">${tour.description}</p>
          
          <!-- Dynamic Timeslots Grid Matrix -->
          ${timeslotsHtml}
          
          <button class="btn btn-primary w-full checkout-boarding-btn" 
            data-tour-id="${tour.id}" 
            ${!hasSlots ? 'disabled' : ''}>
            ${checkoutSelected ? 'Request Boarding Pass' : 'Select Departure Above'}
          </button>
        </div>
      `;
      
      scheduleGrid.appendChild(card);
    });

    // Attach timeslot click listeners
    scheduleGrid.querySelectorAll('.timeslot-stamp-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.timeslot-stamp-btn');
        const tourId = targetBtn.getAttribute('data-tour-id');
        const slotId = targetBtn.getAttribute('data-slot-id');
        
        // Select slot
        selectedSlots[tourId] = slotId;
        
        // Quiet rerender to update button states and highlight selection
        renderSchedule(activeTours);
      });
    });

    // Attach checkout click listeners
    scheduleGrid.querySelectorAll('.checkout-boarding-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tourId = e.target.closest('.checkout-boarding-btn').getAttribute('data-tour-id');
        const slotId = selectedSlots[tourId];
        
        if (!slotId) {
          alert('⚠️ Passenger Alert: Please click on one of the available timeslots above before booking!');
          return;
        }
        
        openBookingDialog(tourId, slotId);
      });
    });
  }

  // --- Modal Controllers ---
  function openBookingDialog(tourId, slotId) {
    const tour = activeTours.find(t => t.id === tourId);
    if (!tour) return;

    const slot = (tour.timeslots || []).find(s => s.id === slotId);
    if (!slot) return;

    formTourId.value = tour.id;
    formTimeslotId.value = slot.id;
    
    modalTourTitle.textContent = tour.title;
    modalTourDate.textContent = formatDate(slot.date);
    modalTourTime.textContent = slot.time;
    
    // Customize warning text based on remaining slots
    if (slot.remainingSlots <= 2) {
      slotsLeftWarning.textContent = `CRITICAL EXPEDITION: Only ${slot.remainingSlots} seat manifests remain!`;
      slotsLeftWarning.style.backgroundColor = '#F0A5A5';
      slotsLeftWarning.style.color = '#5C1E1E';
    } else {
      slotsLeftWarning.textContent = 'Only 5 slots total per departure. Secure yours now.';
      slotsLeftWarning.style.backgroundColor = 'var(--accent-pink-light)';
      slotsLeftWarning.style.color = 'var(--primary-green)';
    }

    bookingForm.reset();

    bookingModal.classList.add('active');
    bookingModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Lock scrolling
  }

  function closeBookingDialog() {
    bookingModal.classList.remove('active');
    bookingModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; // Unlock scrolling
  }

  // --- Booking Submission ---
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const tourId = formTourId.value;
    const timeslotId = formTimeslotId.value;
    const name = document.getElementById('passenger-name').value;
    const email = document.getElementById('passenger-email').value;
    const phone = document.getElementById('passenger-phone').value;

    try {
      submitBookingBtn.disabled = true;
      submitBookingBtn.textContent = 'Writing Manifest...';

      const response = await fetch('/api/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tourId, timeslotId, name, email, phone })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to finalize reservation");
      }

      // Successful Booking!
      closeBookingDialog();
      showSuccessTicket(result, tourId, timeslotId);
      
      // Clear selection
      selectedSlots[tourId] = null;
      fetchSchedule(); // Refresh layout background

    } catch (error) {
      alert(`⚠️ Booking Error: ${error.message}`);
    } finally {
      submitBookingBtn.disabled = false;
      submitBookingBtn.textContent = 'Request Boarding Pass';
    }
  });

  // Close buttons
  closeModalBtn.addEventListener('click', closeBookingDialog);
  cancelBookingBtn.addEventListener('click', closeBookingDialog);
  
  // Close on outside click
  bookingModal.addEventListener('click', (e) => {
    if (e.target === bookingModal) {
      closeBookingDialog();
    }
  });

  // --- Success Boarding Ticket Render (Vertical) ---
  function showSuccessTicket(booking, tourId, timeslotId) {
    const tour = activeTours.find(t => t.id === tourId);
    if (!tour) return;

    const slot = (tour.timeslots || []).find(s => s.id === timeslotId);
    if (!slot) return;

    // Store booking data for wallet/download
    currentBookingData = {
      booking,
      tour,
      slot
    };

    // Fill vertical ticket fields
    ticketPassengerName.textContent = booking.name;
    ticketTourTitle.textContent = tour.title;
    ticketTourDate.textContent = formatDate(slot.date);
    ticketTourTime.textContent = slot.time;
    ticketBookingCode.textContent = booking.bookingCode;

    // Generate real QR code
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(booking.bookingCode)}&bgcolor=FAF6F4&color=1A3322`;
    ticketQrCode.src = qrUrl;

    // Show ticket modal
    ticketModal.classList.add('active');
    ticketModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeTicketDialog() {
    ticketModal.classList.remove('active');
    ticketModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  closeTicketBtn.addEventListener('click', closeTicketDialog);

  ticketModal.addEventListener('click', (e) => {
    if (e.target === ticketModal) {
      closeTicketDialog();
    }
  });

  // --- Download Ticket as Image (html2canvas) ---
  downloadTicketImgBtn.addEventListener('click', async () => {
    const ticketEl = document.getElementById('printable-ticket');
    if (!ticketEl) return;

    try {
      downloadTicketImgBtn.disabled = true;
      downloadTicketImgBtn.textContent = 'Generating...';

      const canvas = await html2canvas(ticketEl, {
        backgroundColor: null,
        scale: 2, // High-res for sharp mobile screenshots
        useCORS: true, // Allow cross-origin QR code image
        logging: false
      });

      const link = document.createElement('a');
      const code = currentBookingData?.booking?.bookingCode || 'ticket';
      link.download = `dust2_boarding_pass_${code}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

    } catch (err) {
      console.error('Image download failed:', err);
      alert('⚠️ Failed to generate ticket image. Please try again or take a screenshot.');
    } finally {
      downloadTicketImgBtn.disabled = false;
      downloadTicketImgBtn.innerHTML = `
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
        Download Pass
      `;
    }
  });

  // --- Open Mobile Wallet Page ---
  openWalletBtn.addEventListener('click', () => {
    if (!currentBookingData) return;

    const { booking, tour, slot } = currentBookingData;
    const params = new URLSearchParams({
      code: booking.bookingCode,
      tour: tour.title,
      slot: slot.date,
      time: slot.time,
      name: booking.name
    });

    window.open(`/wallet.html?${params.toString()}`, '_blank');
  });

  // --- Utility Formatting Helpers ---
  function formatDate(dateStr) {
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        weekday: 'short'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function formatDateCompact(dateStr) {
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        weekday: 'short'
      });
    } catch (e) {
      return dateStr;
    }
  }

  fetchSchedule();
});
