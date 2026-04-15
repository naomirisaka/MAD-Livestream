const express = require('express');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/token', async (req, res) => {
  const { room, identity, canPublish } = req.query;
  if (!room || !identity) {
    return res.status(400).json({ error: 'room and identity are required' });
  }

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity, ttl: '2h' }
  );
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: canPublish === 'true',
    canSubscribe: true,
  });

  const token = await at.toJwt();
  res.json({ token });
});

app.listen(PORT, () => console.log(`Token server on port ${PORT}`));
