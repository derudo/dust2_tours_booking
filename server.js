const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Path configurations
const DATA_DIR = process.env.DATA_DIR || __dirname;

// Ensure target data directory exists on startup
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to initialize target data directory:", err);
  }
}

const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const EMAIL_LOG_FILE = path.join(DATA_DIR, 'sent_emails.log');

// --- Helper Functions for File Database Operations ---

// Read active schedule
function readSchedule() {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) {
      return [];
    }
    const data = fs.readFileSync(SCHEDULE_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error("Error reading schedule config file:", error);
    return [];
  }
}

// Write schedule updates (Admin feature)
function writeSchedule(schedule) {
  try {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error("Error writing schedule config file:", error);
    return false;
  }
}

// Read bookings safely
function readBookings() {
  try {
    if (!fs.existsSync(BOOKINGS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(BOOKINGS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error("Error reading bookings file:", error);
    return [];
  }
}

// Atomic write to bookings file using a temporary file
function writeBookings(bookings) {
  const tempFile = `${BOOKINGS_FILE}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(bookings, null, 2), 'utf8');
    fs.renameSync(tempFile, BOOKINGS_FILE);
    return true;
  } catch (error) {
    console.error("Error performing atomic write on bookings database:", error);
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (e) {}
    }
    return false;
  }
}

// --- Sequential Queue / Lock for Safe Concurrent Bookings ---
// In Node.js, asynchronous operations like fs.readFile could allow race conditions.
// We implement a simple queue lock to process booking requests sequentially.
let bookingQueue = Promise.resolve();

function enqueueBookingTask(taskFn) {
  return new Promise((resolve, reject) => {
    bookingQueue = bookingQueue
      .then(() => taskFn())
      .then(resolve)
      .catch((err) => {
        reject(err);
        // Recover queue from failures
      });
  });
}

// --- Email Dispatch & Logging System ---
async function sendBookingConfirmationEmail(booking, session) {
  const emailHtml = `
    <div style="font-family: 'DM Sans', sans-serif; background-color: #FAF7F0; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; color: #1A3322; border: 2px solid #1A3322; box-shadow: 0 8px 0 rgba(26,51,34,0.15);">
      <div style="text-align: center; border-bottom: 2px dashed #1A3322; padding-bottom: 20px; margin-bottom: 25px;">
        <span style="font-family: 'Anton', Impact, sans-serif; font-size: 28px; letter-spacing: 2px; color: #1A3322; text-transform: uppercase;">DUST2 TOURS</span>
        <div style="font-size: 12px; letter-spacing: 1px; color: #8C8070; margin-top: 5px; text-transform: uppercase;">Est. 2026 • Official Boarding Pass</div>
      </div>
      
      <div style="background-color: #DDA5A5; color: #1A3322; padding: 15px; border-radius: 6px; font-weight: bold; text-align: center; margin-bottom: 25px; letter-spacing: 0.5px;">
        CONFIRMED RESERVATION • PASSENGER TICKET
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #8C8070; text-transform: uppercase; width: 40%;">Passenger Name</td>
          <td style="padding: 6px 0; font-size: 15px; font-weight: bold; color: #1A3322;">${booking.name}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #8C8070; text-transform: uppercase;">Email Address</td>
          <td style="padding: 6px 0; font-size: 15px; font-weight: bold; color: #1A3322;">${booking.email}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #8C8070; text-transform: uppercase;">Tour Route</td>
          <td style="padding: 6px 0; font-size: 15px; font-weight: bold; color: #1A3322;">${session.title}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #8C8070; text-transform: uppercase;">Departure Date</td>
          <td style="padding: 6px 0; font-size: 15px; font-weight: bold; color: #1A3322;">${session.date}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #8C8070; text-transform: uppercase;">Departure Time</td>
          <td style="padding: 6px 0; font-size: 15px; font-weight: bold; color: #1A3322;">${session.time}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #8C8070; text-transform: uppercase;">Fare Category</td>
          <td style="padding: 6px 0; font-size: 15px; font-weight: bold; color: #DDA5A5; background-color: #1A3322; display: inline-block; padding: 2px 8px; border-radius: 4px;">${session.price || 'Free'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #8C8070; text-transform: uppercase;">Ticket Reference</td>
          <td style="padding: 6px 0; font-size: 16px; font-family: monospace; font-weight: bold; color: #1A3322; letter-spacing: 1px;">${booking.bookingCode}</td>
        </tr>
      </table>
      
      <div style="border-top: 2px dashed #1A3322; padding-top: 20px; text-align: center; font-size: 12px; color: #8C8070;">
        <p style="margin: 0 0 10px 0;">Please present this digital confirmation ticket or booking reference at the starting area (T Spawn or CT Spawn depending on route) 10 minutes prior to departure.</p>
        <p style="margin: 0; font-weight: bold; color: #1A3322;">Thank you for choosing Dust2 Tours. Have a legendary expedition!</p>
      </div>
    </div>
  `;

  const logText = `
[${new Date().toISOString()}] EMAIL SENT TO: ${booking.email}
Subject: Booking Confirmed - Reference: ${booking.bookingCode}
Tour: ${session.title} (${session.date} @ ${session.time})
Passenger: ${booking.name}
------------------------------------------------------------
`;

  // Write log to file
  fs.appendFileSync(EMAIL_LOG_FILE, logText + '\n', 'utf8');
  console.log(`[Email Service] Confirmation logged for ${booking.email} [Ref: ${booking.bookingCode}]`);

  // Try SMTP send if config is present
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'Dust2 Tours'}" <${process.env.SMTP_FROM_EMAIL || 'no-reply@dust2.tours'}>`,
        to: booking.email,
        subject: `Your Booking is Confirmed! (Ref: ${booking.bookingCode}) - Dust2 Tours`,
        html: emailHtml,
      });
      console.log(`[SMTP Mailer] Real email dispatched to ${booking.email}`);
    } catch (smtpError) {
      console.error("[SMTP Mailer Error] Failed sending real email:", smtpError.message);
    }
  }
}

