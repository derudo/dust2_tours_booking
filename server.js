const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Admin password configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'dust2admin';

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

// --- Security Middleware for Admin Access ---
function checkAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized. Operator passcode required." });
  }

  const token = authHeader.split(' ')[1]; // Expecting "Bearer <password>"
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized. Invalid operator passcode." });
  }

  next();
}

// --- Helper Functions for File Database Operations ---

// Read active schedule of tours
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

// Atomic write to bookings file
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
let bookingQueue = Promise.resolve();

function enqueueBookingTask(taskFn) {
  return new Promise((resolve, reject) => {
    bookingQueue = bookingQueue
      .then(() => taskFn())
      .then(resolve)
      .catch((err) => {
        reject(err);
      });
  });
}

// --- Email Dispatch & Logging System ---
let mailTransporter = null;

async function initMailer() {
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false // CRITICAL: Fixes Porkbun/domain registrar certificate rejections!
      }
    });
    console.log(`[SMTP Mailer] Production SMTP configured successfully (with TLS fallback).`);
  } else {
    // Dynamic fallback: Create a free Ethereal test account so that email confirmations WORK instantly out of the box!
    try {
      console.log(`[SMTP Mailer] SMTP config missing. Creating free Ethereal sandbox mailer...`);
      const testAccount = await nodemailer.createTestAccount();
      mailTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[SMTP Mailer] Ethereal Sandbox created! User: ${testAccount.user}`);
    } catch (err) {
      console.error("[SMTP Mailer Error] Failed to auto-generate Ethereal test account:", err.message);
    }
  }
}

initMailer();

async function sendBookingConfirmationEmail(booking, tour, slot) {
  const emailHtml = `
    <div style="font-family: 'DM Sans', sans-serif; background-color: #FAF7F0; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; color: #1A3322; border: 3px solid #1A3322; box-shadow: 0 8px 0 rgba(26,51,34,0.15);">
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
          <td style="padding: 6px 0; font-size: 15px; font-weight: bold; color: #1A3322;">${tour.title}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #8C8070; text-transform: uppercase;">Departure Date</td>
          <td style="padding: 6px 0; font-size: 15px; font-weight: bold; color: #1A3322;">${slot.date}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #8C8070; text-transform: uppercase;">Departure Time</td>
          <td style="padding: 6px 0; font-size: 15px; font-weight: bold; color: #1A3322;">${slot.time}</td>
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
Tour: ${tour.title} (Departure: ${slot.date} @ ${slot.time})
Passenger: ${booking.name}
------------------------------------------------------------
`;

  // Write log to file
  fs.appendFileSync(EMAIL_LOG_FILE, logText + '\n', 'utf8');

  if (mailTransporter) {
    try {
      const isTestAccount = mailTransporter.options.host.includes('ethereal.email');
      const fromEmail = process.env.SMTP_FROM_EMAIL || (isTestAccount ? mailTransporter.options.auth.user : 'bookings@dust2.tours');

      const info = await mailTransporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'Dust2 Tours'}" <${fromEmail}>`,
        to: booking.email,
        subject: `Your Booking is Confirmed! (Ref: ${booking.bookingCode}) - Dust2 Tours`,
        html: emailHtml,
      });

      if (isTestAccount) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`========================================`);
        console.log(`📩 [Ethereal Mail] HTML test email dispatched!`);
        console.log(`👉 View Preview: ${previewUrl}`);
        console.log(`========================================`);
        
        fs.appendFileSync(EMAIL_LOG_FILE, `Ethereal Sandbox Preview URL: ${previewUrl}\n------------------------------------------------------------\n`, 'utf8');
      } else {
        console.log(`[SMTP Mailer] Real production email dispatched to ${booking.email}`);
      }
    } catch (smtpError) {
      console.error("[SMTP Mailer Error] Failed sending email:", smtpError.message);
    }
  } else {
    console.log(`[Email Service] Mailer transporter not initialized. Booking logged to sent_emails.log.`);
  }
}

// --- Customer API Endpoints ---

// Get active schedule with remaining slots per individual timeslot
app.get('/api/schedule', (req, res) => {
  const tours = readSchedule();
  const bookings = readBookings();

  // Compute remaining slots for each timeslot inside each tour
  const enrichedTours = tours.map(tour => {
    const enrichedTimeslots = (tour.timeslots || []).map(slot => {
      const bookedCount = bookings.filter(b => b.timeslotId === slot.id).length;
      const remainingSlots = Math.max(0, (slot.maxSlots || 5) - bookedCount);
      return {
        ...slot,
        bookedCount,
        remainingSlots
      };
    });

    return {
      ...tour,
      timeslots: enrichedTimeslots
    };
  });

  res.json(enrichedTours);
});

