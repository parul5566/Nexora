import 'dotenv/config';
import { migrate } from './database.js';

migrate()
  .then(() => {
    console.log('migrations complete');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
