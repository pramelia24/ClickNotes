// --- STATE MANAGEMENT ---
// Mengambil data dari LocalStorage saat aplikasi dibuka
let tasks = JSON.parse(localStorage.getItem('eq_tasks')) || [];
let settings = JSON.parse(localStorage.getItem('eq_settings')) || { sound: true, vibrate: true, theme: 'light' };

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(settings.theme);
    renderTasks(); // Tampilkan tugas saat load
    requestNotifPermission();
    
    // Cek notifikasi setiap 10 detik
    setInterval(checkReminders, 10000);
});

// --- NAVIGATION ---
function switchTab(viewId, btnEl) {
    // Sembunyikan semua halaman
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    // Tampilkan halaman yang dipilih
    document.getElementById(viewId).classList.add('active');
    
    // Update tombol navigasi aktif
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(btnEl) {
        btnEl.classList.add('active');
    } else {
        // Jika dipanggil manual tanpa klik tombol (misal setelah save)
        // Cari tombol yang sesuai logika ID
        if(viewId === 'view-home') document.querySelector('.nav-item:nth-child(1)').classList.add('active');
    }

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

// --- FITUR UTAMA: TAMBAH TUGAS (CRUD) ---
function addNewTask() {
    // 1. Ambil nilai dari input HTML
    const title = document.getElementById('inp-title').value;
    const desc = document.getElementById('inp-desc').value;
    const cat = document.getElementById('inp-cat').value;
    const prio = document.getElementById('inp-prio').value;
    const date = document.getElementById('inp-date').value;
    const freq = document.getElementById('inp-freq').value;

    // 2. Validasi: Judul dan Tanggal Wajib Diisi
    if (!title) {
        showToast("Judul tugas tidak boleh kosong!", true);
        return;
    }
    if (!date) {
        showToast("Tentukan tanggal deadline!", true);
        return;
    }

    // 3. Buat Objek Tugas Baru
    const newTask = {
        id: Date.now(), // ID unik berdasarkan waktu
        title: title,
        desc: desc,
        category: cat,
        priority: prio,
        deadline: date,
        frequency: freq,
        status: 'active',
        notified: false
    };

    // 4. Simpan ke Array dan LocalStorage
    tasks.push(newTask);
    saveData();
    
    // 5. Reset Form Input agar kosong kembali
    document.getElementById('inp-title').value = '';
    document.getElementById('inp-desc').value = '';
    document.getElementById('inp-date').value = '';

    // 6. Pindah ke Halaman Home & Tampilkan Notifikasi
    switchTab('view-home');
    renderTasks(); // Pastikan daftar direfresh
    showToast("Tugas berhasil disimpan!");
}

function completeTask(id) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex > -1) {
        const task = tasks[taskIndex];
        
        // Logika Pengulangan (Frequency)
        if (task.frequency !== 'once') {
            const nextDate = new Date(task.deadline);
            if (task.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
            if (task.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);

            task.status = 'completed';
            task.completedAt = new Date().toLocaleString();
            
            const nextTask = { ...task, id: Date.now(), deadline: nextDate.toISOString().slice(0,16), status: 'active', notified: false };
            tasks.push(nextTask);
        } else {
            task.status = 'completed';
            task.completedAt = new Date().toLocaleString();
        }
        
        saveData();
        renderTasks();
        showToast("Tugas selesai! Masuk ke riwayat.");
    }
}

function deleteTask(id) {
    if(confirm("Hapus tugas ini permanen?")) {
        tasks = tasks.filter(t => t.id !== id);
        saveData();
        renderTasks();
        renderHistory();
        showToast("Tugas dihapus.");
    }
}

function clearHistory() {
    if(confirm("Hapus semua riwayat tugas selesai?")) {
        tasks = tasks.filter(t => t.status !== 'completed');
        saveData();
        renderHistory();
        showToast("Riwayat dibersihkan.");
    }
}

function saveData() {
    localStorage.setItem('eq_tasks', JSON.stringify(tasks));
}

