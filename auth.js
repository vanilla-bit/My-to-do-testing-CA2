let tasks = [];
let currentFilter = 'all';
let currentCategory = 'all';
let currentUser = null;

// Helper: Get auth from either localStorage or sessionStorage
function getAuthToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

function getUserName() {
    return localStorage.getItem('userName') || sessionStorage.getItem('userName');
}

function getUserId() {
    return localStorage.getItem('userId') || sessionStorage.getItem('userId');
}

// Helper: Set auth to the appropriate storage based on keepSignedIn flag
function setAuthData(userId, userName, keepSignedIn) {
    if (keepSignedIn) {
        // Use localStorage (persist until manually deleted)
        localStorage.setItem('authToken', 'token_' + userId);
        localStorage.setItem('userName', userName);
        localStorage.setItem('userId', String(userId));
        localStorage.setItem('keepSignedIn', '1');
        // Clear sessionStorage to avoid conflicts
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userName');
        sessionStorage.removeItem('userId');
    } else {
        // Use sessionStorage (clear when browser closes)
        sessionStorage.setItem('authToken', 'token_' + userId);
        sessionStorage.setItem('userName', userName);
        sessionStorage.setItem('userId', String(userId));
        // Clear localStorage to avoid conflicts
        localStorage.removeItem('authToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');
        localStorage.removeItem('keepSignedIn');
    }
}

// Check authentication on page load
window.addEventListener('DOMContentLoaded', () => {
    const token = getAuthToken();
    const userName = getUserName();
    const userId = getUserId();
    // if not authenticated, redirect to login.html unless we're already there
    const path = window.location.pathname;
    const file = path.substring(path.lastIndexOf('/') + 1);
    
    // Show username on login page header if exists
    const welcomeNameEl = document.getElementById('welcomeName');
    if (welcomeNameEl && userName) {
        welcomeNameEl.textContent = userName;
    }
    
    if (!token || !userId) {
        if (file !== 'login.html' && file !== 'signup.html') {
            window.location.href = 'login.html';
        }
        return;
    }
    
    currentUser = {
        id: parseInt(userId),
        name: userName
    };
    
    // Display user name
    document.getElementById('userName').textContent = userName;
    
    // Load user's tasks (PERSISTED - will remember all past inputs!)
    loadTasks();
    renderTasks();
    updateStats();
    
    // Add Enter key support
    document.getElementById('taskInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
});

// Add task
function addTask() {
    const input = document.getElementById('taskInput');
    const priority = document.getElementById('prioritySelect').value;
    const category = document.getElementById('categorySelect').value;
    const text = input.value.trim();

    if (!text) {
        alert('Please enter a task!');
        return;
    }

    const task = {
        id: Date.now(),
        userId: currentUser.id,
        text: escapeHtml(text),
        priority: priority,
        category: category,
        completed: false,
        createdAt: new Date().toISOString()
    };

    tasks.push(task);
    saveTasks(); // SAVE TO PERSIST HISTORY
    renderTasks();
    updateStats();
    input.value = '';
    input.focus();
    
    showSyncStatus('Saved ✅');
}

// Toggle task completion
function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderTasks();
        updateStats();
        showSyncStatus('Updated ✅');
    }
}

// Delete task
function deleteTask(id) {
    if (confirm('Delete this task?')) {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
        updateStats();
        showSyncStatus('Deleted ✅');
    }
}

// Filter tasks
function filterTasks(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    renderTasks();
}

// Filter by category
function filterByCategory(category) {
    currentCategory = category;
    renderTasks();
}

// Search tasks
function searchTasks() {
    renderTasks();
}

