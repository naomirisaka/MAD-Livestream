const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

// in-memory: room -> Set<identity>
const liveRooms = new Map();

app.get('/token', async (req, res) => {
  const { room, identity, canPublish } = req.query;
  if (!room || !identity) return res.status(400).json({ error: 'room and identity required' });
  const at = new AccessToken(API_KEY, API_SECRET, { identity });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: canPublish === 'true',
    canSubscribe: true,
  });
  const token = await at.toJwt();
  res.json({ token });
});

app.post('/live/start', (req, res) => {
  const { room, identity } = req.query;
  if (!room || !identity) return res.status(400).json({ error: 'room and identity required' });
  if (!liveRooms.has(room)) liveRooms.set(room, new Set());
  liveRooms.get(room).add(identity);
  res.json({ ok: true });
});

app.post('/live/end', (req, res) => {
  const { room, identity } = req.query;
  if (!room || !identity) return res.status(400).json({ error: 'room and identity required' });
  liveRooms.get(room)?.delete(identity);
  res.json({ ok: true });
});

app.get('/active', (req, res) => {
  const { room } = req.query;
  if (!room) return res.status(400).json({ error: 'room required' });
  const broadcasters = [...(liveRooms.get(room) ?? new Set())];
  res.json({ broadcasters });
});

app.listen(PORT, () => console.log(`Token server on port ${PORT}`));