// --- RENDERING (MENAMPILKAN DATA) ---
function renderTasks() {
    const container = document.getElementById('active-task-list');
    if(!container) return;
    
    container.innerHTML = '';
    
    const activeTasks = tasks.filter(t => t.status === 'active');
    
    // Urutkan: Urgent paling atas, lalu berdasarkan tanggal terdekat
    activeTasks.sort((a, b) => {
        const prioScore = { 'Urgent': 3, 'Penting': 2, 'Biasa': 1 };
        if (prioScore[b.priority] !== prioScore[a.priority]) {
            return prioScore[b.priority] - prioScore[a.priority];
        }
        return new Date(a.deadline) - new Date(b.deadline);
    });

    const emptyState = document.getElementById('empty-state');
    if(activeTasks.length === 0) {
        if(emptyState) emptyState.style.display = 'block';
    } else {
        if(emptyState) emptyState.style.display = 'none';
        
        activeTasks.forEach(task => {
            const deadline = new Date(task.deadline);
            const isOverdue = new Date() > deadline;
            const dateStr = deadline.toLocaleString('id-ID', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});

            // Render HTML Tugas
            const html = `
                <div class="task-card prio-${task.priority}">
                    <div class="task-content">
                        <div class="task-header">
                            <div class="task-title">${task.title}</div>
                            <span class="task-badge">${task.category}</span>
                        </div>
                        <div class="task-desc">${task.desc}</div>
                        <div class="task-meta">
                            <span class="${isOverdue ? 'task-overdue' : ''}" style="display:flex; align-items:center; gap:4px;">
                                <span class="material-icons-round" style="font-size:14px">schedule</span> ${dateStr}
                            </span>
                            ${task.frequency !== 'once' ? '<span style="display:flex; align-items:center; margin-left:8px; gap:4px;"><span class="material-icons-round" style="font-size:14px">repeat</span> ' + task.frequency + '</span>' : ''}
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="btn-icon btn-check" onclick="completeTask(${task.id})" title="Selesai">
                            <span class="material-icons-round">check_circle</span>
                        </button>
                        <button class="btn-icon btn-cal" onclick="addToCalendar(${task.id})" title="Simpan ke Kalender">
                            <span class="material-icons-round">event</span>
                        </button>
                        <button class="btn-icon btn-trash" onclick="deleteTask(${task.id})" title="Hapus">
                            <span class="material-icons-round">delete</span>
                        </button>
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });
    }
}

function renderHistory() {
    const container = document.getElementById('history-task-list');
    if(!container) return;
    
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
                    <button class="btn-icon btn-trash" onclick="deleteTask(${task.id})">
                        <span class="material-icons-round">delete</span>
                    </button>
                </div>
            </div>
        `;
    });
}

// --- HELPER: TOAST NOTIFICATION ---
// Menampilkan pesan pop-up kecil di bawah layar
function showToast(message, isError = false) {
    // Cek apakah elemen toast sudah ada di HTML, jika tidak buat baru
    let toastBox = document.getElementById('toast-box');
    if (!toastBox) {
        toastBox = document.createElement('div');
        toastBox.id = 'toast-box';
        document.body.appendChild(toastBox);
    }

    toastBox.innerText = message;
    toastBox.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--text-primary)';
    toastBox.className = 'show';

    // Hilangkan setelah 3 detik
    setTimeout(() => { toastBox.className = toastBox.className.replace('show', ''); }, 3000);
}

// --- NOTIFICATION SYSTEM ---
function checkReminders() {
    const now = new Date();
    tasks.forEach(task => {
        if (task.status === 'active' && !task.notified) {
            const deadline = new Date(task.deadline);
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
    if (Notification.permission === "granted") {
        new Notification(`Deadline: ${task.title}`, {
            body: `Waktunya menyelesaikan tugas ${task.category}!`,
            icon: '' 
        });
    }
    if (settings.sound) {
        const audio = document.getElementById('notif-sound');
        if(audio) audio.play().catch(e => console.log("Audio play blocked"));
    }
    if (settings.vibrate && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
}

// --- CALENDAR SYNC ---
function addToCalendar(id) {
    const task = tasks.find(t => t.id === id);
    if(!task) return;
    const d = new Date(task.deadline);
    const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const start = formatICSDate(d);
    const end = formatICSDate(new Date(d.getTime() + 3600000));
    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${start}\nDTEND:${end}\nSUMMARY:${task.title}\nDESCRIPTION:${task.desc}\nEND:VEVENT\nEND:VCALENDAR`;
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Task.ics`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
