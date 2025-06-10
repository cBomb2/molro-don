const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

const clients = new Map(); // Map: socket → { username, role }
const projects = {}; // In-memory project data

// Project format:
// projects = {
//   AB123: {
//     name: "My Project",
//     createdBy: "admin",
//     tasks: ["Design", "Code"],
//     assignments: {
//       "alice": [ { text: "Design", done: false }, ... ]
//     }
//   }
// }

server.on('connection', socket => {
  console.log("Client connected.");

  socket.on('message', msg => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    // Handle login/register
    if (data.type === 'login') {
      clients.set(socket, { username: data.username, role: data.role });
      socket.send(JSON.stringify({ type: 'login_success' }));
    }

    // Create new project
    else if (data.type === 'create_project') {
      const user = clients.get(socket);
      const code = generateCode();
      projects[code] = {
        name: data.name,
        createdBy: user.username,
        tasks: [],
        assignments: {}
      };
      broadcast({ type: 'project_created', code, project: projects[code] });
    }

    // Assign tasks
    else if (data.type === 'assign') {
      const proj = projects[data.code];
      if (!proj) return;
      proj.tasks = data.tasks;
      proj.assignments[data.user] = data.tasks.map(task => ({ text: task, done: false }));
      broadcast({ type: 'tasks_assigned', code: data.code, project: proj });
    }

    // Update task progress
    else if (data.type === 'update_progress') {
      const proj = projects[data.code];
      if (!proj || !proj.assignments[data.user]) return;
      proj.assignments[data.user] = data.tasks;
      broadcast({ type: 'progress_updated', code: data.code, project: proj });
    }

    // Request full data
    else if (data.type === 'get_all') {
      socket.send(JSON.stringify({ type: 'all_data', projects }));
    }
  });

  socket.on('close', () => {
    clients.delete(socket);
    console.log("Client disconnected.");
  });
});

// Broadcast message to all connected clients
function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of clients.keys()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// Generate random project code
function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

console.log("WebSocket server running on ws://localhost:8080");
