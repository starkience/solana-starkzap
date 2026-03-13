import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import starknetRouter from './routes/starknet/starknetWalletRoutes';

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/starknet', starknetRouter);

const PORT = parseInt(process.env.PORT || '8080', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Starknet Server] Listening on port ${PORT}`);
  console.log(`[Starknet Server] PRIVY_APP_ID set: ${!!process.env.PRIVY_APP_ID}`);
  console.log(`[Starknet Server] PRIVY_APP_SECRET set: ${!!process.env.PRIVY_APP_SECRET}`);
});
