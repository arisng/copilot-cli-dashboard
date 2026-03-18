import express from 'express';
import cors from 'cors';
import router from './router.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());
app.use('/api', router);

app.listen(PORT, () => {
  console.log(`Copilot Sessions API running at http://localhost:${PORT}`);
});
