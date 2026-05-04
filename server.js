// Complete working server with data loading
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Socket.IO with CORS configuration
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3002;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');
const QUOTES_FILE = path.join(DATA_DIR, 'quotes.json');
const REACTIONS_FILE = path.join(DATA_DIR, 'reactions.json');
const CHAT_DIR = path.join(DATA_DIR, 'chats');
const ONE_ON_ONE_DIR = path.join(DATA_DIR, 'one_on_one');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CHAT_DIR)) fs.mkdirSync(CHAT_DIR, { recursive: true });
if (!fs.existsSync(ONE_ON_ONE_DIR)) fs.mkdirSync(ONE_ON_ONE_DIR, { recursive: true });

// Serve static files
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Random name generation
const adjectives = ['Quiet', 'Happy', 'Sad', 'Angry', 'Calm', 'Wise', 'Funny', 'Brave', 'Shy', 'Kind'];
const nouns = ['Fox', 'Wolf', 'Bear', 'Eagle', 'Lion', 'Tiger', 'Owl', 'Deer', 'Rabbit', 'Mouse'];
const colors = ['#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3', '#33FFF3', '#8A2BE2', '#FF7F50', '#6495ED', '#DC143C'];
const CATEGORIES = ['Deep', 'Confessions', 'Advice', 'Late Night', 'Funny'];
const MOODS = ['Reflective', 'Hopeful', 'Heavy', 'Curious', 'Unfiltered', 'Celebrating'];
const REACTIONS = ['felt this', 'hmm', 'deep', 'ouch'];
const IDENTITY_MODES = ['The Overthinker', 'The Romantic', 'The Cynic', 'The Observer'];
const rateBuckets = new Map();

function generateRandomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

function generateRandomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

function sanitizeText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key) || [];
  const recent = bucket.filter(ts => now - ts < windowMs);
  if (recent.length >= limit) {
    rateBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  return true;
}

function emitRateLimited(socket, action) {
  socket.emit('rateLimited', {
    action,
    message: `Slow down a little before trying ${action} again.`
  });
}

function readJsonFile(file, fallback, validate, label) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return validate(parsed) ? parsed : fallback;
  } catch (err) {
    console.error(`Error loading ${label}:`, err);
    return fallback;
  }
}

