// Stranger Thoughts - Minimal working version


// Focused on core functionality to fix connection issues





const MAX_LENGTH = 200;


const MIN_LENGTH = 10;


const REACTIONS = ['👍', '😂', '🤔', '❤️'];

const MATCH_CATEGORIES = ['Deep', 'Confessions', 'Advice', 'Late Night', 'Funny'];

const MOODS = ['Reflective', 'Hopeful', 'Heavy', 'Curious', 'Unfiltered', 'Celebrating'];

const THREAD_NUDGES = {
    Reflective: [
        { label: 'Mirror', text: 'What I hear in this is ' },
        { label: 'Meaning', text: 'The part that stays with me is ' }
    ],
    Hopeful: [
        { label: 'Encourage', text: 'One hopeful angle here is ' },
        { label: 'Build', text: 'A next step might be ' }
    ],
    Heavy: [
        { label: 'Hold Space', text: 'That sounds heavy. I want to say ' },
        { label: 'Care', text: 'If this were mine, I would need ' }
    ],
    Curious: [
        { label: 'Ask Better', text: 'A question this opens for me is ' },
        { label: 'Explore', text: 'I wonder if part of this is ' }
    ],
    Unfiltered: [
        { label: 'Name It', text: 'The blunt truth I notice is ' },
        { label: 'Reframe', text: 'Another way to look at this is ' }
    ],
    Celebrating: [
        { label: 'Cheer', text: 'This deserves a little celebration because ' },
        { label: 'Savor', text: 'The good part worth holding onto is ' }
    ]
};

const DAILY_PROMPTS = [
    'What thought keeps coming back when the world gets quiet?',
    'What would you tell someone who feels exactly like you tonight?',
    'What tiny truth did today reveal?',
    'What are you carrying that nobody can see?',
    'What made you feel human this week?'
];


let socket;


let quotes = [];


let allQuotes = [];


let reactionsData = {};


let currentUser = null;


let currentSort = 'new';


let currentFilter = 'all';

let currentMoodFilter = 'all';


let currentTab = 'all';


let onlineCount = 0;


let isConnected = false;


let yourPosts = [];


let savedPosts = [];

let blockedAuthors = [];

let reportedPosts = [];

let threadReplies = {};

let expandedThreads = new Set();

let followedThreads = [];

let profileDetails = {
    bio: '',
    status: 'Open to thoughtful replies',
    intention: 'Share honestly',
    premiumBadge: false,
    pinnedThoughtId: ''
};


let chatParticipantCounts = {}; // quoteId -> participant count


let searchQuery = '';


let notifications = [];


let unreadNotifications = 0;


let postsWithReplies = []; // Posts where current user has received replies


let currentOneOnOneChat = null; // Current 1-on-1 chat data

let matchQueueInfo = {}; // Category -> count of users waiting for matches

let waitingMatchCategory = null;
let availableMatches = []; // Users currently waiting for matches

let discoveryQueueIndex = 0;

let currentShareCardText = '';

let calmMode = false;

let visitStreak = 1;





// Load saved identity from localStorage


function loadSavedIdentity() {


    const saved = localStorage.getItem('strangerIdentity');


    return saved ? JSON.parse(saved) : null;


}





// Save identity to localStorage


function saveIdentity(user) {


    if (user?.id && user.name && user.color) {


        localStorage.setItem('strangerIdentity', JSON.stringify(user));


    }


}





// Load saved posts from localStorage


function loadSavedPosts() {


    const saved = localStorage.getItem('strangerSavedPosts');


    return saved ? JSON.parse(saved) : [];


}





// Save posts to localStorage


function saveSavedPosts() {


    if (currentUser) {


        localStorage.setItem('strangerSavedPosts', JSON.stringify(savedPosts));


    }


}





// Update UI based on connection state


function updateConnectionUI() {


    const userAvatar = document.getElementById('user-avatar');


    const userName = document.getElementById('user-name');


    const input = document.getElementById('thought-input');


    const submitBtn = document.getElementById('submit-btn');


    const loadingElement = document.getElementById('feed')?.querySelector('.loading');


    


    if (isConnected && currentUser) {


        if (userAvatar) userAvatar.style.backgroundColor = currentUser.color;


        if (userName) userName.textContent = currentUser.name;


        if (input) input.disabled = false;


        if (submitBtn) submitBtn.disabled = false;


        if (loadingElement) loadingElement.style.display = 'none';


    } else {


        if (userAvatar) userAvatar.style.backgroundColor = '#444';


        if (userName) userName.textContent = 'Connecting...';


        if (input) input.disabled = true;


        if (submitBtn) submitBtn.disabled = true;


        if (loadingElement) loadingElement.style.display = 'block';


    }


}





// Update online count display


function updateOnlineCount(count) {


    onlineCount = count;


    const onlineCountElement = document.getElementById('online-count');


    if (onlineCountElement) {


        onlineCountElement.textContent = `${count} ${count === 1 ? 'stranger' : 'strangers'} online`;


    }


}





// Update chat participant count for a quote


function updateChatParticipantCount(quoteId, count) {


    chatParticipantCounts[quoteId] = count;


    // Refresh the display to show updated participant counts


    applyFiltersAndSort();


}





// Handle search input


function handleSearch() {


    const searchInput = document.getElementById('search-input');


    const clearButton = document.getElementById('search-clear');


    


    if (searchInput && clearButton) {


        searchQuery = searchInput.value.trim().toLowerCase();


        


        if (searchQuery.length > 0) {


            clearButton.style.display = 'block';


        } else {


            clearButton.style.display = 'none';


        }


        


        applyFiltersAndSort();


    }


}





// Clear search


function clearSearch() {


    const searchInput = document.getElementById('search-input');


    const clearButton = document.getElementById('search-clear');


    


    if (searchInput && clearButton) {


        searchInput.value = '';


        searchQuery = '';


        clearButton.style.display = 'none';


        applyFiltersAndSort();


    }


}





// Request 1-on-1 match


// Update Matches tab badge
function updateMatchesTabBadge() {
    const matchesBadge = document.getElementById('matches-badge');
    if (matchesBadge) {
        // Count total users waiting across all categories
        let totalWaiting = 0;
        for (const category in matchQueueInfo) {
            totalWaiting += matchQueueInfo[category];
        }
        matchesBadge.textContent = totalWaiting;
    }
}

function loadSafetyPreferences() {
    try {
        blockedAuthors = JSON.parse(localStorage.getItem('strangerBlockedAuthors') || '[]');
        reportedPosts = JSON.parse(localStorage.getItem('strangerReportedPosts') || '[]');
    } catch (err) {
        blockedAuthors = [];
        reportedPosts = [];
    }
}

function saveSafetyPreferences() {
    localStorage.setItem('strangerBlockedAuthors', JSON.stringify(blockedAuthors));
    localStorage.setItem('strangerReportedPosts', JSON.stringify(reportedPosts));
}

function loadFollowedThreads() {
    try {
        followedThreads = JSON.parse(localStorage.getItem('strangerFollowedThreads') || '[]');
    } catch (err) {
        followedThreads = [];
    }
}

function saveFollowedThreads() {
    localStorage.setItem('strangerFollowedThreads', JSON.stringify(followedThreads));
}

function loadProfileDetails() {
    try {
        profileDetails = {
            ...profileDetails,
            ...JSON.parse(localStorage.getItem('strangerProfileDetails') || '{}')
        };
    } catch (err) {
        localStorage.removeItem('strangerProfileDetails');
    }
}

function saveProfileDetails() {
    localStorage.setItem('strangerProfileDetails', JSON.stringify(profileDetails));
}

