# DineBuddies - Social Dining Platform

A modern social platform for connecting people through dining experiences. Share invitations to restaurants, cafes, and entertainment venues, and meet new friends who share your interests.

## Features

### For Users
- **Create & Join Invitations**: Post dining invitations or join existing ones
- **Social Networking**: Follow other users and build your network
- **Real-time Chat**: Private messaging and group chats
- **Location-based Discovery**: Find nearby dining opportunities
- **Community Features**: Join communities and interact with like-minded people

### For Business Partners
- **Business Profiles**: Showcase your restaurant or cafe
- **Community Management**: Build and manage your customer community
- **Invitation Hosting**: Create special dining events
- **Analytics**: Track engagement and community growth

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Firebase (Authentication, Firestore, Storage, Functions)
- **Styling**: CSS3 with modern design patterns
- **Maps**: Google Maps API
- **Payments**: Stripe Integration
- **Deployment**: Vercel

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase account
- Google Maps API key
- Stripe account (for payments)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd temporal-coronal
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

Fill in your credentials:
- Firebase configuration
- Google Maps API key
- Stripe keys

4. Run development server
```bash
npm run dev
```

5. Build for production
```bash
npm run build
```

## Firebase Setup

1. Create a Firebase project
2. Enable Authentication (Email/Password, Google)
3. Create Firestore database
4. Set up Storage
5. Deploy Firestore rules and indexes:
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

## Deployment

### Vercel (Recommended)
```bash
npm run build
vercel --prod
```

### Firebase Hosting
```bash
firebase deploy --only hosting
```

## Project Structure

```
src/
├── components/       # Reusable UI components
├── context/         # React Context providers
├── pages/           # Page components
├── utils/           # Utility functions
├── firebase/        # Firebase configuration
└── App.jsx          # Main app component
```

## Environment Variables

Required environment variables:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GOOGLE_MAPS_API_KEY=
VITE_STRIPE_PUBLIC_KEY=
```

## Contributing

This is a private project. For any questions or issues, please contact the development team.

## License

Proprietary - All rights reserved

## Support

For support, email: support@dinebuddies.com
