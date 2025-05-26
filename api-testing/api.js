// api.js

// 1. Import Express
const express = require('express');
const app = express(); // Create an Express application
const PORT = 3000; // Port the API will run on

// 2. Middleware
// This middleware parses incoming JSON requests and puts the parsed data in req.body
app.use(express.json());

// Custom middleware for simple request logging (helps in demos)
app.use((req, res, next) => {
    const start = Date.now();
    // Log when the response is finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
        // Log request body for non-GET requests if it exists
        if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
            // Be cautious logging full request bodies in a real production app if they contain sensitive data.
            // For this demo API, it's useful for seeing what's being sent.
            console.log('Request Body:', JSON.stringify(req.body, null, 2));
        }
    });
    next(); // Move to the next middleware or route handler
});


// 3. In-Memory "Database" for Tasks
let tasks = [
    { id: 1, title: "Learn API Testing Basics", completed: false, description: "Understand different types of API tests." },
    { id: 2, title: "Prepare Video Script", completed: true, description: "Outline content for the 10-minute video." },
    { id: 3, title: "Record API Demos", completed: false, description: "Create live demos for each test type." }
];
let nextTaskId = 4; // To assign unique IDs to new tasks

// Define the Admin API Key (keep this simple for the demo)
const ADMIN_API_KEY = "your_secret_admin_key_123";

// 4. API Key Authentication Middleware (for admin endpoints)
const requireAdminApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key']; // HTTP headers are case-insensitive, but Express normalizes them to lowercase
    if (apiKey && apiKey === ADMIN_API_KEY) {
        next(); // API key is valid, proceed
    } else {
        console.warn(`Failed admin access attempt. IP: ${req.ip}. Provided key: ${apiKey || 'None'}`);
        res.status(401).json({ error: "Unauthorized. Valid X-API-KEY header required for this operation." });
    }
};


// 5. Define API Routes (Endpoints)

// --- HEALTH CHECK ---
// For Smoke Testing
app.get('/health', (req, res) => {
    res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

// --- TASK ENDPOINTS ---

// GET /tasks: Retrieve all tasks
// For Functional, Regression, Load, Stress Testing
app.get('/tasks', (req, res) => {
    res.status(200).json(tasks);
});

// POST /tasks: Create a new task
// For Functional Testing (happy path, error handling), Integration (audit log), Fuzz (malformed data)
app.post('/tasks', (req, res) => {
    const { title, completed, description } = req.body;

    // Basic validation for Functional/Fuzz testing
    if (!title || typeof title !== 'string' || title.trim() === "") {
        return res.status(400).json({ error: "Task title is required and must be a non-empty string." });
    }
    if (title.length > 100) { // For Fuzz Testing demo (oversized data)
        return res.status(400).json({ error: "Task title is too long (max 100 characters)." });
    }
    if (typeof completed !== 'undefined' && typeof completed !== 'boolean') {
        return res.status(400).json({ error: "Field 'completed' must be a boolean if provided." });
    }
    if (description && typeof description !== 'string') {
        return res.status(400).json({ error: "Field 'description' must be a string if provided." });
    }
     // For Fuzz testing: check for unexpected fields
    if (req.body.hasOwnProperty('unexpected_fuzz_field')) {
        console.error("FUZZING DETECTED: Unexpected field 'unexpected_fuzz_field' received!");
        // Intentionally fragile response for demo:
        // return res.status(500).json({ error: "Internal server error due to unexpected input." });
        // More robust response:
        return res.status(400).json({ error: "Unexpected field 'unexpected_fuzz_field' received. This API is robust!"})
    }


    const newTask = {
        id: nextTaskId++,
        title: title.trim(),
        description: description ? description.trim() : "No description",
        completed: completed === true // Ensure it's a boolean, default to false
    };
    tasks.push(newTask);

    // Simulate calling an "audit log service" for Integration Testing demo
    console.log(`AUDIT_LOG: New task created with id ${newTask.id} - Title: '${newTask.title}'`);

    res.status(201).json(newTask); // 201 Created
});

// GET /tasks/:id: Retrieve a single task by its ID
// For Functional Testing (happy path, not found)
app.get('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);

    // Basic validation
    if (isNaN(taskId)) {
        return res.status(400).json({ error: "Task ID must be a valid number." });
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        return res.status(404).json({ error: "Task not found." }); // 404 Not Found
    }
    res.status(200).json(task);
});

// PUT /tasks/:id: Update an existing task
// (Good for more complete functional testing)
app.put('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
        return res.status(400).json({ error: "Task ID must be a valid number." });
    }

    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        return res.status(404).json({ error: "Task not found." });
    }

    const { title, completed, description } = req.body;
    let updated = false;

    if (title !== undefined) {
        if (typeof title !== 'string' || title.trim() === "") {
            return res.status(400).json({ error: "Task title must be a non-empty string if provided." });
        }
        if (title.length > 100) {
             return res.status(400).json({ error: "Task title is too long (max 100 characters)." });
        }
        tasks[taskIndex].title = title.trim();
        updated = true;
    }
    if (description !== undefined) {
        if (typeof description !== 'string') {
            return res.status(400).json({ error: "Description must be a string if provided." });
        }
        tasks[taskIndex].description = description.trim();
        updated = true;
    }
    if (completed !== undefined) {
        if (typeof completed !== 'boolean') {
            return res.status(400).json({ error: "Field 'completed' must be a boolean if provided." });
        }
        tasks[taskIndex].completed = completed;
        updated = true;
    }

    if (!updated) {
        return res.status(400).json({ error: "No updateable fields provided (title, description, completed)." });
    }

    console.log(`AUDIT_LOG: Task updated with id ${tasks[taskIndex].id}`);
    res.status(200).json(tasks[taskIndex]);
});

