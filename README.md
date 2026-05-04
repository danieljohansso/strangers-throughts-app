# Strangers Thoughts

Anonymous quote-sharing app with reactions, categories, and chat.

## Features

- **Anonymous Identities**: Random names like "QuietFox42" with colored avatars
- **Reactions**: 👍 😂 🤔 ❤️ on each quote
- **Sorting**: New, Hot, Most Discussed
- **Categories**: Funny, Deep, Sad, Random, Advice, Shower Thoughts
- **Quote Cards**: Shows author, category, reply count, reaction count, timestamp
- **Chat Rooms**: Join chat for any quote, reply with quoting
- **Persistence**: All quotes, reactions, and chats saved to disk

## Quick Start

```bash
# Navigate to the project folder
cd stranger-thoughts-app

# Install dependencies (first time only)
npm install

# Start the server
npm start

# Open your browser to:
# http://localhost:3002
```

## Quality Checks

```bash
npm run check
npm run smoke
```

See `RUNBOOK.md` for architecture, admin routes, backup/export notes, and production safety caveats.

## How It Works

1. **Landing Page**: Browse quotes, filter by category, sort by popularity
2. **React to Quotes**: Click emoji buttons to react
3. **Share a Thought**: Type your quote, select a category, click Share
4. **Join Chat**: Click "Join Chat" on any quote to discuss it with others
5. **Quote in Chat**: Click any message to quote it

## Data Storage

All data is stored in the `data/` folder:
- `quotes.json` - All quotes
- `reactions.json` - All reactions
- `chats/*.json` - Chat messages per quote

Delete the `data/` folder to reset everything.

## Tech Stack

- Node.js + Express
- Socket.IO (real-time updates)
- File-based persistence
- Pure HTML/CSS/JavaScript (no frameworks)

## Customization

Edit `server.js` to:
- Change port: modify `const PORT = process.env.PORT || 3002;`
- Add more categories: edit `CATEGORIES` array
- Add more reactions: edit `REACTIONS` array in `app.js`
- Change random names: edit `adjectives` and `nouns` arrays
- Change colors: edit `colors` array

## Troubleshooting

**"Cannot Open Directly" message?**
- You opened the HTML file directly. Use `http://localhost:3002` instead.

**Connection stuck?**
- Make sure Node.js is installed (`node --version`)
- Run `npm install` then `npm start`
- Check terminal for errors

**Server won't start?**
- Try a different port by editing `const PORT = 8080;` in `server.js`
- Check if port 3002 is already in use
