const express = require('express');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

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

app.get('/active', async (req, res) => {
  const { room } = req.query;
  if (!room) return res.status(400).json({ error: 'room required' });
  try {
    const participants = await roomService.listParticipants(room);
    const broadcasters = participants
      .filter(p => p.tracks && p.tracks.some(t => !t.muted))
      .map(p => p.identity);
    res.json({ broadcasters });
  } catch {
    res.json({ broadcasters: [] });
  }
});

app.listen(PORT, () => console.log(`Token server on port ${PORT}`));
