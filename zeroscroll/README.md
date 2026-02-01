# ZeroScroll - Screen Time Stake App

A React Native (Expo) mobile app that lets users stake SOL on their screen time commitments. Built with Expo Router, NativeWind (TailwindCSS), and Solana Mobile Wallet Adapter.

## Features

- 🔐 **Wallet Authentication**: Secure login via Solana MWA (Mobile Wallet Adapter)
- 💰 **Stake Management**: Create and manage screen time stakes
- 📊 **Real-time Balance**: Track your SOL balance and stake history
- 🏆 **Leaderboard**: Compete with other users
- 👤 **Profile Management**: Customize your username and profile

## Tech Stack

- **Framework**: Expo SDK 54 with Expo Router
- **Styling**: NativeWind (TailwindCSS for React Native)
- **State Management**: React Context + Hooks
- **Auth**: Solana MWA with JWT tokens
- **Navigation**: Expo Router (file-based routing)

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Android device with a Solana wallet app (Phantom, Solflare, etc.)
- ZCrow Backend running (see backend README)

## Project Structure

```
zeroscroll/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Auth screens (login, register)
│   ├── (tabs)/            # Main tab screens
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
│   ├── Commitments/       # Commitment-related components
│   └── ui/                # UI components
├── context/               # React Context providers
│   └── AuthContext.tsx    # Auth state management
├── hooks/                 # Custom React hooks
│   └── useApi.ts          # API data fetching hooks
├── services/              # API services
│   └── api.ts             # Backend API client
├── types/                 # TypeScript type definitions
│   └── index.ts           # All type definitions
├── constants/             # App constants
│   ├── config.ts          # API config, app identity
│   └── theme.ts           # Theme colors
└── utils/                 # Utility functions
    └── debounce.ts        # Debounce/throttle helpers
```

## Setup

1. **Install dependencies**:

   ```bash
   cd zeroscroll
   npm install
   ```

2. **Configure API URL**:
   Edit `constants/config.ts` to point to your backend:

   ```typescript
   // For Android emulator:
   export const API_URL = "http://10.0.2.2:3000";

   // For physical device (use your computer's IP):
   export const API_URL = "http://192.168.1.XXX:3000";
   ```

3. **Start the development server**:

   ```bash
   npm start
   ```

4. **Run on Android**:

   ```bash
   npm run android
   ```

   Or scan the QR code with Expo Go app.

## Backend Setup

Make sure the ZCrow backend is running:

1. Set up PostgreSQL database
2. Configure environment variables
3. Run the backend:
   ```bash
   cd zcrow
   cargo run
   ```

See the backend README for detailed setup instructions.

## Authentication Flow

1. User taps "Connect Wallet"
2. MWA opens wallet app for authorization
3. App requests challenge from backend (`POST /auth/challenge`)
4. User signs the challenge message in wallet
5. App sends signature to backend (`POST /auth/wallet`)
6. Backend verifies signature and returns JWT token
7. App stores token and navigates to main app

## API Integration

All API calls are handled through the `services/api.ts` module:

```typescript
import { api } from "@/services/api";

// Fetch commitments
const { commitments } = await api.getCommitments(20, 0);

// Create a commitment
const commitment = await api.createCommitment({
  kind: "screen_time_bet",
  title: "No Instagram for a week",
  amount: 500000000, // 0.5 SOL in lamports
  currency: "SOL",
  meta: {
    app_name: "Instagram",
    time_limit_minutes: 60,
  },
});

// Get balance
const balance = await api.getBalance("SOL");
```

## State Management

Auth state is managed via React Context:

```typescript
import { useAuth } from "@/context/AuthContext";

function MyComponent() {
  const {
    user, // Current user
    profile, // User profile
    isAuthenticated, // Auth status
    login, // Login function
    logout, // Logout function
    updateProfile, // Update profile
  } = useAuth();
}
```

## Custom Hooks

Data fetching hooks are available in `hooks/useApi.ts`:

```typescript
import { useCommitments, useBalance, useTransactions } from "@/hooks/useApi";

function MyComponent() {
  const { commitments, loading, error, refetch } = useCommitments();
  const { balance } = useBalance();
  const { transactions } = useTransactions();
}
```

## Screens

| Screen         | Route                   | Description           |
| -------------- | ----------------------- | --------------------- |
| Login          | `/(auth)/login`         | Wallet connection     |
| Register       | `/(auth)/register`      | Set username          |
| Home           | `/(tabs)/`              | Dashboard with stakes |
| Add Stake      | `/(tabs)/addStake`      | Create new stake      |
| Leaderboard    | `/(tabs)/leaderboard`   | Rankings              |
| Profile        | `/(tabs)/settings`      | Profile settings      |
| Wallet Details | `/(tabs)/stake_details` | Transaction history   |

## Development Notes

- The app uses file-based routing with Expo Router
- All styling is done with NativeWind (TailwindCSS)
- Authentication tokens are stored in AsyncStorage
- The app requires a physical Android device with a wallet app for full functionality

## Troubleshooting

**Wallet connection fails:**

- Make sure you have a Solana wallet app installed (Phantom, Solflare)
- Ensure the wallet is on the correct network (devnet/mainnet)

**API errors:**

- Check that the backend is running
- Verify the API_URL in config.ts matches your backend address
- For physical devices, use your computer's local IP instead of localhost

**Build errors:**

- Clear the Metro bundler cache: `expo start -c`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

## License

MIT
