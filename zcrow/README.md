# ZCrow Backend

A secure Rust backend for wallet-based authentication and escrow/commitment management. Built with Axum, SQLx, and PostgreSQL.

## Features

- ✅ **Secure Wallet Authentication**: Challenge-response flow with ed25519 signature verification
- ✅ **User Management**: Wallet-based accounts with profile support
- ✅ **JWT Sessions**: Stateless authentication with 7-day token expiry
- ✅ **Escrow/Commitment System**: Generic commitment lifecycle management
- ✅ **Transaction Ledger**: Full audit trail of all financial movements
- ✅ **RESTful API**: Clean, documented endpoints

## Tech Stack

- **Framework**: Axum 0.8
- **Database**: PostgreSQL with SQLx
- **Auth**: ed25519-dalek for signature verification, jsonwebtoken for JWTs
- **Async Runtime**: Tokio

## Quick Start

### Prerequisites

- Rust 1.75+ (2021 edition)
- PostgreSQL 14+
- SQLx CLI (`cargo install sqlx-cli`)

### Setup

1. **Clone and enter the project**:

   ```bash
   cd zcrow
   ```

2. **Copy environment file**:

   ```bash
   cp .env.example .env
   ```

3. **Configure `.env`**:

   ```env
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/zcrow
   JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
   HOST=0.0.0.0
   PORT=3000
   RUST_LOG=info
   ```

4. **Create database**:

   ```bash
   # Start PostgreSQL if not running
   sudo systemctl start postgresql

   # Create database
   sudo -u postgres createdb zcrow
   ```

5. **Run the server** (migrations run automatically):

   ```bash
   cargo run
   ```

   The server will start at `http://localhost:3000`

## API Reference

### Health Check

```http
GET /health
```

**Response**:

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

### Authentication

#### 1. Request Challenge

```http
POST /auth/challenge
Content-Type: application/json

{
  "wallet_pubkey": "BASE58_SOLANA_PUBKEY"
}
```

**Response**:

```json
{
  "nonce": "uuid",
  "message": "ZCrow Sign-In\nWallet: ...\nNonce: ...\nIssued At: ...",
  "expires_at": "2024-01-29T12:00:00Z"
}
```

#### 2. Wallet Login

The frontend must sign the `message` from step 1 using the wallet, then submit:

```http
POST /auth/wallet
Content-Type: application/json

{
  "wallet_pubkey": "BASE58_SOLANA_PUBKEY",
  "wallet_label": "phantom-wallet",
  "nonce": "uuid-from-challenge",
  "signature": "BASE58_OR_BASE64_SIGNATURE"
}
```

**Response**:

```json
{
  "is_new": true,
  "user": {
    "id": "uuid",
    "wallet_pubkey": "...",
    "wallet_label": "phantom-wallet",
    "created_at": "...",
    "last_login_at": "..."
  },
  "profile": {
    "user_id": "uuid",
    "username": null,
    "display_name": null,
    "avatar_url": null,
    "bio": null,
    "updated_at": "..."
  },
  "access_token": "eyJ..."
}
```

---

### Profile (Authenticated)

All profile endpoints require `Authorization: Bearer <token>` header.

#### Get My Profile

```http
GET /me
Authorization: Bearer <token>
```

#### Set Username

```http
PATCH /me/username
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "myusername"
}
```

Username rules:

- 3-20 characters
- Alphanumeric and underscores only
- Must be unique

#### Update Profile

```http
PATCH /me/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "display_name": "My Display Name",
  "avatar_url": "https://example.com/avatar.png",
  "bio": "Hello world!"
}
```

#### Check Username Availability

```http
GET /username/check?username=myusername
```

---

### Commitments (Authenticated)

#### Create Commitment

```http
POST /commitments
Authorization: Bearer <token>
Content-Type: application/json

{
  "kind": "escrow_payment",
  "title": "My Commitment",
  "description": "Description here",
  "amount": 1000000000,
  "currency": "SOL",
  "opponent_wallet": "OPPONENT_PUBKEY_OPTIONAL",
  "start_at": "2024-01-30T00:00:00Z",
  "end_at": "2024-01-31T00:00:00Z",
  "meta": {}
}
```

Note: `amount` is in lamports (1 SOL = 1,000,000,000 lamports)

#### List My Commitments

```http
GET /commitments?limit=20&offset=0
Authorization: Bearer <token>
```

#### Get Commitment

```http
GET /commitments/:id
```

#### Join Commitment (as opponent)

```http
POST /commitments/:id/join
Authorization: Bearer <token>
```

#### Record Deposit

```http
POST /commitments/:id/deposit
Authorization: Bearer <token>
Content-Type: application/json

{
  "tx_signature": "SOLANA_TX_SIGNATURE"
}
```

#### Cancel Commitment (creator only, pending status)

```http
POST /commitments/:id/cancel
Authorization: Bearer <token>
```

#### Activate Commitment (system)

```http
POST /commitments/:id/activate
```