// --- Customer API Endpoints ---

// Get active schedule with remaining slots
app.get('/api/schedule', (req, res) => {
  const sessions = readSchedule();
  const bookings = readBookings();

  // For each session, compute booked count
  const enrichedSessions = sessions.map(session => {
    const bookedCount = bookings.filter(b => b.sessionId === session.id).length;
    const remainingSlots = Math.max(0, (session.maxSlots || 5) - bookedCount);
    return {
      ...session,
      bookedCount,
      remainingSlots
    };
  });

  res.json(enrichedSessions);
});

// Book a slot (Processed through sequential queue for concurrency safety)
app.post('/api/book', (req, res) => {
  const { sessionId, name, email, phone } = req.body;

  // Initial inputs validation
  if (!sessionId || !name || !email) {
    return res.status(400).json({ error: "Missing required fields (session, name, and email are mandatory)." });
  }

  // Enqueue this booking task
  enqueueBookingTask(async () => {
    const sessions = readSchedule();
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      return { status: 404, data: { error: "Tour session not found." } };
    }

    const bookings = readBookings();
    const sessionBookings = bookings.filter(b => b.sessionId === sessionId);
    const maxCapacity = session.maxSlots || 5;

    if (sessionBookings.length >= maxCapacity) {
      return { status: 409, data: { error: "This session is fully booked. Only 5 slots are available." } };
    }

    // Check if the user is already booked for this exact session
    const isDoubleBooked = sessionBookings.some(b => b.email.toLowerCase() === email.toLowerCase());
    if (isDoubleBooked) {
      return { status: 400, data: { error: "You are already booked for this tour session." } };
    }

    // Create the booking entry
    const newBooking = {
      id: uuidv4(),
      sessionId,
      name: name.trim(),
      email: email.trim(),
      phone: (phone || '').trim(),
      bookingCode: 'D2-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      createdAt: new Date().toISOString(),
      checkedIn: false
    };

    bookings.push(newBooking);
    const writeSuccess = writeBookings(bookings);

    if (!writeSuccess) {
      return { status: 500, data: { error: "Internal Database Write Failure. Please try again." } };
    }

    // Trigger email confirmation in the background
    sendBookingConfirmationEmail(newBooking, session).catch(console.error);

    return { status: 201, data: newBooking };
  })
  .then((result) => {
    res.status(result.status).json(result.data);
  })
  .catch((err) => {
    console.error("Booking queue crash:", err);
    res.status(500).json({ error: "An unexpected server error occurred during booking." });
  });
});

