# Dust2 Tours Booking System

A robust, simple, and beautifully styled booking tool for **Dust2 Tours**. Crafted with a high-end traditional travel agency aesthetic featuring clean vintage paper cards, ink borders, luggage-tag boarding passes, and custom postage badges.

---

## 🎨 Design Theme & Brand Identity
- **Visual Vibe**: Traditional Print Travel Brochure. No sci-fi glassmorphism or gaming neon. Warm retro stamp accents and boarding ticket stub motifs.
- **Palette**:
  - **Background**: Soft Rosa (`#F4E4F1`) and Warm Ivory Cream (`#FAF6F4`)
  - **Primary Brand Color**: Forest Green (`#00A95C`)
  - **Accent Elements & Highlights**: Medium Pink (`#DFB3D7`) and Muted Rose (`#C686BB`)
- **Typography**: 
  - **Anton** (high-impact retro title headings)
  - **DM Sans** (highly legible, elegant body sans-serif)

---

## 🚀 Features
1. **Passenger Registration Portal (`index.html`)**:
   - Visual postcard schedule cards showing route details, departures, prices, and remaining slots.
   - Dynamic real-time passenger booking limits (strictly capped at **5 slots** per session, protected on both client and backend).
   - Generates an interactive, styled **Boarding Pass Ticket** (Dusty Pink background, barcodes, passed stamps, and a tear-off stub) upon successful registration.
   - Print-ready design: customers can click "Print Boarding Ticket" to print only their boarding pass!

2. **Operator Control Panel (`admin.html`)**:
   - Real-time statistics manifest (passenger count, active slots count, capacity ratios).
   - Searchable, filterable ledger manifest database of all active passenger bookings.
   - Live interactive switches to check passengers in atCT Spawn or T Spawn.
   - Single-click cancellation, which instantly updates active slots for online users.
   - **Visual Schedule.json Editor**: Add, edit, or remove departures visually, writing directly to the underlying `schedule.json` file in real-time.
   - **Passenger Manifest CSV Exporter**: Download filtered passenger logs as formatted `.csv` files for manifest registries.

3. **Backend Safety (`server.js`)**:
   - Concurrency locking queue prevents overbookings when multiple customers try to check out the last slot at the exact same moment.
   - Safe atomic file-writing techniques block data corruptions.
   - Integrated **Email Dispatch System** using Node.js standard mailing streams.

---

## 📧 Email Confirmation Setup
By default, the server operates a local logging system. Every time a customer books a tour, a confirmation ticket layout is logged to the console and recorded into `sent_emails.log` in your workspace.

To enable **real SMTP HTML email delivery** to customers:
1. Open the `.env` file in the project folder.
2. Provide your email server SMTP settings:
   ```env
   SMTP_HOST=smtp.yourprovider.com
   SMTP_PORT=587
   SMTP_USER=your-username
   SMTP_PASS=your-password
   SMTP_FROM_EMAIL=bookings@yourdomain.com
   SMTP_FROM_NAME="Dust2 Tours Agency"
   ```
3. Restart the server. The application will immediately begin dispatching HTML passenger tickets!

---

## 🛠️ Quick Installation & Startup

### Prerequisites
Make sure [Node.js](https://nodejs.org/) (v16+) is installed on your computer.

### Step 1: Install Dependencies
Open your command terminal, navigate to the project directory, and run:
```bash
npm install
```

### Step 2: Start the Agency Server
Launch the local server:
```bash
npm start
```
*Alternatively, you can run in developer mode:*
```bash
npm run dev
```

### Step 3: Explore the Booking Interfaces
- **Customer Frontdesk**: [http://localhost:3000](http://localhost:3000)
- **Operator Dashboard**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## 📁 System Architecture & Directory Structure
- [`server.js`](file:///u:/master/studio%202/dust2.tours%20booking/server.js): The heart of the backend. Coordinates security capacity checks, atomic database locks, and SMTP mail services.
- [`schedule.json`](file:///u:/master/studio%202/dust2.tours%20booking/schedule.json): Active JSON configuration file defining scheduled departures. Can be edited visually in `/admin.html` or manually in a text editor.
- [`bookings.json`](file:///u:/master/studio%202/dust2.tours%20booking/bookings.json): File database containing registered passenger bookings and check-in logs.
- `public/`: Passenger assets.
  - [`index.html`](file:///u:/master/studio%202/dust2.tours%20booking/public/index.html): Primary booking portal.
  - [`admin.html`](file:///u:/master/studio%202/dust2.tours%20booking/public/admin.html): Visual Operator Dashboard.
  - `css/`: Theme files.
    - [`style.css`](file:///u:/master/studio%202/dust2.tours%20booking/public/css/style.css): Custom ink agency styles, layouts, and typography bindings.
  - `js/`: Application code.
    - [`app.js`](file:///u:/master/studio%202/dust2.tours%20booking/public/js/app.js): Customer frontend controllers.
    - [`admin.js`](file:///u:/master/studio%202/dust2.tours%20booking/public/js/admin.js): Operator controllers.
  - `images/`: Brand assets.
    - [`logo.svg`](file:///u:/master/studio%202/dust2.tours%20booking/public/images/logo.svg): Placeholder curved agency compass logo badge (ready for swap-out!).
- [`sent_emails.log`](file:///u:/master/studio%202/dust2.tours%20booking/sent_emails.log): Generated log registering confirmation emails dispatched.

---

## ☁️ Deployment on Render

This system is fully optimized for cloud deployment platforms like **Render**:
1. **Persistent Disk Mount**: Under the "Disks" section of your Web Service in Render, mount a persistent disk at a specific path (e.g., `/var/data` or `/data`).
2. **Environment Variables**: Add an environment variable named `DATA_DIR` and set it to your disk mount path (e.g., `DATA_DIR=/var/data`).
3. **Automatic Copying**: On first startup, if the database file `schedule.json` does not exist in your persistent path, the server will automatically copy the pre-seeded default tour configurations from the codebase repository so your app works instantly with all tour routes loaded!

