import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const log = (message) => {
  if (process.env.NODE_ENV === 'test') return;
  console.log(message);
};

const warn = (message) => {
  if (process.env.NODE_ENV === 'test') return;
  console.warn(message);
};

export const configureLocalDotenv = (moduleUrl) => {
  if (process.env.DOTENV_CONFIG_PATH) {
    log('ℹ️ Respecting existing DOTENV_CONFIG_PATH override.');
    return;
  }

  const currentDir = path.dirname(fileURLToPath(moduleUrl));
  const projectRoot = path.resolve(currentDir, '..');
  const localEnvPath = path.join(projectRoot, '.env.local');

  if (fs.existsSync(localEnvPath)) {
    process.env.DOTENV_CONFIG_PATH = localEnvPath;
    log(`ℹ️ Using local environment file: ${localEnvPath}`);
  } else {
    warn('⚠️ .env.local not found. Falling back to default environment resolution.');
  }
};