function writeJsonFile(file, value, label) {
  try {
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error saving ${label}:`, err);
  }
}

// Data loading and saving functions
function loadQuotes() {
  return readJsonFile(QUOTES_FILE, [], Array.isArray, 'quotes');
}

function saveQuotes(quotes) {
  writeJsonFile(QUOTES_FILE, Array.isArray(quotes) ? quotes : [], 'quotes');
}

function loadReactions() {
  return readJsonFile(
    REACTIONS_FILE,
    {},
    value => value && typeof value === 'object' && !Array.isArray(value),
    'reactions'
  );
}

function saveReactions(reactions) {
  const safeReactions = reactions && typeof reactions === 'object' && !Array.isArray(reactions) ? reactions : {};
  writeJsonFile(REACTIONS_FILE, safeReactions, 'reactions');
}

function loadOneOnOneChats() {
  const chats = {};
  try {
    if (fs.existsSync(ONE_ON_ONE_DIR)) {
      const files = fs.readdirSync(ONE_ON_ONE_DIR);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const chatId = file.replace('.json', '');
          const chatData = readJsonFile(
            path.join(ONE_ON_ONE_DIR, file),
            null,
            value => value && typeof value === 'object' && !Array.isArray(value),
            `1-on-1 chat ${chatId}`
          );
          if (chatData) chats[chatId] = chatData;
        }
      });
    }
  } catch (err) {
    console.error('Error loading 1-on-1 chats:', err);
  }
  return chats;
}

function saveOneOnOneChat(chatId, chatData) {
  writeJsonFile(path.join(ONE_ON_ONE_DIR, `${chatId}.json`), chatData, '1-on-1 chat');
}

function loadReports() {
  return readJsonFile(REPORTS_FILE, [], Array.isArray, 'reports');
}

function saveReports(reports) {
  writeJsonFile(REPORTS_FILE, Array.isArray(reports) ? reports : [], 'reports');
}

function loadChatHistory(quoteId) {
  const file = path.join(CHAT_DIR, `${quoteId}.json`);
  const chatData = readJsonFile(
    file,
    null,
    value => value && typeof value === 'object' && !Array.isArray(value),
    `chat history ${quoteId}`
  );
  return Array.isArray(chatData?.messages) ? chatData.messages : [];
}

function saveChatHistory(quoteId, messages) {
  writeJsonFile(path.join(CHAT_DIR, `${quoteId}.json`), { quoteId, messages }, 'chat history');
}

function getQuoteById(quoteId) {
  return loadQuotes().find(q => q.id === quoteId) || null;
}

function removeQuoteArtifacts(quoteId) {
  const chatFile = path.join(CHAT_DIR, `${quoteId}.json`);
  try {
    if (fs.existsSync(chatFile)) fs.unlinkSync(chatFile);
  } catch (err) {
    console.error('Error deleting quote thread:', err);
  }
}

// User management
const connectedUsers = new Map(); // socket.id -> user data
const matchQueue = new Map(); // category -> [socketIds]
const activeOneOnOneChats = new Map(); // chatId -> chat data
const socketToOneOnOne = new Map(); // socket.id -> chatId
const quoteRoomParticipants = new Map(); // quoteId -> Map(socket.id -> user)

function getUserFromSocket(socket) {
  return connectedUsers.get(socket.id);
}

function broadcastOnlineCount() {
  const count = connectedUsers.size;
  io.emit('onlineCount', count);
}

function broadcastActivity(activity) {
  io.emit('activity', activity);
}

function broadcastMatchQueueUpdate() {
  const queueInfo = {};
  matchQueue.forEach((queue, category) => {
    queueInfo[category] = queue.length;
  });
  io.emit('matchQueueUpdate', queueInfo);
}

app.post('/api/reports', (req, res) => {
  const { quoteId, authorId, reason, reporterId } = req.body || {};
  const reporterKey = reporterId || req.ip || 'anonymous-report';
  if (!checkRateLimit(`report:${reporterKey}`, 8, 60 * 1000)) {
    return res.status(429).json({ ok: false, error: 'Too many reports too quickly' });
  }
  if (!quoteId || !reason) {
    return res.status(400).json({ ok: false, error: 'quoteId and reason are required' });
  }

  const reports = loadReports();
  reports.push({
    id: uuidv4(),
    quoteId,
    authorId: authorId || null,
    reporterId: reporterId || null,
    reason: sanitizeText(reason, 200),
    timestamp: new Date().toISOString()
  });
  saveReports(reports);

  res.json({ ok: true });
});

app.get('/api/reports', (req, res) => {
  res.json(loadReports());
});

app.delete('/api/reports/:id', (req, res) => {
  const reports = loadReports();
  const nextReports = reports.filter(report => report.id !== req.params.id);
  saveReports(nextReports);
  res.json({ ok: true, removed: reports.length - nextReports.length });
});

app.get('/api/stats', (req, res) => {
  const quotes = loadQuotes();
  const reports = loadReports();
  res.json({
    quotes: quotes.length,
    reports: reports.length,
    activeUsers: connectedUsers.size,
    oneOnOneRooms: activeOneOnOneChats.size
  });
});

app.get('/api/export', (req, res) => {
  res.json({
    exportedAt: new Date().toISOString(),
    quotes: loadQuotes(),
    reactions: loadReactions(),
    reports: loadReports(),
    stats: {
      activeUsers: connectedUsers.size,
      oneOnOneRooms: activeOneOnOneChats.size
    }
  });
});

app.post('/api/backup', (req, res) => {
  const backupDir = path.join(DATA_DIR, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-${stamp}.json`);
  const payload = {
    createdAt: new Date().toISOString(),
    quotes: loadQuotes(),
    reactions: loadReactions(),
    reports: loadReports()
  };

  fs.writeFileSync(backupFile, JSON.stringify(payload, null, 2), 'utf8');
  res.json({ ok: true, file: path.relative(__dirname, backupFile) });
});

