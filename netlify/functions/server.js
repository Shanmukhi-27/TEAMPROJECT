const serverless = require('serverless-http');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const bodyParser = require('body-parser');

const app = express();
const db = new Database('/tmp/courses.db');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'course-selection-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    instructor TEXT NOT NULL,
    credits INTEGER NOT NULL,
    capacity INTEGER NOT NULL,
    enrolled INTEGER DEFAULT 0,
    day TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    semester TEXT NOT NULL,
    description TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    status TEXT DEFAULT 'enrolled',
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    UNIQUE(student_id, course_id)
  )
`);

const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!admin) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)').run('admin', hashedPassword, 'admin@university.edu', 'admin');
}

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.userId || req.session.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
};

app.post('/api/signup', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email) return res.status(400).json({ error: 'All fields required' });
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    db.prepare('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)').run(username, hashedPassword, email, 'student');
    res.json({ success: true, message: 'Registration successful' });
  } catch (err) {
    res.status(400).json({ error: 'Username or email already exists' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  res.json({ success: true, role: user.role, username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/session', (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, role: req.session.role, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

app.get('/api/courses', requireAuth, (req, res) => {
  const courses = db.prepare('SELECT * FROM courses ORDER BY code').all();
  res.json(courses || []);
});

app.post('/api/courses', requireAdmin, (req, res) => {
  const { code, name, instructor, credits, capacity, day, start_time, end_time, semester, description } = req.body;
  try {
    const result = db.prepare('INSERT INTO courses (code, name, instructor, credits, capacity, day, start_time, end_time, semester, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(code, name, instructor, credits, capacity, day, start_time, end_time, semester, description);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: 'Course code already exists' });
  }
});

app.put('/api/courses/:id', requireAdmin, (req, res) => {
  const { name, instructor, credits, capacity, day, start_time, end_time, semester, description } = req.body;
  db.prepare('UPDATE courses SET name=?, instructor=?, credits=?, capacity=?, day=?, start_time=?, end_time=?, semester=?, description=? WHERE id=?').run(name, instructor, credits, capacity, day, start_time, end_time, semester, description, req.params.id);
  res.json({ success: true });
});

app.delete('/api/courses/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM registrations WHERE course_id=?').run(req.params.id);
  db.prepare('DELETE FROM courses WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/registrations', requireAuth, (req, res) => {
  const query = `
    SELECT r.*, c.code, c.name, c.instructor, c.credits, c.day, c.start_time, c.end_time, u.username
    FROM registrations r
    JOIN courses c ON r.course_id = c.id
    JOIN users u ON r.student_id = u.id
    ${req.session.role === 'student' ? 'WHERE r.student_id = ?' : ''}
    ORDER BY c.code
  `;
  const rows = req.session.role === 'student' ? db.prepare(query).all(req.session.userId) : db.prepare(query).all();
  res.json(rows || []);
});

app.post('/api/registrations', requireAuth, (req, res) => {
  const { course_id } = req.body;
  
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(course_id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  if (course.enrolled >= course.capacity) return res.status(400).json({ error: 'Course is full' });
  
  const myRegistrations = db.prepare('SELECT c.* FROM registrations r JOIN courses c ON r.course_id = c.id WHERE r.student_id = ?').all(req.session.userId);
  
  for (let reg of myRegistrations) {
    if (reg.day === course.day) {
      const regStart = parseInt(reg.start_time.replace(':', ''));
      const regEnd = parseInt(reg.end_time.replace(':', ''));
      const courseStart = parseInt(course.start_time.replace(':', ''));
      const courseEnd = parseInt(course.end_time.replace(':', ''));
      
      if ((courseStart >= regStart && courseStart < regEnd) || (courseEnd > regStart && courseEnd <= regEnd) || (courseStart <= regStart && courseEnd >= regEnd)) {
        return res.status(400).json({ error: `Schedule conflict with ${reg.code} on ${reg.day}` });
      }
    }
  }
  
  try {
    db.prepare('INSERT INTO registrations (student_id, course_id) VALUES (?, ?)').run(req.session.userId, course_id);
    db.prepare('UPDATE courses SET enrolled = enrolled + 1 WHERE id = ?').run(course_id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Already registered for this course' });
  }
});

app.delete('/api/registrations/:id', requireAuth, (req, res) => {
  const registration = db.prepare('SELECT * FROM registrations WHERE id = ?').get(req.params.id);
  if (!registration) return res.status(404).json({ error: 'Registration not found' });
  if (req.session.role === 'student' && registration.student_id !== req.session.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM registrations WHERE id = ?').run(req.params.id);
  db.prepare('UPDATE courses SET enrolled = enrolled - 1 WHERE id = ?').run(registration.course_id);
  res.json({ success: true });
});

app.get('/api/students', requireAdmin, (req, res) => {
  const students = db.prepare('SELECT id, username, email, created_at FROM users WHERE role = "student"').all();
  res.json(students || []);
});

module.exports.handler = serverless(app);