// Book a timeslot (Processed through queue for safety)
app.post('/api/book', (req, res) => {
  const { tourId, timeslotId, name, email, phone } = req.body;

  if (!tourId || !timeslotId || !name || !email) {
    return res.status(400).json({ error: "Missing required fields (tour, timeslot, name, and email are mandatory)." });
  }

  enqueueBookingTask(async () => {
    const tours = readSchedule();
    const tour = tours.find(t => t.id === tourId);

    if (!tour) {
      return { status: 404, data: { error: "Tour route not found." } };
    }

    const slot = (tour.timeslots || []).find(s => s.id === timeslotId);
    if (!slot) {
      return { status: 404, data: { error: "Scheduled departure timeslot not found." } };
    }

    const bookings = readBookings();
    const slotBookings = bookings.filter(b => b.timeslotId === timeslotId);
    const maxCapacity = slot.maxSlots || 5;

    if (slotBookings.length >= maxCapacity) {
      return { status: 409, data: { error: "This scheduled departure is fully booked. Capped at 5 passengers." } };
    }

    // Check double-booking on this specific timeslot
    const isDoubleBooked = slotBookings.some(b => b.email.toLowerCase() === email.toLowerCase());
    if (isDoubleBooked) {
      return { status: 400, data: { error: "You are already booked for this specific timeslot departure." } };
    }

    // Create the booking entry referencing BOTH tour and timeslot
    const newBooking = {
      id: uuidv4(),
      tourId,
      timeslotId,
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

    sendBookingConfirmationEmail(newBooking, tour, slot).catch(console.error);

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

// Login Endpoint to verify passcode
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(401).json({ error: "Invalid operator passcode." });
  }
});

// Get all bookings + statistics (Protected)
app.get('/api/admin/bookings', checkAdminAuth, (req, res) => {
  const bookings = readBookings();
  const tours = readSchedule();

  // Attach route and timeslot details to bookings for manifest ledger
  const enrichedBookings = bookings.map(b => {
    const tour = tours.find(t => t.id === b.tourId);
    const slot = tour ? (tour.timeslots || []).find(s => s.id === b.timeslotId) : null;
    return {
      ...b,
      sessionTitle: tour ? tour.title : 'Unknown Tour',
      sessionDate: slot ? slot.date : '',
      sessionTime: slot ? slot.time : ''
    };
  });

  // Calculate stats based on timeslots capacity
  let totalSlotsCapacity = 0;
  tours.forEach(tour => {
    (tour.timeslots || []).forEach(slot => {
      totalSlotsCapacity += (slot.maxSlots || 5);
    });
  });

  const stats = {
    totalBookings: bookings.length,
    activeTours: tours.length,
    checkedInCount: bookings.filter(b => b.checkedIn).length,
    totalSlotsAvailable: totalSlotsCapacity
  };

  res.json({ bookings: enrichedBookings, stats });
});

// Toggle check-in status (Protected)
app.post('/api/admin/checkin', checkAdminAuth, (req, res) => {
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

// Cancel a booking (Protected)
app.post('/api/admin/cancel', checkAdminAuth, (req, res) => {
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

// Save/Update the schedule configuration (Protected - Fully updates schedule.json)
app.post('/api/admin/schedule', checkAdminAuth, (req, res) => {
  const newSchedule = req.body;

  if (!Array.isArray(newSchedule)) {
    return res.status(400).json({ error: "Invalid schedule format. Expected an array of tours." });
  }

  // Validate tour objects
  for (const tour of newSchedule) {
    if (!tour.id || !tour.title || !tour.description) {
      return res.status(400).json({ error: "All tours must contain a unique ID, Title, and Description." });
    }
    
    // Validate nested timeslots
    tour.timeslots = tour.timeslots || [];
    for (const slot of tour.timeslots) {
      if (!slot.id || !slot.date || !slot.time) {
        return res.status(400).json({ error: "All timeslots must contain a unique ID, Date, and Time." });
      }
      slot.maxSlots = parseInt(slot.maxSlots) || 5;
    }
  }

  const success = writeSchedule(newSchedule);
  if (!success) {
    return res.status(500).json({ error: "Failed to write schedule configuration to file." });
  }

  // Clean bookings that belong to deleted timeslots
  const bookings = readBookings();
  const activeTimeslotIds = [];
  newSchedule.forEach(tour => {
    (tour.timeslots || []).forEach(slot => {
      activeTimeslotIds.push(slot.id);
    });
  });

  const filteredBookings = bookings.filter(b => activeTimeslotIds.includes(b.timeslotId));
  if (filteredBookings.length !== bookings.length) {
    writeBookings(filteredBookings);
  }

  res.json({ success: true, schedule: newSchedule });
});

// --- Server Startup ---

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
