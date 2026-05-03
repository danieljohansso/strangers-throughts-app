const MAX_LENGTH = 500;
const urlParams = new URLSearchParams(window.location.search);
const quoteId = urlParams.get('quoteId');
let socket;
let messages = [];
let currentQuote = null;
let currentUser = null;
let isConnected = false;
let quoteText = '';
let quoteReactions = {};
let participants = [];

// Load saved identity from localStorage
function loadSavedIdentity() {
    const saved = localStorage.getItem('strangerIdentity');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            return null;
        }
    }
    return null;
}

// Save identity to localStorage
function saveIdentity(user) {
    if (user && user.id && user.name && user.color) {
        localStorage.setItem('strangerIdentity', JSON.stringify(user));
    }
}

// Update connection UI
function updateConnectionUI() {
    const status = document.getElementById('status');
    const avatar = document.getElementById('chat-avatar');
    const username = document.getElementById('chat-username');
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (isConnected && currentUser) {
        avatar.style.backgroundColor = currentUser.color;
        username.textContent = currentUser.name;
        input.disabled = false;
        sendBtn.disabled = false;
        status.textContent = 'Connected';
        status.className = 'connected-status connected';
    } else {
        avatar.style.backgroundColor = '#444';
        username.textContent = 'Connecting...';
        input.disabled = true;
        sendBtn.disabled = true;
        status.textContent = 'Connecting...';
        status.className = 'connected-status disconnected';
    }
}