#### Start Resolution (system)

```http
POST /commitments/:id/resolve
```

#### Settle Commitment (system)

```http
POST /commitments/:id/settle
Content-Type: application/json

{
  "winner_id": "uuid",
  "tx_settle": "SOLANA_TX_SIGNATURE"
}
```

---

### Transactions (Authenticated)

#### List My Transactions

```http
GET /transactions?limit=20&offset=0
Authorization: Bearer <token>
```

#### Get Transaction

```http
GET /transactions/:id
Authorization: Bearer <token>
```

#### Get Balance

```http
GET /balance?currency=SOL
Authorization: Bearer <token>
```

#### Get Commitment Transactions

```http
GET /commitments/:id/transactions
```

---

## Commitment Lifecycle

```
pending → locked → active → resolving → released
    ↓
cancelled
```

1. **pending**: Created, waiting for both parties to deposit
2. **locked**: Both deposits received
3. **active**: Commitment period is running
4. **resolving**: Period ended, awaiting settlement
5. **released**: Settled, winner received funds
6. **cancelled**: Cancelled before deposits

---

## Frontend Integration (React Native + MWA)

### Converting MWA Address to Base58

MWA returns the address as base64. Convert it:

```javascript
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

// address from authResult.accounts[0].address (base64)
const pubkey = new PublicKey(Buffer.from(address, "base64"));
const base58Pubkey = pubkey.toBase58();
```

### Complete Auth Flow

```javascript
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

const API_URL = "http://your-server:3000";

async function connectAndLogin() {
  // 1. Connect to wallet and get pubkey
  const authResult = await transact(async (wallet) => {
    return await wallet.authorize({
      cluster: "solana:mainnet-beta",
      identity: {
        name: "ZCrow",
        uri: "https://your-app.com",
        icon: "https://your-app.com/icon.png",
      },
    });
  });

  const base64Address = authResult.accounts[0].address;
  const pubkey = new PublicKey(Buffer.from(base64Address, "base64"));
  const walletPubkey = pubkey.toBase58();

  // 2. Request challenge from backend
  const challengeRes = await fetch(`${API_URL}/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet_pubkey: walletPubkey }),
  });
  const { nonce, message } = await challengeRes.json();

  // 3. Sign the message
  const signResult = await transact(async (wallet) => {
    // Re-authorize to get signing capability
    await wallet.authorize({
      cluster: "solana:mainnet-beta",
      identity: {
        name: "ZCrow",
        uri: "https://your-app.com",
        icon: "https://your-app.com/icon.png",
      },
    });

    // Sign the challenge message
    const messageBytes = new TextEncoder().encode(message);
    const signatures = await wallet.signMessages({
      addresses: [base64Address],
      payloads: [messageBytes],
    });
    return signatures[0];
  });

  // 4. Convert signature to base58
  const signatureBase58 = bs58.encode(signResult);

  // 5. Login to backend
  const loginRes = await fetch(`${API_URL}/auth/wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet_pubkey: walletPubkey,
      wallet_label: authResult.accounts[0].label,
      nonce: nonce,
      signature: signatureBase58,
    }),
  });

  const { is_new, user, profile, access_token } = await loginRes.json();

  // Store access_token for authenticated requests
  return { is_new, user, profile, access_token };
}
```

### Making Authenticated Requests

```javascript
async function fetchProfile(accessToken) {
  const res = await fetch(`${API_URL}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.json();
}

async function setUsername(accessToken, username) {
  const res = await fetch(`${API_URL}/me/username`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username }),
  });
  return res.json();
}
```

---

## Database Schema

### Tables

- `users` - Wallet-based user accounts
- `profiles` - User profile information
- `auth_nonces` - Challenge nonces for auth flow
- `commitments` - Escrow commitments
- `transactions` - Financial transaction ledger
- `commitment_events` - Commitment state change history

### Migrations

Migrations are in `/migrations/` and run automatically on startup.

To run manually:

```bash
sqlx migrate run
```

---

## Development

### Running Tests

```bash
cargo test
```

### Building for Production

```bash
cargo build --release
```

### Environment Variables

| Variable       | Required | Default   | Description                           |
| -------------- | -------- | --------- | ------------------------------------- |
| `DATABASE_URL` | Yes      | -         | PostgreSQL connection string          |
| `JWT_SECRET`   | Yes      | -         | Secret for JWT signing (min 32 chars) |
| `HOST`         | No       | `0.0.0.0` | Server bind host                      |
| `PORT`         | No       | `3000`    | Server bind port                      |
| `RUST_LOG`     | No       | `info`    | Log level                             |

---

## Security Notes

1. **Never trust frontend-provided wallet addresses** - Always verify via signature
2. **JWT tokens expire in 7 days** - Implement refresh flow for long sessions
3. **Challenge nonces expire in 5 minutes** - Prevents replay attacks
4. **Signatures can be base58 or base64** - Backend accepts both formats
5. **CORS is permissive by default** - Restrict in production

---

## License

MIT
