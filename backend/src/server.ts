import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);

const app = createApp();
app.listen(PORT, () => {
  // Sin PII -- solo puerto de arranque.
  console.log(`texture-studio-mc backend escuchando en :${PORT}`);
});
