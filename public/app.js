let currentUser = null;

// Check session on load
window.onload = async () => {
  const res = await fetch('/api/session');
  const data = await res.json();
  if (data.loggedIn) {
    currentUser = data;
    showDashboard(data.role);
  }
};

// Auth Functions
async function showLogin() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('loginPage').classList.add('active');
}

async function showSignup() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('signupPage').classList.add('active');
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  const data = await res.json();
  if (data.success) {
    currentUser = data;
    showDashboard(data.role);
  } else {
    alert(data.error);
  }
});

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('signupUsername').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  
  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  
  const data = await res.json();
  if (data.success) {
    alert('Registration successful! Please login.');
    showLogin();
  } else {
    alert(data.error);
  }
});

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  currentUser = null;
  showLogin();
}

function showDashboard(role) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  if (role === 'admin') {
    document.getElementById('adminDashboard').classList.add('active');
    document.getElementById('adminName').textContent = currentUser.username;
    loadAdminData();
  } else {
    document.getElementById('studentDashboard').classList.add('active');
    document.getElementById('studentName').textContent = currentUser.username;
    loadStudentData();
  }
}

function showTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(tabName).classList.add('active');
  
  if (tabName === 'timetable') loadTimetable();
  if (tabName === 'myCourses') loadMyRegistrations();
  if (tabName === 'manageRegistrations') loadAllRegistrations();
  if (tabName === 'students') loadStudents();
}

// Student Functions
async function loadStudentData() {
  await loadAvailableCourses();
  await loadMyRegistrations();
}

async function loadAvailableCourses() {
  const res = await fetch('/api/courses');
  const courses = await res.json();
  
  const myRegs = await fetch('/api/registrations');
  const registrations = await myRegs.json();
  const enrolledIds = registrations.map(r => r.course_id);
  
  const html = courses.map(course => `
    <div class="course-card">
      <h3>${course.code} - ${course.name}</h3>
      <div class="course-info">
        <div><strong>Instructor:</strong> ${course.instructor}</div>
        <div><strong>Credits:</strong> ${course.credits}</div>
        <div><strong>Schedule:</strong> ${course.day} ${course.start_time}-${course.end_time}</div>
        <div><strong>Capacity:</strong> ${course.enrolled}/${course.capacity}</div>
        <div><strong>Semester:</strong> ${course.semester}</div>
      </div>
      <p>${course.description || ''}</p>
      ${enrolledIds.includes(course.id) 
        ? '<span class="badge badge-success">Enrolled</span>' 
        : course.enrolled >= course.capacity 
          ? '<span class="badge badge-danger">Full</span>'
          : `<button class="btn-enroll" onclick="enrollCourse(${course.id})">Enroll</button>`
      }
    </div>
  `).join('');
  
  document.getElementById('coursesList').innerHTML = html || '<p>No courses available</p>';
}

async function enrollCourse(courseId) {
  const res = await fetch('/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ course_id: courseId })
  });
  
  const data = await res.json();
  if (data.success) {
    alert('Successfully enrolled!');
    loadAvailableCourses();
    loadMyRegistrations();
  } else {
    alert(data.error);
  }
}

async function loadMyRegistrations() {
  const res = await fetch('/api/registrations');
  const registrations = await res.json();
  
  const html = registrations.map(reg => `
    <div class="course-card">
      <h3>${reg.code} - ${reg.name}</h3>
      <div class="course-info">
        <div><strong>Instructor:</strong> ${reg.instructor}</div>
        <div><strong>Credits:</strong> ${reg.credits}</div>
        <div><strong>Schedule:</strong> ${reg.day} ${reg.start_time}-${reg.end_time}</div>
      </div>
      <button class="btn-drop" onclick="dropCourse(${reg.id})">Drop Course</button>
    </div>
  `).join('');
  
  document.getElementById('myRegistrations').innerHTML = html || '<p>No courses registered</p>';
}

async function dropCourse(regId) {
  if (!confirm('Are you sure you want to drop this course?')) return;
  
  const res = await fetch(`/api/registrations/${regId}`, { method: 'DELETE' });
  const data = await res.json();
  
  if (data.success) {
    alert('Course dropped successfully');
    loadAvailableCourses();
    loadMyRegistrations();
  }
}