// Render participants list
function renderParticipants() {
    const container = document.getElementById('participants-list');
    const countEl = document.getElementById('participant-count');
    
    if (!container) return;
    
    countEl.textContent = participants.length;
    
    if (participants.length === 0) {
        container.innerHTML = '<div class="participant-loading">No one here yet...</div>';
        return;
    }
    
    container.innerHTML = participants.map(p => {
        const isMe = p.id === currentUser?.id;
        const className = isMe ? 'participant participant-me' : 'participant';
        const status = isMe ? 'You' : '';
        
        return `
            <div class="${className}">
                <div class="participant-avatar" style="background-color: ${escapeHtml(p.color)};"></div>
                <div class="participant-info">
                    <div class="participant-name">${escapeHtml(p.name)}</div>
                    ${status ? `<div class="participant-status">${status}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Add participant to list
function addParticipant(user) {
    if (!participants.some(p => p.id === user.id)) {
        participants.push(user);
        renderParticipants();
    }
}

// Remove participant from list
function removeParticipant(userId) {
    participants = participants.filter(p => p.id !== userId);
    renderParticipants();
}

// Update participant in list (e.g., when they change username)
function updateParticipant(updatedUser) {
    const index = participants.findIndex(p => p.id === updatedUser.id);
    if (index !== -1) {
        participants[index] = updatedUser;
        renderParticipants();
    }
}

// Set participants list
function setParticipants(newParticipants) {
    participants = newParticipants;
    renderParticipants();
}

// Connect to Socket.IO server
function connect() {
    if (typeof io === 'undefined') {
        setTimeout(() => {
            document.body.innerHTML = `
                <div style="text-align: center; padding: 4rem; color: #fff; font-family: Arial, sans-serif; background: #0a0a0a; min-height: 100vh;">
                    <h1>Cannot Load Socket.IO</h1>
                    <p style="color: #aaa;">Make sure you are accessing this through <code>http://localhost:3000</code></p>
                </div>
            `;
        }, 1000);
        return;
    }

    if (!quoteId) {
        document.getElementById('status').textContent = 'Error: No quote ID';
        return;
    }

    // Load saved identity
    const savedIdentity = loadSavedIdentity();

    socket = io({
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 5000,
        // Send saved identity with connection
        auth: savedIdentity ? { identity: savedIdentity } : {}
    });
    
    socket.on('connect', () => {
        console.log('Connected to server');
        isConnected = true;
        
        // Get user identity
        socket.emit('getQuotes');
        
        // Join the quote's chat room
        socket.emit('joinQuoteChat', quoteId);
        
        // Get quote info
        socket.emit('getQuote', quoteId);
        
        updateConnectionUI();
    });
    
    socket.on('connect_error', (err) => {
        console.error('Connection error:', err.message);
        isConnected = false;
        updateConnectionUI();
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        isConnected = false;
        updateConnectionUI();
    });
    
    // Receive user identity
    socket.on('yourIdentity', (user) => {
        currentUser = user;
        updateConnectionUI();
        // Save identity to localStorage for persistence
        saveIdentity(user);
    });

    // Receive updated identity (name/color/id change)
    socket.on('identityUpdated', (user) => {
        if (currentUser) {
            currentUser.name = user.name;
            currentUser.color = user.color;
            if (user.id) {
                currentUser.id = user.id;
            }
            updateConnectionUI();
            // Save updated identity
            saveIdentity(currentUser);
            // Update in participants list
            updateParticipant(currentUser);
        }
    });
    
    // Receive participants list
    socket.on('participantsList', (list) => {
        setParticipants(list);
    });
    
    // Receive participant joined
    socket.on('participantJoined', (user) => {
        addParticipant(user);
        addSystemMessage(`${user.name} joined the chat.`);
    });
    
    // Receive participant left
    socket.on('participantLeft', ({ id }) => {
        removeParticipant(id);
        addSystemMessage('Someone left the chat.');
    });
    
    // User was updated (e.g., changed username)
    socket.on('userUpdated', (user) => {
        updateParticipant(user);
    });
    
    // Receive quote info
    socket.on('quoteInfo', (quote) => {
        if (quote) {
            quoteText = quote.text;
            quoteReactions = quote.reactions || {};
            document.getElementById('quote-display').textContent = `"${escapeHtml(quote.text)}"`;
        } else {
            document.getElementById('quote-display').textContent = 'Quote not found';
        }
    });
    
    // Receive messages
    socket.on('chatMessage', (message) => {
        messages.push(message);
        renderMessages();
    });
    
    // Receive all messages on join
    socket.on('chatHistory', (history) => {
        messages = history;
        renderMessages();
        updateConnectionUI();
    });
    
    // Receive typing indicator
    socket.on('typing', (typing) => {
        showTypingIndicator(typing);
    });
    
    // Someone joined (legacy - for backwards compatibility)
    socket.on('userJoined', ({ count, user }) => {
        if (user) {
            addParticipant(user);
        }
    });
    
    // Someone left (legacy - for backwards compatibility)
    socket.on('userLeft', (data) => {
        // If it's just a count, we can't remove specific user
        if (data && data.userId) {
            removeParticipant(data.userId);
        }
    });
    
    updateConnectionUI();
}

// Show/hide typing indicator
function showTypingIndicator(show) {
    const indicator = document.getElementById('typing-indicator');
    if (show) {
        indicator.style.display = 'block';
        scrollToBottom();
    } else {
        indicator.style.display = 'none';
    }
}

// Add system message
function addSystemMessage(text) {
    messages.push({
        text: text,
        timestamp: new Date().toISOString(),
        isMe: false,
        isSystem: true
    });
    renderMessages();
}

// Render messages
function renderMessages() {
    const container = document.getElementById('messages');
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="typing-indicator">Be the first to comment on this quote.</div>';
        return;
    }
    
    container.innerHTML = messages.map(msg => {
        const date = new Date(msg.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const className = msg.isMe ? 'message message-sent' : (msg.isSystem ? 'message system-message' : 'message message-received');
        
        // Format content with quotes
        const formattedContent = formatMessage(msg.text);
        
        const onClick = msg.isSystem ? '' : `quoteMessage(${JSON.stringify(msg.text).replace(/"/g, '&quot;')})`;
        
        if (msg.isSystem) {
            return `
                <div class="${className}">
                    <div class="message-content">${formattedContent}</div>
                </div>
            `;
        }
        
        return `
            <div class="${className}" onclick="${onClick}">
                <div class="message-header">
                    <div class="message-avatar" style="background-color: ${msg.authorColor || '#444'}"></div>
                    <span class="message-author">${escapeHtml(msg.authorName || 'Anonymous')}</span>
                </div>
                <div class="message-content">${formattedContent}</div>
                <div class="message-time">${timeStr}</div>
            </div>
        `;
    }).join('');
    
    scrollToBottom();
}

// Format message with blockquote styling for quoted text
function formatMessage(text) {
    return escapeHtml(text).replace(/^(&gt;|>) /gm, '<blockquote>$1 ').replace(/<\/blockquote>\n(&gt;|>)/g, '$1');
}

// Quote a message
function quoteMessage(content) {
    currentQuote = content;
    const input = document.getElementById('message-input');
    const notice = document.getElementById('quoting-notice');
    const preview = document.getElementById('quote-preview');
    
    notice.style.display = 'flex';
    preview.textContent = truncate(content, 40);
    
    const lines = content.split('\n');
    const quoted = lines.map(line => `> ${line}`).join('\n');
    input.value = `${quoted}\n\n`;
    input.focus();
    updateCharCount();
}

// Cancel quote
function cancelQuote() {
    currentQuote = null;
    const input = document.getElementById('message-input');
    const notice = document.getElementById('quoting-notice');
    
    notice.style.display = 'none';
    input.value = '';
    updateCharCount();
}

// Send message
function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (content && content.length <= MAX_LENGTH && quoteId && currentUser) {
        const message = {
            quoteId: quoteId,
            text: content,
            timestamp: new Date().toISOString(),
            isMe: true,
            authorName: currentUser.name,
            authorColor: currentUser.color
        };
        
        // Send to server
        socket.emit('sendChatMessage', message);
        
        // Clear input
        input.value = '';
        document.getElementById('char-count').textContent = '0';
        document.getElementById('send-btn').disabled = true;
        document.getElementById('quoting-notice').style.display = 'none';
        currentQuote = null;
        
        // Add message locally for instant feedback
        messages.push(message);
        renderMessages();
    }
}

// Update character count
function updateCharCount() {
    const input = document.getElementById('message-input');
    const count = input.value.length;
    const charCount = document.getElementById('char-count');
    const sendBtn = document.getElementById('send-btn');
    
    charCount.textContent = count;
    
    if (count > 0 && count <= MAX_LENGTH) {
        sendBtn.disabled = false;
        charCount.style.color = count > MAX_LENGTH * 0.8 ? '#ff6b6b' : '#888';
    } else {
        sendBtn.disabled = true;
    }
    
    if (count > MAX_LENGTH) {
        charCount.style.color = '#ff4444';
    }
}

// Scroll to bottom
function scrollToBottom() {
    const messages = document.getElementById('messages');
    messages.scrollTop = messages.scrollHeight;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// Truncate text
function truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Keyboard shortcuts
document.getElementById('message-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey && this.value.trim().length > 0 && this.value.length <= MAX_LENGTH) {
        e.preventDefault();
        sendMessage();
    }
    if (e.key === 'Escape') {
        cancelQuote();
    }
});

// Send typing indicator
document.getElementById('message-input').addEventListener('input', function() {
    if (quoteId && isConnected) {
        socket.emit('typing', quoteId, this.value.length > 0);
    }
});

// Initialize
connect();
