# Cricket Auction App

A comprehensive cricket auction management application built with React, Firebase, and Tailwind CSS. Designed for conducting live bidding auctions with admin controls and real-time viewer updates.

## Features

### Admin Panel

- **Auction Setup**: Create auctions, add teams, define groups with custom bid increments
- **Player Management**: Add/edit/delete players, assign groups, upload photos
- **Live Bidding Control**: Increment bids, manage bid history, undo bids, select winners
- **Tie Management**: Admin-controlled winner selection for tied bids
- **Results & Export**: Export final squads and auction results to CSV/Excel

### Viewer Panel

- **Live Auction Dashboard**: Real-time bid display, team squad building, budget tracking
- **Player Information**: View player photos, age, group, stats
- **Team Status**: Monitor team budgets and squad formation
- **Player Pool**: Browse and filter players by group

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Backend**: Firebase Realtime Database
- **Authentication**: Firebase Auth
- **File Storage**: Firebase Storage
- **Export**: CSV/Excel via papaparse & xlsx

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Firebase account (free tier works)

### Installation

1. **Clone or navigate to the project**

   ```bash
   cd cricket-auction-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Setup Firebase**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication (Email/Password)
   - Create a Realtime Database
   - Enable Storage
   - Copy your Firebase config

4. **Configure Environment Variables**
   - Copy `.env.example` to `.env.local`
   - Update with your Firebase credentials

   ```bash
   cp .env.example .env.local
   ```

   - Edit `.env.local` and add your Firebase config values:

   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_DATABASE_URL=your_database_url
   ```

   - Seed the first admin in Firebase Realtime Database console:
     - path: `admin_roles/<your-auth-uid>`
     - value: `true`

   - After at least one admin exists, grant additional admins with:
      ```bash
      ADMIN_EMAIL=your_admin_email@example.com ADMIN_PASSWORD=your_admin_password npm run admin:grant
      ```
      (On PowerShell, set env vars first: `$env:ADMIN_EMAIL="..."`; `$env:ADMIN_PASSWORD="..."`)

   - Migrate legacy plaintext team PINs to hashed PINs:
     ```bash
     ADMIN_EMAIL=your_admin_email@example.com ADMIN_PASSWORD=your_admin_password npm run pins:migrate
     ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```
   The app will open at `http://localhost:3000`

## Project Structure

```
src/
├── pages/
│   ├── admin/              # Admin panel pages
│   │   ├── AdminSetup.jsx
│   │   ├── AdminPlayers.jsx
│   │   ├── AdminLive.jsx
│   │   ├── AdminResults.jsx
│   │   └── components/     # Admin sub-components
│   ├── viewer/             # Viewer panel pages
│   │   ├── AuctionDashboard.jsx
│   │   ├── TeamDetails.jsx
│   │   ├── PlayerPool.jsx
│   │   └── components/     # Viewer sub-components
│   ├── Home.jsx
│   └── NotFound.jsx
├── components/             # Shared components
├── hooks/                  # Custom React hooks
├── utils/                  # Utility functions
├── constants/              # App constants and config
├── styles/                 # CSS files
└── assets/                 # Images and static files
```

## Usage

### For Admins

1. **Login** with your admin credentials
2. **Setup Auction**:
   - Create auction with name, purse size, max players
   - Add teams and team owners with budgets
   - Create player groups (A+, A, B+, etc.) with:
     - Group name
     - Bid increment (e.g., 25,000)
     - Max price cap
3. **Add Players**:
   - Upload player data (bulk CSV or manual)
   - Assign groups and base prices
   - Upload player photos
4. **Start Auction**:
   - Go to Live Auction page
   - For each player:
     - Click INCREMENT to raise bid
     - Monitor bid display and bid history
     - Select winning team
     - Move to next player
5. **Export Results**:
   - Download final squads as CSV/Excel
   - View auction summary and statistics

### For Viewers

1. **Open** auction link without authentication
2. **Monitor Auction**:
   - Watch current player and bid amount in real-time
   - See team squad formation as players are sold
   - Track remaining budgets per team
3. **Browse Players**:
   - View complete player pool
   - Filter by group
   - Check player details (photo, age, group, stats)

## Database Schema

```
auctions/
  ├── auctionId
  │   ├── name, date, purse_size, status
  │   ├── teams/          # Team info and budgets
  │   ├── groups/         # Custom groups with increments
  │   ├── players/        # All players in auction
  │   └── bidding/        # Live bid tracking

teams/
  ├── auctionId
  ├── team_name, owner_name
  ├── budget_total, budget_remaining
  └── squad: [playerId1, playerId2, ...]

players/
  ├── playerId
  ├── name, age, photo_url, group_id
  └── base_price, role, nationality

auction_players/ (Live state)
  ├── current_bid, status (pending/live/sold/unsold)
  ├── winning_team_id
  └── bid_history: []
```

## Firebase Security Rules

Configure Firestore rules to:

- Allow admin (authenticated) to read/write all data
- Allow viewers (unauthenticated) to read-only auction data
- Restrict player/auction modifications to admin only

## Deployment

### Deploy to Firebase Hosting

1. **Install Firebase CLI**

   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**

   ```bash
   firebase login
   ```

3. **Build for Production**

   ```bash
   npm run build
   ```

4. **Deploy**
   ```bash
   firebase deploy
   ```

### Deploy to Vercel

1. **Push to GitHub**

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Import in Vercel** and connect your GitHub repo

### Google Search Console Sitemap

1. Update `public/sitemap.xml` and replace `https://your-domain.com` with your production domain.
2. Keep `public/robots.txt` in place (it already references `/sitemap.xml`).
3. Deploy the app.
4. In Google Search Console, submit `https://<your-domain>/sitemap.xml`.

## Testing

### Manual Test Checklist

- [ ] Admin can create auction and setup teams
- [ ] Admin can add players and assign groups
- [ ] Admin can start bidding and increment prices
- [ ] Viewers see real-time bid updates
- [ ] Team budgets update correctly
- [ ] Undo functionality works
- [ ] Winner selection works correctly
- [ ] Export to CSV/Excel works
- [ ] Responsive design on mobile/tablet/desktop

## Performance Optimization

- Real-time database listeners are subscribed/unsubscribed carefully
- Image lazy loading for player photos
- Pagination for large player lists
- Optimized Tailwind CSS builds

## Troubleshooting

### Firebase Connection Issues

- Verify `.env.local` has correct Firebase credentials
- Check Firebase project has Realtime Database enabled
- Ensure database security rules allow your operations

### Real-time Updates Not Working

- Check browser console for Firebase errors
- Verify Firebase listeners are active
- Check network tab in DevTools for Firestore calls

### Build Issues

- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf dist && npm run build`

## Future Enhancements

- Player statistics dashboard
- Auction replay/history
- Multi-auction management
- Advanced filtering and search
- Team performance analytics
- Email notifications

## License

ISC

## Support

For issues or questions, please refer to the Firebase documentation or create an issue in the project repository.

---

**Created for Cricket Auction Management**
