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
  const modalTourPrice = document.getElementById('modal-tour-price');
  const modalTourDate = document.getElementById('modal-tour-date');
  const modalTourTime = document.getElementById('modal-tour-time');
  const formSessionId = document.getElementById('form-session-id');
  const slotsLeftWarning = document.getElementById('slots-left-warning');
  
  // Ticket Modal Elements
  const ticketModal = document.getElementById('ticket-modal');
  const ticketPassengerName = document.getElementById('ticket-passenger-name');
  const ticketTourTitle = document.getElementById('ticket-tour-title');
  const ticketTourDate = document.getElementById('ticket-tour-date');
  const ticketTourTime = document.getElementById('ticket-tour-time');
  const ticketTourPrice = document.getElementById('ticket-tour-price');
  const ticketBookingCode = document.getElementById('ticket-booking-code');
  const ticketBarcodeNum = document.getElementById('ticket-barcode-num');
  
  const stubPassengerName = document.getElementById('stub-passenger-name');
  const stubTourId = document.getElementById('stub-tour-id');
  const stubBookingCode = document.getElementById('stub-booking-code');
  
  const closeTicketBtn = document.getElementById('close-ticket-btn');
  const printTicketBtn = document.getElementById('print-ticket-btn');

  let activeSessions = [];

  // --- Fetch and Load Tours ---
  async function fetchSchedule() {
    try {
      showLoading();
      const response = await fetch('/api/schedule');
      if (!response.ok) {
        throw new Error("Failed to load active schedule");
      }
      activeSessions = await response.json();
      renderSchedule(activeSessions);
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

  function renderSchedule(sessions) {
    if (sessions.length === 0) {
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
    
    sessions.forEach(session => {
      const card = document.createElement('article');
      card.className = 'tour-card';
      
      const isFullyBooked = session.remainingSlots <= 0;
      const capacityStatusText = isFullyBooked 
        ? 'FULLY BOOKED' 
        : `${session.remainingSlots} SLOTS LEFT`;
      
      const bannerClass = isFullyBooked 
        ? 'tour-capacity-banner fully-booked' 
        : 'tour-capacity-banner';

      // Highlight urgent availability (e.g. 1 or 2 slots remaining)
      const warningStyle = (!isFullyBooked && session.remainingSlots <= 2)
        ? 'color: #8C4040; font-weight: bold;'
        : '';

      card.innerHTML = `
        <div class="tour-card-header">
          <span class="tour-price-badge">${session.price || 'Free'}</span>
          <h4 class="tour-title">${session.title}</h4>
          <div class="tour-meta-list">
            <div class="tour-meta-item">
              <span>📅 ${formatDate(session.date)}</span>
            </div>
            <div class="tour-meta-item">
              <span>⏰ ${session.time}</span>
            </div>
          </div>
        </div>
        <div class="tour-card-body">
          <p class="tour-description">${session.description}</p>
          
          <div class="${bannerClass}">
            <span class="capacity-label">Manifest Slots</span>
            <span class="capacity-status" style="${warningStyle}">${capacityStatusText}</span>
          </div>
          
          <button class="btn btn-primary w-full" 
            data-id="${session.id}" 
            ${isFullyBooked ? 'disabled' : ''}>
            ${isFullyBooked ? 'Departure Closed' : 'Request Boarding Pass'}
          </button>
        </div>
      `;
      
      scheduleGrid.appendChild(card);
    });

    // Add event listeners to buttons
    const bookButtons = scheduleGrid.querySelectorAll('.btn-primary');
    bookButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = e.target.getAttribute('data-id');
        openBookingDialog(sessionId);
      });
    });
  }

  // --- Modal Controllers ---
  function openBookingDialog(sessionId) {
    const session = activeSessions.find(s => s.id === sessionId);
    if (!session) return;

    formSessionId.value = session.id;
    modalTourTitle.textContent = session.title;
    modalTourPrice.textContent = `PRICE: ${session.price || 'FREE'}`;
    modalTourDate.textContent = formatDate(session.date);
    modalTourTime.textContent = session.time;
    
    // Customize warning text based on remaining slots
    if (session.remainingSlots <= 2) {
      slotsLeftWarning.textContent = `CRITICAL DEPARTURE: Only ${session.remainingSlots} seat manifests remain!`;
      slotsLeftWarning.style.backgroundColor = '#F0A5A5';
      slotsLeftWarning.style.color = '#5C1E1E';
    } else {
      slotsLeftWarning.textContent = 'Only 5 slots total per expedition. Secure yours now.';
      slotsLeftWarning.style.backgroundColor = 'var(--accent-pink-light)';
      slotsLeftWarning.style.color = 'var(--primary-green)';
    }

    // Reset Form fields
    bookingForm.reset();

    // Show modal
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
    
    const sessionId = formSessionId.value;
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
        body: JSON.stringify({ sessionId, name, email, phone })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to finalize reservation");
      }

      // Successful Booking!
      closeBookingDialog();
      showSuccessTicket(result, sessionId);
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

  // --- Success Boarding Ticket Render ---
  function showSuccessTicket(booking, sessionId) {
    const session = activeSessions.find(s => s.id === sessionId);
    if (!session) return;

    // Fill main ticket
    ticketPassengerName.textContent = booking.name;
    ticketTourTitle.textContent = session.title;
    ticketTourDate.textContent = formatDate(session.date);
    ticketTourTime.textContent = session.time;
    ticketTourPrice.textContent = session.price || 'FREE';
    ticketBookingCode.textContent = booking.bookingCode;
    ticketBarcodeNum.textContent = booking.bookingCode;

    // Fill tear-off stub
    stubPassengerName.textContent = abbreviateName(booking.name);
    stubTourId.textContent = session.id.toUpperCase();
    stubBookingCode.textContent = booking.bookingCode.substring(3); // Grab short version

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
  printTicketBtn.addEventListener('click', () => {
    window.print();
  });

  // Close ticket on outside click
  ticketModal.addEventListener('click', (e) => {
    if (e.target === ticketModal) {
      closeTicketDialog();
    }
  });

  // --- Utility Formatting Helpers ---
  function formatDate(dateStr) {
    // converts YYYY-MM-DD to beautiful localized format
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

  function abbreviateName(fullName) {
    const parts = fullName.trim().split(' ');
    if (parts.length <= 1) return fullName;
    const firstInitial = parts[0].substring(0, 1) + '.';
    const lastName = parts[parts.length - 1];
    return `${firstInitial} ${lastName}`;
  }

  // --- Initial Launch ---
  fetchSchedule();
});
