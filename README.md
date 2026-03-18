# Stationery & Games Inventory Management System

A comprehensive inventory management system built specifically for stationery and games businesses. This web application provides real-time inventory tracking, sales management, and business analytics.

## 🚀 Project Overview

**Type**: Full-stack web application  
**Framework**: Next.js 14 (React 18)  
**Database**: Supabase (PostgreSQL)  
**Styling**: Tailwind CSS  
**Language**: TypeScript  
**Deployment**: Vercel  

## 📁 Project Structure

```
stationery_business/
├── app/                          # Next.js 14 App Router
│   ├── components/
│   │   └── InventoryApp.tsx      # Main inventory application component
│   ├── globals.css               # Global styles and Tailwind utilities
│   ├── layout.tsx               # Root layout with toast notifications
│   └── page.tsx                 # Home page with error boundary
├── lib/
│   └── database.types.ts        # TypeScript definitions for Supabase tables
├── auth_context.ts              # Authentication context (not currently used)
├── supabase_client.ts          # Supabase client configuration and API functions
├── supabase_sql_setup.sql      # Full database schema with authentication
├── inventory_setup.sql         # Simplified schema without authentication
├── cleanup_script.sql          # Database cleanup utilities
├── package.json                # Dependencies and scripts
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
├── vercel.json                # Vercel deployment configuration
└── next.config.js             # Next.js configuration
```

## 🗄️ Database Schema

The application uses Supabase (PostgreSQL) with the following main tables:

### Core Tables
- **products**: Product inventory with pricing, stock levels, categories
- **categories**: Product categorization system
- **sales**: Sales transactions with profit tracking
- **customers**: Customer information and purchase history
- **profiles**: User profiles (for multi-user setups)

### Key Features
- UUID primary keys for all tables
- Automatic timestamp tracking (created_at, updated_at)
- Stock level constraints and validation
- Profit calculation on sales
- Category-based product organization

## 🛠️ Technology Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **React 18**: UI library with hooks and modern patterns
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Hot Toast**: Toast notification system

### Backend & Database
- **Supabase**: Backend-as-a-Service with PostgreSQL
- **Real-time subscriptions**: Live data updates
- **Row Level Security**: Data access control
- **Authentication**: Built-in auth system (configurable)

### Development Tools
- **ESLint**: Code linting
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

## 🔧 Key Components & Features

### InventoryApp.tsx (Main Component)
- **Dashboard**: Business analytics and KPI overview
- **Product Management**: CRUD operations for inventory
- **Sales Tracking**: Transaction recording and history
- **Category Management**: Product categorization
- **Real-time Updates**: Live inventory changes

### Supabase Integration
- **API Functions**: Pre-built functions for common operations
- **Type Safety**: Full TypeScript integration
- **Real-time Subscriptions**: Live data synchronization
- **Analytics**: Built-in business metrics calculation

### Error Handling
- **Error Boundaries**: Graceful error handling in React
- **Loading States**: User-friendly loading indicators
- **Fallback UI**: Alternative UI when errors occur

## 📊 Business Features

### Inventory Management
- Product CRUD operations
- Stock level monitoring
- Low stock alerts
- Category-based organization
- Barcode support
- Purchase/selling price tracking

### Sales Management
- Sales transaction recording
- Profit calculation
- Customer information tracking
- Daily sales reporting
- Sales history

### Analytics Dashboard
- Total products count
- Total sales revenue
- Profit tracking
- Daily sales metrics
- Low stock alerts
- Recent sales activity

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Quick Start
```bash
# Clone the repository
git clone https://github.com/mehak6/stationery-business.git
cd stationery-business

# Install dependencies
npm install

# Environment is already configured!
# Run development server
npm run dev
```

**✅ Ready to use!** - Database is connected and environment is configured.

### Database Setup
✅ **Your Supabase project is ready!**
- **Project URL**: `https://ccpvnpidhxkcbxeeyqeq.supabase.co`
- **Project ID**: `ccpvnpidhxkcbxeeyqeq` 
- **Database**: Already connected and tested ✅

See `SUPABASE_SETUP.md` for detailed setup instructions.

### Available Scripts
- `npm run dev`: Development server (currently running on localhost:3001)
- `npm run build`: Production build
- `npm run start`: Production server
- `npm run lint`: Code linting
- `npm run type-check`: TypeScript checking
- `npm run deploy`: Deploy to Vercel

### Current Status
🟢 **Server Status**: Running on http://localhost:3001  
🟢 **Database**: Connected and functional  
🟢 **Recent Sales**: Dashboard displaying correctly  
🟢 **All Features**: Fully operational with real data

## 🎨 UI/UX Features

### Design System
- Custom Tailwind color palette
- Consistent component styling
- Responsive design
- Mobile-friendly interface

### User Experience
- Loading states for better perceived performance
- Toast notifications for user feedback
- Error boundaries for graceful error handling
- Intuitive navigation and workflows

## 🔒 Security Features

### Database Security
- Row Level Security (RLS) policies
- User-based access control
- Secure API endpoints
- Input validation and sanitization

### Application Security
- TypeScript for type safety
- Environment variable protection
- Secure authentication flows
- HTTPS enforcement (production)

## 📱 Responsive Design

- Mobile-first approach
- Tablet and desktop optimized
- Touch-friendly interactions
- Adaptive layouts

## 🔄 Real-time Features

- Live inventory updates
- Real-time sales notifications
- Automatic data synchronization
- Conflict resolution

## 🚀 Deployment

### Vercel Configuration
- Optimized for Next.js deployment
- European region deployment (fra1)
- Function timeout configuration
- Environment variable management

