import { app, initializeDatabase } from '../server/index.js';

export const config = {
  api: {
    bodyParser: false
  }
};

let databaseInitialization;

export default async function handler(request, response) {
  try {
    if (!databaseInitialization) {
      databaseInitialization = initializeDatabase().catch((error) => {
        databaseInitialization = undefined;
        throw error;
      });
    }

    await databaseInitialization;
    await new Promise((resolve, reject) => {
      response.once('finish', resolve);
      response.once('close', resolve);

      try {
        app(request, response);
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    console.error('Vercel API initialization failed:', error);
    response.status(500).json({ message: 'The server could not connect to its database.' });
  }
}