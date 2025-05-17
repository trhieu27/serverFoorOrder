const result = require('dotenv').config({ path: './firebase.env' });
if (result.error) {
    console.error('Failed to load firebase.env:', result.error);
    process.exit(1);
}
console.log('Env vars loaded:', result.parsed);
console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? 'Loaded' : 'Not loaded');

const admin = require('firebase-admin');

try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
    console.log('Firebase Admin initialized successfully.');
} catch (error) {
    console.error('Firebase Admin initialization failed:', error);
}

const db = admin.firestore();

module.exports = db;