function getMyThoughts() {
    if (!currentUser) return [];
    return allQuotes
        .filter(quote => quote.authorId === currentUser.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function syncYourPostsFromQuotes() {
    if (!currentUser) return;
    yourPosts = getMyThoughts();
    updateTabBadges();
}

function getMyProfileStats() {
    const myThoughts = getMyThoughts();
    const totalReplies = myThoughts.reduce((sum, quote) => sum + (quote.replyCount || 0), 0);
    const totalReactions = myThoughts.reduce((sum, quote) => sum + (quote.reactionCount || 0), 0);
    const topMood = getMostCommon(myThoughts.map(quote => quote.mood || 'Reflective')) || 'Reflective';
    const topCategory = getMostCommon(myThoughts.map(quote => quote.category || 'Deep')) || 'Deep';

    return {
        myThoughts,
        totalReplies,
        totalReactions,
        topMood,
        topCategory,
        savedCount: savedPosts.length,
        followedCount: followedThreads.length
    };
}

function getProfileAchievements(stats = getMyProfileStats()) {
    return [
        {
            title: 'First Thought',
            detail: 'Posted at least one anonymous thought',
            unlocked: stats.myThoughts.length > 0
        },
        {
            title: 'Conversation Starter',
            detail: 'Earned 5 thread replies',
            unlocked: stats.totalReplies >= 5
        },
        {
            title: 'Signal Found',
            detail: 'Earned 10 reactions',
            unlocked: stats.totalReactions >= 10
        },
        {
            title: 'Curator',
            detail: 'Saved 3 thoughts for later',
            unlocked: stats.savedCount >= 3
        },
        {
            title: 'Thread Watcher',
            detail: 'Followed 3 conversations',
            unlocked: stats.followedCount >= 3
        }
    ];
}

function updateProfileStats() {
    const stats = getMyProfileStats();
    const achievements = getProfileAchievements(stats);
    const posts = document.getElementById('profile-posts');
    const replies = document.getElementById('profile-replies');
    const reactions = document.getElementById('profile-reactions');
    const largeAvatar = document.getElementById('profile-avatar-large');

    if (posts) posts.textContent = stats.myThoughts.length;
    if (replies) replies.textContent = stats.totalReplies;
    if (reactions) reactions.textContent = stats.totalReactions;
    if (largeAvatar && currentUser) largeAvatar.style.backgroundColor = currentUser.color;
}

function getDailyPrompt() {
    const dayKey = new Date().toISOString().slice(0, 10);
    const index = Array.from(dayKey).reduce((sum, char) => sum + char.charCodeAt(0), 0) % DAILY_PROMPTS.length;
    return DAILY_PROMPTS[index];
}

function getEngagementScore(quote) {
    return (quote.reactionCount || 0) + (quote.replyCount || 0) * 2 + (quote.boosted ? 4 : 0);
}

function getConversationHealth(quote) {
    const replies = quote.replyCount || 0;
    const reactions = quote.reactionCount || 0;
    if (replies >= 5) return { label: 'Active thread', level: 'hot' };
    if (replies >= 1) return { label: 'Conversation started', level: 'warm' };
    if (reactions >= 5) return { label: 'Waiting for replies', level: 'spark' };
    return { label: 'Fresh thought', level: 'fresh' };
}

function updateExperienceStats() {
    const thoughtStat = document.getElementById('stat-thoughts');
    const savedStat = document.getElementById('stat-saved');
    const categoryStat = document.getElementById('stat-category');
    const safetyStat = document.getElementById('stat-safety');
    const streakStat = document.getElementById('stat-streak');

    if (thoughtStat) thoughtStat.textContent = allQuotes.length;
    if (savedStat) savedStat.textContent = savedPosts.length;
    if (safetyStat) safetyStat.textContent = blockedAuthors.length + reportedPosts.length;
    if (streakStat) streakStat.textContent = visitStreak;

    if (categoryStat && allQuotes.length > 0) {
        const counts = allQuotes.reduce((acc, quote) => {
            acc[quote.category] = (acc[quote.category] || 0) + 1;
            return acc;
        }, {});
        categoryStat.textContent = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }

    updateProfileStats();
    updateSpotlight();
    updateDiscoveryQueue();
    updateMoodPulse();
    updateMoodMatchLane();
    updateThoughtDna();
    updateReplyRadar();
    updateSavedDigest();
    updateOrbitPanel();
}

function getSpotlightQuote() {
    return allQuotes
        .filter(quote => !blockedAuthors.includes(quote.authorId) && !reportedPosts.includes(quote.id))
        .sort((a, b) => getEngagementScore(b) - getEngagementScore(a))[0] || null;
}

function getQuotePreviewById(quoteId) {
    return allQuotes.find(quote => quote.id === quoteId) || null;
}

function updateOrbitPanel() {
    const summary = document.getElementById('orbit-summary');
    const grid = document.getElementById('orbit-grid');
    if (!summary || !grid) return;

    const stats = getMyProfileStats();
    const pinned = getQuotePreviewById(profileDetails.pinnedThoughtId);
    const latestSaved = [...savedPosts].reverse().map(getQuotePreviewById).find(Boolean);
    const oldestSaved = savedPosts.map(getQuotePreviewById).find(Boolean);
    const latestFollowed = [...followedThreads].reverse().map(getQuotePreviewById).find(Boolean);
    const strongest = stats.myThoughts.slice().sort((a, b) => getEngagementScore(b) - getEngagementScore(a))[0];
    const unlocked = getProfileAchievements(stats).filter(item => item.unlocked).length;

    summary.textContent = currentUser
        ? `${currentUser.name}: ${stats.myThoughts.length} thoughts, ${stats.savedCount} saved, ${unlocked} badges.`
        : 'Connect to start building your orbit.';

    const cards = [
        {
            title: 'Pinned',
            label: pinned ? pinned.text : 'Pin one of your thoughts from the feed.',
            action: pinned ? `jumpToThought('${pinned.id}')` : "switchTab('yours')",
            cta: pinned ? 'Open pinned' : 'Pick a thought'
        },
        {
            title: 'Saved',
            label: latestSaved ? latestSaved.text : 'Save thoughts you want to revisit.',
            action: latestSaved ? `jumpToThought('${latestSaved.id}')` : "switchTab('saved')",
            cta: latestSaved ? 'Open saved' : 'Saved tab'
        },
        {
            title: 'Read later',
            label: oldestSaved ? oldestSaved.text : 'Your oldest saved thought will surface here.',
            action: oldestSaved ? `jumpToThought('${oldestSaved.id}')` : "switchTab('saved')",
            cta: oldestSaved ? 'Revisit' : 'No backlog'
        },
        {
            title: 'Following',
            label: latestFollowed ? latestFollowed.text : 'Follow threads to track replies.',
            action: latestFollowed ? `jumpToThought('${latestFollowed.id}')` : "switchTab('following')",
            cta: latestFollowed ? 'Open thread' : 'Following tab'
        },
        {
            title: 'Best signal',
            label: strongest ? strongest.text : 'Your strongest thought will appear here.',
            action: strongest ? `jumpToThought('${strongest.id}')` : 'focusThoughtInput()',
            cta: strongest ? 'Open best' : 'Write'
        }
    ];

    grid.innerHTML = cards.map(card => `
        <button class="orbit-card" onclick="${card.action}">
            <strong>${escapeHtml(card.title)}</strong>
            <span>${escapeHtml(card.label)}</span>
            <em>${escapeHtml(card.cta)}</em>
        </button>
    `).join('');
}

function updateSpotlight() {
    const spotlightText = document.getElementById('spotlight-text');
    const spotlightMeta = document.getElementById('spotlight-meta');
    if (!spotlightText || !spotlightMeta) return;

    const quote = getSpotlightQuote();
    if (!quote) {
        spotlightText.textContent = 'The first featured thought is waiting to be written.';
        spotlightMeta.textContent = 'No spotlight yet';
        return;
    }

    spotlightText.textContent = `"${quote.text}"`;
    spotlightMeta.textContent = `${quote.category} · ${quote.mood || 'Reflective'} · ${getEngagementScore(quote)} signal`;
}

function updateMoodPulse() {
    const summary = document.getElementById('mood-pulse-summary');
    const bars = document.getElementById('mood-pulse-bars');
    if (!summary || !bars) return;

    const visibleQuotes = allQuotes.filter(quote => !blockedAuthors.includes(quote.authorId) && !reportedPosts.includes(quote.id));
    const counts = MOODS.map(mood => ({
        mood,
        count: visibleQuotes.filter(quote => (quote.mood || 'Reflective') === mood).length
    }));
    const top = counts.slice().sort((a, b) => b.count - a.count)[0];
    const total = visibleQuotes.length || 1;

    summary.textContent = top?.count
        ? `${top.mood} is leading the room right now.`
        : 'The room has no clear mood yet.';

    bars.innerHTML = counts.map(item => {
        const width = Math.max(6, Math.round((item.count / total) * 100));
        return `
            <button class="mood-pulse-row" onclick="filterByMood('${item.mood}')">
                <span>${escapeHtml(item.mood)}</span>
                <div><i style="width: ${width}%"></i></div>
                <strong>${item.count}</strong>
            </button>
        `;
    }).join('');
}

function updateMoodMatchLane() {
    const summary = document.getElementById('mood-match-summary');
    const list = document.getElementById('mood-match-list');
    if (!summary || !list) return;

    const visibleQuotes = getVisibleQuotes();
    const targetMood = currentMoodFilter !== 'all'
        ? currentMoodFilter
        : getTopCount(visibleQuotes, quote => quote.mood || 'Reflective')?.[0] || 'Reflective';
    const matches = visibleQuotes
        .filter(quote => (quote.mood || 'Reflective') === targetMood)
        .sort((a, b) => getEngagementScore(b) - getEngagementScore(a) || new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 3);

    if (matches.length === 0) {
        summary.textContent = `No ${targetMood} thoughts yet.`;
        list.innerHTML = `
            <article class="mood-match-card">
                <p>Write the first ${escapeHtml(targetMood.toLowerCase())} thought for this room.</p>
                <button class="secondary-action compact-action" onclick="useThoughtTemplate('', 'Deep', '${targetMood}'); focusThoughtInput()">Write one</button>
            </article>
        `;
        return;
    }

    summary.textContent = `${matches.length} ${targetMood.toLowerCase()} ${matches.length === 1 ? 'thought' : 'thoughts'} worth opening.`;
    list.innerHTML = matches.map(quote => `
        <article class="mood-match-card">
            <div class="mood-match-meta">
                <span>${escapeHtml(quote.category || 'Deep')}</span>
                <span>${getEngagementScore(quote)} signal</span>
                <span>${quote.replyCount || 0} replies</span>
            </div>
            <p>${escapeHtml(quote.text)}</p>
            <button class="primary-action compact-action" onclick="jumpToThought('${quote.id}')">Open Match</button>
        </article>
    `).join('');
}

function getVisibleQuotes() {
    return allQuotes.filter(quote => !blockedAuthors.includes(quote.authorId) && !reportedPosts.includes(quote.id));
}

function getTopCount(items, getKey) {
    return Object.entries(items.reduce((acc, item) => {
        const key = getKey(item) || 'Unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {})).sort((a, b) => b[1] - a[1])[0] || null;
}

function updateThoughtDna() {
    const summary = document.getElementById('thought-dna-summary');
    const grid = document.getElementById('thought-dna-grid');
    if (!summary || !grid) return;

    const visibleQuotes = getVisibleQuotes();
    const hasActiveFeedFilter = Boolean(searchQuery) || currentFilter !== 'all' || currentMoodFilter !== 'all' || currentTab !== 'all';
    const feedQuotes = quotes.length || hasActiveFeedFilter ? quotes : visibleQuotes;

    if (feedQuotes.length === 0) {
        summary.textContent = 'No visible signal in this view yet.';
        grid.innerHTML = `
            <div class="thought-dna-card">
                <span>Next move</span>
                <strong>Start it</strong>
                <em>Post, clear filters, or follow a thread to give this feed a pulse.</em>
            </div>
        `;
        return;
    }

    const topCategory = getTopCount(feedQuotes, quote => quote.category);
    const topMood = getTopCount(feedQuotes, quote => quote.mood || 'Reflective');
    const quietCount = feedQuotes.filter(quote => quote.quiet).length;
    const featuredCount = feedQuotes.filter(quote => quote.boosted).length;
    const totalSignal = feedQuotes.reduce((sum, quote) => sum + getEngagementScore(quote), 0);
    const replyCount = feedQuotes.reduce((sum, quote) => sum + (quote.replyCount || 0), 0);
    const replyRate = Math.round((replyCount / feedQuotes.length) * 10) / 10;
    const moodShare = Math.round(((topMood?.[1] || 0) / feedQuotes.length) * 100);

    summary.textContent = `${topMood?.[0] || 'Mixed'} energy, ${topCategory?.[0] || 'open'} themes, ${totalSignal} signal points.`;

    grid.innerHTML = [
        {
            label: 'Dominant mood',
            value: topMood?.[0] || 'Mixed',
            detail: `${moodShare}% of this view leans this way.`
        },
        {
            label: 'Main theme',
            value: topCategory?.[0] || 'Open',
            detail: `${topCategory?.[1] || 0} thoughts are clustered here.`
        },
        {
            label: 'Reply gravity',
            value: `${replyRate}x`,
            detail: 'Average replies per thought in this view.'
        },
        {
            label: 'Premium signal',
            value: featuredCount ? `${featuredCount} boosted` : `${quietCount} quiet`,
            detail: featuredCount ? 'Featured thoughts are shaping discovery.' : 'Quiet posts are adding softer texture.'
        }
    ].map(card => `
        <div class="thought-dna-card">
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(card.value)}</strong>
            <em>${escapeHtml(card.detail)}</em>
        </div>
    `).join('');
}

function updateReplyRadar() {
    const summary = document.getElementById('reply-radar-summary');
    const list = document.getElementById('reply-radar-list');
    if (!summary || !list) return;

    const visibleQuotes = getVisibleQuotes();
    const activeThreads = visibleQuotes
        .filter(quote => (quote.replyCount || 0) > 0)
        .sort((a, b) => {
            const replyDelta = (b.replyCount || 0) - (a.replyCount || 0);
            return replyDelta || getEngagementScore(b) - getEngagementScore(a);
        })
        .slice(0, 3);

    if (activeThreads.length === 0) {
        summary.textContent = 'No active threads yet.';
        list.innerHTML = `
            <div class="reply-radar-card">
                <p>The next reply can start the first real conversation.</p>
                <button class="secondary-action compact-action" onclick="switchTab('all')">Browse thoughts</button>
            </div>
        `;
        return;
    }

    const totalReplies = activeThreads.reduce((sum, quote) => sum + (quote.replyCount || 0), 0);
    summary.textContent = `${activeThreads.length} live ${activeThreads.length === 1 ? 'thread' : 'threads'} with ${totalReplies} recent replies.`;
    list.innerHTML = activeThreads.map(quote => `
        <article class="reply-radar-card">
            <div class="reply-radar-meta">
                <span>${escapeHtml(quote.mood || 'Reflective')}</span>
                <span>${escapeHtml(quote.category || 'Deep')}</span>
                <span>${quote.replyCount || 0} replies</span>
            </div>
            <p>${escapeHtml(quote.text)}</p>
            <button class="primary-action compact-action" onclick="openThreadFromRadar('${quote.id}')">Join Thread</button>
        </article>
    `).join('');
}

function openThreadFromRadar(quoteId) {
    expandedThreads.add(quoteId);
    if (socket) socket.emit('getThreadReplies', quoteId);
    jumpToThought(quoteId);
    setTimeout(() => {
        const input = document.getElementById(`thread-input-${quoteId}`);
        if (input) input.focus();
    }, 120);
}

function getSavedQuotes() {
    return savedPosts
        .map(getQuotePreviewById)
        .filter(quote => quote && !blockedAuthors.includes(quote.authorId) && !reportedPosts.includes(quote.id));
}

function updateSavedDigest() {
    const summary = document.getElementById('saved-digest-summary');
    const grid = document.getElementById('saved-digest-grid');
    if (!summary || !grid) return;

    const savedQuotes = getSavedQuotes();
    if (savedQuotes.length === 0) {
        summary.textContent = 'Your saved thoughts will gather here.';
        grid.innerHTML = `
            <article class="saved-digest-card">
                <span>Start saving</span>
                <p>Save thoughts you want to revisit and this digest will become your reading queue.</p>
                <button class="secondary-action compact-action" onclick="switchTab('all')">Browse feed</button>
            </article>
        `;
        return;
    }

    const oldest = savedQuotes[0];
    const newest = savedQuotes[savedQuotes.length - 1];
    const strongest = savedQuotes.slice().sort((a, b) => getEngagementScore(b) - getEngagementScore(a))[0];
    const discussed = savedQuotes.slice().sort((a, b) => (b.replyCount || 0) - (a.replyCount || 0))[0];
    const cards = [
        {
            label: 'Continue reading',
            quote: oldest,
            meta: `${formatTimeAgo(new Date(oldest.timestamp))} · ${oldest.mood || 'Reflective'}`
        },
        {
            label: 'Strongest saved',
            quote: strongest,
            meta: `${getEngagementScore(strongest)} signal · ${strongest.category || 'Deep'}`
        },
        {
            label: 'Most discussed',
            quote: discussed || newest,
            meta: `${(discussed || newest).replyCount || 0} replies · ${(discussed || newest).mood || 'Reflective'}`
        }
    ];

    summary.textContent = `${savedQuotes.length} saved ${savedQuotes.length === 1 ? 'thought' : 'thoughts'} in your private queue.`;
    grid.innerHTML = cards.map(card => `
        <article class="saved-digest-card">
            <span>${escapeHtml(card.label)}</span>
            <p>${escapeHtml(card.quote.text)}</p>
            <small>${escapeHtml(card.meta)}</small>
            <button class="primary-action compact-action" onclick="jumpToThought('${card.quote.id}')">Open</button>
        </article>
    `).join('');
}

function focusThoughtInput() {
    const input = document.getElementById('thought-input');
    if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
    }
}

function useDailyPrompt() {
    const input = document.getElementById('thought-input');
    if (input) {
        input.value = `${getDailyPrompt()} `;
        updateCharCount();
        focusThoughtInput();
    }
}

function showUpgradePanel() {
    const panel = document.getElementById('upgrade-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'grid' : 'none';
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function showSafetyCenter() {
    const panel = document.getElementById('safety-center');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'grid' : 'none';
        renderSafetyControls();
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function clearHiddenContent() {
    blockedAuthors = [];
    reportedPosts = [];
    saveSafetyPreferences();
    applyFiltersAndSort();
    addNotification({ type: 'safety', message: 'Hidden and reported local filters were cleared.' });
    renderSafetyControls();
}

function getAuthorSummary(authorId) {
    const authorQuotes = allQuotes.filter(quote => quote.authorId === authorId);
    const firstQuote = authorQuotes[0];
    return {
        name: firstQuote?.authorName || 'Hidden stranger',
        color: firstQuote?.authorColor || '#444',
        count: authorQuotes.length
    };
}

function renderSafetyControls() {
    const list = document.getElementById('safety-list');
    if (!list) return;

    const blockedRows = blockedAuthors.map(authorId => {
        const author = getAuthorSummary(authorId);
        return `
            <div class="safety-row">
                <div class="safety-row-avatar" style="background-color: ${author.color}"></div>
                <div>
                    <strong>${escapeHtml(author.name)}</strong>
                    <span>${author.count} hidden ${author.count === 1 ? 'thought' : 'thoughts'}</span>
                </div>
                <button class="secondary-action compact-action" onclick="unblockAuthor('${authorId}')">Unblock</button>
            </div>
        `;
    }).join('');

    const reportedRows = reportedPosts.map(quoteId => {
        const quote = allQuotes.find(item => item.id === quoteId);
        return `
            <div class="safety-row">
                <div>
                    <strong>${quote ? escapeHtml(quote.authorName || 'Anonymous') : 'Reported thought'}</strong>
                    <span>${quote ? escapeHtml(quote.text) : 'This thought is hidden locally.'}</span>
                </div>
                <button class="secondary-action compact-action" onclick="restoreReportedThought('${quoteId}')">Restore</button>
            </div>
        `;
    }).join('');

    list.innerHTML = `
        <div class="safety-list-section">
            <h4>Blocked Strangers</h4>
            ${blockedRows || '<p class="thread-empty">No blocked strangers in this browser.</p>'}
        </div>
        <div class="safety-list-section">
            <h4>Hidden Reports</h4>
            ${reportedRows || '<p class="thread-empty">No locally hidden reports.</p>'}
        </div>
    `;
}

function unblockAuthor(authorId) {
    blockedAuthors = blockedAuthors.filter(id => id !== authorId);
    saveSafetyPreferences();
    applyFiltersAndSort();
    renderSafetyControls();
    addNotification({ type: 'safety', message: 'Stranger restored to your feed.' });
}

function restoreReportedThought(quoteId) {
    reportedPosts = reportedPosts.filter(id => id !== quoteId);
    saveSafetyPreferences();
    applyFiltersAndSort();
    renderSafetyControls();
    addNotification({ type: 'safety', message: 'Thought restored to your feed.' });
}

function showOnboarding(force = false) {
    const modal = document.getElementById('onboarding-modal');
    if (!modal) return;

    const hasSeen = localStorage.getItem('strangerOnboardingSeen') === 'true';
    if (force || !hasSeen) {
        modal.style.display = 'grid';
    }
}

function completeOnboarding() {
    localStorage.setItem('strangerOnboardingSeen', 'true');
    const modal = document.getElementById('onboarding-modal');
    if (modal) modal.style.display = 'none';
}

function initializeProductShell() {
    const prompt = document.getElementById('daily-prompt');
    if (prompt) prompt.textContent = getDailyPrompt();
    loadProfileDetails();
    loadFollowedThreads();
    loadCalmMode();
    updateVisitStreak();
    updateExperienceStats();
    updateSpotlight();
    restoreThoughtDraft();
    renderDraftLocker();
    showOnboarding();
}

function updateVisitStreak() {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const saved = JSON.parse(localStorage.getItem('strangerVisitStreak') || '{}');

    if (saved.lastVisit === today) {
        visitStreak = saved.count || 1;
        return;
    }

    visitStreak = saved.lastVisit === yesterday ? (saved.count || 1) + 1 : 1;
    localStorage.setItem('strangerVisitStreak', JSON.stringify({ lastVisit: today, count: visitStreak }));
}

function loadCalmMode() {
    calmMode = localStorage.getItem('strangerCalmMode') === 'true';
    applyCalmMode();
}

function toggleCalmMode() {
    calmMode = !calmMode;
    localStorage.setItem('strangerCalmMode', String(calmMode));
    applyCalmMode();
    addNotification({
        type: 'settings',
        message: calmMode ? 'Calm mode is on.' : 'Calm mode is off.'
    });
}

function applyCalmMode() {
    document.body.classList.toggle('calm-mode', calmMode);
    const button = document.getElementById('calm-mode-btn');
    if (button) button.textContent = calmMode ? 'Full Mode' : 'Calm Mode';
}

function saveThoughtDraft() {
    const input = document.getElementById('thought-input');
    const category = document.getElementById('new-category');
    const mood = document.getElementById('new-mood');
    const boosted = document.getElementById('boost-thought');
    const quiet = document.getElementById('quiet-thought');
    if (!input) return;

    localStorage.setItem('strangerThoughtDraft', JSON.stringify({
        text: input.value,
        category: category?.value || 'Deep',
        mood: mood?.value || 'Reflective',
        boosted: Boolean(boosted?.checked),
        quiet: Boolean(quiet?.checked),
        updatedAt: new Date().toISOString()
    }));
}

function restoreThoughtDraft() {
    try {
        const draft = JSON.parse(localStorage.getItem('strangerThoughtDraft') || 'null');
        if (!draft || !draft.text) return;

        const input = document.getElementById('thought-input');
        const category = document.getElementById('new-category');
        const mood = document.getElementById('new-mood');
        const boosted = document.getElementById('boost-thought');
        const quiet = document.getElementById('quiet-thought');
        if (input && !input.value) input.value = draft.text;
        if (category && draft.category) category.value = draft.category;
        if (mood && draft.mood) mood.value = draft.mood;
        if (boosted) boosted.checked = Boolean(draft.boosted);
        if (quiet) quiet.checked = Boolean(draft.quiet);
        updateCharCount();
        addNotification({ type: 'draft', message: 'Your unfinished thought draft was restored.' });
    } catch (err) {
        localStorage.removeItem('strangerThoughtDraft');
    }
}

function clearThoughtDraft() {
    localStorage.removeItem('strangerThoughtDraft');
}

function getDraftLocker() {
    try {
        return JSON.parse(localStorage.getItem('strangerDraftLocker') || '[]');
    } catch (err) {
        localStorage.removeItem('strangerDraftLocker');
        return [];
    }
}

function saveDraftLocker(drafts) {
    localStorage.setItem('strangerDraftLocker', JSON.stringify(drafts.slice(0, 6)));
    renderDraftLocker();
}

function getCurrentComposerDraft() {
    const input = document.getElementById('thought-input');
    if (!input) return null;

    const text = input.value.trim();
    if (!text) return null;

    return {
        id: `draft-${Date.now()}`,
        text,
        category: document.getElementById('new-category')?.value || 'Deep',
        mood: document.getElementById('new-mood')?.value || 'Reflective',
        boosted: Boolean(document.getElementById('boost-thought')?.checked),
        quiet: Boolean(document.getElementById('quiet-thought')?.checked),
        updatedAt: new Date().toISOString()
    };
}

function saveCurrentDraftToLocker() {
    const draft = getCurrentComposerDraft();
    if (!draft) {
        addNotification({ type: 'draft', message: 'Write a little first, then save it to the locker.' });
        focusThoughtInput();
        return;
    }

    const drafts = getDraftLocker().filter(item => item.text !== draft.text);
    saveDraftLocker([draft, ...drafts]);
    addNotification({ type: 'draft', message: 'Draft saved to your locker.' });
}

function loadDraftFromLocker(id) {
    const draft = getDraftLocker().find(item => item.id === id);
    if (!draft) return;

    const input = document.getElementById('thought-input');
    const category = document.getElementById('new-category');
    const mood = document.getElementById('new-mood');
    const boosted = document.getElementById('boost-thought');
    const quiet = document.getElementById('quiet-thought');

    if (input) input.value = draft.text;
    if (category) category.value = draft.category || 'Deep';
    if (mood) mood.value = draft.mood || 'Reflective';
    if (boosted) boosted.checked = Boolean(draft.boosted);
    if (quiet) quiet.checked = Boolean(draft.quiet);

    updateCharCount();
    saveThoughtDraft();
    updateComposerPreview();
    focusThoughtInput();
    addNotification({ type: 'draft', message: 'Draft loaded into the composer.' });
}

function deleteDraftFromLocker(id) {
    saveDraftLocker(getDraftLocker().filter(item => item.id !== id));
    addNotification({ type: 'draft', message: 'Draft removed from your locker.' });
}

function renderDraftLocker() {
    const count = document.getElementById('draft-locker-count');
    const list = document.getElementById('draft-locker-list');
    if (!count || !list) return;

    const drafts = getDraftLocker();
    count.textContent = drafts.length === 1 ? '1 saved draft' : `${drafts.length} saved drafts`;

    if (drafts.length === 0) {
        list.innerHTML = '<p>Save unfinished thoughts here before they disappear from your head.</p>';
        return;
    }

    list.innerHTML = drafts.map(draft => `
        <div class="draft-locker-item">
            <div>
                <strong>${escapeHtml(draft.text)}</strong>
                <span>${escapeHtml(draft.category || 'Deep')} · ${escapeHtml(draft.mood || 'Reflective')} · ${formatTimeAgo(new Date(draft.updatedAt || Date.now()))}</span>
            </div>
            <div class="draft-locker-actions">
                <button onclick="loadDraftFromLocker('${draft.id}')">Load</button>
                <button onclick="deleteDraftFromLocker('${draft.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function useThoughtTemplate(text, category, mood) {
    const input = document.getElementById('thought-input');
    const categorySelect = document.getElementById('new-category');
    const moodSelect = document.getElementById('new-mood');

    if (categorySelect) categorySelect.value = category;
    if (moodSelect) moodSelect.value = mood;
    if (input) {
        input.value = input.value.trim() ? `${input.value.trim()} ${text}` : text;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }

    updateCharCount();
    saveThoughtDraft();
    updateComposerPreview();
}

function updateComposerPreview() {
    const preview = document.getElementById('composer-preview');
    const helper = document.getElementById('composer-helper');
    const input = document.getElementById('thought-input');
    const category = document.getElementById('new-category')?.value || 'Deep';
    const mood = document.getElementById('new-mood')?.value || 'Reflective';
    const quiet = Boolean(document.getElementById('quiet-thought')?.checked);
    if (!preview || !input) return;

    const text = input.value.trim();
    const remaining = MAX_LENGTH - input.value.length;
    preview.innerHTML = `
        <span>${escapeHtml(category)} · ${escapeHtml(mood)}${quiet ? ' · Quiet hours' : ''}</span>
        <p>${text ? escapeHtml(text) : 'Your thought preview will appear here.'}</p>
    `;
    preview.classList.toggle('ready', text.length >= MIN_LENGTH);

    if (helper) {
        helper.className = 'composer-helper';
        if (!text) {
            helper.textContent = 'Start with a real sentence. The room works best when thoughts have a little shape.';
        } else if (text.length < MIN_LENGTH) {
            helper.textContent = `${MIN_LENGTH - text.length} more characters before this can be posted.`;
            helper.classList.add('warning');
        } else if (remaining <= 20) {
            helper.textContent = `${remaining} characters left. Tight, but still readable.`;
            helper.classList.add('warning');
        } else {
            helper.textContent = 'Ready to share anonymously.';
            helper.classList.add('ready');
        }
    }
}

function filterByMood(mood) {
    currentMoodFilter = mood;
    document.querySelectorAll('.mood-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.mood === mood);
    });
    applyFiltersAndSort();
}

function clearDiscovery() {
    currentMoodFilter = 'all';
    currentFilter = 'all';
    searchQuery = '';

    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    const categorySelect = document.getElementById('category-filter');
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    if (categorySelect) categorySelect.value = 'all';
    document.querySelectorAll('.mood-chip').forEach(chip => chip.classList.toggle('active', chip.dataset.mood === 'all'));

    applyFiltersAndSort();
}

function showRandomThought() {
    const visibleQuotes = allQuotes.filter(quote => !blockedAuthors.includes(quote.authorId) && !reportedPosts.includes(quote.id));
    if (visibleQuotes.length === 0) {
        addNotification({ type: 'info', message: 'No thoughts are available yet. Share the first one.' });
        focusThoughtInput();
        return;
    }

    const quote = visibleQuotes[Math.floor(Math.random() * visibleQuotes.length)];
    currentTab = 'all';
    currentFilter = 'all';
    searchQuery = quote.text.slice(0, 24).toLowerCase();

    const searchInput = document.getElementById('search-input');
    const filterSelect = document.getElementById('category-filter');
    if (searchInput) searchInput.value = searchQuery;
    if (filterSelect) filterSelect.value = 'all';

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === 'all'));
    applyFiltersAndSort();

    setTimeout(() => {
        const card = document.querySelector(`[data-quote-id="${quote.id}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
}

function getDiscoveryCandidates() {
    return allQuotes
        .filter(quote => !blockedAuthors.includes(quote.authorId) && !reportedPosts.includes(quote.id))
        .sort((a, b) => {
            const aSaved = savedPosts.includes(a.id) ? -2 : 0;
            const bSaved = savedPosts.includes(b.id) ? -2 : 0;
            return (getEngagementScore(b) + bSaved) - (getEngagementScore(a) + aSaved);
        });
}

function getCurrentDiscoveryThought() {
    const candidates = getDiscoveryCandidates();
    if (candidates.length === 0) return null;
    discoveryQueueIndex = discoveryQueueIndex % candidates.length;
    return candidates[discoveryQueueIndex];
}

function updateDiscoveryQueue() {
    const card = document.getElementById('discovery-queue-card');
    if (!card) return;

    const quote = getCurrentDiscoveryThought();
    if (!quote) {
        card.innerHTML = `
            <p>The queue is empty. Share something honest to seed discovery.</p>
            <button class="primary-action compact-action" onclick="focusThoughtInput()">Write a Thought</button>
        `;
        return;
    }

    const isSaved = savedPosts.includes(quote.id);
    card.innerHTML = `
        <div class="discovery-queue-meta">
            <span>${escapeHtml(quote.category)}</span>
            <span>${escapeHtml(quote.mood || 'Reflective')}</span>
            <span>${getEngagementScore(quote)} signal</span>
        </div>
        <p>"${escapeHtml(quote.text)}"</p>
        <div class="discovery-queue-author">
            <div class="quote-avatar" style="background-color: ${quote.authorColor || '#444'}"></div>
            <span>${escapeHtml(quote.authorName || 'Anonymous')}</span>
        </div>
        <div class="discovery-queue-actions">
            <button class="primary-action compact-action" onclick="openDiscoveryThread()">Reply</button>
            <button class="secondary-action compact-action" onclick="saveDiscoveryThought()">${isSaved ? 'Saved' : 'Save'}</button>
            <button class="secondary-action compact-action" onclick="jumpToThought('${quote.id}')">Open</button>
            <button class="secondary-action compact-action" onclick="nextDiscoveryThought()">Next</button>
        </div>
    `;
}

function nextDiscoveryThought() {
    const candidates = getDiscoveryCandidates();
    if (candidates.length === 0) return;
    discoveryQueueIndex = (discoveryQueueIndex + 1) % candidates.length;
    updateDiscoveryQueue();
}

function saveDiscoveryThought() {
    const quote = getCurrentDiscoveryThought();
    if (!quote) return;
    toggleSavePost(quote.id, { stopPropagation() {} });
    updateDiscoveryQueue();
}

function openDiscoveryThread() {
    const quote = getCurrentDiscoveryThought();
    if (!quote) return;
    expandedThreads.add(quote.id);
    jumpToThought(quote.id);
    if (socket) socket.emit('getThreadReplies', quote.id);
    setTimeout(() => {
        const input = document.getElementById(`thread-input-${quote.id}`);
        if (input) input.focus();
    }, 120);
}

function cancelMatchSearch() {
    if (!waitingMatchCategory) return;

    socket.emit('cancelOneOnOneMatch');
    waitingMatchCategory = null;
    renderMatchLobby();
}


function requestOneOnOneMatch(quoteId, category) {
    if (category === undefined) {
        category = quoteId;
        quoteId = null;
    }


    if (!currentUser) {


        alert('Please connect first');


        return;


    }


    


    if (currentOneOnOneChat) {


        alert('You are already in a 1-on-1 chat');


        return;


    }

    if (waitingMatchCategory) {
        alert(`Already looking for a ${waitingMatchCategory} match`);
        return;
    }


    


    waitingMatchCategory = category;
    socket.emit('requestOneOnOneMatch', { category: category });
    renderMatchLobby();


    


    // Show waiting indicator on the quote


    const quoteElement = document.querySelector(`[data-quote-id="${quoteId}"]`);


    if (quoteElement) {


        const existingButton = quoteElement.querySelector('.match-button');


        if (existingButton) {


            existingButton.textContent = '🕒 Waiting...';


            existingButton.disabled = true;


        }


    }


}





// Handle 1-on-1 match found


function handleOneOnOneMatched(data) {


    currentOneOnOneChat = data;
    waitingMatchCategory = null;


    


    // Show 1-on-1 chat interface


    showOneOnOneChatInterface(data);


    


    // Update the quote button


    const quoteElement = document.querySelector(`[data-quote-id="${data.quoteId}"]`);


    if (quoteElement) {


        const existingButton = quoteElement.querySelector('.match-button');


        if (existingButton) {


            existingButton.textContent = '💬 Chat Active';


            existingButton.disabled = true;


            existingButton.style.backgroundColor = '#4CAF50';


        }


    }


    


    // Add notification


    addNotification({


        type: 'match',


        message: `Matched with ${data.partner.name} to talk about ${data.category}!`


    });


}





// Handle waiting for match


function handleOneOnOneWaiting(data) {
    waitingMatchCategory = data.category;
    renderMatchLobby();


    addNotification({


        type: 'waiting',


        message: `Looking for someone to talk about ${data.category}... (position ${data.position})`


    });


}





// Handle match canceled


function handleOneOnOneMatchCanceled(data) {
    waitingMatchCategory = null;
    renderMatchLobby();


    addNotification({


        type: 'info',


        message: data.message


    });


}





// Handle 1-on-1 message received


function handleOneOnOneMessage(message) {


    if (currentOneOnOneChat && message.chatId === currentOneOnOneChat.chatId) {


        addMessageToOneOnOneChat(message);


    }


}





// Handle partner left


function handleOneOnOnePartnerLeft(data) {


    if (currentOneOnOneChat && data.chatId === currentOneOnOneChat.chatId) {


        addSystemMessageToOneOnOneChat(data.message);


        currentOneOnOneChat = null;


        closeOneOnOneChatInterface();


    }


}





// Show 1-on-1 chat interface


function showOneOnOneChatInterface(chatData) {


    const chatInterface = document.getElementById('one-on-one-chat-interface');


    if (!chatInterface) return;


    


    // Set up the chat UI


    const partnerNameElement = document.getElementById('one-on-one-partner-name');


    const partnerAvatarElement = document.getElementById('one-on-one-partner-avatar');


    const categoryElement = document.getElementById('one-on-one-category');


    const messagesContainer = document.getElementById('one-on-one-messages');


    const messageInput = document.getElementById('one-on-one-message-input');


    


    if (partnerNameElement) partnerNameElement.textContent = chatData.partner.name;


    if (partnerAvatarElement) {


        partnerAvatarElement.style.backgroundColor = chatData.partner.color;


        partnerAvatarElement.title = `Color: ${chatData.partner.color}`;


    }


    if (categoryElement) categoryElement.textContent = chatData.category;


    if (messagesContainer) messagesContainer.innerHTML = '';


    if (messageInput) {


        messageInput.disabled = false;


        messageInput.focus();


    }


    


    // Show the interface


    chatInterface.style.display = 'flex';


    


    // Add welcome message


    addSystemMessageToOneOnOneChat(`Connected with ${chatData.partner.name} to talk about ${chatData.category}`);


}





// Add message to 1-on-1 chat


function addMessageToOneOnOneChat(message) {


    const messagesContainer = document.getElementById('one-on-one-messages');


    if (!messagesContainer) return;


    


    const messageElement = document.createElement('div');


    messageElement.className = `one-on-one-message ${message.authorId === currentUser.id ? 'sent' : 'received'}`;


    


    const avatarElement = document.createElement('div');


    avatarElement.className = 'one-on-one-message-avatar';


    avatarElement.style.backgroundColor = message.authorColor;


    


    const contentElement = document.createElement('div');


    contentElement.className = 'one-on-one-message-content';


    contentElement.textContent = message.text;


    


    const infoElement = document.createElement('div');


    infoElement.className = 'one-on-one-message-info';


    infoElement.textContent = `${message.authorName} • ${formatTimeAgo(new Date(message.timestamp))}`;


    


    messageElement.appendChild(avatarElement);


    messageElement.appendChild(contentElement);


    messageElement.appendChild(infoElement);


    


    messagesContainer.appendChild(messageElement);


    messagesContainer.scrollTop = messagesContainer.scrollHeight;


}





// Add system message to 1-on-1 chat


function addSystemMessageToOneOnOneChat(message) {


    const messagesContainer = document.getElementById('one-on-one-messages');


    if (!messagesContainer) return;


    


    const messageElement = document.createElement('div');


    messageElement.className = 'one-on-one-message system';


    messageElement.textContent = message;


    


    messagesContainer.appendChild(messageElement);


    messagesContainer.scrollTop = messagesContainer.scrollHeight;


}





// Send 1-on-1 message


function sendOneOnOneMessage() {


    const input = document.getElementById('one-on-one-message-input');


    if (!input || !currentOneOnOneChat) return;


    


    const message = input.value.trim();


    if (message.length === 0) return;


    


    socket.emit('sendOneOnOneMessage', {


        chatId: currentOneOnOneChat.chatId,


        message: message


    });


    


    input.value = '';
    clearThoughtDraft();
    const boostToggle = document.getElementById('boost-thought');
    if (boostToggle) boostToggle.checked = false;
    const quietToggle = document.getElementById('quiet-thought');
    if (quietToggle) quietToggle.checked = false;


}





// Leave 1-on-1 chat


function leaveOneOnOneChat() {


    if (!currentOneOnOneChat) return;


    


    socket.emit('leaveOneOnOneChat');


    closeOneOnOneChatInterface();


    


    addNotification({


        type: 'info',


        message: 'You left the 1-on-1 chat'


    });


}





// Close 1-on-1 chat interface


function closeOneOnOneChatInterface() {


    const chatInterface = document.getElementById('one-on-one-chat-interface');


    if (chatInterface) {


        chatInterface.style.display = 'none';


    }


    


    // Re-enable any match buttons


    document.querySelectorAll('.match-button').forEach(button => {


        button.textContent = '👥 Find Match';


        button.disabled = false;


        button.style.backgroundColor = '';


    });


    


    currentOneOnOneChat = null;
    waitingMatchCategory = null;

    if (currentTab === 'profile') {
        updateExperienceStats();
        renderProfilePage();
        return;
    }

    if (currentTab === 'matches') {
        renderMatchLobby();
    }


}





// Toggle save/unsave post


function toggleSavePost(quoteId, event) {


    event.stopPropagation();


    if (!currentUser) return;


    


    const isSaved = savedPosts.includes(quoteId);


    


    if (isSaved) {


        // Remove from saved posts


        savedPosts = savedPosts.filter(id => id !== quoteId);


    } else {


        // Add to saved posts


        savedPosts.push(quoteId);


    }


    


    saveSavedPosts();


    updateTabBadges();


    applyFiltersAndSort();


}





// Check if a post is saved


function isPostSaved(quoteId) {


    return savedPosts.includes(quoteId);


}





// Update tab badges


function updateTabBadges() {


    // Update Your Thoughts badge


    const yoursBadge = document.getElementById('yours-badge');


    if (yoursBadge) {


        yoursBadge.textContent = yourPosts.length;


    }


    


    // Update Replies badge


    const repliesBadge = document.getElementById('replies-badge');


    if (repliesBadge) {


        repliesBadge.textContent = postsWithReplies.length;


    }


    


    const followingBadge = document.getElementById('following-badge');
    if (followingBadge) {
        followingBadge.textContent = followedThreads.length;
    }

    // Update Saved badge


    const savedBadge = document.getElementById('saved-badge');


    if (savedBadge) {


        savedBadge.textContent = savedPosts.length;


    }


}





// Notification functions


function toggleNotifications(event) {


    event.stopPropagation();


    const dropdown = document.getElementById('notification-dropdown');


    if (dropdown) {


        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';


        if (dropdown.style.display === 'block') {


            markAllNotificationsRead();


        }


    }


}





function markAllNotificationsRead() {


    unreadNotifications = 0;


    updateNotificationBadge();


    


    // Mark all notifications as read


    notifications = notifications.map(notif => ({ ...notif, read: true }));


    renderNotifications();

    const toastStack = document.getElementById('toast-stack');
    if (toastStack && notification.message) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${notification.type || 'info'}`;
        toast.textContent = notification.message;
        toastStack.appendChild(toast);
        setTimeout(() => toast.remove(), 4200);
    }


}





function addNotification(notification) {


    notifications.unshift({


        ...notification,


        id: Date.now().toString(),


        timestamp: new Date().toISOString(),


        read: false


    });


    unreadNotifications++;


    updateNotificationBadge();


    renderNotifications();


}





function updateNotificationBadge() {


    const badge = document.getElementById('notification-badge');


    if (badge) {


        badge.textContent = unreadNotifications > 0 ? unreadNotifications : '';


        badge.style.display = unreadNotifications > 0 ? 'inline' : 'none';


    }


}





function renderNotifications() {


    const list = document.getElementById('notification-list');


    if (!list) return;


    


    if (notifications.length === 0) {


        list.innerHTML = '<p class="no-notifications">No new notifications</p>';


        return;


    }


    


    list.innerHTML = notifications.map(notif => {


        const timeAgo = formatTimeAgo(new Date(notif.timestamp));


        return `


            <div class="notification-item ${notif.read ? 'read' : 'unread'}">


                <div class="notification-content">${notif.message}</div>


                <div class="notification-time">${timeAgo}</div>


            </div>


        `;


    }).join('');


}





// Escape HTML to prevent XSS


function escapeHtml(text) {


    if (!text) return '';


    const div = document.createElement('div');


    div.textContent = text;


    return div.innerHTML;


}





// Format time as "2 min ago", "1 hour ago", etc.


function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatTimeAgo(date) {


    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);


    if (seconds < 10) return 'Just now';


    if (seconds < 60) return `${seconds} sec ago`;


    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;


    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour ago`;


    if (seconds < 604800) return `${Math.floor(seconds / 86400)} day ago`;


    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });


}





// Render match category lobby

function renderMatchLobby() {
    const feed = document.getElementById('feed');
    if (!feed) return;

    let categories = MATCH_CATEGORIES;

    if (currentFilter !== 'all') {
        categories = categories.filter(category => category === currentFilter);
    }

    if (searchQuery) {
        categories = categories.filter(category => category.toLowerCase().includes(searchQuery));
    }

    if (categories.length === 0) {
        feed.innerHTML = '<div class="empty-message">No match categories to show...</div>';
        return;
    }

    feed.innerHTML = categories.map(category => {
        const waitingCount = matchQueueInfo[category] || 0;
        const isWaitingHere = waitingMatchCategory === category;
        const isWaitingElsewhere = waitingMatchCategory && !isWaitingHere;
        const disabled = !currentUser || currentOneOnOneChat || isWaitingElsewhere;
        const buttonText = isWaitingHere ? 'Cancel Search' : waitingCount > 0 ? 'Join Match' : 'Start Matching';
        const buttonAction = isWaitingHere ? 'cancelMatchSearch()' : `requestOneOnOneMatch('${category}')`;
        const helperText = isWaitingHere
            ? 'Looking for someone now...'
            : waitingCount > 0
                ? `${waitingCount} ${waitingCount === 1 ? 'person is' : 'people are'} waiting`
                : 'No one waiting yet. Be first in line.';

        return `
            <div class="quote-card match-lobby-card" data-category="${category}">
                <div class="quote-header">
                    <div class="quote-avatar match-lobby-avatar">👥</div>
                    <span class="quote-author">${escapeHtml(category)}</span>
                    <span class="quote-category">${waitingCount} waiting</span>
                </div>
                <div class="quote-content match-lobby-content">${helperText}</div>
                <div class="conversation-health health-${health.level}">
                    <span>${escapeHtml(health.label)}</span>
                    <i style="width: ${Math.min(100, 18 + getEngagementScore(quote) * 8)}%"></i>
                </div>

                <div class="quote-actions">
                    <button class="join-btn match-button" onclick="${buttonAction}" ${disabled ? 'disabled' : ''}>${buttonText}</button>
                </div>
            </div>
        `;
    }).join('');
}

async function reportThought(quoteId, authorId, event) {
    if (event) event.stopPropagation();
    if (reportedPosts.includes(quoteId)) return;

    const reason = window.prompt('Why are you reporting this thought?', 'Unsafe or harmful content');
    if (!reason) return;

    reportedPosts.push(quoteId);
    saveSafetyPreferences();
    applyFiltersAndSort();
    renderSafetyControls();
    addNotification({ type: 'safety', message: 'Thanks. That thought is hidden for you and saved for review.' });

    try {
        await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteId,
                authorId,
                reporterId: currentUser?.id || null,
                reason
            })
        });
    } catch (err) {
        console.warn('Report saved locally but could not reach server:', err);
    }
}

function blockAuthor(authorId, event) {
    if (event) event.stopPropagation();
    if (!authorId || blockedAuthors.includes(authorId)) return;

    blockedAuthors.push(authorId);
    saveSafetyPreferences();
    applyFiltersAndSort();
    renderSafetyControls();
    addNotification({ type: 'safety', message: 'That stranger is now hidden from your feed.' });
}

function openAuthorProfile(authorId, event) {
    if (event) event.stopPropagation();
    const modal = document.getElementById('author-modal');
    if (!modal || !authorId) return;

    const authorQuotes = allQuotes
        .filter(q => q.authorId === authorId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (authorQuotes.length === 0) return;

    const firstQuote = authorQuotes[0];
    const totalReactions = authorQuotes.reduce((sum, q) => sum + (q.reactionCount || 0), 0);
    const totalReplies = authorQuotes.reduce((sum, q) => sum + (q.replyCount || 0), 0);
    const favoriteMood = getMostCommon(authorQuotes.map(q => q.mood || 'Reflective'));
    const favoriteCategory = getMostCommon(authorQuotes.map(q => q.category || 'Deep'));

    document.getElementById('author-modal-name').textContent = firstQuote.authorName || 'Anonymous';
    document.getElementById('author-modal-summary').textContent = `${favoriteMood} energy · mostly ${favoriteCategory}`;
    document.getElementById('author-modal-posts').textContent = authorQuotes.length;
    document.getElementById('author-modal-reactions').textContent = totalReactions;
    document.getElementById('author-modal-replies').textContent = totalReplies;

    const avatar = document.getElementById('author-modal-avatar');
    if (avatar) avatar.style.backgroundColor = firstQuote.authorColor || '#444';

    const list = document.getElementById('author-modal-list');
    if (list) {
        list.innerHTML = authorQuotes.slice(0, 5).map(quote => `
            <button class="profile-thought-row" onclick="jumpToThought('${quote.id}')">
                <strong>${escapeHtml(quote.category)} · ${escapeHtml(quote.mood || 'Reflective')}</strong>
                <span>${escapeHtml(quote.text)}</span>
            </button>
        `).join('');
    }

    modal.style.display = 'grid';
}

function closeAuthorModal(event) {
    if (event && event.target.id !== 'author-modal') return;
    const modal = document.getElementById('author-modal');
    if (modal) modal.style.display = 'none';
}

function getMostCommon(values) {
    const counts = values.reduce((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function jumpToThought(quoteId) {
    closeAuthorModal();
    currentTab = 'all';
    currentFilter = 'all';
    currentMoodFilter = 'all';
    searchQuery = '';

    const searchInput = document.getElementById('search-input');
    const filterSelect = document.getElementById('category-filter');
    if (searchInput) searchInput.value = '';
    if (filterSelect) filterSelect.value = 'all';

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === 'all'));
    document.querySelectorAll('.mood-chip').forEach(chip => chip.classList.toggle('active', chip.dataset.mood === 'all'));
    applyFiltersAndSort();

    setTimeout(() => {
        const card = document.querySelector(`[data-quote-id="${quoteId}"]`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('pulse-focus');
            setTimeout(() => card.classList.remove('pulse-focus'), 1400);
        }
    }, 50);
}

function copyThoughtLink(quoteId, event) {
    if (event) event.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#thought-${quoteId}`;

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            addNotification({ type: 'share', message: 'Thought link copied.' });
        }).catch(() => {
            window.prompt('Copy this thought link:', url);
        });
    } else {
        window.prompt('Copy this thought link:', url);
    }
}

function focusThoughtFromHash() {
    const match = window.location.hash.match(/^#thought-(.+)$/);
    if (!match) return;
    const quoteId = decodeURIComponent(match[1]);
    if (!allQuotes.some(q => q.id === quoteId)) return;
    jumpToThought(quoteId);
}

function openShareCard(quoteId, event) {
    if (event) event.stopPropagation();
    const quote = allQuotes.find(item => item.id === quoteId);
    const modal = document.getElementById('share-card-modal');
    const preview = document.getElementById('share-card-preview');
    if (!quote || !modal || !preview) return;

    currentShareCardText = `"${quote.text}"\n\n- ${quote.authorName || 'Anonymous'} on Stranger Thoughts\n${quote.category} · ${quote.mood || 'Reflective'}`;
    preview.innerHTML = `
        <div class="share-card-brand">Stranger Thoughts</div>
        <blockquote>${escapeHtml(quote.text)}</blockquote>
        <div class="share-card-meta">
            <span>${escapeHtml(quote.authorName || 'Anonymous')}</span>
            <span>${escapeHtml(quote.category)} · ${escapeHtml(quote.mood || 'Reflective')}</span>
        </div>
    `;
    modal.style.display = 'grid';
}

function closeShareCard(event) {
    if (event && event.target.id !== 'share-card-modal') return;
    const modal = document.getElementById('share-card-modal');
    if (modal) modal.style.display = 'none';
}

function copyShareCardText() {
    if (!currentShareCardText) return;
    navigator.clipboard.writeText(currentShareCardText).then(() => {
        addNotification({ type: 'share', message: 'Share card text copied.' });
    });
}

async function openModerationPanel() {
    const modal = document.getElementById('moderation-modal');
    const list = document.getElementById('moderation-list');
    if (!modal || !list) return;

    modal.style.display = 'grid';
    list.textContent = 'Loading reports...';

    try {
        const res = await fetch('/api/reports');
        const reports = await res.json();
        if (!reports.length) {
            list.innerHTML = '<div class="empty-message">No reports in the local queue.</div>';
            return;
        }

        list.innerHTML = reports.map(report => `
            <div class="moderation-row">
                <strong>${escapeHtml(report.reason)}</strong>
                <span>Quote: ${escapeHtml(report.quoteId)} · ${formatTimeAgo(new Date(report.timestamp))}</span>
                <button class="secondary-action" onclick="dismissReport('${report.id}')">Dismiss</button>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = '<div class="empty-message">Could not load reports. Restart the server if this route is unavailable.</div>';
    }
}

function closeModerationPanel(event) {
    if (event && event.target.id !== 'moderation-modal') return;
    const modal = document.getElementById('moderation-modal');
    if (modal) modal.style.display = 'none';
}

async function dismissReport(reportId) {
    await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
    openModerationPanel();
    updateExperienceStats();
}

function openMyProfile() {
    switchTab('profile');
    closeProfileDropdown();
}

function renderProfilePage() {
    const feed = document.getElementById('feed');
    if (!feed) return;

    const stats = getMyProfileStats();
    const displayName = currentUser?.name || 'Anonymous Stranger';
    const avatarColor = currentUser?.color || '#444';
    const memberSince = currentUser?.createdAt ? formatTimeAgo(new Date(currentUser.createdAt)) : 'just now';
    const pinnedThought = stats.myThoughts.find(quote => quote.id === profileDetails.pinnedThoughtId);
    const strongestThought = stats.myThoughts
        .slice()
        .sort((a, b) => getEngagementScore(b) - getEngagementScore(a))[0];
    const recentThoughts = stats.myThoughts.slice(0, 4);
    const savedThoughts = allQuotes
        .filter(quote => savedPosts.includes(quote.id))
        .slice(0, 3);

    feed.innerHTML = `
        <section class="my-profile-page">
            <div class="my-profile-hero">
                <div class="my-profile-avatar" style="background-color: ${avatarColor}"></div>
                <div class="my-profile-copy">
                    <span class="hero-kicker">Your anonymous profile</span>
                    <h2>${escapeHtml(displayName)} ${profileDetails.premiumBadge ? '<span class="premium-badge">Premium</span>' : ''}</h2>
                    <p>${escapeHtml(profileDetails.bio || 'Add a short bio so your anonymous presence feels more intentional.')}</p>
                    <div class="profile-signal-row">
                        <span>${escapeHtml(profileDetails.status)}</span>
                        <span>${escapeHtml(profileDetails.intention)}</span>
                        <span>Joined ${memberSince}</span>
                    </div>
                </div>
            </div>

            <div class="my-profile-grid">
                <div class="profile-stat-card"><strong>${stats.myThoughts.length}</strong><span>thoughts</span></div>
                <div class="profile-stat-card"><strong>${stats.totalReactions}</strong><span>reactions earned</span></div>
                <div class="profile-stat-card"><strong>${stats.totalReplies}</strong><span>thread replies</span></div>
                <div class="profile-stat-card"><strong>${stats.savedCount}</strong><span>saved thoughts</span></div>
            </div>

            <div class="profile-editor-panel">
                <div>
                    <h3>Profile Details</h3>
                    <p>These stay in this browser for now. They shape your profile page without adding accounts yet.</p>
                </div>
                <label>
                    Bio
                    <textarea id="profile-bio-input" maxlength="160" placeholder="A short anonymous bio...">${escapeHtml(profileDetails.bio)}</textarea>
                </label>
                <label>
                    Current status
                    <input id="profile-status-input" maxlength="48" value="${escapeAttr(profileDetails.status)}">
                </label>
                <label>
                    Why you are here
                    <select id="profile-intention-input">
                        ${['Share honestly', 'Find similar minds', 'Give advice', 'Read quietly', 'Ask better questions'].map(option => `<option value="${option}" ${profileDetails.intention === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </label>
                <label class="boost-toggle profile-badge-toggle">
                    <input type="checkbox" id="profile-premium-input" ${profileDetails.premiumBadge ? 'checked' : ''}>
                    <span>Show premium badge placeholder</span>
                </label>
                <div class="thread-compose-actions">
                    <button class="secondary-action compact-action" onclick="copyUserId()">Copy ID</button>
                    <button class="primary-action compact-action" onclick="saveMyProfileDetails()">Save Profile</button>
                </div>
            </div>

            <div class="profile-section-grid">
                <section class="profile-panel">
                    <h3>Profile Pattern</h3>
                    <div class="profile-pattern">
                        <span><strong>${escapeHtml(stats.topMood)}</strong> top mood</span>
                        <span><strong>${escapeHtml(stats.topCategory)}</strong> top category</span>
                        <span><strong>${stats.followedCount}</strong> followed threads</span>
                    </div>
                </section>
                <section class="profile-panel">
                    <h3>${pinnedThought ? 'Pinned Thought' : 'Strongest Thought'}</h3>
                    ${pinnedThought || strongestThought ? `
                        <button class="profile-thought-row" onclick="jumpToThought('${(pinnedThought || strongestThought).id}')">
                            <strong>${escapeHtml((pinnedThought || strongestThought).category)} · ${escapeHtml((pinnedThought || strongestThought).mood || 'Reflective')}</strong>
                            <span>${escapeHtml((pinnedThought || strongestThought).text)}</span>
                        </button>
                    ` : '<p class="thread-empty">Share a thought to start building your profile signal.</p>'}
                </section>
            </div>

            <section class="profile-panel">
                <div class="profile-panel-header">
                    <h3>Achievements</h3>
                    <span class="profile-progress">${achievements.filter(item => item.unlocked).length}/${achievements.length} unlocked</span>
                </div>
                <div class="achievement-grid">
                    ${achievements.map(item => `
                        <div class="achievement-card ${item.unlocked ? 'unlocked' : ''}">
                            <strong>${escapeHtml(item.title)}</strong>
                            <span>${escapeHtml(item.detail)}</span>
                        </div>
                    `).join('')}
                </div>
            </section>

            <section class="profile-panel">
                <div class="profile-panel-header">
                    <h3>Recent Thoughts</h3>
                    <button class="secondary-action compact-action" onclick="viewYourThoughts()">View All</button>
                </div>
                <div class="profile-modal-list">
                    ${recentThoughts.length ? recentThoughts.map(quote => `
                        <button class="profile-thought-row" onclick="jumpToThought('${quote.id}')">
                            <strong>${escapeHtml(quote.category)} · ${escapeHtml(quote.mood || 'Reflective')} · ${formatTimeAgo(new Date(quote.timestamp))}</strong>
                            <span>${escapeHtml(quote.text)}</span>
                        </button>
                    `).join('') : '<p class="thread-empty">No thoughts from this identity yet.</p>'}
                </div>
            </section>

            <section class="profile-panel">
                <div class="profile-panel-header">
                    <h3>Saved For Later</h3>
                    <button class="secondary-action compact-action" onclick="viewSaved()">Saved Tab</button>
                </div>
                <div class="profile-modal-list">
                    ${savedThoughts.length ? savedThoughts.map(quote => `
                        <button class="profile-thought-row" onclick="jumpToThought('${quote.id}')">
                            <strong>${escapeHtml(quote.authorName || 'Anonymous')} · ${escapeHtml(quote.category)}</strong>
                            <span>${escapeHtml(quote.text)}</span>
                        </button>
                    `).join('') : '<p class="thread-empty">Saved thoughts become your private reading list.</p>'}
                </div>
            </section>
        </section>
    `;
}

function saveMyProfileDetails() {
    profileDetails = {
        bio: document.getElementById('profile-bio-input')?.value.trim().slice(0, 160) || '',
        status: document.getElementById('profile-status-input')?.value.trim().slice(0, 48) || 'Open to thoughtful replies',
        intention: document.getElementById('profile-intention-input')?.value || 'Share honestly',
        premiumBadge: Boolean(document.getElementById('profile-premium-input')?.checked),
        pinnedThoughtId: profileDetails.pinnedThoughtId || ''
    };

    saveProfileDetails();
    addNotification({ type: 'profile', message: 'Profile saved for this browser.' });
    renderProfilePage();
}

function pinThoughtToProfile(quoteId, event) {
    if (event) event.stopPropagation();
    profileDetails.pinnedThoughtId = profileDetails.pinnedThoughtId === quoteId ? '' : quoteId;
    saveProfileDetails();
    addNotification({
        type: 'profile',
        message: profileDetails.pinnedThoughtId ? 'Thought pinned to your profile.' : 'Profile pin removed.'
    });
    applyFiltersAndSort();
}

function deleteOwnThought(quoteId, event) {
    if (event) event.stopPropagation();
    if (!socket || !currentUser || !quoteId) return;

    const quote = allQuotes.find(item => item.id === quoteId);
    if (!quote || quote.authorId !== currentUser.id) return;
    if (!confirm('Delete this thought and its thread replies?')) return;

    socket.emit('deleteQuote', { quoteId });
}

function removeQuoteLocally(quoteId) {
    allQuotes = allQuotes.filter(quote => quote.id !== quoteId);
    quotes = quotes.filter(quote => quote.id !== quoteId);
    yourPosts = yourPosts.filter(quote => quote.id !== quoteId);
    postsWithReplies = postsWithReplies.filter(quote => quote.id !== quoteId);
    savedPosts = savedPosts.filter(id => id !== quoteId);
    delete reactionsData[quoteId];
    delete threadReplies[quoteId];
    expandedThreads.delete(quoteId);
    followedThreads = followedThreads.filter(id => id !== quoteId);
    reportedPosts = reportedPosts.filter(id => id !== quoteId);

    if (profileDetails.pinnedThoughtId === quoteId) {
        profileDetails.pinnedThoughtId = '';
        saveProfileDetails();
    }

    saveSavedPosts();
    saveFollowedThreads();
    saveSafetyPreferences();
    updateTabBadges();
    applyFiltersAndSort();
}

// Render quotes to the feed


function renderQuotes() {


    const feed = document.getElementById('feed');


    if (!feed) return;


    


    if (quotes.length === 0) {


        const emptyCopy = searchQuery
            ? 'No thoughts match that search. Try a mood, category, or stranger name.'
            : currentTab === 'saved'
                ? 'Saved thoughts will appear here when one is worth coming back to.'
                : currentTab === 'following'
                    ? 'Follow a thread to keep an eye on replies and return to it fast.'
                : currentTab === 'yours'
                    ? 'Your anonymous thoughts will collect here after you post.'
                    : 'No thoughts to show yet. Start the room with something honest.';
        feed.innerHTML = `<div class="empty-message premium-empty"><strong>${emptyCopy}</strong><button onclick="focusThoughtInput()">Write a Thought</button></div>`;


        return;


    }


    


    const savedShelf = currentTab === 'saved' ? renderSavedShelf() : '';

    feed.innerHTML = savedShelf + quotes.map(quote => {


        const date = new Date(quote.timestamp);


        const timeAgo = formatTimeAgo(date);


        const quoteReactions = reactionsData[quote.id] || {};


        const replyCount = quote.replyCount || 0;


        const reactionCount = quote.reactionCount || 0;


        const isYours = currentUser && quote.authorId === currentUser.id;


        const chatParticipants = chatParticipantCounts[quote.id] || 0;


        const isSaved = isPostSaved(quote.id);
        const isFeatured = quote.boosted || getEngagementScore(quote) >= 5;
        const isQuiet = Boolean(quote.quiet);
        const mood = quote.mood || 'Reflective';
        const replies = threadReplies[quote.id] || [];
        const isThreadOpen = expandedThreads.has(quote.id);
        const latestReplies = replies.slice(-3);
        const isFollowingThread = followedThreads.includes(quote.id);
        const isPinned = profileDetails.pinnedThoughtId === quote.id;
        const health = getConversationHealth(quote);


        


        return `


            <div class="quote-card ${isYours ? 'yours' : ''} ${isFeatured ? 'featured' : ''} ${isQuiet ? 'quiet-thought-card' : ''}" data-category="${quote.category}" data-quote-id="${quote.id}">


                <div class="quote-header">


                    <div class="quote-avatar" style="background-color: ${quote.authorColor || '#444'}"></div>


                    <button class="quote-author author-link" onclick="openAuthorProfile('${quote.authorId || ''}', event)">${escapeHtml(quote.authorName || 'Anonymous')}${isYours ? ' (You)' : ''}</button>


                    <span class="quote-category">${escapeHtml(quote.category)}</span>
                    <span class="mood-tag">${escapeHtml(mood)}</span>
                    ${isQuiet ? '<span class="quiet-tag">Quiet hours</span>' : ''}
                    ${isFeatured ? '<span class="premium-badge">Featured</span>' : ''}


                    ${currentUser ? `<button class="save-btn ${isSaved ? 'saved' : ''}" onclick="toggleSavePost('${quote.id}', event)" title="${isSaved ? 'Unsave' : 'Save'} post">${isSaved ? '🔖' : '🖤'}</button>` : ''}


                </div>


                <div class="quote-content">"${escapeHtml(quote.text)}"</div>


                <div class="reactions">


                    ${REACTIONS.map(reaction => {


                        const count = quoteReactions[reaction] || 0;


                        return `<button class="reaction-btn" onclick="toggleReaction('${quote.id}', '${reaction}')" title="${reaction}">${reaction}<span class="reaction-count">${count > 0 ? count : ''}</span></button>`;


                    }).join('')}


                </div>


                <div class="quote-meta">


                    <div class="quote-stats">


                        <span>💬 ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}</span>


                        <span>❤️ ${reactionCount} ${reactionCount === 1 ? 'reaction' : 'reactions'}</span>


                        ${chatParticipants > 0 ? `<span class="chat-participants">👥 ${chatParticipants} ${chatParticipants === 1 ? 'person' : 'people'} chatting now</span>` : ''}


                    </div>


                    <span class="quote-time">${timeAgo}</span>


                </div>


                <div class="quote-actions">


                    <button class="join-btn" onclick="toggleThread('${quote.id}')">${isThreadOpen ? 'Hide Thread' : 'Reply in Thread'}</button>
                    ${isYours ? `<button class="action-btn ${isPinned ? 'active-action' : ''}" onclick="pinThoughtToProfile('${quote.id}', event)">${isPinned ? 'Unpin' : 'Pin'}</button>` : ''}
                    <button class="action-btn" onclick="copyThoughtLink('${quote.id}', event)">Copy Link</button>
                    <button class="action-btn" onclick="openShareCard('${quote.id}', event)">Share Card</button>
                    <button class="action-btn" onclick="reportThought('${quote.id}', '${quote.authorId || ''}', event)">Report</button>
                    ${isYours ? `<button class="action-btn danger-action" onclick="deleteOwnThought('${quote.id}', event)">Delete</button>` : ''}
                    ${!isYours ? `<button class="action-btn" onclick="blockAuthor('${quote.authorId || ''}', event)">Block</button>` : ''}


                    ${currentUser && currentTab === 'matches' ? `<button class="match-button" onclick="requestOneOnOneMatch('${quote.id}', '${quote.category}')">👥 Find Match</button>` : ''}


                </div>


            </div>


        `;


    }).join('');
    renderInlineThreads();


}

function renderSavedShelf() {
    const savedQuotes = allQuotes.filter(quote => savedPosts.includes(quote.id));
    if (savedQuotes.length === 0) return '';

    const groups = MOODS.map(mood => ({
        mood,
        count: savedQuotes.filter(quote => (quote.mood || 'Reflective') === mood).length
    })).filter(group => group.count > 0);

    return `
        <section class="saved-shelf">
            <div class="profile-panel-header">
                <h3>Saved Collections</h3>
                <span>${savedQuotes.length} saved</span>
            </div>
            <div class="saved-shelf-chips">
                ${groups.map(group => `
                    <button onclick="filterByMood('${group.mood}')">
                        <strong>${escapeHtml(group.mood)}</strong>
                        <span>${group.count}</span>
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

function renderInlineThreads() {
    quotes.forEach(quote => {
        const card = document.querySelector(`[data-quote-id="${quote.id}"]`);
        if (!card) return;

        const replies = threadReplies[quote.id] || [];
        const draft = getThreadReplyDraft(quote.id);
        const nudges = getThreadNudges(quote);
        const isThreadOpen = expandedThreads.has(quote.id);
        const isFollowingThread = followedThreads.includes(quote.id);
        const latestReplies = replies.slice(-3);
        const replyTotal = replies.length || quote.replyCount || 0;
        const recapText = replyTotal === 0
            ? 'No replies yet. A thoughtful first reply can set the tone.'
            : `${replyTotal} ${replyTotal === 1 ? 'reply' : 'replies'} in this thread${isFollowingThread ? ' · following' : ''}.`;
        const panel = document.createElement('div');
        panel.className = `thread-panel ${isThreadOpen ? 'open' : ''}`;
        panel.id = `thread-${quote.id}`;
        panel.innerHTML = `
            <div class="thread-recap">
                <strong>Thread recap</strong>
                <span>${escapeHtml(recapText)}</span>
            </div>
            <div class="thread-replies">
                ${latestReplies.length > 0 ? latestReplies.map(reply => renderThreadReply(reply)).join('') : '<div class="thread-empty">No replies yet. Start the thread.</div>'}
            </div>
            ${replies.length > 3 ? `<button class="thread-more" onclick="expandAllThreadReplies('${quote.id}')">Show all ${replies.length} replies</button>` : ''}
            <div class="thread-compose">
                ${draft ? `<div class="thread-draft-note">Draft restored from ${formatTimeAgo(new Date(draft.updatedAt || Date.now()))}.</div>` : ''}
                <textarea id="thread-input-${quote.id}" placeholder="Reply to this thought..." maxlength="500" oninput="saveThreadReplyDraft('${quote.id}')">${escapeHtml(draft?.text || '')}</textarea>
                <div class="thread-nudge">
                    <span>${escapeHtml(getThreadNudgeHint(quote))}</span>
                </div>
                <div class="thread-starters">
                    ${nudges.map(nudge => `<button onclick="insertThreadStarter('${quote.id}', ${JSON.stringify(nudge.text).replace(/"/g, '&quot;')})">${escapeHtml(nudge.label)}</button>`).join('')}
                </div>
                <div class="thread-compose-actions">
                    <button class="secondary-action compact-action" onclick="toggleFollowThread('${quote.id}')">${isFollowingThread ? 'Unfollow' : 'Follow Thread'}</button>
                    <button class="secondary-action compact-action" onclick="quoteOriginalInReply('${quote.id}')">Quote Thought</button>
                    <button class="secondary-action compact-action" onclick="clearThreadReplyDraft('${quote.id}', true)">Clear Draft</button>
                    <button class="primary-action compact-action" onclick="sendThreadReply('${quote.id}')">Reply</button>
                </div>
                <div class="thread-compose-status" id="thread-status-${quote.id}"></div>
            </div>
        `;

        card.appendChild(panel);
    });
}

function getThreadDraftKey(quoteId) {
    return `strangerThreadDraft:${quoteId}`;
}

function getThreadReplyDraft(quoteId) {
    try {
        return JSON.parse(localStorage.getItem(getThreadDraftKey(quoteId)) || 'null');
    } catch (err) {
        localStorage.removeItem(getThreadDraftKey(quoteId));
        return null;
    }
}

function saveThreadReplyDraft(quoteId) {
    const input = document.getElementById(`thread-input-${quoteId}`);
    if (!input) return;

    const text = input.value.trim();
    if (!text) {
        localStorage.removeItem(getThreadDraftKey(quoteId));
        return;
    }

    localStorage.setItem(getThreadDraftKey(quoteId), JSON.stringify({
        text: input.value,
        updatedAt: new Date().toISOString()
    }));
}

function clearThreadReplyDraft(quoteId, updateUi = false) {
    localStorage.removeItem(getThreadDraftKey(quoteId));
    if (updateUi) {
        const input = document.getElementById(`thread-input-${quoteId}`);
        if (input) input.value = '';
        addNotification({ type: 'draft', message: 'Thread reply draft cleared.' });
    }
}

function getThreadNudges(quote) {
    const mood = quote.mood || 'Reflective';
    const moodNudges = THREAD_NUDGES[mood] || THREAD_NUDGES.Reflective;
    return [
        ...moodNudges,
        { label: 'Relate', text: 'I relate to this because ' },
        { label: 'Support', text: 'If I were sitting with you, I would say ' }
    ];
}

function getThreadNudgeHint(quote) {
    const mood = quote.mood || 'Reflective';
    if (mood === 'Heavy') return 'Lead with care before advice.';
    if (mood === 'Celebrating') return 'Reflect the good thing back clearly.';
    if (mood === 'Curious') return 'Ask one question that opens the thought.';
    if (mood === 'Unfiltered') return 'Keep it honest without escalating.';
    if (mood === 'Hopeful') return 'Help the hopeful part become concrete.';
    return 'Mirror the feeling, then add one true thing.';
}

function renderThreadReply(reply) {
    const quoteBlock = reply.quotedText ? `<blockquote>${escapeHtml(reply.quotedText)}</blockquote>` : '';
    return `
        <div class="thread-reply">
            <div class="thread-reply-avatar" style="background-color: ${reply.authorColor || '#444'}"></div>
            <div>
                <div class="thread-reply-meta">${escapeHtml(reply.authorName || 'Anonymous')} · ${formatTimeAgo(new Date(reply.timestamp))}</div>
                ${quoteBlock}
                <div class="thread-reply-text">${escapeHtml(reply.text)}</div>
            </div>
        </div>
    `;
}

function toggleThread(quoteId) {
    if (expandedThreads.has(quoteId)) {
        expandedThreads.delete(quoteId);
        applyFiltersAndSort();
        return;
    }

    expandedThreads.add(quoteId);
    if (!threadReplies[quoteId] && socket) {
        socket.emit('getThreadReplies', quoteId);
    }
    applyFiltersAndSort();

    setTimeout(() => {
        const input = document.getElementById(`thread-input-${quoteId}`);
        if (input) input.focus();
    }, 50);
}

function expandAllThreadReplies(quoteId) {
    const panel = document.getElementById(`thread-${quoteId}`);
    if (!panel) return;

    const replies = threadReplies[quoteId] || [];
    const repliesContainer = panel.querySelector('.thread-replies');
    const moreButton = panel.querySelector('.thread-more');
    if (repliesContainer) repliesContainer.innerHTML = replies.map(reply => renderThreadReply(reply)).join('');
    if (moreButton) moreButton.remove();
}

function quoteOriginalInReply(quoteId) {
    const quote = allQuotes.find(q => q.id === quoteId);
    const input = document.getElementById(`thread-input-${quoteId}`);
    if (!quote || !input) return;

    input.value = `> ${quote.text}\n\n${input.value}`;
    input.focus();
    saveThreadReplyDraft(quoteId);
}

function insertThreadStarter(quoteId, starter) {
    const input = document.getElementById(`thread-input-${quoteId}`);
    if (!input) return;

    const prefix = input.value.trim() ? `${input.value.trim()}\n\n` : '';
    input.value = `${prefix}${starter}`;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    saveThreadReplyDraft(quoteId);
}

function toggleFollowThread(quoteId) {
    if (followedThreads.includes(quoteId)) {
        followedThreads = followedThreads.filter(id => id !== quoteId);
        addNotification({ type: 'thread', message: 'Thread unfollowed.' });
    } else {
        followedThreads.push(quoteId);
        addNotification({ type: 'thread', message: 'Thread followed. New replies will notify you.' });
    }

    saveFollowedThreads();
    updateTabBadges();
    applyFiltersAndSort();
}

function sendThreadReply(quoteId) {
    const input = document.getElementById(`thread-input-${quoteId}`);
    if (!input || !socket || !currentUser) return;
    const status = document.getElementById(`thread-status-${quoteId}`);

    const raw = input.value.trim();
    if (!raw) return;

    const quotedMatch = raw.match(/^>\s?(.+?)(\n\n|$)/s);
    const quotedText = quotedMatch ? quotedMatch[1].trim().slice(0, 180) : '';
    const text = raw.replace(/^>\s?.+?(\n\n|$)/s, '').trim() || raw;

    if (status) status.textContent = 'Sending reply...';
    input.disabled = true;

    socket.timeout(5000).emit('sendThreadReply', { quoteId, text, quotedText }, (err, response) => {
        input.disabled = false;
        if (err || !response?.ok) {
            if (status) status.textContent = response?.error || 'Reply did not send. Check the connection and try again.';
            return;
        }

        input.value = '';
        clearThreadReplyDraft(quoteId);
        if (status) status.textContent = 'Reply posted.';
        setTimeout(() => {
            if (status) status.textContent = '';
        }, 1600);
    });
}





// Apply filters and sorting


function applyFiltersAndSort() {
    if (currentTab === 'profile') {
        updateExperienceStats();
        renderProfilePage();
        return;
    }


    if (currentTab === 'matches') {
        renderMatchLobby();
        return;
    }

    let filtered = [...allQuotes];
    filtered = filtered.filter(q => !blockedAuthors.includes(q.authorId) && !reportedPosts.includes(q.id));


    


    // Apply search filter


    if (searchQuery) {


        filtered = filtered.filter(q => 


            q.text.toLowerCase().includes(searchQuery) ||


            q.authorName.toLowerCase().includes(searchQuery) ||


            q.category.toLowerCase().includes(searchQuery) ||
            (q.mood || '').toLowerCase().includes(searchQuery)


        );


    }


    


    if (currentTab === 'trending') {
        filtered = filtered.filter(q => getEngagementScore(q) > 0 || q.boosted);
    } else if (currentTab === 'yours') {


        filtered = yourPosts;


    } else if (currentTab === 'replies') {


        filtered = postsWithReplies;


    } else if (currentTab === 'following') {










        filtered = allQuotes.filter(q => followedThreads.includes(q.id) && !blockedAuthors.includes(q.authorId) && !reportedPosts.includes(q.id));










    } else if (currentTab === 'saved') {


        filtered = allQuotes.filter(q => savedPosts.includes(q.id) && !blockedAuthors.includes(q.authorId) && !reportedPosts.includes(q.id));


    }


    


    if (currentFilter !== 'all') {


        filtered = filtered.filter(q => q.category === currentFilter);


    }

    if (currentMoodFilter !== 'all') {
        filtered = filtered.filter(q => (q.mood || 'Reflective') === currentMoodFilter);
    }


    


    switch (currentSort) {


        case 'new':


            filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));


            break;


        case 'hot':


            filtered.sort((a, b) => getEngagementScore(b) - getEngagementScore(a));


            break;


        case 'discussed':


            filtered.sort((a, b) => (b.replyCount || 0) - (a.replyCount || 0));


            break;


    }


    


    quotes = filtered;
    updateExperienceStats();


    renderQuotes();


}





// Toggle reaction on a quote


function toggleReaction(quoteId, reaction) {


    if (!isConnected || !currentUser) return;


    


    if (!currentUser.lastReaction) {


        currentUser.lastReaction = {};


    }


    


    const currentReaction = currentUser.lastReaction[quoteId];


    


    if (currentReaction === reaction) {


        socket.emit('removeReaction', { quoteId, reaction });


        currentUser.lastReaction[quoteId] = null;


    } else {


        if (currentReaction) {


            socket.emit('removeReaction', { quoteId, reaction: currentReaction });


        }


        socket.emit('addReaction', { quoteId, reaction });


        currentUser.lastReaction[quoteId] = reaction;


    }


}





// Join chat for a quote


function joinChat(quoteId) {


    if (!isConnected) {


        alert('Not connected to server. Please refresh the page.');


        return;


    }


    


    socket.emit('joinQuoteChat', quoteId);


    window.location.href = `/chat.html?quoteId=${quoteId}`;


}





// Submit a new quote


function submitThought() {


    const input = document.getElementById('thought-input');


    const content = input.value.trim();


    const category = document.getElementById('new-category').value;
    const mood = document.getElementById('new-mood')?.value || 'Reflective';
    const boosted = Boolean(document.getElementById('boost-thought')?.checked);
    const quiet = Boolean(document.getElementById('quiet-thought')?.checked);


    


    if (!content || content.length < MIN_LENGTH) {


        alert(`Thought must be at least ${MIN_LENGTH} characters`);


        return;


    }


    


    if (content.length > MAX_LENGTH) return;


    if (!isConnected || !currentUser) return;


    


    const newQuote = {


        id: Date.now().toString(),


        text: content,


        category: category,
        mood: mood,
        boosted: boosted,
        quiet: quiet,


        timestamp: new Date().toISOString(),


        authorId: currentUser.id,


        authorName: currentUser.name,


        authorColor: currentUser.color,


        replyCount: 0,


        reactionCount: 0


    };


    


    input.value = '';


    document.getElementById('char-count').textContent = '0';
    updateComposerPreview();


    document.getElementById('submit-btn').disabled = true;


    


    socket.emit('newQuote', newQuote);


    


    window.scrollTo({ top: 0, behavior: 'smooth' });


}





// Update character count


function updateCharCount() {


    const input = document.getElementById('thought-input');


    const count = input.value.length;


    const charCount = document.getElementById('char-count');


    const submitBtn = document.getElementById('submit-btn');


    


    if (charCount) charCount.textContent = count;
    saveThoughtDraft();
    updateComposerPreview();


    


    if (count >= MIN_LENGTH && count <= MAX_LENGTH) {


        if (submitBtn) submitBtn.disabled = false;


    } else {


        if (submitBtn) submitBtn.disabled = true;


    }


}





// Connect to Socket.IO server


function connect() {


    if (typeof io === 'undefined') {


        setTimeout(() => {


            document.body.innerHTML = 


                `<div style="text-align: center; padding: 4rem; color: #fff; font-family: Arial, sans-serif; background: #0a0a0a; min-height: 100vh;">


                    <h1>Cannot Load Socket.IO</h1>


                    <p style="color: #aaa;">Make sure you are accessing this through <code>http://localhost:3002</code></p>


                </div>`;


        }, 1000);


        return;


    }


    


    const savedIdentity = loadSavedIdentity();


    savedPosts = loadSavedPosts();
    loadSafetyPreferences();
    initializeProductShell();


    


    socket = io({


        reconnection: true,


        reconnectionAttempts: 5,


        reconnectionDelay: 1000,


        timeout: 5000,


        auth: savedIdentity ? { identity: savedIdentity } : {}


    });


    


    socket.on('connect', () => {


        console.log('Connected to server');


        isConnected = true;


        socket.emit('getQuotes');


        socket.emit('getYourPosts');


        updateConnectionUI();


        updateTabBadges();


    });


    


    socket.on('connect_error', (err) => {


        console.error('Connection error:', err.message);


        isConnected = false;


        updateConnectionUI();


    });

    socket.on('rateLimited', (data) => {
        addNotification({
            type: 'warning',
            message: data.message || 'Slow down a little before trying again.'
        });
    });

    socket.on('quoteRejected', (data) => {
        addNotification({
            type: 'error',
            message: data.message || 'That thought could not be posted.'
        });
        focusThoughtFromHash();
        updateConnectionUI();
    });


    


    socket.on('disconnect', () => {


        console.log('Disconnected from server');


        isConnected = false;


        updateConnectionUI();


    });


    


    socket.on('yourIdentity', (user) => {


        currentUser = user;


        updateConnectionUI();
        syncYourPostsFromQuotes();


        saveIdentity(user);


    });


    


    socket.on('identityUpdated', (user) => {


        currentUser = user;


        updateConnectionUI();
        syncYourPostsFromQuotes();


        saveIdentity(user);


    });


    


    socket.on('onlineCount', (count) => {


        updateOnlineCount(count);


    });


    


    socket.on('chatParticipants', ({ quoteId, count }) => {


        updateChatParticipantCount(quoteId, count);


    });


    


    socket.on('activity', (activity) => {


        // Handle different types of activity notifications


        if (activity.type === 'join') {


            addNotification({


                type: 'join',


                message: activity.message


            });


        } else if (activity.type === 'quote') {


            addNotification({


                type: 'quote',


                message: activity.message


            });


        } else if (activity.type === 'reply') {


            addNotification({


                type: 'reply',


                message: activity.message


            });


        } else if (activity.type === 'identity') {


            addNotification({


                type: 'identity',


                message: activity.message


            });


        }


    });


    


    // 1-on-1 chat events


    socket.on('oneOnOneMatched', handleOneOnOneMatched);


    socket.on('oneOnOneWaiting', handleOneOnOneWaiting);


    socket.on('oneOnOneMatchCanceled', handleOneOnOneMatchCanceled);


    socket.on('oneOnOneMessage', handleOneOnOneMessage);


    socket.on('oneOnOnePartnerLeft', handleOneOnOnePartnerLeft);
    
    // Match queue updates
    socket.on('matchQueueUpdate', (queueInfo) => {
        matchQueueInfo = queueInfo;
        if (currentTab === 'matches') {
            applyFiltersAndSort();
        }
        updateMatchesTabBadge();
    });


    


    socket.on('allQuotes', (serverQuotes) => {


        console.log('Received quotes:', serverQuotes);


        allQuotes = serverQuotes;


        quotes = serverQuotes;
        syncYourPostsFromQuotes();


        applyFiltersAndSort();


        updateConnectionUI();


    });


    


    socket.on('allReactions', (serverReactions) => {


        reactionsData = serverReactions;


        applyFiltersAndSort();


    });


    


    socket.on('yourPosts', (posts) => {


        yourPosts = posts;


        updateTabBadges();


        applyFiltersAndSort();


    });


    


    socket.on('postsWithReplies', (posts) => {


        postsWithReplies = posts;


        updateTabBadges();


        applyFiltersAndSort();


    });


    


    socket.on('newQuote', (quote) => {


        allQuotes.unshift(quote);


        if (currentUser && quote.authorId === currentUser.id) {


            yourPosts.unshift(quote);


            updateTabBadges();


        }


        applyFiltersAndSort();


    });


    


    socket.on('reactionUpdated', ({ quoteId, reactions }) => {


        reactionsData[quoteId] = reactions;


        applyFiltersAndSort();


    });


    


    socket.on('quoteUpdated', (updatedQuote) => {


        const allIndex = allQuotes.findIndex(q => q.id === updatedQuote.id);


        if (allIndex !== -1) {


            allQuotes[allIndex] = updatedQuote;


        }


        const filteredIndex = quotes.findIndex(q => q.id === updatedQuote.id);


        if (filteredIndex !== -1) {


            quotes[filteredIndex] = updatedQuote;


        }


        applyFiltersAndSort();


    });

    socket.on('quoteDeleted', ({ quoteId, message }) => {
        removeQuoteLocally(quoteId);
        addNotification({
            type: 'profile',
            message: message || 'Thought deleted.'
        });
    });

    socket.on('quoteDeleteRejected', ({ message }) => {
        addNotification({
            type: 'error',
            message: message || 'That thought could not be deleted.'
        });
    });

    socket.on('threadHistory', ({ quoteId, replies }) => {
        threadReplies[quoteId] = replies || [];
        if (expandedThreads.has(quoteId)) {
            applyFiltersAndSort();
        }
    });

    socket.on('newThreadReply', ({ quoteId, reply, replyCount }) => {
        if (!threadReplies[quoteId]) threadReplies[quoteId] = [];
        threadReplies[quoteId].push(reply);

        allQuotes = allQuotes.map(quote => quote.id === quoteId ? { ...quote, replyCount } : quote);
        quotes = quotes.map(quote => quote.id === quoteId ? { ...quote, replyCount } : quote);

        if (expandedThreads.has(quoteId)) {
            applyFiltersAndSort();
        } else {
            updateTabBadges();
            updateExperienceStats();
        }

        if (followedThreads.includes(quoteId) && reply.authorId !== currentUser?.id) {
            addNotification({
                type: 'thread',
                message: `${reply.authorName || 'Someone'} replied to a thread you follow.`
            });
        }
    });


    


    // Keyboard shortcuts


    const input = document.getElementById('thought-input');


    if (input) {


        input.addEventListener('keydown', function(e) {


            if (e.ctrlKey && e.key === 'Enter' && this.value.trim().length >= MIN_LENGTH && this.value.length <= MAX_LENGTH) {


                e.preventDefault();


                submitThought();


            }


        });


        


        input.addEventListener('keypress', function(e) {


            if (e.key === 'Enter' && !e.shiftKey && this.value.trim().length >= MIN_LENGTH && this.value.length <= MAX_LENGTH) {


                e.preventDefault();


                submitThought();


            }


        });


        


        input.addEventListener('input', updateCharCount);


    }


    


    // 1-on-1 chat message input


    const oneOnOneInput = document.getElementById('one-on-one-message-input');


    if (oneOnOneInput) {


        oneOnOneInput.addEventListener('keypress', function(e) {


            if (e.key === 'Enter' && !e.shiftKey) {


                e.preventDefault();


                sendOneOnOneMessage();


            }


        });


    }


}





// Tab switching functionality


function switchTab(tab) {


    currentTab = tab;


    


    // Update tab buttons


    const tabButtons = document.querySelectorAll('.tab-btn');


    tabButtons.forEach(btn => {


        btn.classList.remove('active');


        if (btn.getAttribute('data-tab') === tab) {


            btn.classList.add('active');


        }


    });


    


    // Apply filters and sorting


    applyFiltersAndSort();


}





// Sort functionality


function setSort(sort) {


    currentSort = sort;


    


    // Update sort buttons


    const sortButtons = document.querySelectorAll('.sort-btn');


    sortButtons.forEach(btn => {


        btn.classList.remove('active');


        if (btn.getAttribute('data-sort') === sort) {


            btn.classList.add('active');


        }


    });


    


    // Apply filters and sorting


    applyFiltersAndSort();


}





// Filter functionality


function filterByCategory() {


    const select = document.getElementById('category-filter');


    currentFilter = select.value;


    applyFiltersAndSort();


}





// Profile dropdown functionality


function toggleProfileDropdown(event) {


    event.stopPropagation();


    const dropdown = document.getElementById('profile-dropdown');


    if (dropdown) {


        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';


    }


}





function updateUsername() {


    const input = document.getElementById('profile-name-input');


    const name = input.value.trim();


    if (name && name.length >= 2) {


        socket.emit('updateUsername', { name });


        input.value = '';


    }


}





function handleProfileInputKey(event) {


    if (event.key === 'Enter') {


        event.preventDefault();


        event.stopPropagation();


        updateUsername();


    }


}





function copyUserId() {


    if (currentUser) {


        navigator.clipboard.writeText(currentUser.id).then(() => {


        alert('User ID copied to clipboard!');


        });


    }


}





function regenerateIdentity() {


    if (confirm('Are you sure you want to generate a new identity? This will reset your posts and replies.')) {


        socket.emit('regenerateIdentity');


        closeProfileDropdown();


    }


}





function viewYourThoughts() {


    switchTab('yours');


    closeProfileDropdown();


}





function viewSaved() {


    switchTab('saved');


    closeProfileDropdown();


}





function closeProfileDropdown() {


    const dropdown = document.getElementById('profile-dropdown');


    if (dropdown) {


        dropdown.style.display = 'none';


    }


}





// Close dropdowns when clicking outside


window.addEventListener('click', function() {


    closeProfileDropdown();


    closeNotificationDropdown();


});





// Prevent dropdowns from closing when clicking inside them


document.addEventListener('DOMContentLoaded', function() {


    const profileDropdown = document.getElementById('profile-dropdown');


    if (profileDropdown) {


        profileDropdown.addEventListener('click', function(event) {


            event.stopPropagation();


        });


    }


    


    const notificationDropdown = document.getElementById('notification-dropdown');


    if (notificationDropdown) {


        notificationDropdown.addEventListener('click', function(event) {


            event.stopPropagation();


        });


    }


});





function closeNotificationDropdown() {


    const dropdown = document.getElementById('notification-dropdown');


    if (dropdown) {


        dropdown.style.display = 'none';


    }


}





// Initialize


connect();