// --- Admin API Endpoints ---

// Get all bookings + statistics
app.get('/api/admin/bookings', (req, res) => {
  const bookings = readBookings();
  const sessions = readSchedule();

  // Attach session details to bookings for the manifest
  const enrichedBookings = bookings.map(b => {
    const session = sessions.find(s => s.id === b.sessionId);
    return {
      ...b,
      sessionTitle: session ? session.title : 'Unknown Tour',
      sessionDate: session ? session.date : '',
      sessionTime: session ? session.time : ''
    };
  });

  // Calculate statistics
  const stats = {
    totalBookings: bookings.length,
    activeTours: sessions.length,
    checkedInCount: bookings.filter(b => b.checkedIn).length,
    totalSlotsAvailable: sessions.reduce((acc, s) => acc + (s.maxSlots || 5), 0)
  };

  res.json({ bookings: enrichedBookings, stats });
});

// Toggle check-in status
app.post('/api/admin/checkin', (req, res) => {
  const { bookingId, checkedIn } = req.body;

  if (!bookingId) {
    return res.status(400).json({ error: "Missing Booking ID." });
  }

  const bookings = readBookings();
  const bookingIndex = bookings.findIndex(b => b.id === bookingId);

  if (bookingIndex === -1) {
    return res.status(404).json({ error: "Booking record not found." });
  }

  bookings[bookingIndex].checkedIn = !!checkedIn;
  const success = writeBookings(bookings);

  if (!success) {
    return res.status(500).json({ error: "Failed to update booking database." });
  }

  res.json({ success: true, booking: bookings[bookingIndex] });
});

// Cancel a booking
app.post('/api/admin/cancel', (req, res) => {
  const { bookingId } = req.body;

  if (!bookingId) {
    return res.status(400).json({ error: "Missing Booking ID." });
  }

  let bookings = readBookings();
  const bookingExists = bookings.some(b => b.id === bookingId);

  if (!bookingExists) {
    return res.status(404).json({ error: "Booking record not found." });
  }

  bookings = bookings.filter(b => b.id !== bookingId);
  const success = writeBookings(bookings);

  if (!success) {
    return res.status(500).json({ error: "Failed to update booking database." });
  }

  res.json({ success: true, message: "Booking cancelled successfully." });
});

// Save/Update the schedule configuration (Fully updates schedule.json)
app.post('/api/admin/schedule', (req, res) => {
  const newSchedule = req.body;

  if (!Array.isArray(newSchedule)) {
    return res.status(400).json({ error: "Invalid schedule format. Expected an array of tour sessions." });
  }

  // Validate schedule objects
  for (const session of newSchedule) {
    if (!session.id || !session.title || !session.date || !session.time) {
      return res.status(400).json({ error: "All sessions must contain a unique ID, Title, Date, and Departure Time." });
    }
    session.maxSlots = parseInt(session.maxSlots) || 5; // Enforce integer capacity
  }

  const success = writeSchedule(newSchedule);
  if (!success) {
    return res.status(500).json({ error: "Failed to write schedule configuration to file." });
  }

  // Remove bookings that belong to deleted sessions (Optional, but clean)
  const bookings = readBookings();
  const activeSessionIds = newSchedule.map(s => s.id);
  const filteredBookings = bookings.filter(b => activeSessionIds.includes(b.sessionId));
  if (filteredBookings.length !== bookings.length) {
    writeBookings(filteredBookings);
  }

  res.json({ success: true, schedule: newSchedule });
});

// --- Server Startup ---

// Initialize default files if they do not exist
if (!fs.existsSync(SCHEDULE_FILE)) {
  writeSchedule([]);
}
if (!fs.existsSync(BOOKINGS_FILE)) {
  writeBookings([]);
}

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  DUST2 TOURS BOOKING SYSTEM STARTED    `);
  console.log(`  Running on: http://localhost:${PORT}  `);
  console.log(`========================================`);
});
