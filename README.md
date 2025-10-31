# wagents - AI Agent Platform

wagents is a B2B SaaS platform that enables businesses to create AI agents that integrate with various platforms like Shopify, Facebook Marketplace, and WhatsApp to automate sales, negotiation, and customer support processes.

## Overview

wagents allows businesses to deploy AI agents that can:
- Sell products automatically on multiple platforms
- Negotiate with customers
- Provide 24/7 customer support
- Connect to various integration platforms
- Operate fully autonomously without human intervention

## Features

### Core Platform
- **AI Agent Creation** - Build custom AI agents with specific capabilities
- **Integration Hub** - Connect to Shopify, Facebook Marketplace, WhatsApp, and more
- **Agent Configuration** - Customize agent behavior for sales, support, or negotiation
- **Analytics Dashboard** - Track agent performance and customer interactions

### Technical Stack
- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Husky** - Git hooks for code quality
- **Turborepo** - Optimized monorepo build system
- **Drizzle ORM** - Database management

## Roadmap

- **AI-Powered Product Search** - Enhanced product discovery capabilities
- **Additional Platform Integrations** - Expanding to more e-commerce and messaging platforms
- **Advanced Negotiation Capabilities** - More sophisticated pricing and offer strategies
- **Multi-language Support** - Global market expansion

## Getting Started

First, install the dependencies:

```bash
bun install
```

Then, run the development server:

```bash
bun dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.

## Project Structure

```
wagents/
├── apps/
│   ├── web/         # Frontend application (Next.js)
├── packages/
│   ├── auth/        # Authentication services
│   ├── db/          # Database models and connections
```

## Available Scripts

- `bun dev`: Start all applications in development mode
- `bun build`: Build all applications
- `bun dev:web`: Start only the web application
- `bun check-types`: Check TypeScript types across all apps

## Deployment

The platform is designed to be deployed on modern cloud infrastructure with scalability in mind to handle varying loads of AI agent activities.

## License

Proprietary - All rights reserved
