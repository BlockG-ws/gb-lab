# ActivityPub/Fediverse Integration

This implementation adds ActivityPub support to your Astro blog, allowing it to federate with Mastodon, Pleroma, and other fediverse platforms.

## Features

- ✅ Full ActivityPub actor implementation
- ✅ WebFinger support for user discovery
- ✅ Inbox/Outbox endpoints
- ✅ Follow/Unfollow handling
- ✅ Automatic blog post publishing to fediverse
- ✅ SQLite and PostgreSQL support
- ✅ HTTP signature verification
- ✅ Configurable federation settings

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database (choose one)
DB_TYPE=sqlite
DB_PATH=./data/activitypub.db

# OR for PostgreSQL
# DB_TYPE=postgresql
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=activitypub
# DB_USER=postgres
# DB_PASSWORD=your_password

# ActivityPub Configuration
ACTIVITYPUB_DOMAIN=yourdomain.com
ACTIVITYPUB_BASE_URL=https://yourdomain.com
ACTIVITYPUB_USERNAME=yourusername
ACTIVITYPUB_NAME=Your Name
ACTIVITYPUB_SUMMARY=Your bio description
```

### 3. Database Setup

Initialize the database and create tables:

```bash
pnpm run activitypub:init
```

This will:
- Create the database file (for SQLite)
- Create all necessary tables
- Generate RSA key pairs for ActivityPub signing
- Initialize your actor profile

### 4. Verify Setup

After deployment, test your ActivityPub endpoints:

1. **WebFinger**: `https://yourdomain.com/.well-known/webfinger?resource=acct:yourusername@yourdomain.com`
2. **Actor Profile**: `https://yourdomain.com/ap/users/yourusername`
3. **Outbox**: `https://yourdomain.com/ap/users/yourusername/outbox`

## Usage

### Following Your Blog

Users can follow your blog from any fediverse platform by searching for:
```
@yourusername@yourdomain.com
```

### Automatic Post Publishing

When you publish a new blog post, it will automatically be shared to the fediverse if `autoPublish` is enabled in your configuration.

### Manual Publishing

You can also manually publish posts to ActivityPub:

```typescript
import { publishToActivityPub } from './src/lib/activitypub/integration';

await publishToActivityPub({
  title: 'My Blog Post',
  content: 'This is the content...',
  slug: 'my-blog-post',
  excerpt: 'A short summary...'
});
```

## Database Management

### SQLite (Default)

The SQLite database will be created automatically at `./data/activitypub.db`.

### PostgreSQL

For production deployments, PostgreSQL is recommended:

1. Create a PostgreSQL database
2. Set `DB_TYPE=postgresql` in your `.env`
3. Configure the database connection settings
4. Run the migration: `pnpm run activitypub:init`

### Database Studio

View and manage your ActivityPub data:

```bash
pnpm run db:studio
```

## Security Considerations

1. **Private Keys**: Keep your `ACTIVITYPUB_PRIVATE_KEY` secure and never commit it to version control
2. **Signature Verification**: The implementation includes basic signature verification - enhance this for production use
3. **Rate Limiting**: Consider adding rate limiting to your ActivityPub endpoints
4. **Allowlist/Blocklist**: Use the federation settings to control which instances can interact with your blog

## Endpoints

- `/.well-known/webfinger` - WebFinger discovery
- `/ap/users/{username}` - Actor profile
- `/ap/users/{username}/inbox` - Personal inbox
- `/ap/users/{username}/outbox` - Personal outbox
- `/ap/users/{username}/followers` - Followers collection
- `/ap/inbox` - Shared inbox

## Troubleshooting

### Key Generation

If you see warnings about missing keys, they will be auto-generated. Save the displayed keys to your environment variables:

```env
ACTIVITYPUB_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
ACTIVITYPUB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### Database Issues

If you encounter database issues, try recreating the tables:

```bash
rm -f ./data/activitypub.db  # Only for SQLite
pnpm run activitypub:init
```

### Federation Issues

1. Verify your domain is accessible via HTTPS
2. Check that WebFinger returns valid JSON
3. Ensure your actor profile is properly formatted
4. Verify HTTP signatures are working correctly

## Configuration Reference

All ActivityPub settings are configured in `src/config.ts`:

```javascript
activitypub: {
  enabled: true,              // Enable/disable ActivityPub
  domain: 'yourdomain.com',   // Your domain
  username: 'yourusername',   // Your fediverse handle
  autoPublish: true,          // Auto-publish blog posts
}
```

Environment variables override config file settings.
