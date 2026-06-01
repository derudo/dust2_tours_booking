document.addEventListener('DOMContentLoaded', () => {
  // Elements
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
  
  // Add Modal Wizard
  const addSessionModal = document.getElementById('add-session-modal');
  const closeAddModalBtn = document.getElementById('close-add-modal-btn');
  const cancelAddBtn = document.getElementById('cancel-add-btn');
  const addSessionForm = document.getElementById('add-session-form');

  // Toast banner
  const toastNotification = document.getElementById('toast-notification');

  // State Memory
  let bookingsData = [];
  let scheduleData = [];
  let activeFilters = { search: '', route: 'all' };
  let isConfigDirty = false;

  // --- Fetch System Records ---
  async function fetchAdminData() {
    try {
      const bookingsResponse = await fetch('/api/admin/bookings');
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
    // Keep current selection
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
      // Apply Route filter
      if (activeFilters.route !== 'all' && booking.sessionId !== activeFilters.route) {
        return false;
      }
      
      // Apply Search query
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

    // Attach row triggers
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
    
    // Optimistic UI updates
    const textSpan = e.target.parentElement.nextElementSibling;
    textSpan.textContent = checkedIn ? 'Checked-In' : 'Pending';
    textSpan.className = `toggle-status-text ${checkedIn ? 'checked' : 'pending'}`;

    try {
      const response = await fetch('/api/admin/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, checkedIn })
      });

      if (!response.ok) {
        throw new Error("API Check-in update failed");
      }

      // Refresh records quietly to sync stats
      fetchAdminData();
      showToast("Checked-in manifest status updated");

    } catch (error) {
      console.error(error);
      showToast("⚠️ Connection error: Failed to record check-in", true);
      e.target.checked = !checkedIn; // rollback
      textSpan.textContent = !checkedIn ? 'Checked-In' : 'Pending';
      textSpan.className = `toggle-status-text ${!checkedIn ? 'checked' : 'pending'}`;
    }
  }

  // Handle Cancel passenger Booking
  async function handleCancelBooking(e) {
    const bookingId = e.target.getAttribute('data-id');
    const targetBooking = bookingsData.find(b => b.id === bookingId);
    if (!targetBooking) return;

    const confirmCancel = confirm(`⚠️ Are you sure you want to cancel the booking for passenger "${targetBooking.name}"?\nThis slot will immediately open up for other online customers.`);
    
    if (!confirmCancel) return;

    try {
      const response = await fetch('/api/admin/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId })
      });

      if (!response.ok) {
        throw new Error("Cancellation request rejected");
      }

      showToast(`Cancelled reservation for ${targetBooking.name}`);
      fetchAdminData(); // Full refresh manifest lists

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
          <p>Schedule is empty. Add a departure session to start.</p>
        </div>
      `;
      return;
    }

    editorToursList.innerHTML = '';
    
    scheduleData.forEach(tour => {
      const div = document.createElement('div');
      // Style changed configurations visually using the changed class
      div.className = `editor-tour-item ${isConfigDirty ? 'changed' : ''}`;
      
      div.innerHTML = `
        <h4 class="editor-tour-title">${tour.title}</h4>
        <div class="editor-tour-meta">
          📅 ${formatDate(tour.date)} • ⏰ ${tour.time} • 🎫 ${tour.price || 'Free'}
        </div>
        <p class="editor-tour-desc">${tour.description}</p>
        
        <div class="editor-tour-actions">
          <span class="capacity-badge-pill">${tour.maxSlots || 5} Pax Maximum Capacity</span>
          <button class="btn btn-danger btn-sm btn-icon delete-session-btn" data-id="${tour.id}">
            &times; Remove Tour
          </button>
        </div>
      `;
      
      editorToursList.appendChild(div);
    });

    // Add remove actions
    editorToursList.querySelectorAll('.delete-session-btn').forEach(btn => {
      btn.addEventListener('click', handleDeleteSession);
    });
  }

  // Delete session from memory list
  function handleDeleteSession(e) {
    const sessionId = e.target.getAttribute('data-id');
    const targetSession = scheduleData.find(s => s.id === sessionId);
    if (!targetSession) return;

    // Check if bookings exist for this session
    const bookingsCount = bookingsData.filter(b => b.sessionId === sessionId).length;
    let message = `Are you sure you want to delete the excursion departure "${targetSession.title}"?`;
    if (bookingsCount > 0) {
      message += `\n\n⚠️ WARNING: There are active passenger manifests (${bookingsCount} bookings) for this tour! Deleting it will permanently clear these bookings as well.`;
    }

    if (!confirm(message)) return;

    // Remove from active list
    scheduleData = scheduleData.filter(s => s.id !== sessionId);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData)
      });

      if (!response.ok) {
        throw new Error("Failed to write schedule file");
      }

      showToast("Successfully updated schedule.json config file");
      setConfigDirtyState(false);
      fetchAdminData(); // reload statistics and lists

    } catch (error) {
      console.error(error);
      showToast("⚠️ Config Write Error: Unable to synchronize schedule.json", true);
      saveScheduleConfigBtn.disabled = false;
    } finally {
      saveScheduleConfigBtn.textContent = 'Write Changes to schedule.json';
    }
  });

  // --- Add Session Modal Form ---
  openAddSessionBtn.addEventListener('click', () => {
    addSessionForm.reset();
    
    // Set default date to 1 week from now
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    document.getElementById('new-session-date').value = nextWeek.toISOString().substring(0,10);
    
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
    const date = document.getElementById('new-session-date').value;
    const time = document.getElementById('new-session-time').value;
    const price = document.getElementById('new-session-price').value.trim() || 'Free';
    const capacity = parseInt(document.getElementById('new-session-capacity').value) || 5;
    const description = document.getElementById('new-session-desc').value.trim();

    // Create session in local memory list
    const newSession = {
      id: 'session-' + Date.now(),
      title,
      date,
      time,
      maxSlots: capacity,
      description,
      price
    };

    scheduleData.push(newSession);
    setConfigDirtyState(true);
    closeAddModal();
    renderConfigEditor();
    
    showToast(`Added departure route: "${title}"`);
  });

  // --- Export CSV Manifests Download ---
  exportCsvBtn.addEventListener('click', () => {
    // Grab all current items matching searches/routes
    const filtered = bookingsData.filter(booking => {
      if (activeFilters.route !== 'all' && booking.sessionId !== activeFilters.route) return false;
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

    // Generate CSV contents
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

  // --- Initial Launch ---
  fetchAdminData();
});
