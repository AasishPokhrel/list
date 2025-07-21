// DOM Elements
const taskInput = document.getElementById('taskInput');
const dueDateInput = document.getElementById('dueDateInput');
const categoryInput = document.getElementById('categoryInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const searchInput = document.getElementById('searchInput');
const filterSelect = document.getElementById('filterSelect');
const categoryFilter = document.getElementById('categoryFilter');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const voiceInputBtn = document.getElementById('voiceInputBtn');
const voiceStatus = document.getElementById('voiceStatus');
const newCategoryInput = document.getElementById('newCategoryInput');
const addCategoryBtn = document.getElementById('addCategoryBtn');

// Initialize tasks and categories from localStorage
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let categories = JSON.parse(localStorage.getItem('categories')) || ['Work', 'Personal', 'Shopping', 'Health'];

// Initialize the app
function init() {
    renderTasks();
    renderCategories();
    updateProgress();
    setupEventListeners();
    checkNotificationPermission();
    registerServiceWorker();
    
    // Set minimum date to today
    dueDateInput.min = new Date().toISOString().split('T')[0];
}

// Set up event listeners
function setupEventListeners() {
    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
    
    searchInput.addEventListener('input', filterTasks);
    filterSelect.addEventListener('change', filterTasks);
    categoryFilter.addEventListener('change', filterTasks);
    
    voiceInputBtn.addEventListener('click', toggleVoiceInput);
    addCategoryBtn.addEventListener('click', addCategory);
    
    // Make task list sortable
    new Sortable(taskList, {
        animation: 150,
        ghostClass: 'bg-gray-100',
        onEnd: function(evt) {
            // Update task order in the array
            const taskElements = Array.from(taskList.children);
            tasks = taskElements.map(el => {
                const taskId = parseInt(el.getAttribute('data-id'));
                return tasks.find(task => task.id === taskId);
            });
            saveTasks();
        }
    });
}

// Render tasks to the DOM
function renderTasks(filteredTasks = null) {
    const tasksToRender = filteredTasks || tasks;
    taskList.innerHTML = '';
    
    if (tasksToRender.length === 0) {
        taskList.innerHTML = '<li class="py-4 text-center text-gray-500">No tasks found</li>';
        return;
    }
    
    tasksToRender.forEach(task => {
        const taskElement = document.createElement('li');
        taskElement.className = `py-3 px-2 hover:bg-gray-50 cursor-move ${task.completed ? 'opacity-70' : ''}`;
        taskElement.setAttribute('data-id', task.id);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(task.dueDate);
        const isOverdue = dueDate < today && !task.completed;
        
        taskElement.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <input type="checkbox" ${task.completed ? 'checked' : ''} 
                           class="h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500 mr-3 task-checkbox">
                    <div>
                        <span class="${task.completed ? 'line-through text-gray-500' : 'text-gray-800'}">${task.text}</span>
                        <div class="flex items-center mt-1 text-sm">
                            ${task.dueDate ? `
                                <span class="${isOverdue ? 'text-red-500' : 'text-gray-500'} mr-2">
                                    <i class="far fa-calendar-alt mr-1"></i>${formatDate(task.dueDate)}
                                </span>
                            ` : ''}
                            ${task.category ? `
                                <span class="bg-${getCategoryColor(task.category)}-100 text-${getCategoryColor(task.category)}-800 text-xs px-2 py-0.5 rounded">
                                    ${task.category}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <button class="text-red-500 hover:text-red-700 delete-btn">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        taskList.appendChild(taskElement);
    });
    
    // Add event listeners to checkboxes and delete buttons
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', toggleTaskComplete);
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('change', deleteTask);
    });
}

// Render categories to select inputs
function renderCategories() {
    categoryInput.innerHTML = '<option value="">No Category</option>';
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    
    categories.forEach(category => {
        categoryInput.innerHTML += `<option value="${category}">${category}</option>`;
        categoryFilter.innerHTML += `<option value="${category}">${category}</option>`;
    });
}

// Add a new task
function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    
    const dueDate = dueDateInput.value;
    const category = categoryInput.value;
    
    const newTask = {
        id: Date.now(),
        text,
        dueDate,
        category,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    tasks.push(newTask);
    saveTasks();
    renderTasks();
    updateProgress();
    
    // Clear inputs
    taskInput.value = '';
    dueDateInput.value = '';
    categoryInput.value = '';
    
    // Schedule notification if due date is set
    if (dueDate) {
        scheduleNotification(newTask);
    }
}

// Toggle task completion status
function toggleTaskComplete(e) {
    const taskId = parseInt(e.target.closest('li').getAttribute('data-id'));
    const task = tasks.find(task => task.id === taskId);
    task.completed = e.target.checked;
    saveTasks();
    updateProgress();
    
    // Update the task appearance
    const taskElement = e.target.closest('li');
    if (task.completed) {
        taskElement.classList.add('opacity-70');
        taskElement.querySelector('span').classList.add('line-through', 'text-gray-500');
    } else {
        taskElement.classList.remove('opacity-70');
        taskElement.querySelector('span').classList.remove('line-through', 'text-gray-500');
    }
}

// Delete a task
function deleteTask(e) {
    const taskId = parseInt(e.target.closest('li').getAttribute('data-id'));
    tasks = tasks.filter(task => task.id !== taskId);
    saveTasks();
    renderTasks();
    updateProgress();
}

// Filter tasks based on search, filter and category
function filterTasks() {
    const searchTerm = searchInput.value.toLowerCase();
    const filterValue = filterSelect.value;
    const categoryValue = categoryFilter.value;
    
    let filteredTasks = tasks.filter(task => {
        const matchesSearch = task.text.toLowerCase().includes(searchTerm);
        const matchesCategory = categoryValue === 'all' || task.category === categoryValue;
        
        if (!matchesSearch || !matchesCategory) return false;
        
        if (filterValue === 'all') return true;
        if (filterValue === 'completed') return task.completed;
        if (filterValue === 'today' || filterValue === 'week' || filterValue === 'overdue') {
            if (!task.dueDate) return false;
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(task.dueDate);
            
            if (filterValue === 'today') {
                return dueDate.getTime() === today.getTime();
            } else if (filterValue === 'week') {
                const nextWeek = new Date(today);
                nextWeek.setDate(today.getDate() + 7);
                return dueDate >= today && dueDate <= nextWeek;
            } else if (filterValue === 'overdue') {
                return dueDate < today && !task.completed;
            }
        }
        
        return true;
    });
    
    renderTasks(filteredTasks);
}

// Update progress bar
function updateProgress() {
    if (tasks.length === 0) {
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        return;
    }
    
    const completedCount = tasks.filter(task => task.completed).length;
    const progress = Math.round((completedCount / tasks.length) * 100);
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
}

// Save tasks to localStorage
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
    localStorage.setItem('categories', JSON.stringify(categories));
}

// Add a new category
function addCategory() {
    const categoryName = newCategoryInput.value.trim();
    if (!categoryName || categories.includes(categoryName)) return;
    
    categories.push(categoryName);
    saveTasks();
    renderCategories();
    newCategoryInput.value = '';
}

// Voice input functionality
function toggleVoiceInput() {
    if (!('webkitSpeechRecognition' in window)) {
        voiceStatus.textContent = 'Voice input not supported in your browser';
        return;
    }
    
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    if (voiceInputBtn.classList.contains('bg-indigo-600')) {
        // Stop listening
        recognition.stop();
        voiceInputBtn.classList.remove('bg-indigo-600', 'text-white');
        voiceInputBtn.classList.add('bg-gray-200', 'text-gray-700');
        voiceStatus.textContent = 'Ready';
    } else {
        // Start listening
        recognition.start();
        voiceInputBtn.classList.remove('bg-gray-200', 'text-gray-700');
        voiceInputBtn.classList.add('bg-indigo-600', 'text-white');
        voiceStatus.textContent = 'Listening...';
    }
    
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        taskInput.value = transcript;
        voiceInputBtn.classList.remove('bg-indigo-600', 'text-white');
        voiceInputBtn.classList.add('bg-gray-200', 'text-gray-700');
        voiceStatus.textContent = 'Ready';
    };
    
    recognition.onerror = function(event) {
        voiceInputBtn.classList.remove('bg-indigo-600', 'text-white');
        voiceInputBtn.classList.add('bg-gray-200', 'text-gray-700');
        voiceStatus.textContent = 'Error occurred: ' + event.error;
    };
}

// Format date for display
function formatDate(dateString) {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Get color for category badge
function getCategoryColor(category) {
    const colors = ['indigo', 'blue', 'green', 'yellow', 'red', 'purple', 'pink'];
    const index = Math.abs(hashCode(category)) % colors.length;
    return colors[index];
}

// Simple hash function for category colors
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
}

// Notification functions
function checkNotificationPermission() {
    if (!('Notification' in window)) return;
    
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            console.log('Notification permission:', permission);
        });
    }
}

function scheduleNotification(task) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    
    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const timeUntilDue = dueDate - now;
    
    // Only schedule if due date is in the future
    if (timeUntilDue > 0) {
        // Notify one hour before due date
        const notifyTime = timeUntilDue - (60 * 60 * 1000);
        
        if (notifyTime > 0) {
            setTimeout(() => {
                new Notification('Task Due Soon', {
                    body: `Your task "${task.text}" is due in one hour!`,
                    icon: '/icon.png'
                });
            }, notifyTime);
        }
    }
}

// PWA Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('ServiceWorker registration successful');
                
                // Check if the app is being launched from a homescreen icon
                window.addEventListener('beforeinstallprompt', (e) => {
                    // Prevent the mini-infobar from appearing on mobile
                    e.preventDefault();
                    // Stash the event so it can be triggered later
                    const deferredPrompt = e;
                    // Show install button or custom prompt
                    showInstallPrompt(deferredPrompt);
                });
            }).catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }
}

function showInstallPrompt(deferredPrompt) {
    // You could show a custom install button here
    // and then call deferredPrompt.prompt() when clicked
    console.log('App can be installed');
    // For this example, we'll prompt immediately
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choiceResult => {
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted install');
        } else {
            console.log('User dismissed install');
        }
    });
}

// Initialize the app
init();