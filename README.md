# wagents - B2B SaaS Platform for AI Agents

wagents is a comprehensive B2B SaaS platform that enables businesses to create AI agents that integrate with various platforms like Shopify, Facebook Marketplace, and WhatsApp to automate sales, negotiation, and customer support processes.

## Overview

wagents allows businesses to deploy AI agents that can:
- **Sell products automatically** on multiple platforms (Shopify, WhatsApp, Facebook, etc.)
- **Negotiate with customers** using advanced AI reasoning
- **Provide 24/7 customer support** without human intervention
- **Connect to various platforms** through a unified integration hub
- **Operate fully autonomously** with self-reflection and agentic RAG

## Features

### Core Platform
- **AI Agent Creation** - Build custom AI agents with specific capabilities and system prompts
- **Integration Hub** - Connect to Shopify, Facebook Marketplace, WhatsApp, TikTok Shop, Amazon, and Instagram
- **Agent Configuration** - Customize agent behavior, communication style, and model selection
- **Analytics Dashboard** - Track agent performance, conversations, and customer interactions
- **Conversation Management** - Real-time monitoring of all customer interactions
- **Multi-tenant Architecture** - Organization and workspace management with RBAC

### AI Capabilities
- **Agentic RAG System** - Advanced retrieval-augmented generation with self-reflection
- **Knowledge Base Integration** - Connect custom knowledge bases for domain-specific responses
- **Multi-model Support** - GPT-4, Claude 3.5, and DeepSeek models
- **Tool Calling** - Agents can search products, create orders, and escalate to humans
- **Streaming Responses** - Real-time streaming for optimal user experience

### Platform Integrations

#### Shopify
- Product synchronization with variants
- Order management and fulfillment
- Inventory tracking
- Real-time webhook support

#### WhatsApp Business
- Message sending (text, media, templates, interactive)
- Product catalog integration
- Business profile management
- Message status tracking and read receipts

#### Facebook Marketplace
- Product catalog management
- Messenger integration
- Order synchronization
- Automated customer responses

## Technology Stack

### Frontend
- **Framework**: Next.js 16 with React 19 and App Router
- **Language**: TypeScript 5.8+
- **Styling**: TailwindCSS 4 with Radix UI components
- **State Management**: Zustand + TanStack React Query
- **Forms**: React Hook Form with Zod validation

### Backend
- **Runtime**: Bun 1.3+
- **Database**: PostgreSQL 15+ with Drizzle ORM
- **Authentication**: better-auth with OAuth (Google, GitHub), Magic Links, and Passkeys
- **Payment Processing**: Polar.sh for subscription management
- **File Storage**: AWS S3 + Cloudflare R2

### AI & ML
- **Models**: OpenAI GPT-4, Anthropic Claude 3.5, DeepSeek
- **Embeddings**: OpenAI 1536-dimensional vectors with pgvector
- **RAG**: Custom agentic RAG with query processing, retrieval, and self-reflection
- **Document Processing**: PDF (pdf2json) and DOCX (mammoth) support

## Project Structure

```
wa-agent/
├── apps/
│   └── web/                      # Next.js frontend application
│       ├── src/
│       │   ├── app/
│       │   │   ├── workspace/    # Workspace pages (agents, integrations, etc.)
│       │   │   ├── api/          # API routes
│       │   │   └── auth/         # Authentication
│       │   ├── components/       # React components
│       │   │   ├── ui/           # Shadcn/Radix UI components
│       │   │   └── workspace/    # Workspace-specific components
│       │   └── lib/
│       │       ├── ai/           # AI agent engine and RAG system
│       │       ├── integrations/ # Platform integrations
│       │       └── conversations/ # Conversation management
├── packages/
│   ├── auth/                     # Authentication package (better-auth)
│   └── db/                       # Database schemas and migrations
│       └── src/schema/           # Drizzle ORM schemas
└── package.json
```

## Getting Started

### Prerequisites

- **Bun** 1.3+ (recommended) or Node.js 18+
- **PostgreSQL** 15+
- **Docker** (optional, for local database)

### Installation

1. **Clone the repository**:
```bash
git clone <repository-url>
cd wa-agent
```

2. **Install dependencies**:
```bash
bun install
```

3. **Set up environment variables**:
```bash
cp .env.example .env
```

Configure the following in `.env`:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/wagents

# Authentication
BETTER_AUTH_SECRET=your-random-secret-key
BETTER_AUTH_URL=http://localhost:3000

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Payment Processing
POLAR_ACCESS_TOKEN=your-polar-access-token

# AI Models
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key

# Platform Integrations
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
WHATSAPP_ACCESS_TOKEN=your-whatsapp-token
WHATSAPP_VERIFY_TOKEN=your-verify-token
FACEBOOK_ACCESS_TOKEN=your-facebook-token
FACEBOOK_VERIFY_TOKEN=your-verify-token
```

4. **Set up the database**:
```bash
# Start PostgreSQL (if using Docker)
docker-compose up -d

