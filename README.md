# HostelHub – Hostel Community & Student Connect Platform

HostelHub is a full-stack web application designed to make hostel life easier by connecting students within a hostel community.

Students can explore hostel rooms, find people to play indoor games with, exchange used items, request or lend essential items, and find teammates for academic projects.

## Features

### 1. Room Selection
- View flats and rooms provided by hostel management.
- Explore room details such as flat number, floor, room capacity, available beds, facilities, and balcony direction.
- Search and filter rooms.
- Request room allocation for a semester.
- Admin approval for room allocation.
- Prevent double booking through database transactions.
- No room or flat image uploading is required.

### 2. Peer to Play
- Create indoor game requests.
- Select game, date, time, location, and required players.
- Join or leave play requests.
- View participants.
- Automatically update request status when full.

### 3. Hostel Marketplace
- Buy and sell used items within the hostel community.
- Create product listings with descriptions, categories, price, condition, and pickup location.
- Search and filter listings.
- Mark items as sold.
- Optional product image upload.
- Listing ownership protection.

### 4. Hostel Needs
- Request essential items such as kettles, hair dryers, iron boxes, books, and other hostel necessities.
- Borrow or request items.
- Respond to other students' requests.
- Offer to lend items.
- Mark requests as fulfilled.

### 5. Project Partners
- Create academic project or hackathon requests.
- Mention project domain, description, required skills, technologies, and team size.
- Find students with similar interests.
- Express interest in joining projects.
- Accept or reject interested students.

### 6. User Profile
- Manage student profile information.
- Update skills and interests.
- Control contact information visibility.
- View active listings and requests.

### 7. Admin Dashboard
- Manage flats and rooms.
- Manage room allocation requests.
- View registered students.
- Manage marketplace listings.
- Review reported content.

### 8. Themes
Four themes are available:
- Classic
- Decent
- Simple
- Normal

Theme preferences are saved for the user.

Custom background selection is planned for a future version.

---

## Technology Stack

### Frontend
- React.js
- Vite
- JavaScript
- React Router
- Axios / Fetch API
- Lucide React

### Backend
- Node.js
- Express.js
- REST API

### Database
- PostgreSQL
- pgAdmin 4
- `pg` PostgreSQL driver

### Authentication
- Email OTP authentication
- Mobile OTP authentication
- JWT-based sessions

### Email and SMS
- Nodemailer / SMTP for email OTP
- Twilio or MSG91 for SMS OTP

---

## Project Structure

```text
KL_Sync/
│
├── client/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── layouts/
│       ├── pages/
│       ├── services/
│       ├── context/
│       └── App.jsx
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── scripts/
│   └── server.js
│
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   └── migrations/
│
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Prerequisites

Install the following before running the project:

- Node.js 18 or later
- npm
- PostgreSQL 13 or later
- pgAdmin 4
- Visual Studio Code

Check Node.js and npm installation:

```bash
node -v
npm -v
```

---

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Praveen-9640/KL_Sync.git
```

Navigate to the project directory:

```bash
cd KL_Sync
```

### 2. Install npm packages

Install frontend and backend dependencies:

```bash
npm run install:all
```

This installs the required packages for both the React frontend and Express backend.

### 3. Create the PostgreSQL database

Open pgAdmin 4.

Create a new database named:

```text
hostelhub
```

### 4. Configure environment variables

Copy the example environment file into the server directory.

Windows PowerShell:

```powershell
Copy-Item .env.example server/.env
```

Linux / macOS:

```bash
cp .env.example server/.env
```

Open `server/.env` and configure the required values.

Important environment variables:

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/hostelhub

JWT_SECRET=
OTP_SECRET=

CURRENT_SEMESTER=Spring 2027

ADMIN_EMAIL=
ADMIN_NAME=Hostel Admin
ADMIN_STUDENT_ID=ADMIN001
```

Generate secure JWT and OTP secrets using:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Generate a separate value for each secret.

Do not commit `server/.env` or any file containing real credentials.

### 5. Initialize the database

Run:

```bash
npm run db:init
```

This creates the required database tables.

### 6. Seed the database

Run:

```bash
npm run db:seed
```

This inserts sample flats and rooms and creates the admin account if `ADMIN_EMAIL` is configured.

The seed data uses the semester:

```text
Spring 2027
```

Make sure `CURRENT_SEMESTER` matches the semester configured in the room data.

---

## Running the Application

### Start the backend

Open a terminal in the project root:

```bash
npm run dev:server
```

Backend API:

```text
http://localhost:5000
```

### Start the frontend

Open another terminal:

```bash
npm run dev:client
```

Frontend:

```text
http://localhost:5173
```

Open the frontend URL in your browser.

Keep both terminals running while using the application.

---

## OTP Authentication Setup

HostelHub supports passwordless authentication using email or mobile OTP.

### Email OTP

Configure the following SMTP variables in `server/.env`:

```env
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_FROM=
```

For Gmail, use an App Password with a Google account that has 2-Step Verification enabled.

### SMS OTP

HostelHub supports Twilio and MSG91.

Configure the required provider credentials in `server/.env`.

For MSG91 in India, an approved OTP template and DLT registration may be required.

### Development OTP

For local development only, OTP can be printed in the backend terminal when no provider is configured.

Set:

```env
DEV_OTP_CONSOLE=true
```

This option is disabled in production.

It does not send a real email or SMS.

---

## Admin Account

Configure the admin email in `server/.env`:

```env
ADMIN_EMAIL=your-email@example.com
```

Run the database seed command:

```bash
npm run db:seed
```

The admin can log in using the configured email and OTP.

There is no public admin registration option.

---

## Testing

The backend includes an integration test script.

Make sure the database is initialized and the backend server is running.

Run:

```bash
npm test --prefix server
```

The test script checks important application flows such as:

- Authentication and protected routes
- Admin permissions
- Play request creation and joining
- Marketplace ownership
- Duplicate need responses
- Project interest and acceptance
- Room allocation
- Double-booking prevention

The test script must be executed locally to confirm the results.

---

## Production Build

Build the frontend:

```bash
npm run build
```

The production frontend build is generated inside:

```text
client/dist/
```

Start the backend:

```bash
npm start
```

For production deployment, configure the appropriate hosting environment, database connection, OTP provider credentials, CORS settings, and frontend/API routing.

---

## Security

The project includes:

- OTP verification
- JWT authentication
- Rate limiting
- Input validation
- Parameterized SQL queries
- Protected API routes
- Role-based admin access
- Ownership checks
- Environment-based secrets
- OTP expiration and single-use verification

Never commit real credentials, API keys, database passwords, or environment files.

---

## Development Status

The project source code and integration test script were generated and statically checked.

The original development environment did not have access to the npm registry, PostgreSQL, or external email/SMS services.

Therefore, the following must be verified locally:

- npm package installation
- Frontend production build
- Backend startup
- PostgreSQL schema and queries
- Email and SMS OTP delivery
- Integration test results

External OTP services require valid provider credentials.

---

## Future Enhancements

- Custom background selection
- Additional hostel management features
- Improved notification system
- More student community features
- Production deployment

---

## Repository

GitHub: https://github.com/Praveen-9640/KL_Sync