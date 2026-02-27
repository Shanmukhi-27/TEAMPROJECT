const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const db = new sqlite3.Database('courses.db');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'course-selection-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Initialize Database
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
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

  db.run(`
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

  // Create default admin
  db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
    if (!row) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      db.run('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)', 
        ['admin', hashedPassword, 'admin@university.edu', 'admin']);
    }
  });
});

// Middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.userId || req.session.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
};

// Auth Routes
app.post('/api/signup', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email) return res.status(400).json({ error: 'All fields required' });
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)', 
    [username, hashedPassword, email, 'student'], (err) => {
    if (err) return res.status(400).json({ error: 'Username or email already exists' });
    res.json({ success: true, message: 'Registration successful' });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    res.json({ success: true, role: user.role, username: user.username });
  });
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

// Course Routes
app.get('/api/courses', requireAuth, (req, res) => {
  db.all('SELECT * FROM courses ORDER BY code', [], (err, courses) => {
    res.json(courses || []);
  });
});

app.post('/api/courses', requireAdmin, (req, res) => {
  const { code, name, instructor, credits, capacity, day, start_time, end_time, semester, description } = req.body;
  db.run('INSERT INTO courses (code, name, instructor, credits, capacity, day, start_time, end_time, semester, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [code, name, instructor, credits, capacity, day, start_time, end_time, semester, description], function(err) {
    if (err) return res.status(400).json({ error: 'Course code already exists' });
    res.json({ success: true, id: this.lastID });
  });
});

app.put('/api/courses/:id', requireAdmin, (req, res) => {
  const { name, instructor, credits, capacity, day, start_time, end_time, semester, description } = req.body;
  db.run('UPDATE courses SET name=?, instructor=?, credits=?, capacity=?, day=?, start_time=?, end_time=?, semester=?, description=? WHERE id=?',
    [name, instructor, credits, capacity, day, start_time, end_time, semester, description, req.params.id], (err) => {
    res.json({ success: true });
  });
});

app.delete('/api/courses/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM registrations WHERE course_id=?', [req.params.id], () => {
    db.run('DELETE FROM courses WHERE id=?', [req.params.id], () => {
      res.json({ success: true });
    });
  });
});

// Registration Routes
app.get('/api/registrations', requireAuth, (req, res) => {
  const query = `
    SELECT r.*, c.code, c.name, c.instructor, c.credits, c.day, c.start_time, c.end_time, u.username
    FROM registrations r
    JOIN courses c ON r.course_id = c.id
    JOIN users u ON r.student_id = u.id
    ${req.session.role === 'student' ? 'WHERE r.student_id = ?' : ''}
    ORDER BY c.code
  `;
  const params = req.session.role === 'student' ? [req.session.userId] : [];
  db.all(query, params, (err, rows) => {
    res.json(rows || []);
  });
});

app.post('/api/registrations', requireAuth, (req, res) => {
  const { course_id } = req.body;
  
  db.get('SELECT * FROM courses WHERE id = ?', [course_id], (err, course) => {
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.enrolled >= course.capacity) return res.status(400).json({ error: 'Course is full' });
    
    db.all('SELECT c.* FROM registrations r JOIN courses c ON r.course_id = c.id WHERE r.student_id = ?', 
      [req.session.userId], (err, myRegistrations) => {
      
      for (let reg of myRegistrations) {
        if (reg.day === course.day) {
          const regStart = parseInt(reg.start_time.replace(':', ''));
          const regEnd = parseInt(reg.end_time.replace(':', ''));
          const courseStart = parseInt(course.start_time.replace(':', ''));
          const courseEnd = parseInt(course.end_time.replace(':', ''));
          
          if ((courseStart >= regStart && courseStart < regEnd) || (courseEnd > regStart && courseEnd <= regEnd) || 
              (courseStart <= regStart && courseEnd >= regEnd)) {
            return res.status(400).json({ error: `Schedule conflict with ${reg.code} on ${reg.day}` });
          }
        }
      }
      
      db.run('INSERT INTO registrations (student_id, course_id) VALUES (?, ?)', 
        [req.session.userId, course_id], (err) => {
        if (err) return res.status(400).json({ error: 'Already registered for this course' });
        db.run('UPDATE courses SET enrolled = enrolled + 1 WHERE id = ?', [course_id], () => {
          res.json({ success: true });
        });
      });
    });
  });
});

app.delete('/api/registrations/:id', requireAuth, (req, res) => {
  db.get('SELECT * FROM registrations WHERE id = ?', [req.params.id], (err, registration) => {
    if (!registration) return res.status(404).json({ error: 'Registration not found' });
    if (req.session.role === 'student' && registration.student_id !== req.session.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    db.run('DELETE FROM registrations WHERE id = ?', [req.params.id], () => {
      db.run('UPDATE courses SET enrolled = enrolled - 1 WHERE id = ?', [registration.course_id], () => {
        res.json({ success: true });
      });
    });
  });
});

app.get('/api/students', requireAdmin, (req, res) => {
  db.all('SELECT id, username, email, created_at FROM users WHERE role = "student"', [], (err, students) => {
    res.json(students || []);
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