# Run migrations
bun run db:push
```

5. **Start the development server**:
```bash
bun run dev
```

The application will be available at `http://localhost:3000`

## Available Scripts

- `bun dev` - Start development server
- `bun build` - Build for production
- `bun start` - Start production server
- `bun run db:push` - Apply database migrations
- `bun run db:generate` - Generate new migration
- `bun run lint` - Run linters (Oxlint + Biome)
- `bun check-types` - Type check all packages

## API Documentation

### Agents API
- `GET /api/agents` - List all agents for the organization
- `POST /api/agents` - Create a new AI agent
- `GET /api/agents/[id]` - Get agent details with knowledge bases
- `PATCH /api/agents/[id]` - Update agent configuration
- `DELETE /api/agents/[id]` - Delete an agent
- `POST /api/agents/[id]/toggle` - Toggle agent active/inactive status
- `GET /api/agents/[id]/metrics` - Get agent performance metrics

### Integrations API
- `GET /api/integrations` - List all platform integrations
- `POST /api/integrations` - Create a new integration
- `GET /api/integrations/[id]` - Get integration details
- `PATCH /api/integrations/[id]` - Update integration credentials
- `DELETE /api/integrations/[id]` - Remove an integration
- `POST /api/integrations/[id]/toggle` - Enable/disable integration
- `POST /api/integrations/[id]/test` - Test connection

### Conversations API
- `GET /api/conversations` - List conversations with filters
- `POST /api/conversations` - Create a new conversation
- `GET /api/conversations/[id]` - Get conversation with message history
- `PATCH /api/conversations/[id]` - Update conversation status
- `POST /api/conversations/[id]/messages` - Add a message to conversation
- `GET /api/conversations/stats` - Get conversation statistics

### Webhook Endpoints
- `POST /api/webhooks/whatsapp` - WhatsApp webhook handler
- `POST /api/webhooks/shopify` - Shopify webhook handler
- `POST /api/webhooks/facebook` - Facebook Messenger webhook handler

## Database Schema

The platform uses Drizzle ORM with PostgreSQL. Key tables include:

- **agent** - AI agent configurations and settings
- **integration** - Platform connections and credentials
- **conversation** - Customer conversations tracked by agent
- **message** - Individual messages within conversations
- **product** - Product catalog synced from platforms
- **orders** - Order tracking from all platforms
- **knowledgeBase** - Knowledge bases for agent context
- **user** & **organization** - Multi-tenant user management

## Creating Your First Agent

1. Navigate to **Workspace > Agents**
2. Click **Create Agent**
3. Configure:
   - **Name**: Sales Agent
   - **System Prompt**: "You are a helpful sales assistant..."
   - **Model**: GPT-4o (recommended)
   - **Communication Style**: Professional
   - **Temperature**: 0.7
4. (Optional) Connect knowledge bases
5. Click **Create Agent**
6. Toggle the agent to **Active**

## Setting Up Integrations

### Shopify
1. Create a custom app in Shopify Admin
2. Generate Admin API access token
3. In wagents: **Integrations > Connect Shopify**
4. Enter Shop Domain and Access Token
5. Test the connection

### WhatsApp Business
1. Set up WhatsApp Business API in Meta Business Suite
2. Get Phone Number ID and Access Token
3. Configure webhook URL: `https://yourdomain.com/api/webhooks/whatsapp`
4. In wagents: **Integrations > Connect WhatsApp**
5. Enter credentials and test

### Facebook Marketplace
1. Create Facebook Page and Product Catalog
2. Generate Page Access Token
3. In wagents: **Integrations > Connect Facebook**
4. Enter Catalog ID and Access Token

## Subscription Plans

- **Free**: 500 credits/month
- **Starter**: 2,000 credits/month - $29/mo
- **Pro**: 5,000 credits/month - $99/mo
- **Business**: 30,000 credits/month - $299/mo

Credits are consumed based on:
- AI model usage (tokens)
- Message length
- Tool calls and operations

## Deployment

### Vercel (Recommended)
1. Connect GitHub repository to Vercel
2. Configure environment variables
3. Set build command: `bun run build`
4. Deploy

### Docker
```bash
docker build -t wagents .
docker run -p 3000:3000 wagents
```

## Security

- Session-based authentication with better-auth
- Organization-level data isolation
- Webhook signature verification
- Encrypted credential storage
- Rate limiting on API endpoints
- CORS protection

## Roadmap

- [x] Shopify integration
- [x] WhatsApp Business integration
- [x] Facebook Marketplace integration
- [x] Agentic RAG system
- [ ] TikTok Shop integration
- [ ] Amazon Seller Central integration
- [ ] Instagram Shopping integration
- [ ] Advanced analytics and reporting
- [ ] Multi-language agent support
- [ ] Voice call integration
- [ ] Custom model fine-tuning
- [ ] Public API for developers

## License

Proprietary - All rights reserved