async function loadTimetable() {
  const res = await fetch('/api/registrations');
  const registrations = await res.json();
  
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const times = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  
  let html = '<div class="timetable-grid"><table class="timetable-table"><thead><tr><th>Time</th>';
  days.forEach(day => html += `<th>${day}</th>`);
  html += '</tr></thead><tbody>';
  
  times.forEach(time => {
    html += `<tr><td><strong>${time}</strong></td>`;
    days.forEach(day => {
      const course = registrations.find(r => {
        if (r.day !== day) return false;
        const startHour = parseInt(r.start_time.split(':')[0]);
        const timeHour = parseInt(time.split(':')[0]);
        const endHour = parseInt(r.end_time.split(':')[0]);
        return timeHour >= startHour && timeHour < endHour;
      });
      
      if (course) {
        html += `<td><div class="timetable-slot"><strong>${course.code}</strong>${course.name}<br>${course.instructor}</div></td>`;
      } else {
        html += '<td></td>';
      }
    });
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  document.getElementById('timetableView').innerHTML = html;
}

// Admin Functions
async function loadAdminData() {
  await loadAdminCourses();
}

async function loadAdminCourses() {
  const res = await fetch('/api/courses');
  const courses = await res.json();
  
  const html = courses.map(course => `
    <div class="course-card">
      <h3>${course.code} - ${course.name}</h3>
      <div class="course-info">
        <div><strong>Instructor:</strong> ${course.instructor}</div>
        <div><strong>Credits:</strong> ${course.credits}</div>
        <div><strong>Schedule:</strong> ${course.day} ${course.start_time}-${course.end_time}</div>
        <div><strong>Enrolled:</strong> ${course.enrolled}/${course.capacity}</div>
        <div><strong>Semester:</strong> ${course.semester}</div>
      </div>
      <p>${course.description || ''}</p>
      <button class="btn-delete" onclick="deleteCourse(${course.id})">Delete</button>
    </div>
  `).join('');
  
  document.getElementById('adminCoursesList').innerHTML = html || '<p>No courses available</p>';
}

function showAddCourseForm() {
  document.getElementById('addCourseForm').style.display = 'block';
}

function hideAddCourseForm() {
  document.getElementById('addCourseForm').style.display = 'none';
  document.getElementById('courseForm').reset();
}

document.getElementById('courseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const courseData = {
    code: document.getElementById('courseCode').value,
    name: document.getElementById('courseName').value,
    instructor: document.getElementById('courseInstructor').value,
    credits: document.getElementById('courseCredits').value,
    capacity: document.getElementById('courseCapacity').value,
    day: document.getElementById('courseDay').value,
    start_time: document.getElementById('courseStartTime').value,
    end_time: document.getElementById('courseEndTime').value,
    semester: document.getElementById('courseSemester').value,
    description: document.getElementById('courseDescription').value
  };
  
  const res = await fetch('/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(courseData)
  });
  
  const data = await res.json();
  if (data.success) {
    alert('Course added successfully!');
    hideAddCourseForm();
    loadAdminCourses();
  } else {
    alert(data.error);
  }
});

async function deleteCourse(courseId) {
  if (!confirm('Are you sure? This will remove all registrations for this course.')) return;
  
  const res = await fetch(`/api/courses/${courseId}`, { method: 'DELETE' });
  const data = await res.json();
  
  if (data.success) {
    alert('Course deleted successfully');
    loadAdminCourses();
  }
}

async function loadAllRegistrations() {
  const res = await fetch('/api/registrations');
  const registrations = await res.json();
  
  const html = registrations.map(reg => `
    <div class="course-card">
      <h3>${reg.code} - ${reg.name}</h3>
      <div class="course-info">
        <div><strong>Student:</strong> ${reg.username}</div>
        <div><strong>Instructor:</strong> ${reg.instructor}</div>
        <div><strong>Schedule:</strong> ${reg.day} ${reg.start_time}-${reg.end_time}</div>
        <div><strong>Status:</strong> <span class="badge badge-success">${reg.status}</span></div>
      </div>
      <button class="btn-drop" onclick="removeRegistration(${reg.id})">Remove</button>
    </div>
  `).join('');
  
  document.getElementById('allRegistrations').innerHTML = html || '<p>No registrations found</p>';
}

async function removeRegistration(regId) {
  if (!confirm('Remove this registration?')) return;
  
  const res = await fetch(`/api/registrations/${regId}`, { method: 'DELETE' });
  const data = await res.json();
  
  if (data.success) {
    alert('Registration removed');
    loadAllRegistrations();
  }
}

async function loadStudents() {
  const res = await fetch('/api/students');
  const students = await res.json();
  
  const html = students.map(student => `
    <div class="student-card">
      <div>
        <strong>${student.username}</strong><br>
        <small>${student.email}</small>
      </div>
      <div>
        <small>Joined: ${new Date(student.created_at).toLocaleDateString()}</small>
      </div>
    </div>
  `).join('');
  
  document.getElementById('studentsList').innerHTML = html || '<p>No students registered</p>';
}
