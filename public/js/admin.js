document.addEventListener('DOMContentLoaded', () => {
  // Auth Screen Elements
  const adminLoginOverlay = document.getElementById('admin-login-overlay');
  const loginCardContainer = document.getElementById('login-card-container');
  const adminLoginForm = document.getElementById('admin-login-form');
  const adminPasscodeInput = document.getElementById('admin-passcode-input');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const adminSecuredContent = document.getElementById('admin-secured-content');
  const adminLogoutBtn = document.getElementById('admin-logout-btn');

  // Core Dashboard Elements
  const bookingsTableBody = document.getElementById('bookings-table-body');
  const manifestRouteFilter = document.getElementById('manifest-route-filter');
  const manifestSearchInput = document.getElementById('manifest-search-input');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  
  // Stats Elements
  const statTotalBookings = document.getElementById('stat-total-bookings');
  const statActiveTours = document.getElementById('stat-active-tours');
  const statCheckedIn = document.getElementById('stat-checked-in');
  const statCapacityRatio = document.getElementById('stat-capacity-ratio');

  // Schedule Config Elements
  const editorToursList = document.getElementById('editor-tours-list');
  const saveScheduleConfigBtn = document.getElementById('save-schedule-config-btn');
  const configStatusHelp = document.getElementById('config-status-help');
  const openAddSessionBtn = document.getElementById('open-add-session-btn');
  
  // Add Route Modal Wizard
  const addSessionModal = document.getElementById('add-session-modal');
  const closeAddModalBtn = document.getElementById('close-add-modal-btn');
  const cancelAddBtn = document.getElementById('cancel-add-btn');
  const addSessionForm = document.getElementById('add-session-form');

  // Add Timeslot Modal Wizard (NEW!)
  const addTimeslotModal = document.getElementById('add-timeslot-modal');
  const closeTimeslotModalBtn = document.getElementById('close-timeslot-modal-btn');
  const cancelTimeslotBtn = document.getElementById('cancel-timeslot-btn');
  const addTimeslotForm = document.getElementById('add-timeslot-form');
  const timeslotTargetTourTitle = document.getElementById('timeslot-target-tour-title');
  const timeslotTargetTourId = document.getElementById('timeslot-target-tour-id');

  // Toast banner
  const toastNotification = document.getElementById('toast-notification');

  // State Memory
  let bookingsData = [];
  let scheduleData = [];
  let activeFilters = { search: '', route: 'all' };
  let isConfigDirty = false;

  // --- Auth Gating Check ---
  function getAuthToken() {
    return sessionStorage.getItem('admin_token');
  }

  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getAuthToken()
    };
  }

  function handleUnauthorized() {
    sessionStorage.removeItem('admin_token');
    adminSecuredContent.style.display = 'none';
    adminLoginOverlay.classList.add('active');
    adminLoginForm.reset();
    showToast("⚠️ Security session expired. Passcode required.", true);
  }

  // Login execution
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = adminPasscodeInput.value;

    try {
      loginErrorMsg.textContent = '';
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Authentication failed");
      }

      // Success!
      sessionStorage.setItem('admin_token', result.token);
      adminLoginOverlay.classList.remove('active');
      adminSecuredContent.style.display = 'block';
      fetchAdminData();
      showToast("Access granted. Terminal synchronized.");

    } catch (error) {
      console.error(error);
      loginErrorMsg.textContent = error.message;
      
      // Trigger card shake animation
      loginCardContainer.classList.add('shake');
      setTimeout(() => {
        loginCardContainer.classList.remove('shake');
      }, 500);
    }
  });

  // Logout execution
  adminLogoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('admin_token');
    location.reload();
  });

  // Check initial token presence on load
  if (getAuthToken()) {
    adminLoginOverlay.classList.remove('active');
    adminSecuredContent.style.display = 'block';
    fetchAdminData();
  }

  // --- Fetch System Records ---
  async function fetchAdminData() {
    const token = getAuthToken();
    if (!token) return;

    try {
      const bookingsResponse = await fetch('/api/admin/bookings', { headers: getHeaders() });
      
      if (bookingsResponse.status === 401) {
        handleUnauthorized();
        return;
      }

      const scheduleResponse = await fetch('/api/schedule');

      if (!bookingsResponse.ok || !scheduleResponse.ok) {
        throw new Error("Unable to read registry files");
      }

      const bookingsResult = await bookingsResponse.json();
      bookingsData = bookingsResult.bookings;
      scheduleData = await scheduleResponse.json();

      updateStats(bookingsResult.stats);
      populateRouteFilter(scheduleData);
      renderManifest();
      renderConfigEditor();

    } catch (error) {
      console.error(error);
      showToast("⚠️ Failed to load administrative records", true);
    }
  }

  // --- Stats Updater ---
  function updateStats(stats) {
    statTotalBookings.textContent = stats.totalBookings;
    statActiveTours.textContent = stats.activeTours;
    statCheckedIn.textContent = stats.checkedInCount;
    
    const ratio = stats.totalSlotsAvailable > 0 
      ? Math.round((stats.totalBookings / stats.totalSlotsAvailable) * 100)
      : 0;
    
    statCapacityRatio.textContent = `${ratio}%`;
  }

  // Populate Route Dropdown Filter
  function populateRouteFilter(schedule) {
    const currentVal = manifestRouteFilter.value;
    
    manifestRouteFilter.innerHTML = '<option value="all">All Excursions</option>';
    schedule.forEach(tour => {
      const opt = document.createElement('option');
      opt.value = tour.id;
      opt.textContent = tour.title;
      manifestRouteFilter.appendChild(opt);
    });

    manifestRouteFilter.value = currentVal;
  }

  // --- Render Passenger Manifest ---
  function renderManifest() {
    const filtered = bookingsData.filter(booking => {
      if (activeFilters.route !== 'all' && booking.tourId !== activeFilters.route) {
        return false;
      }
      
      if (activeFilters.search) {
        const query = activeFilters.search.toLowerCase();
        const nameMatch = booking.name.toLowerCase().includes(query);
        const emailMatch = booking.email.toLowerCase().includes(query);
        const refMatch = booking.bookingCode.toLowerCase().includes(query);
        return nameMatch || emailMatch || refMatch;
      }

      return true;
    });

    if (filtered.length === 0) {
      bookingsTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center italic text-muted py-8">
            No passengers match active ledger filters.
          </td>
        </tr>
      `;
      return;
    }

    bookingsTableBody.innerHTML = '';
    
    filtered.forEach(booking => {
      const tr = document.createElement('tr');
      
      const phoneText = booking.phone ? ` • Tel: ${booking.phone}` : '';
      const checkinChecked = booking.checkedIn ? 'checked' : '';
      const statusText = booking.checkedIn ? 'Checked-In' : 'Pending';
      const statusClass = booking.checkedIn ? 'checked' : 'pending';

      tr.innerHTML = `
        <td>
          <span class="monospace" style="font-weight: bold; font-size: 14px;">${booking.bookingCode}</span>
        </td>
        <td>
          <div class="passenger-meta">
            <span class="passenger-name-text">${booking.name}</span>
            <span class="passenger-sub-text">${booking.email}${phoneText}</span>
          </div>
        </td>
        <td>
          <div class="passenger-meta">
            <span class="route-meta-text">${booking.sessionTitle}</span>
            <span class="route-time-text">Departure: ${formatDate(booking.sessionDate)} at ${booking.sessionTime}</span>
          </div>
        </td>
        <td>
          <label class="toggle-switch-label">
            <div class="toggle-switch">
              <input type="checkbox" class="checkin-toggle-input" data-id="${booking.id}" ${checkinChecked}>
              <span class="toggle-slider"></span>
            </div>
            <span class="toggle-status-text ${statusClass}">${statusText}</span>
          </label>
        </td>
        <td class="text-right">
          <button class="btn btn-danger btn-sm cancel-booking-btn" data-id="${booking.id}">
            Cancel Slot
          </button>
        </td>
      `;
      
      bookingsTableBody.appendChild(tr);
    });

    bookingsTableBody.querySelectorAll('.checkin-toggle-input').forEach(input => {
      input.addEventListener('change', handleCheckinToggle);
    });

    bookingsTableBody.querySelectorAll('.cancel-booking-btn').forEach(btn => {
      btn.addEventListener('click', handleCancelBooking);
    });
  }

  // Handle passenger Check-in API update
  async function handleCheckinToggle(e) {
    const bookingId = e.target.getAttribute('data-id');
    const checkedIn = e.target.checked;
    
    const textSpan = e.target.parentElement.nextElementSibling;
    textSpan.textContent = checkedIn ? 'Checked-In' : 'Pending';
    textSpan.className = `toggle-status-text ${checkedIn ? 'checked' : 'pending'}`;

    try {
      const response = await fetch('/api/admin/checkin', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ bookingId, checkedIn })
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("API Check-in update failed");
      }

      fetchAdminData();
      showToast("Checked-in manifest status updated");

    } catch (error) {
      console.error(error);
      showToast("⚠️ Connection error: Failed to record check-in", true);
      e.target.checked = !checkedIn;
      textSpan.textContent = !checkedIn ? 'Checked-In' : 'Pending';
      textSpan.className = `toggle-status-text ${!checkedIn ? 'checked' : 'pending'}`;
    }
  }

  // Handle Cancel passenger Booking
  async function handleCancelBooking(e) {
    const btn = e.target.closest('.cancel-booking-btn');
    if (!btn) return;
    
    const bookingId = btn.getAttribute('data-id');
    const targetBooking = bookingsData.find(b => b.id === bookingId);
    if (!targetBooking) return;

    const confirmCancel = confirm(`⚠️ Are you sure you want to cancel the booking for passenger "${targetBooking.name}"?\nThis slot will immediately open up for other online customers.`);
    if (!confirmCancel) return;

    try {
      const response = await fetch('/api/admin/cancel', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ bookingId })
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Cancellation request rejected");
      }

      showToast(`Cancelled reservation for ${targetBooking.name}`);
      fetchAdminData();

    } catch (error) {
      console.error(error);
      showToast("⚠️ Server Error: Unable to delete reservation", true);
    }
  }

  // --- Schedule Config Editor (Right Panel) ---
  function renderConfigEditor() {
    if (scheduleData.length === 0) {
      editorToursList.innerHTML = `
        <div class="loading-spinner-wrapper">
          <div style="font-size: 24px;">📭</div>
          <p>Schedule is empty. Add a tour route to start.</p>
        </div>
      `;
      return;
    }

    editorToursList.innerHTML = '';
    
    scheduleData.forEach(tour => {
      const div = document.createElement('div');
      div.className = `editor-tour-item ${isConfigDirty ? 'changed' : ''}`;
      
      // Render nested timeslots list
      let timeslotsListHtml = '';
      if (!tour.timeslots || tour.timeslots.length === 0) {
        timeslotsListHtml = `<p class="italic text-muted" style="font-size: 11px; margin: 10px 0;">No active timeslot departures scheduled.</p>`;
      } else {
        timeslotsListHtml = `
          <table class="nested-slots-table" style="width: 100%; font-size: 12px; margin: 10px 0; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid var(--primary-green); text-align: left;">
                <th style="padding: 4px 0;">Date</th>
                <th style="padding: 4px 0;">Time</th>
                <th style="padding: 4px 0;">Cap</th>
                <th style="padding: 4px 0; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
        `;
        
        tour.timeslots.forEach(slot => {
          timeslotsListHtml += `
            <tr style="border-bottom: 1px solid rgba(26,51,34,0.06);">
              <td style="padding: 6px 0;">📅 ${formatDate(slot.date)}</td>
              <td style="padding: 6px 0;">⏰ ${slot.time}</td>
              <td style="padding: 6px 0;">👤 ${slot.maxSlots || 5} Pax</td>
              <td style="padding: 6px 0; text-align: right;">
                <button type="button" class="btn btn-danger btn-sm delete-timeslot-btn" 
                  data-tour-id="${tour.id}" 
                  data-slot-id="${slot.id}" 
                  style="padding: 2px 6px; font-size: 9px; border-width: 1px;">
                  &times; Delete
                </button>
              </td>
            </tr>
          `;
        });
        
        timeslotsListHtml += `</tbody></table>`;
      }

      div.innerHTML = `
        <h4 class="editor-tour-title" style="margin-bottom: 2px;">${tour.title}</h4>
        <p class="editor-tour-desc" style="margin-bottom: 8px;">${tour.description}</p>
        
        <div style="background-color: var(--accent-pink-light); padding: 12px; border-radius: 4px; border: var(--border-thin);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--primary-green); padding-bottom: 6px;">
            <strong style="font-size: 11px; text-transform: uppercase; color: var(--primary-green);">Scheduled Departures:</strong>
            <button type="button" class="btn btn-primary btn-sm open-add-timeslot-btn" 
              data-tour-id="${tour.id}" 
              data-tour-title="${tour.title}"
              style="padding: 2px 8px; font-size: 9px; border-width: 1px;">
              + Add Slot
            </button>
          </div>
          ${timeslotsListHtml}
        </div>
        
        <div class="editor-tour-actions" style="margin-top: 14px;">
          <span></span>
          <button class="btn btn-danger btn-sm btn-icon delete-session-btn" data-id="${tour.id}">
            &times; Delete Route
          </button>
        </div>
      `;
      
      editorToursList.appendChild(div);
    });

    // Attach route delete triggers
    editorToursList.querySelectorAll('.delete-session-btn').forEach(btn => {
      btn.addEventListener('click', handleDeleteSession);
    });

    // Attach open timeslot modal triggers
    editorToursList.querySelectorAll('.open-add-timeslot-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.open-add-timeslot-btn');
        const tourId = targetBtn.getAttribute('data-tour-id');
        const tourTitle = targetBtn.getAttribute('data-tour-title');
        
        openAddTimeslotDialog(tourId, tourTitle);
      });
    });

    // Attach timeslot delete triggers
    editorToursList.querySelectorAll('.delete-timeslot-btn').forEach(btn => {
      btn.addEventListener('click', handleDeleteTimeslot);
    });
  }

  // Open add timeslot wizard
  function openAddTimeslotDialog(tourId, tourTitle) {
    timeslotTargetTourId.value = tourId;
    timeslotTargetTourTitle.textContent = tourTitle;
    
    addTimeslotForm.reset();
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    document.getElementById('new-slot-date').value = nextWeek.toISOString().substring(0, 10);
    
    addTimeslotModal.classList.add('active');
    addTimeslotModal.setAttribute('aria-hidden', 'false');
  }

  function closeAddTimeslotDialog() {
    addTimeslotModal.classList.remove('active');
    addTimeslotModal.setAttribute('aria-hidden', 'true');
  }

  closeTimeslotModalBtn.addEventListener('click', closeAddTimeslotDialog);
  cancelTimeslotBtn.addEventListener('click', closeAddTimeslotDialog);

  // Submit add timeslot
  addTimeslotForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const tourId = timeslotTargetTourId.value;
    const date = document.getElementById('new-slot-date').value;
    const time = document.getElementById('new-slot-time').value;
    const maxSlots = parseInt(document.getElementById('new-slot-capacity').value) || 5;

    const tour = scheduleData.find(t => t.id === tourId);
    if (!tour) return;

    tour.timeslots = tour.timeslots || [];
    
    // Create slot object
    const newSlot = {
      id: 'slot-' + Date.now(),
      date,
      time,
      maxSlots
    };

    tour.timeslots.push(newSlot);
    
    setConfigDirtyState(true);
    closeAddTimeslotDialog();
    renderConfigEditor();
    
    showToast(`Added timeslot departure: ${date} at ${time}`);
  });

  // Delete timeslot from memory
  function handleDeleteTimeslot(e) {
    const btn = e.target.closest('.delete-timeslot-btn');
    if (!btn) return;

    const tourId = btn.getAttribute('data-tour-id');
    const slotId = btn.getAttribute('data-slot-id');
    
    const tour = scheduleData.find(t => t.id === tourId);
    if (!tour) return;

    const slot = (tour.timeslots || []).find(s => s.id === slotId);
    if (!slot) return;

    // Check if bookings exist for this slot
    const bookingsCount = bookingsData.filter(b => b.timeslotId === slotId).length;
    let message = `Are you sure you want to delete the timeslot departure "${slot.date} at ${slot.time}"?`;
    if (bookingsCount > 0) {
      message += `\n\n⚠️ WARNING: There are active passenger manifests (${bookingsCount} bookings) for this timeslot! Deleting it will permanently clear these bookings as well.`;
    }

    if (!confirm(message)) return;

    tour.timeslots = tour.timeslots.filter(s => s.id !== slotId);
    setConfigDirtyState(true);
    renderConfigEditor();
  }

  // Delete route from memory list
  function handleDeleteSession(e) {
    const btn = e.target.closest('.delete-session-btn');
    if (!btn) return;

    const tourId = btn.getAttribute('data-id');
    const targetTour = scheduleData.find(t => t.id === tourId);
    if (!targetTour) return;

    // Count bookings across all timeslots of this tour
    const activeSlots = (targetTour.timeslots || []).map(s => s.id);
    const bookingsCount = bookingsData.filter(b => activeSlots.includes(b.timeslotId)).length;
    
    let message = `Are you sure you want to delete the entire excursion route "${targetTour.title}"?`;
    if (bookingsCount > 0) {
      message += `\n\n⚠️ WARNING: There are active passenger manifests (${bookingsCount} bookings) across the scheduled timeslots of this route! Deleting the route will permanently clear these bookings as well.`;
    }

    if (!confirm(message)) return;

    scheduleData = scheduleData.filter(t => t.id !== tourId);
    setConfigDirtyState(true);
    renderConfigEditor();
  }

  // State setter for dirty config modifications
  function setConfigDirtyState(isDirty) {
    isConfigDirty = isDirty;
    saveScheduleConfigBtn.disabled = !isDirty;
    
    if (isDirty) {
      configStatusHelp.textContent = "You have unsaved changes in your schedule configuration!";
      configStatusHelp.className = "config-status-help dirty";
    } else {
      configStatusHelp.textContent = "Schedule configuration is synchronized";
      configStatusHelp.className = "config-status-help synced";
    }
  }

  // Save Schedule Config Array back to backend schedule.json
  saveScheduleConfigBtn.addEventListener('click', async () => {
    try {
      saveScheduleConfigBtn.disabled = true;
      saveScheduleConfigBtn.textContent = 'Writing config...';

      const response = await fetch('/api/admin/schedule', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(scheduleData)
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to write schedule file");
      }

      showToast("Successfully updated schedule.json config file");
      setConfigDirtyState(false);
      fetchAdminData();

    } catch (error) {
      console.error(error);
      showToast("⚠️ Config Write Error: Unable to synchronize schedule.json", true);
      saveScheduleConfigBtn.disabled = false;
    } finally {
      saveScheduleConfigBtn.textContent = 'Write Changes to schedule.json';
    }
  });

  // --- Add Route Modal Form ---
  openAddSessionBtn.addEventListener('click', () => {
    addSessionForm.reset();
    addSessionModal.classList.add('active');
    addSessionModal.setAttribute('aria-hidden', 'false');
  });

  function closeAddModal() {
    addSessionModal.classList.remove('active');
    addSessionModal.setAttribute('aria-hidden', 'true');
  }

  closeAddModalBtn.addEventListener('click', closeAddModal);
  cancelAddBtn.addEventListener('click', closeAddModal);
  
  addSessionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const title = document.getElementById('new-session-title').value.trim();
    const description = document.getElementById('new-session-desc').value.trim();

    const newTour = {
      id: 'tour-' + Date.now(),
      title,
      description,
      image: "",
      timeslots: []
    };

    scheduleData.push(newTour);
    setConfigDirtyState(true);
    closeAddModal();
    renderConfigEditor();
    
    showToast(`Added tour route: "${title}"`);
  });

  // --- Export CSV Manifests Download ---
  exportCsvBtn.addEventListener('click', () => {
    const filtered = bookingsData.filter(booking => {
      if (activeFilters.route !== 'all' && booking.tourId !== activeFilters.route) return false;
      if (activeFilters.search) {
        const query = activeFilters.search.toLowerCase();
        const nameMatch = booking.name.toLowerCase().includes(query);
        const emailMatch = booking.email.toLowerCase().includes(query);
        const refMatch = booking.bookingCode.toLowerCase().includes(query);
        return nameMatch || emailMatch || refMatch;
      }
      return true;
    });

    if (filtered.length === 0) {
      showToast("⚠️ Export Cancelled: Manifest selection is empty", true);
      return;
    }

    const headers = ["Booking Reference", "Passenger Name", "Contact Email", "Contact Phone", "Tour Route", "Date", "Departure Time", "Check-In Boarded", "Created Date"];
    const rows = filtered.map(b => [
      b.bookingCode,
      `"${b.name.replace(/"/g, '""')}"`,
      b.email,
      b.phone || 'N/A',
      `"${b.sessionTitle.replace(/"/g, '""')}"`,
      b.sessionDate,
      b.sessionTime,
      b.checkedIn ? 'YES' : 'NO',
      b.createdAt
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodedUri);
    downloadAnchor.setAttribute('download', `dust2_tours_passenger_manifest_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(downloadAnchor);
    
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    
    showToast("Manifest ledger CSV successfully downloaded");
  });

  // --- Live Filters Listener ---
  manifestSearchInput.addEventListener('input', (e) => {
    activeFilters.search = e.target.value.trim();
    renderManifest();
  });

  manifestRouteFilter.addEventListener('change', (e) => {
    activeFilters.route = e.target.value;
    renderManifest();
  });

  // --- Toast Notification Display ---
  let toastTimer;
  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toastNotification.textContent = message;
    
    if (isError) {
      toastNotification.classList.add('error');
    } else {
      toastNotification.classList.remove('error');
    }

    toastNotification.classList.add('active');
    
    toastTimer = setTimeout(() => {
      toastNotification.classList.remove('active');
    }, 4000);
  }

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

  // --- QR Scanner Implementation ---
  const openScannerBtn = document.getElementById('open-scanner-btn');
  const scannerModalOverlay = document.getElementById('scanner-modal-overlay');
  const closeScannerBtn = document.getElementById('close-scanner-btn');
  const scannerResultCard = document.getElementById('scanner-result-card');
  const scannerResultTitle = document.getElementById('scanner-result-title');
  const scannerResultDetails = document.getElementById('scanner-result-details');
  const scanAgainBtn = document.getElementById('scan-again-btn');

  let html5QrCode = null;

  // Web Audio sounds
  function playSuccessBeep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn("Audio Context blocked or not supported:", e);
    }
  }

  function playErrorBeep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime); // low buzz
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn("Audio Context blocked or not supported:", e);
    }
  }

  async function startScanner() {
    scannerResultCard.className = 'scanner-result-card';
    scannerResultCard.style.display = 'none';
    scanAgainBtn.style.display = 'none';

    try {
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("qr-reader");
      }
      
      const config = { 
        fps: 10, 
        qrbox: (width, height) => {
          const size = Math.min(width, height) * 0.7;
          return { width: size, height: size };
        }
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        onQrSuccess
      );
    } catch (err) {
      console.error("Camera startup failed:", err);
      scannerResultCard.className = 'scanner-result-card error';
      scannerResultCard.style.display = 'block';
      scannerResultTitle.textContent = 'CAMERA ERROR';
      scannerResultDetails.innerHTML = `<p style="color: #721C24;">Unable to access or stream from rear camera. Please ensure camera permissions are allowed.</p>`;
    }
  }

  async function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
      try {
        await html5QrCode.stop();
      } catch (err) {
        console.error("Failed to stop scanner camera stream:", err);
      }
    }
  }

  async function onQrSuccess(decodedText) {
    // Immediately stop scanning so it doesn't trigger multiple API calls
    await stopScanner();

    // Call API to look up and check-in
    try {
      scannerResultCard.className = 'scanner-result-card';
      scannerResultCard.style.display = 'none';

      const response = await fetch('/api/admin/scan-lookup', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ bookingCode: decodedText })
      });

      if (response.status === 401) {
        handleUnauthorized();
        closeScannerDialog();
        return;
      }

      const result = await response.json();

      if (response.status === 404) {
        playErrorBeep();
        scannerResultCard.className = 'scanner-result-card error';
        scannerResultCard.style.display = 'block';
        scannerResultTitle.textContent = 'INVALID TICKET';
        scannerResultDetails.innerHTML = `<p style="color: #721C24;">${result.error || "No booking matched this QR code reference."}</p>`;
        scanAgainBtn.style.display = 'block';
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || "Server scan verification failed");
      }

      const { booking, alreadyCheckedIn } = result;

      if (alreadyCheckedIn) {
        playErrorBeep();
        scannerResultCard.className = 'scanner-result-card already';
        scannerResultCard.style.display = 'block';
        scannerResultTitle.textContent = 'ALREADY CHECKED IN';
        scannerResultDetails.innerHTML = `
          <p style="color: #856404; font-weight: bold; margin-bottom: 6px;">⚠️ THIS BOARDING PASS WAS PREVIOUSLY SPAN-CHECKED!</p>
          <div style="font-size: 12px; margin-top: 4px;">
            <strong>Ref Code:</strong> ${booking.bookingCode}<br>
            <strong>Passenger:</strong> ${booking.name}<br>
            <strong>Excursion:</strong> ${booking.sessionTitle}<br>
            <strong>Departure:</strong> ${formatDate(booking.sessionDate)} at ${booking.sessionTime}
          </div>
        `;
      } else {
        playSuccessBeep();
        scannerResultCard.className = 'scanner-result-card success';
        scannerResultCard.style.display = 'block';
        scannerResultTitle.textContent = 'BOARDING PASSED';
        scannerResultDetails.innerHTML = `
          <p style="color: #1A3322; font-weight: bold; margin-bottom: 6px;">✅ BOARDING SPAN COMPLETED SUCCESSFULLY!</p>
          <div style="font-size: 12px; margin-top: 4px;">
            <strong>Ref Code:</strong> ${booking.bookingCode}<br>
            <strong>Passenger:</strong> ${booking.name}<br>
            <strong>Excursion:</strong> ${booking.sessionTitle}<br>
            <strong>Departure:</strong> ${formatDate(booking.sessionDate)} at ${booking.sessionTime}
          </div>
        `;
        // Refresh background stats and manifest lists
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
      playErrorBeep();
      scannerResultCard.className = 'scanner-result-card error';
      scannerResultCard.style.display = 'block';
      scannerResultTitle.textContent = 'SCAN FAILURE';
      scannerResultDetails.innerHTML = `<p style="color: #721C24;">${err.message || "Failed to contact database terminal server."}</p>`;
    }

    scanAgainBtn.style.display = 'block';
  }

  function openScannerDialog() {
    scannerModalOverlay.classList.add('active');
    scannerModalOverlay.setAttribute('aria-hidden', 'false');
    startScanner();
  }

  async function closeScannerDialog() {
    scannerModalOverlay.classList.remove('active');
    scannerModalOverlay.setAttribute('aria-hidden', 'true');
    await stopScanner();
  }

  if (openScannerBtn) {
    openScannerBtn.addEventListener('click', openScannerDialog);
  }
  if (closeScannerBtn) {
    closeScannerBtn.addEventListener('click', closeScannerDialog);
  }
  if (scanAgainBtn) {
    scanAgainBtn.addEventListener('click', startScanner);
  }
});