// Render tasks
function renderTasks() {
    const taskList = document.getElementById('taskList');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    // Filter by user
    let filteredTasks = tasks.filter(t => t.userId === currentUser.id);
    
    // Apply status filter
    if (currentFilter === 'active') {
        filteredTasks = filteredTasks.filter(t => !t.completed);
    } else if (currentFilter === 'completed') {
        filteredTasks = filteredTasks.filter(t => t.completed);
    }
    
    // Apply category filter
    if (currentCategory !== 'all') {
        filteredTasks = filteredTasks.filter(t => t.category === currentCategory);
    }
    
    // Apply search
    if (searchTerm) {
        filteredTasks = filteredTasks.filter(t => 
            t.text.toLowerCase().includes(searchTerm)
        );
    }
    
    // Sort: incomplete first, then by priority, then by date
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    filteredTasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // Render
    taskList.innerHTML = '';
    
    if (filteredTasks.length === 0) {
        taskList.innerHTML = '<li style="text-align:center;padding:20px;color:#999;">No tasks found</li>';
        return;
    }
    
    const categoryEmojis = {
        work: '💼',
        personal: '🏠',
        shopping: '🛒',
        health: '💪',
        other: '📌'
    };
    //
    filteredTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item priority-${task.priority} ${task.completed ? 'completed' : ''}`;
        
        const date = new Date(task.createdAt).toLocaleDateString();
        
        li.innerHTML = `
            <input type="checkbox" class="task-checkbox" 
                   ${task.completed ? 'checked' : ''} 
                   onchange="toggleTask(${task.id})">
            <span class="task-text">${task.text}</span>
            <span class="category-badge">${categoryEmojis[task.category]} ${task.category}</span>
            <span class="priority-badge priority-${task.priority}">${task.priority}</span>
            <span style="font-size:0.8rem;color:#999;">${date}</span>
            <button class="delete-btn" onclick="deleteTask(${task.id})">✖</button>
        `;
        taskList.appendChild(li);
    });
}

// Update statistics
function updateStats() {
    const userTasks = tasks.filter(t => t.userId === currentUser.id);
    const total = userTasks.length;
    const completed = userTasks.filter(t => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('pendingTasks').textContent = pending;
    // update the progress box (some files use 'progressPercent' id)
    const progressEl = document.getElementById('progressPercent') || document.getElementById('completionRate');
    if (progressEl) progressEl.textContent = completionRate + '%';
}

// Save tasks to localStorage (PERSISTS HISTORY!)
function saveTasks() {
    localStorage.setItem('tasks_v2', JSON.stringify(tasks));
}

// Load tasks from localStorage (REMEMBERS ALL PAST INPUTS!)
function loadTasks() {
    const saved = localStorage.getItem('tasks_v2');
    if (saved) {
        tasks = JSON.parse(saved);
    }
}

// Export tasks
function exportTasks() {
    const userTasks = tasks.filter(t => t.userId === currentUser.id);
    
    if (userTasks.length === 0) {
        alert('No tasks to export!');
        return;
    }
    
    const dataStr = JSON.stringify(userTasks, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_${currentUser.name}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    alert('Tasks exported successfully!');
}

// Import tasks
function importTasks(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedTasks = JSON.parse(e.target.result);
            
            // Add imported tasks with new IDs and current user
            importedTasks.forEach(task => {
                tasks.push({
                    ...task,
                    id: Date.now() + Math.random(), // New unique ID
                    userId: currentUser.id // Assign to current user
                });
            });
            
            saveTasks();
            renderTasks();
            updateStats();
            alert(`Imported ${importedTasks.length} tasks successfully!`);
        } catch (error) {
            alert('Error importing file. Please check the format.');
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear from both localStorage and sessionStorage
        localStorage.removeItem('authToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');
        localStorage.removeItem('keepSignedIn');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userName');
        sessionStorage.removeItem('userId');
        // Tasks remain saved for when user logs back in
        window.location.href = 'login.html';
    }
}

// Show sync status
function showSyncStatus(message) {
    const status = document.getElementById('syncStatus');
    status.textContent = message;
    setTimeout(() => {
        status.textContent = '✅ Synced';
    }, 2000);
}

// Prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- Authentication UI helpers and handlers ---
function getAccounts() {
    try {
        return JSON.parse(localStorage.getItem('accounts') || '[]');
    } catch {
        return [];
    }
}

function saveAccounts(accounts) {
    localStorage.setItem('accounts', JSON.stringify(accounts));
}

function showSignup() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.remove('hidden');
}

function showLogin() {
    document.getElementById('signupForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
}

function handleSignup(event) {
    event.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;
    const msg = document.getElementById('signupMessage');

    if (!name || !email || !password) {
        msg.innerHTML = '<div class="message error">Please fill all fields</div>';
        return;
    }

    const accounts = getAccounts();
    const exists = accounts.find(a => a.email === email);
    if (exists) {
        msg.innerHTML = '<div class="message error">Account already exists. Please log in.</div>';
        return;
    }

    const userId = Date.now();
    const account = { id: userId, name: name, email: email, password: password };
    accounts.push(account);
    saveAccounts(accounts);

    // Auto-login after signup (default: keep signed in = true since checkbox is checked by default)
    setAuthData(userId, name, true);

    msg.innerHTML = '<div class="message success">Account created. Redirecting...</div>';
    setTimeout(() => { window.location.href = 'index.html'; }, 700);
}

function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('keepSignedIn').checked;
    const msg = document.getElementById('message');

    if (!email || !password) {
        msg.innerHTML = '<div class="message error">Please enter email and password</div>';
        return;
    }

    const accounts = getAccounts();
    const account = accounts.find(a => a.email === email && a.password === password);
    if (!account) {
        msg.innerHTML = '<div class="message error">No account found. Please sign up</div>';
        return;
    }

    // Successful login: store auth in localStorage or sessionStorage based on checkbox
    setAuthData(account.id, account.name, remember);

    msg.innerHTML = '<div class="message success">Login successful. Redirecting...</div>';
    setTimeout(() => { window.location.href = 'index.html'; }, 400);
}

// Note: logout is defined above with confirmation. Keep that implementation.