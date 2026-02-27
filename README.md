# Course Selection and Scheduling Platform

A complete web application for student course selection and scheduling with admin management capabilities.

## Features

### Security
- Secure login and signup with bcrypt password hashing
- Session-based authentication
- Role-based access control (Admin/Student)
- Protected API endpoints

### Student Portal
- Browse available courses
- Enroll in courses with automatic conflict detection
- View registered courses
- Interactive weekly timetable view
- Drop courses
- Real-time capacity checking

### Admin Portal
- Add, edit, and delete courses
- Manage all student registrations
- View all registered students
- Resolve scheduling conflicts
- Monitor course capacity

### Course Management
- Course code, name, instructor
- Credits and capacity tracking
- Day and time scheduling
- Semester organization
- Course descriptions

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open browser and navigate to:
```
http://localhost:3000
```

## Default Admin Credentials
- Username: admin
- Password: admin123

## Technology Stack
- Backend: Node.js + Express
- Database: SQLite (better-sqlite3)
- Frontend: HTML, CSS, JavaScript
- Security: bcryptjs, express-session

## Project Structure
```
├── server.js           # Backend server and API
├── package.json        # Dependencies
├── courses.db          # SQLite database (auto-created)
└── public/
    ├── index.html      # Main HTML file
    ├── styles.css      # Styling
    └── app.js          # Frontend JavaScript
```

## API Endpoints

### Authentication
- POST /api/signup - Register new student
- POST /api/login - User login
- POST /api/logout - User logout
- GET /api/session - Check session

### Courses
- GET /api/courses - Get all courses
- POST /api/courses - Add course (admin)
- PUT /api/courses/:id - Update course (admin)
- DELETE /api/courses/:id - Delete course (admin)

### Registrations
- GET /api/registrations - Get registrations
- POST /api/registrations - Enroll in course
- DELETE /api/registrations/:id - Drop course

### Students
- GET /api/students - Get all students (admin)

## Features Implemented

✅ Secure authentication with password hashing
✅ Role-based access (Admin/Student)
✅ Course management (CRUD operations)
✅ Student registration system
✅ Automatic schedule conflict detection
✅ Capacity management
✅ Interactive timetable view
✅ Responsive design
✅ Session management
✅ Real-time updates

## Usage

### For Students:
1. Sign up with username, email, and password
2. Login to access student portal
3. Browse available courses
4. Enroll in courses (system prevents conflicts)
5. View your timetable
6. Drop courses if needed

### For Admins:
1. Login with admin credentials
2. Add new courses with schedule details
3. View all registrations
4. Manage student enrollments
5. Delete courses
6. View registered students

## Security Features
- Password hashing with bcrypt (10 rounds)
- Session-based authentication
- Protected routes with middleware
- SQL injection prevention with prepared statements
- XSS protection
- CSRF protection via session
