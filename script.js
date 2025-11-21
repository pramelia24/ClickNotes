// --- STATE MANAGEMENT ---
let tasks = JSON.parse(localStorage.getItem('eq_tasks')) || [];
let settings = JSON.parse(localStorage.getItem('eq_settings')) || { sound: true, vibrate: true, theme: 'light' };

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(settings.theme);
    renderTasks();
    requestNotifPermission();
    
    // Timer untuk cek notifikasi setiap 10 detik
    setInterval(checkReminders, 10000);
});

// --- NAVIGATION ---
function switchTab(viewId, btnEl) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(btnEl) btnEl.classList.add('active');

    if(viewId === 'view-home') renderTasks();
    if(viewId === 'view-history') renderHistory();
}

// --- THEME & SETTINGS ---
function toggleTheme() {
    settings.theme = settings.theme === 'light' ? 'dark' : 'light';
    applyTheme(settings.theme);
    saveSettings();
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function saveSettings() {
    settings.sound = document.getElementById('set-sound').checked;
    settings.vibrate = document.getElementById('set-vibrate').checked;
    localStorage.setItem('eq_settings', JSON.stringify(settings));
}

function requestNotifPermission() {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

// --- CRUD TUGAS ---
function addNewTask() {
    const title = document.getElementById('inp-title').value;
    const desc = document.getElementById('inp-desc').value;
    const cat = document.getElementById('inp-cat').value;
    const prio = document.getElementById('inp-prio').value;
    const date = document.getElementById('inp-date').value;
    const freq = document.getElementById('inp-freq').value;

    if (!title || !date) {
        alert("Mohon isi Judul dan Waktu Deadline!");
        return;
    }

    const newTask = {
        id: Date.now(),
        title, desc, category: cat, priority: prio,
        deadline: date, frequency: freq,
        status: 'active',
        notified: false
    };

    tasks.push(newTask);
    saveData();
    
    // Reset form & Redirect
    document.getElementById('inp-title').value = '';
    document.getElementById('inp-desc').value = '';
    document.getElementById('inp-date').value = '';
    switchTab('view-home', document.querySelectorAll('.nav-item')[0]);
}

function completeTask(id) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex > -1) {
        const task = tasks[taskIndex];
        
        // Logika Pengulangan (Frequency)
        if (task.frequency !== 'once') {
            // Jika berulang, buat duplikat untuk jadwal berikutnya
            const nextDate = new Date(task.deadline);
            if (task.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
            if (task.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);

            // Update tugas saat ini menjadi selesai
            task.status = 'completed';
            task.completedAt = new Date().toLocaleString();
            
            // Buat tugas baru untuk periode berikutnya
            const nextTask = { ...task, id: Date.now(), deadline: nextDate.toISOString().slice(0,16), status: 'active', notified: false };
            tasks.push(nextTask);
        } else {
            task.status = 'completed';
            task.completedAt = new Date().toLocaleString();
        }
        
        saveData();
        renderTasks();
    }
}

function deleteTask(id) {
    if(confirm("Hapus tugas ini permanen?")) {
        tasks = tasks.filter(t => t.id !== id);
        saveData();
        renderTasks();
        renderHistory();
    }
}

function clearHistory() {
    if(confirm("Hapus semua riwayat tugas selesai?")) {
        tasks = tasks.filter(t => t.status !== 'completed');
        saveData();
        renderHistory();
    }
}

function saveData() {
    localStorage.setItem('eq_tasks', JSON.stringify(tasks));
}

// --- RENDERING ---
function renderTasks() {
    const container = document.getElementById('active-task-list');
    container.innerHTML = '';
    
    const activeTasks = tasks.filter(t => t.status === 'active');
    
    // Sort: Urgent first, then by date
    activeTasks.sort((a, b) => {
        const prioScore = { 'Urgent': 3, 'Penting': 2, 'Biasa': 1 };
        if (prioScore[b.priority] !== prioScore[a.priority]) {
            return prioScore[b.priority] - prioScore[a.priority];
        }
        return new Date(a.deadline) - new Date(b.deadline);
    });

    const emptyState = document.getElementById('empty-state');
    if(activeTasks.length === 0) {
        emptyState.style.display = 'block';
        return;
    } else {
        emptyState.style.display = 'none';
    }

    activeTasks.forEach(task => {
        const deadline = new Date(task.deadline);
        const isOverdue = new Date() > deadline;
        const dateStr = deadline.toLocaleString('id-ID', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});

        const html = `
            <div class="task-card prio-${task.priority}">
                <div class="task-content">
                    <div class="task-header">
                        <div class="task-title">${task.title}</div>
                        <span class="task-badge">${task.category}</span>
                    </div>
                    <div class="task-desc">${task.desc}</div>
                    <div class="task-meta">
                        <span class="${isOverdue ? 'task-overdue' : ''}">⏰ ${dateStr}</span>
                        ${task.frequency !== 'once' ? '<span>🔁 ' + task.frequency + '</span>' : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon btn-check" onclick="completeTask(${task.id})" title="Selesai">✅</button>
                    <button class="btn-icon btn-cal" onclick="addToCalendar(${task.id})" title="Simpan ke Kalender">📅</button>
                    <button class="btn-icon btn-trash" onclick="deleteTask(${task.id})" title="Hapus">🗑️</button>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function renderHistory() {
    const container = document.getElementById('history-task-list');
    container.innerHTML = '';
    const historyTasks = tasks.filter(t => t.status === 'completed').reverse();

    if(historyTasks.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary)">Belum ada riwayat.</p>';
        return;
    }

    historyTasks.forEach(task => {
        container.innerHTML += `
            <div class="task-card history-item">
                <div class="task-content">
                    <div class="task-title done">${task.title}</div>
                    <div class="task-meta">Selesai: ${task.completedAt}</div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon btn-trash" onclick="deleteTask(${task.id})">🗑️</button>
                </div>
            </div>
        `;
    });
}

// --- NOTIFICATION SYSTEM ---
function checkReminders() {
    const now = new Date();
    tasks.forEach(task => {
        if (task.status === 'active' && !task.notified) {
            const deadline = new Date(task.deadline);
            // Notifikasi jika waktu sekarang melewati deadline
            if (now >= deadline) {
                triggerNotification(task);
                task.notified = true; 
                saveData();
                renderTasks(); 
            }
        }
    });
}

function triggerNotification(task) {
    // 1. Push Notification
    if (Notification.permission === "granted") {
        new Notification(`Deadline: ${task.title}`, {
            body: `Waktunya menyelesaikan tugas ${task.category}! (${task.priority})`,
            icon: '' 
        });
    }

    // 2. Sound
    if (settings.sound) {
        const audio = document.getElementById('notif-sound');
        audio.play().catch(e => console.log("Audio play blocked"));
    }

    // 3. Vibrate (Android)
    if (settings.vibrate && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
}

// --- CALENDAR SYNC (ICS EXPORT) ---
function addToCalendar(id) {
    const task = tasks.find(t => t.id === id);
    if(!task) return;

    // Buat format tanggal ICS (YYYYMMDDTHHMMSS)
    const d = new Date(task.deadline);
    const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const start = formatICSDate(d);
    const end = formatICSDate(new Date(d.getTime() + 60*60*1000)); // Asumsi durasi 1 jam

    const icsContent = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Equilibrium Pro//Task Manager//ID
BEGIN:VEVENT
UID:${task.id}@equilibrium.app
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${start}
DTEND:${end}
SUMMARY:${task.title}
DESCRIPTION:${task.desc}
CATEGORIES:${task.category}
PRIORITY:${task.priority === 'Urgent' ? 1 : (task.priority === 'Penting' ? 5 : 9)}
END:VEVENT
END:VCALENDAR`;

    // Download file
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Task-${task.title}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
// --- STATE MANAGEMENT ---
let tasks = JSON.parse(localStorage.getItem('eq_tasks')) || [];

// --- SIMPAN DATA ---
function saveData() {
    localStorage.setItem('eq_tasks', JSON.stringify(tasks));
}

// --- TAMBAH TUGAS ---
function addNewTask() {
    const title = document.getElementById('inp-title').value.trim();
    const desc = document.getElementById('inp-desc').value.trim();
    const cat = document.getElementById('inp-cat').value;
    const prio = document.getElementById('inp-prio').value;
    const date = document.getElementById('inp-date').value;     // harus datetime-local
    const freq = document.getElementById('inp-freq').value;

    // Validasi
    if (!title || !date) {
        alert("Judul dan Waktu Deadline wajib diisi.");
        return;
    }

    const newTask = {
        id: Date.now(),
        title,
        desc,
        category: cat,
        priority: prio,
        deadline: date,
        frequency: freq,
        status: 'active',
        notified: false
    };

    // Masukkan ke array
    tasks.push(newTask);

    // Simpan ke localStorage
    saveData();

    // Bersihkan input
    document.getElementById('inp-title').value = '';
    document.getElementById('inp-desc').value = '';
    document.getElementById('inp-date').value = '';
    document.getElementById('inp-cat').value = 'Umum';
    document.getElementById('inp-prio').value = 'Biasa';
    document.getElementById('inp-freq').value = 'once';

    alert("Tugas berhasil disimpan!");
}
