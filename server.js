const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const HEARTBEAT_TTL_MS = Number(process.env.HEARTBEAT_TTL_MS || 15000);
const HEARTBEAT_PRUNE_INTERVAL_MS = Number(process.env.HEARTBEAT_PRUNE_INTERVAL_MS || 5000);

// in-memory: room -> Map<identity, lastSeenMs>
const liveRooms = new Map();

function ensureRoom(room) {
  if (!liveRooms.has(room)) liveRooms.set(room, new Map());
  return liveRooms.get(room);
}

function pruneStale(roomMap, now = Date.now()) {
  for (const [identity, lastSeen] of roomMap.entries()) {
    if (now - lastSeen > HEARTBEAT_TTL_MS) roomMap.delete(identity);
  }
}

function pruneAllRooms() {
  const now = Date.now();
  for (const [room, roomMap] of liveRooms.entries()) {
    pruneStale(roomMap, now);
    if (roomMap.size === 0) liveRooms.delete(room);
  }
}

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
  const roomMap = ensureRoom(room);
  roomMap.set(identity, Date.now());
  res.json({ ok: true });
});

app.post('/live/heartbeat', (req, res) => {
  const { room, identity } = req.query;
  if (!room || !identity) return res.status(400).json({ error: 'room and identity required' });
  const roomMap = ensureRoom(room);
  roomMap.set(identity, Date.now());
  res.json({ ok: true });
});

app.post('/live/end', (req, res) => {
  const { room, identity } = req.query;
  if (!room || !identity) return res.status(400).json({ error: 'room and identity required' });
  const roomMap = liveRooms.get(room);
  roomMap?.delete(identity);
  if (roomMap?.size === 0) liveRooms.delete(room);
  res.json({ ok: true });
});

app.get('/active', (req, res) => {
  const { room } = req.query;
  if (!room) return res.status(400).json({ error: 'room required' });
  const roomMap = liveRooms.get(room);
  if (!roomMap) return res.json({ broadcasters: [] });

  pruneStale(roomMap);
  if (roomMap.size === 0) {
    liveRooms.delete(room);
    return res.json({ broadcasters: [] });
  }

  const broadcasters = [...roomMap.keys()];
  res.json({ broadcasters });
});

setInterval(pruneAllRooms, HEARTBEAT_PRUNE_INTERVAL_MS).unref?.();

app.listen(PORT, () => console.log(`Token server on port ${PORT}`));