function removeSocketFromMatchQueue(socketId) {
  let removed = false;

  matchQueue.forEach((queue, category) => {
    const filteredQueue = queue.filter(id => id !== socketId);
    if (filteredQueue.length !== queue.length) {
      removed = true;
      matchQueue.set(category, filteredQueue);
    }
  });

  return removed;
}

// 1-on-1 matching system
function findOneOnOneMatch(socket, category) {
  removeSocketFromMatchQueue(socket.id);

  if (!matchQueue.has(category)) {
    matchQueue.set(category, []);
  }
  
  const queue = matchQueue.get(category);
  
  // Instant match if someone is waiting
  while (queue.length > 0) {
    const matchSocketId = queue.shift();
    if (matchSocketId === socket.id) continue;

    const matchSocket = io.sockets.sockets.get(matchSocketId);
    
    if (matchSocket) {
      const chatId = uuidv4();
      const currentUser = getUserFromSocket(socket);
      const matchUser = getUserFromSocket(matchSocket);
      
      // Create chat room
      const chatData = {
        id: chatId,
        users: [
          { socketId: socket.id, user: currentUser },
          { socketId: matchSocketId, user: matchUser }
        ],
        messages: [],
        category: category,
        createdAt: new Date().toISOString()
      };
      
      activeOneOnOneChats.set(chatId, chatData);
      socketToOneOnOne.set(socket.id, chatId);
      socketToOneOnOne.set(matchSocketId, chatId);
      
      // Notify both users
      socket.emit('oneOnOneMatched', {
        chatId,
        partner: matchUser,
        category,
        quoteId: null // No specific quote for 1-on-1 matches
      });
      
      matchSocket.emit('oneOnOneMatched', {
        chatId,
        partner: currentUser,
        category,
        quoteId: null
      });
      
      broadcastActivity({
        type: 'match',
        message: `${currentUser.name} and ${matchUser.name} started a 1-on-1 chat about ${category}`,
        timestamp: new Date().toISOString()
      });

      broadcastMatchQueueUpdate();
      
      return true; // Match successful
    }
  }
  
  // No match found, add to queue
  queue.push(socket.id);
  socket.emit('oneOnOneWaiting', {
    category,
    position: queue.length
  });
  
  broadcastMatchQueueUpdate();
  return false; // Added to queue
}

function endOneOnOneChat(socket, reason = 'left') {
  const chatId = socketToOneOnOne.get(socket.id);
  if (chatId && activeOneOnOneChats.has(chatId)) {
    const chatData = activeOneOnOneChats.get(chatId);
    
    // Find the other user
    const otherUserSocketId = chatData.users.find(u => u.socketId !== socket.id)?.socketId;
    const otherUserSocket = otherUserSocketId ? io.sockets.sockets.get(otherUserSocketId) : null;
    
    // Notify the other user
    if (otherUserSocket) {
      otherUserSocket.emit('oneOnOnePartnerLeft', {
        chatId,
        message: reason === 'left' ? 'Your chat partner left the conversation' : 'Your chat partner disconnected'
      });
    }
    
    // Clean up
    activeOneOnOneChats.delete(chatId);
    socketToOneOnOne.delete(socket.id);
    if (otherUserSocketId) socketToOneOnOne.delete(otherUserSocketId);
    
    // Save chat history
    saveOneOnOneChat(chatId, chatData);
  }
}

