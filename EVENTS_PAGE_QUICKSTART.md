# Events Page - Quick Start Guide

## 🎵 What You'll See

When you visit `http://localhost:3002/events`, you'll see:

### Top Section (Search Controls)
```
┌─────────────────────────────────────────────────────┐
│  ✨ AI Model                                        │
│  [Claude 3.5 Sonnet ▼]                             │
│                                                      │
│  👥 Select Artists (5 selected)                     │
│  [DJ SNEAK] [MARK FARINA] [DJ HEATHER]             │
│  [DERRICK CARTER] [DOC MARTIN]                      │
│                                                      │
│  [Add custom artist...        ] [Add]               │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │   ✨ Search Events                           │  │
│  └──────────────────────────────────────────────┘  │
│  Last updated: 10:30:45 PM                          │
└─────────────────────────────────────────────────────┘
```

### Results Section (Event Cards)
```
🎵 DJ SNEAK
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Event Name  │ │ Event Name  │ │ Event Name  │
│ 📍 Venue    │ │ 📍 Venue    │ │ 📍 Venue    │
│    Location │ │    Location │ │    Location │
│ 📅 Feb 15   │ │ 📅 Mar 3    │ │ 📅 Apr 10   │
│ 🕐 10:00 PM │ │ 🕐 9:00 PM  │ │ 🕐 11:00 PM │
│             │ │             │ │             │
│ Description │ │ Description │ │ Description │
│             │ │             │ │             │
│ [More Info↗]│ │ [More Info↗]│ │ [More Info↗]│
└─────────────┘ └─────────────┘ └─────────────┘

🎵 MARK FARINA
[Similar cards for this artist...]
```

## 🎨 Visual Features

### Colors You'll See:
- **Background**: Deep black fading to purple
- **Cards**: Purple/pink gradients with glass effect
- **Buttons**: Bright lime green that glows on hover
- **Text**: Crisp white with purple accents

### Animations:
- ✨ Cards grow slightly when you hover
- ✨ Buttons glow with lime green shadow
- ✨ Smooth fades and transitions everywhere
- ✨ Loading skeletons pulse while searching

## 🚀 How to Test It

1. **Visit the page**:
   ```
   http://localhost:3002/events
   ```

2. **Watch it auto-search** on page load (takes 5-10 seconds)

3. **Try switching models**:
   - Click the dropdown at the top
   - Select "Claude 3 Opus" or another model
   - Watch it automatically search again

4. **Toggle artists**:
   - Click any artist button to deselect
   - Click again to re-select
   - Green = selected, gray = not selected

5. **Add a custom artist**:
   - Type a name in the text box
   - Press Enter or click Add
   - Click Search Events to include them

6. **Check the results**:
   - Scroll down to see event cards
   - Hover over cards for cool effects
   - Click "More Info" to visit event pages

## 📱 Responsive Design

The page looks great on:
- 🖥️ Desktop: 3 columns of events
- 📱 Tablet: 2 columns of events
- 📱 Phone: 1 column of events

## ⚡ Key Features

### 1. Auto-Search on Model Change
Change the model → Automatically searches again → See new results

### 2. Artist Flexibility
- Default: 5 popular house/techno DJs
- Add anyone you want
- Toggle on/off instantly

### 3. Real Event Data
- Uses Claude's web search
- Finds actual upcoming events
- Real URLs to ticket sites
- Dates, venues, locations

### 4. Beautiful UI
- Modern club aesthetic
- Smooth animations
- Clear information hierarchy
- Professional loading states

## 🐛 If Something Doesn't Work

1. **No events showing?**
   - Wait 10-15 seconds (web search takes time)
   - Check console for errors
   - Try clicking "Search Events" manually

2. **API errors?**
   - Check that `CLAUDE_API_KEY` is in .env
   - Make sure dev servers are running
   - Look at terminal logs

3. **Page won't load?**
   - Make sure you're on `http://localhost:3002/events`
   - Check that Next.js dev server is running
   - Try refreshing the page

## 🎯 What Makes This Special

1. **Live Web Search**: Actually searches the web for current events
2. **Model Comparison**: Try different AI models to see varied results
3. **Beautiful Design**: Stunning visual effects and animations
4. **User Friendly**: Easy to use, responsive, clear information
5. **Customizable**: Add your own artists, choose models

## 🌟 Pro Tips

- **Try different models** - each may find different events
- **Add local DJs** - search for artists in your city
- **Check back daily** - new events are always being announced
- **Click the links** - they go to real event/ticket pages
- **Hover everything** - there are animations everywhere!

Enjoy exploring upcoming DJ events! 🎵✨
