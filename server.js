const WebSocket = require('ws');
const db = require('./firebase');

const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });

const storeConnections = new Map(); // storeId -> Set<WebSocket>
const userConnections = new Map(); // userId -> Set<WebSocket>

function addConnection(map, id, ws) {
    if (!map.has(id)) {
        map.set(id, new Set());
    }
    map.get(id).add(ws);
}

function sendToConnections(map, id, message) {
    const conns = map.get(id);
    if (conns) {
        conns.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }
}

function removeConnection(map, ws) {
    for (const [id, conns] of map.entries()) {
        if (conns.has(ws)) {
            conns.delete(ws);
            if (conns.size === 0) {
                map.delete(id);
            }
            break;
        }
    }
}

wss.on('connection', function connection(ws) {
    console.log('🆕 New client connected');

    ws.on('message', async function incoming(message) {
        const msgStr = message.toString();
        console.log('📥 Received raw message:', msgStr);

        try {
            const data = JSON.parse(msgStr);

            // Register for store
            if (data.type === 'register' && data.storeId) {
                addConnection(storeConnections, data.storeId, ws);
                console.log(`✅ Store ${data.storeId} connected.`);
                ws.send(JSON.stringify({ type: 'registered', storeId: data.storeId }));
            }

            // Register for user
            else if (data.type === 'register_user' && data.userId) {
                addConnection(userConnections, data.userId, ws);
                console.log(`👤 User ${data.userId} connected.`);
                ws.send(JSON.stringify({ type: 'registered_user', userId: data.userId }));
            } else if (data.type === 'cancel_request' && data.orderId) {
                const shopId = data.storeId;

                if (shopId) {
                    const cancelMsg = {
                        type: 'cancel_request',
                        shopId: shopId,
                        orderId: data.orderId,
                        reason: data.reason || '',
                    };

                    sendToConnections(storeConnections, shopId, JSON.stringify(cancelMsg));
                    console.log(`📩 Sent cancel message to store ${shopId}:`, cancelMsg);
                } else {
                    console.log(`⚠️ Cannot find store for order ${data.orderId}`);
                }
            } else if ((data.type === 'cancelled' || data.type === 'complete' || data.type === 'delivery') && data.userId && data.orderId) {
                const userId = data.userId;

                const msg = {
                    type: data.type,
                    userId: userId,
                    orderId: data.orderId,
                    reason: data.reason || '',
                };

                sendToConnections(userConnections, userId, JSON.stringify(msg));
                console.log(`📩 Sent message to user ${userId}:`, msg);
            } else if (data.type === 'reload_orders' && data.storeId) {
                const shopId = data.storeId;

                const reloadMsg = {
                    type: 'reload_orders',
                    shopId: shopId || '',
                };

                sendToConnections(storeConnections, shopId, JSON.stringify(reloadMsg));
                console.log(`📩 Sent reload_orders message to store ${shopId}:`, reloadMsg);
            }

            // Unknown type
            else {
                console.log('⚠️ Unknown message type or missing fields:', data);
            }

        } catch (e) {
            console.error('❗ Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        removeConnection(storeConnections, ws);
        removeConnection(userConnections, ws);
        console.log('❌ Client disconnected');
    });
});

console.log(`🚀 WebSocket server running on ws://localhost:${PORT}`);

// Firestore query helper, giữ nguyên
async function getUserIdByOrderId(orderId) {
    try {
        const doc = await db.collection('orders').doc(orderId).get();
        if (doc.exists) {
            return doc.data().userId;
        }
    } catch (e) {
        console.error('❗ Error getting userId from Firestore:', e);
    }
    return null;
}