// Complete connection handler with all event handlers
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  const savedIdentity = socket.handshake.auth?.identity;
  let user = savedIdentity?.id && savedIdentity?.name && savedIdentity?.color ? {
    id: sanitizeText(savedIdentity.id, 80),
    name: sanitizeText(savedIdentity.name, 20),
    color: sanitizeText(savedIdentity.color, 20),
    createdAt: savedIdentity.createdAt || new Date().toISOString()
  } : {
    id: uuidv4(),
    name: generateRandomName(),
    color: generateRandomColor(),
    createdAt: new Date().toISOString()
  };
  
  connectedUsers.set(socket.id, user);
  
  // Send user their identity
  socket.emit('yourIdentity', user);
  
  // Send initial data
  socket.emit('allQuotes', loadQuotes());
  socket.emit('allReactions', loadReactions());
  
  // Broadcast online count
  broadcastOnlineCount();
  broadcastMatchQueueUpdate();
  
  // Handle client events
  socket.on('requestOneOnOneMatch', ({ category }) => {
    findOneOnOneMatch(socket, category);
  });

  socket.on('cancelOneOnOneMatch', () => {
    if (removeSocketFromMatchQueue(socket.id)) {
      socket.emit('oneOnOneMatchCanceled', {
        message: 'Match search canceled'
      });
      broadcastMatchQueueUpdate();
    }
  });

  socket.on('getQuote', (quoteId) => {
    socket.emit('quoteInfo', getQuoteById(quoteId));
  });

  socket.on('getThreadReplies', (quoteId) => {
    if (!quoteId) return;
    socket.emit('threadHistory', {
      quoteId,
      replies: loadChatHistory(quoteId)
    });
  });

  socket.on('sendThreadReply', ({ quoteId, text, quotedText }, ack = () => {}) => {
    if (!checkRateLimit(`thread:${socket.id}`, 35, 60 * 1000)) {
      emitRateLimited(socket, 'replying');
      ack({ ok: false, error: 'Slow down a little before replying again.' });
      return;
    }

    if (!quoteId) {
      ack({ ok: false, error: 'Missing thought to reply to.' });
      return;
    }
    const cleanText = sanitizeText(text, 500);
    if (!cleanText) {
      ack({ ok: false, error: 'Reply cannot be empty.' });
      return;
    }

    const currentUser = getUserFromSocket(socket);
    const quotes = loadQuotes();
    const quoteIndex = quotes.findIndex(q => q.id === quoteId);
    if (quoteIndex === -1) {
      ack({ ok: false, error: 'That thought no longer exists.' });
      return;
    }

    const replyData = {
      id: uuidv4(),
      quoteId,
      text: cleanText,
      quotedText: sanitizeText(quotedText, 180),
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorColor: currentUser.color,
      timestamp: new Date().toISOString()
    };

    const history = loadChatHistory(quoteId);
    history.push(replyData);
    saveChatHistory(quoteId, history);
    io.emit('newThreadReply', { quoteId, reply: replyData, replyCount: history.length });

    quotes[quoteIndex].replyCount = history.length;
    saveQuotes(quotes);
    io.emit('quoteUpdated', quotes[quoteIndex]);
    ack({ ok: true, reply: replyData });

    broadcastActivity({
      type: 'reply',
      message: `${currentUser.name} replied to a thought`,
      quoteId,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('joinQuoteChat', (quoteId) => {
    if (!quoteId) return;

    const user = getUserFromSocket(socket);
    socket.join(`quote:${quoteId}`);

    if (!quoteRoomParticipants.has(quoteId)) {
      quoteRoomParticipants.set(quoteId, new Map());
    }

    const participants = quoteRoomParticipants.get(quoteId);
    participants.set(socket.id, user);

    socket.emit('chatHistory', loadChatHistory(quoteId));
    socket.emit('participantsList', Array.from(participants.values()));
    socket.to(`quote:${quoteId}`).emit('participantJoined', user);
    io.emit('chatParticipants', { quoteId, count: participants.size });
  });

  socket.on('sendChatMessage', (message) => {
    if (!checkRateLimit(`chat:${socket.id}`, 40, 60 * 1000)) {
      emitRateLimited(socket, 'chatting');
      return;
    }
    if (!message || !message.quoteId || !message.text) return;

    const currentUser = getUserFromSocket(socket);
    const text = sanitizeText(message.text, 500);
    if (!text) return;
    const messageData = {
      id: message.id || uuidv4(),
      quoteId: message.quoteId,
      text,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorColor: currentUser.color,
      timestamp: message.timestamp || new Date().toISOString()
    };

    const history = loadChatHistory(message.quoteId);
    history.push(messageData);
    saveChatHistory(message.quoteId, history);
    socket.to(`quote:${message.quoteId}`).emit('chatMessage', messageData);

    const quotes = loadQuotes();
    const quoteIndex = quotes.findIndex(q => q.id === message.quoteId);
    if (quoteIndex !== -1) {
      quotes[quoteIndex].replyCount = history.length;
      saveQuotes(quotes);
      io.emit('quoteUpdated', quotes[quoteIndex]);
    }
  });

  socket.on('typing', (quoteId, isTyping) => {
    if (quoteId) {
      socket.to(`quote:${quoteId}`).emit('typing', Boolean(isTyping));
    }
  });
  
  socket.on('sendOneOnOneMessage', ({ chatId, message }) => {
    if (!checkRateLimit(`one:${socket.id}`, 30, 60 * 1000)) {
      emitRateLimited(socket, 'messaging');
      return;
    }
    const chatData = activeOneOnOneChats.get(chatId);
    if (chatData) {
      const currentUser = getUserFromSocket(socket);
      const text = sanitizeText(message, 500);
      if (!text) return;
      
      const messageData = {
        id: uuidv4(),
        chatId,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorColor: currentUser.color,
        text,
        timestamp: new Date().toISOString()
      };
      
      chatData.messages.push(messageData);
      
      // Send to both users
      chatData.users.forEach(userData => {
        const userSocket = io.sockets.sockets.get(userData.socketId);
        if (userSocket) {
          userSocket.emit('oneOnOneMessage', messageData);
        }
      });
    }
  });
  
  socket.on('leaveOneOnOneChat', () => {
    endOneOnOneChat(socket, 'left');
  });
  
  socket.on('addReaction', ({ quoteId, reaction }) => {
    if (!checkRateLimit(`react:${socket.id}`, 90, 60 * 1000)) {
      emitRateLimited(socket, 'reacting');
      return;
    }
    if (!REACTIONS.includes(reaction)) return;
    const reactions = loadReactions();
    const quotes = loadQuotes();
    if (!reactions[quoteId]) {
      reactions[quoteId] = {};
    }
    if (!reactions[quoteId][reaction]) {
      reactions[quoteId][reaction] = 0;
    }
    reactions[quoteId][reaction]++;
    saveReactions(reactions);
    const quoteIndex = quotes.findIndex(q => q.id === quoteId);
    if (quoteIndex !== -1) {
      quotes[quoteIndex].reactionCount = Object.values(reactions[quoteId]).reduce((sum, count) => sum + count, 0);
      saveQuotes(quotes);
      io.emit('quoteUpdated', quotes[quoteIndex]);
    }
    
    io.emit('reactionUpdated', { quoteId, reactions: reactions[quoteId] });
  });
  
  socket.on('removeReaction', ({ quoteId, reaction }) => {
    if (!REACTIONS.includes(reaction)) return;
    const reactions = loadReactions();
    const quotes = loadQuotes();
    if (reactions[quoteId] && reactions[quoteId][reaction]) {
      reactions[quoteId][reaction]--;
      if (reactions[quoteId][reaction] <= 0) {
        delete reactions[quoteId][reaction];
      }
      saveReactions(reactions);
      const quoteIndex = quotes.findIndex(q => q.id === quoteId);
      if (quoteIndex !== -1) {
        quotes[quoteIndex].reactionCount = Object.values(reactions[quoteId]).reduce((sum, count) => sum + count, 0);
        saveQuotes(quotes);
        io.emit('quoteUpdated', quotes[quoteIndex]);
      }
      
      io.emit('reactionUpdated', { quoteId, reactions: reactions[quoteId] });
    }
  });
  
  socket.on('newQuote', (newQuote) => {
    if (!checkRateLimit(`quote:${socket.id}`, 10, 60 * 1000)) {
      emitRateLimited(socket, 'posting');
      return;
    }
    const text = sanitizeText(newQuote?.text, 200);
    if (text.length < 10) {
      socket.emit('quoteRejected', { message: 'Thoughts need at least 10 characters.' });
      return;
    }
    const category = CATEGORIES.includes(newQuote?.category) ? newQuote.category : 'Deep';
    const mood = MOODS.includes(newQuote?.mood) ? newQuote.mood : 'Reflective';
    const mode = IDENTITY_MODES.includes(newQuote?.mode) ? newQuote.mode : 'The Observer';
    const quotes = loadQuotes();
    const quoteWithId = {
      id: uuidv4(),
      text,
      category,
      mood,
      mode,
      boosted: Boolean(newQuote?.boosted),
      quiet: Boolean(newQuote?.quiet),
      authorId: user.id,
      authorName: user.name,
      authorColor: user.color,
      timestamp: new Date().toISOString(),
      replies: 0,
      replyCount: 0
    };
    
    quotes.push(quoteWithId);
    saveQuotes(quotes);
    
    // Broadcast to all clients
    io.emit('newQuote', quoteWithId);
    
    broadcastActivity({
      type: 'quote',
      message: `${user.name} shared a new thought`,
      quoteId: quoteWithId.id,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('deleteQuote', ({ quoteId }) => {
    if (!checkRateLimit(`delete:${socket.id}`, 20, 60 * 1000)) {
      emitRateLimited(socket, 'deleting');
      return;
    }

    const quotes = loadQuotes();
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) {
      socket.emit('quoteDeleteRejected', { message: 'That thought no longer exists.' });
      return;
    }

    if (quote.authorId !== user.id) {
      socket.emit('quoteDeleteRejected', { message: 'You can only delete thoughts from your current identity.' });
      return;
    }

    saveQuotes(quotes.filter(q => q.id !== quoteId));

    const reactions = loadReactions();
    if (reactions[quoteId]) {
      delete reactions[quoteId];
      saveReactions(reactions);
    }

    removeQuoteArtifacts(quoteId);
    io.emit('quoteDeleted', {
      quoteId,
      message: `${user.name} deleted a thought.`
    });
  });
  
  socket.on('updateUsername', ({ name }) => {
    const cleanName = sanitizeText(name, 20);
    if (cleanName.length > 0) {
      user.name = cleanName;
      connectedUsers.set(socket.id, user);
      socket.emit('identityUpdated', user);
      
      broadcastActivity({
        type: 'username',
        message: `${user.name} changed their username`,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  socket.on('regenerateIdentity', () => {
    user = {
      id: uuidv4(),
      name: generateRandomName(),
      color: generateRandomColor(),
      createdAt: new Date().toISOString()
    };
    connectedUsers.set(socket.id, user);
    socket.emit('identityUpdated', user);
    
    broadcastActivity({
      type: 'identity',
      message: `${user.name} regenerated their identity`,
      timestamp: new Date().toISOString()
    });
  });
  
  socket.on('getQuotes', () => {
    const quotes = loadQuotes();
    socket.emit('allQuotes', quotes);
  });

  socket.on('getYourPosts', () => {
    const allQuotes = loadQuotes();
    const userPosts = allQuotes.filter(q => q.authorId === user.id);
    socket.emit('yourPosts', userPosts);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    connectedUsers.delete(socket.id);
    removeSocketFromMatchQueue(socket.id);
    endOneOnOneChat(socket, 'disconnected');
    quoteRoomParticipants.forEach((participants, quoteId) => {
      if (participants.delete(socket.id)) {
        socket.to(`quote:${quoteId}`).emit('participantLeft', { id: socket.id });
        io.emit('chatParticipants', { quoteId, count: participants.size });
      }
    });
    broadcastOnlineCount();
    broadcastMatchQueueUpdate();
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
