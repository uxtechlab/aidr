import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { ClinicConfig } from '../types/clinic.types';

// Load environment variables
dotenv.config();

export const PORT = process.env.PORT || 5000;
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const servicesJsonPath = path.resolve(__dirname, '../data/services.json');

/**
 * Loads clinic configuration from services.json file.
 * Reading dynamically allows runtime updates (admin operations) without rebuilding.
 */
export function loadClinicConfig(): ClinicConfig {
  try {
    const rawData = fs.readFileSync(servicesJsonPath, 'utf-8');
    return JSON.parse(rawData) as ClinicConfig;
  } catch (error) {
    console.error('Error reading clinic configuration:', error);
    // Return a basic fallback if file is missing
    return {
      clinic: {
        name: "Clinic AI Assistant",
        phone: "",
        email: "",
        address: "",
        hours: ""
      },
      departments: [],
      treatments: [],
      faqs: []
    };
  }
}

/**
 * Saves the clinic configuration back to services.json.
 * Useful for admin configurations.
 */
export function saveClinicConfig(config: ClinicConfig): boolean {
  try {
    fs.writeFileSync(servicesJsonPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving clinic configuration:', error);
    return false;
  }
}
