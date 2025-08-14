// Main export file for the Geohashing API Service
// This allows easy import of the service without navigating to src folder

export { GeohashingService } from './src/services/GeohashingService';
export * from './src/types';

// Also export the Express app if needed
export { default as app } from './src/index'; 