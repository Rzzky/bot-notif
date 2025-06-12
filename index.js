import express from 'express';
import { refreshSession } from './refresher.mjs';

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('✅ SERVER ON - Made With Love by RzkyO');
});

app.listen(port, () => {
  console.log(`🌐 Express server running on http://localhost:${port}`);
});

refreshSession(); 
setInterval(refreshSession, 1000 * 60 * 5); 