### Performance Optimizations
- Static generation where possible
- Image optimization
- Code splitting
- Bundle optimization

## 📈 Future Enhancements

Potential areas for expansion:
- Multi-store support
- Advanced reporting and analytics
- Inventory forecasting
- Supplier management
- Barcode scanning integration
- Mobile app development
- API for third-party integrations

## 🤝 Architecture Patterns

### State Management
- React hooks for local state
- Supabase for server state
- Context API for global state (auth)

### Data Flow
- Server-side data fetching
- Optimistic updates
- Error handling and retry logic
- Caching strategies

### Code Organization
- Component-based architecture
- Custom hooks for business logic
- Utility functions for common operations
- Type-safe API interactions

## 📝 Development Notes

### Recent Updates (2025-08-30)
✅ **Dashboard Issues Fixed**:
- Fixed recent sales display issue by removing invalid `profiles` table join from getSales function
- "Make Sale" button properly navigates to quick-sale page
- All mock data removed - application now uses 100% real database integration
- Server running on http://localhost:3001 (auto-switched from 3000)

### Error Handling Strategy
- Multiple layers of error handling
- User-friendly error messages
- Development vs production error display
- Automatic error recovery where possible

### Type Safety
- Full TypeScript implementation
- Database schema types generated from Supabase
- Strict typing for API responses
- Type-safe component props

## 🤖 AI Assistant Notes

*This section contains technical insights and observations for future AI assistance sessions.*

### Senior Developer Architectural Learnings (March 2026 Update)
- **True Architecture Discovered**: The application is not just a standard web app; it is a **Tauri-wrapped Desktop Application** with an **Offline-First Architecture**.
- **Local Data First**: Core business logic and database operations (like stock deduction and sales creation) happen locally against **PouchDB** (IndexedDB wrapper) via `lib/offline-db.ts`. This ensures the app works seamlessly without an internet connection.
- **Synchronization Engine**: A custom sync layer in `lib/supabase-sync.ts` manages bidirectional data flow between the local PouchDB instance and the remote Supabase PostgreSQL database using timestamp-based tracking (`updated_at`).
- **Domain Logic**: The system cleanly separates "Products" (customer-facing inventory) from "Party Purchases" (supplier-facing bulk tracking), representing a mature understanding of retail inventory domains.
- **Desktop Integration**: The presence of `src-tauri` indicates the application is compiled as a native desktop executable, allowing for potential native OS capabilities beyond standard web constraints.

### Code Quality & Architecture
- **Well-structured component architecture** with clear separation of concerns
- **Comprehensive error handling** with React Error Boundaries and fallback UIs
- **Type-safe implementation** throughout with TypeScript and Supabase types
- **Mock data strategy** ensures development continuity without database dependency

### Styling System Analysis
The project uses a sophisticated Tailwind CSS setup with custom component classes:

#### Component Library (globals.css)
- **Button variants**: `.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-danger`, `.btn-outline`
- **Form components**: `.input-field`, `.form-group`, `.form-label`, `.form-error`
- **Card layouts**: `.card`, `.card-header` with consistent styling
- **Status badges**: Color-coded badges for different states
- **Dashboard components**: `.stat-card`, `.stat-value`, `.stat-label`

#### Mobile-First Design Patterns
- Touch targets optimized for mobile (44px minimum)
- Safe area insets for iOS devices
- Custom scrollbar styling
- Responsive grid utilities (`.mobile-grid`, `.mobile-container`)

#### Advanced Features
- **Glass morphism effects** (`.glass-effect`)
- **Loading animations** (`.loading-spinner`, `.loading-pulse`)
- **Print-friendly styles** with `.no-print` utility
- **Accessibility focus improvements** with `.focus-visible`
- **Dark mode foundation** (prepared but not fully implemented)

### Database Design Insights
- **Dual setup approach**: Full auth system vs simplified single-user
- **UUID-based architecture** for scalability
- **Profit calculation** built into sales transactions
- **Stock level constraints** with validation
- **Real-time capabilities** with Supabase subscriptions

### Development Patterns
- **Custom hooks usage** for business logic abstraction
- **Optimistic updates** for better UX
- **Error recovery mechanisms** built into data fetching
- **Environment-based error display** (detailed in dev, user-friendly in prod)

### Future Enhancement Opportunities
1. **Theme system expansion** - Dark mode implementation ready
2. **PWA capabilities** - Service worker and manifest setup
3. **Advanced analytics** - Chart.js/Recharts integration potential
4. **Barcode scanning** - Camera API integration ready
5. **Multi-tenancy** - Database structure supports it

### Key Files to Monitor
- `supabase_client.ts`: API layer and business logic (✅ Recently fixed getSales function)
- `InventoryApp.tsx`: Main application state and routing (✅ Dashboard sales display fixed)
- `globals.css`: Design system and component styles
- `database.types.ts`: Type definitions (auto-generated from Supabase)

### Recent Bug Fixes
- **supabase_client.ts:102-111** - Removed invalid `profiles` table join from getSales function
- **Dashboard sales display** - Recent sales now showing correctly with real data
- **Mock data removal** - Complete migration to real Supabase database integration

### Performance Considerations
- **Bundle optimization**: Next.js automatic code splitting
- **Image optimization**: Next.js Image component ready for implementation
- **Caching strategy**: Supabase real-time subscriptions handle data freshness
- **Loading states**: Comprehensive loading UI prevents perceived slowness

### Security Implementation
- **Row Level Security** policies in place
- **Input validation** at database and application level
- **Environment variable protection** for API keys
- **TypeScript** prevents runtime type errors

---

This README serves as a comprehensive reference for understanding the project structure, technologies used, and key features implemented in this inventory management system.