// DELETE /tasks/:id: Delete a task
// (Good for more complete functional testing)
app.delete('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
        return res.status(400).json({ error: "Task ID must be a valid number." });
    }

    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        return res.status(404).json({ error: "Task not found." });
    }

    const deletedTask = tasks.splice(taskIndex, 1); // Remove the task
    console.log(`AUDIT_LOG: Task deleted with id ${taskId}`);
    // res.status(204).send(); // 204 No Content (common for DELETE)
    res.status(200).json({ message: "Task deleted successfully", task: deletedTask[0] }); // Or return the deleted task
});


// --- SPECIAL ENDPOINTS FOR DEMOS ---

// GET /tasks/slow: A deliberately slow endpoint
// For Load/Stress Testing demo to show increased response times or timeouts
app.get('/tasks/slow', (req, res) => {
    console.log("Request received for /tasks/slow endpoint...");
    const delay = 1500 + Math.random() * 2000; // Simulate 1.5 to 3.5 seconds delay

    setTimeout(() => {
        // Simulate a chance of failure under "stress" if the delay is long
        if (delay > 3000 && Math.random() < 0.2) { // 20% chance if delay > 3s
            console.error("/tasks/slow - Simulated server error due to prolonged processing (stress)!");
            return res.status(503).json({ error: "Service temporarily unavailable due to high load (simulated)." });
        }
        console.log(`/tasks/slow responding after ${delay.toFixed(0)}ms delay.`);
        res.status(200).json(tasks.slice(0, Math.min(tasks.length, 2))); // Return a couple of tasks
    }, delay);
});

// POST /admin/reset-all-tasks: Admin endpoint to reset data
// For Security Testing (API key auth) and convenience
app.post('/admin/reset-all-tasks', requireAdminApiKey, (req, res) => {
    // Reset tasks to their initial state
    tasks = [
        { id: 1, title: "Learn API Testing Basics", completed: false, description: "Understand different types of API tests." },
        { id: 2, title: "Prepare Video Script", completed: true, description: "Outline content for the 10-minute video." },
        { id: 3, title: "Record API Demos", completed: false, description: "Create live demos for each test type." }
    ];
    nextTaskId = 4; // Reset the ID counter

    console.log("ADMIN ACTION: All tasks have been reset by admin.");
    res.status(200).json({ message: "All tasks have been reset successfully." });
});


// 6. Catch-all for 404 Not Found (if no other route matched)
app.use((req, res, next) => {
    res.status(404).json({ error: "Not Found", message: `The requested URL ${req.originalUrl} was not found on this server.` });
});

// 7. Global Error Handler (catches errors from route handlers)
app.use((err, req, res, next) => {
    console.error("An unexpected error occurred:", err.stack);
    res.status(500).json({ error: "Internal Server Error", message: "Something went wrong on the server. Please try again later." });
});


// 8. Start the server
app.listen(PORT, () => {
    console.log(`Mock API server is running on http://localhost:${PORT}`);
    console.log("---------------------------------------------------------");
    console.log("Initial tasks available:", JSON.stringify(tasks.map(t => ({id: t.id, title: t.title})), null, 2));
    console.log("Admin API Key for /admin/reset-all-tasks (Header X-API-KEY): " + ADMIN_API_KEY);
    console.log("---------------------------------------------------------");
    console.log("Available routes:");
    console.log("  GET    /health");
    console.log("  GET    /tasks");
    console.log("  POST   /tasks           (Body: {title: string, completed?: boolean, description?: string})");
    console.log("  GET    /tasks/:id");
    console.log("  PUT    /tasks/:id       (Body: {title?: string, completed?: boolean, description?: string})");
    console.log("  DELETE /tasks/:id");
    console.log("  GET    /tasks/slow      (Simulates a slow response, good for load/stress demos)");
    console.log("  POST   /admin/reset-all-tasks (Requires X-API-KEY header for auth)");
    console.log("---------------------------------------------------------");
});
