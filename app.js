const { Engine, Render, Runner, Bodies, World, Events } = Matter;

const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0.7;

const render = Render.create({
    element: document.getElementById('canvas-container'),
    engine: engine,
    options: { width: 600, height: 800, wireframes: false, background: 'transparent' }
});

// --- NOTIFICATION SYSTEM ---
function showNoti(text, type = '') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const noti = document.createElement('div');
    noti.className = `noti ${type}`;
    noti.innerHTML = text;
    container.appendChild(noti);
    setTimeout(() => { noti.remove(); }, 5000);
}

// --- WALLS & FUNNEL ---
const wallOptions = { isStatic: true, render: { visible: false } };
World.add(world, [
    Bodies.rectangle(-5, 400, 10, 800, wallOptions),
    Bodies.rectangle(605, 400, 10, 800, wallOptions),
    Bodies.rectangle(160, 40, 220, 10, { isStatic: true, angle: Math.PI / 5, render: { visible: false } }),
    Bodies.rectangle(440, 40, 220, 10, { isStatic: true, angle: -Math.PI / 5, render: { visible: false } })
]);

// --- PEGS ---
for (let i = 1; i < 15; i++) {
    for (let j = 0; j <= i; j++) {
        const x = 300 + (j - i / 2) * 41.5; 
        const y = 80 + i * 44; 
        World.add(world, Bodies.circle(x, y, 3, { 
            isStatic: true, 
            render: { fillStyle: '#ffffff' } 
        }));
    }
}

// --- BUCKET SENSORS ---
const bucketValues = [100, 50, 25, 15, 10, 5, 1, -1, -2, -1, 1, 5, 10, 15, 25, 50, 100];
const totalWidth = 600;
const bWidth = totalWidth / bucketValues.length;

bucketValues.forEach((val, i) => {
    const x = (i * bWidth) + (bWidth / 2);
    const sensor = Bodies.rectangle(x, 750, bWidth, 60, {
        isStatic: true, isSensor: true, label: `bucket-${val}`, render: { visible: false }
    });
    World.add(world, sensor);
});

// --- DROP BALL ---
function dropBall(username) {
    const spawnX = 300 + (Math.random() * 4 - 2);
    const ball = Bodies.circle(spawnX, 10, 8, {
        restitution: 0.1, friction: 0.2, frictionAir: 0.04, label: 'ball',
        render: { fillStyle: '#53fc18', strokeStyle: '#fff', lineWidth: 2 }
    });
    ball.username = username;
    World.add(world, ball);
}

// --- DROP QUEUE ---
let dropQueue = [];
let isProcessingQueue = false;

async function processQueue() {
    if (isProcessingQueue || dropQueue.length === 0) return;
    isProcessingQueue = true;
    while (dropQueue.length > 0) {
        const username = dropQueue.shift();
        dropBall(username);
        await new Promise(resolve => setTimeout(resolve, 300)); 
    }
    isProcessingQueue = false;
}

// --- COLLISIONS (STRICT POINT LOGIC) ---
// --- COLLISIONS (NO MORE JUMPING) ---
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const isBucket = (b) => b.label && b.label.startsWith('bucket-');
        
        if (isBucket(bodyA) || isBucket(bodyB)) {
            const bucket = isBucket(bodyA) ? bodyA : bodyB;
            const ball = isBucket(bodyA) ? bodyB : bodyA;
            
            if (ball.label === 'ball' && ball.username) {
                const amount = parseInt(bucket.label.slice(7));
                
                // Show the notification immediately
                if (amount < 0) {
                    showNoti(`💀 @${ball.username} lost ${Math.abs(amount)} Balls!`, 'noti-admin');
                } else {
                    showNoti(`🎉 @${ball.username} landed on ${amount} Balls!`, amount >= 25 ? 'noti-bigwin' : '');
                }
                
                // Update Firebase: ONLY add the amount from the bucket
                database.ref(`users/${ball.username.toLowerCase()}`).transaction((data) => {
                    // If user doesn't exist yet, we don't give a bonus here. 
                    // The bot handles the 250 starting points.
                    if (!data) return null; 

                    data.points = Math.max(0, (data.points || 0) + amount);
                    if (amount > 0) data.wins = (data.wins || 0) + amount;
                    return data;
                });
                
                World.remove(world, ball);
            }
        }
    });
});

// --- FIREBASE LISTENERS ---
database.ref('drops').on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (data?.username) {
        dropQueue.push(data.username);
        processQueue();
        database.ref('drops/' + snapshot.key).remove();
    }
});

database.ref('admin_commands').on('child_added', (snapshot) => {
    const cmd = snapshot.val();
    if (cmd && cmd.username) {
        let message = "";
        let type = "noti-admin";
        if (cmd.giftedBy) {
            message = `🎁 GIFT: @${cmd.giftedBy} sent ${cmd.amount} Balls to @${cmd.username}`;
            type = "noti-bigwin";
        } else {
            const label = cmd.type === 'set' ? 'SET' : 'ADD';
            message = `🛠️ ADMIN: ${label} ${cmd.amount} Balls for @${cmd.username}`;
            database.ref(`users/${cmd.username.toLowerCase()}/points`).transaction((pts) => 
                cmd.type === 'set' ? cmd.amount : (pts || 0) + cmd.amount
            );
        }
        showNoti(message, type);
        database.ref('admin_commands/' + snapshot.key).remove();
    }
});

// --- LEADERBOARD ---
database.ref('users').orderByChild('points').limitToLast(10).on('value', (snapshot) => {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = '';
    let players = [];
    snapshot.forEach(c => players.push({ name: c.key, pts: c.val().points || 0 }));
    players.reverse().forEach((p, i) => {
        const li = document.createElement('li');
        const isFirst = i === 0;
        li.innerHTML = `
            <span style="color: #888; width: 22px; display: inline-block;">${i + 1}.</span> 
            <span class="${isFirst ? 'top-player' : ''}" style="color: ${isFirst ? '#ffd700' : '#53fc18'}; flex: 1;">
                ${isFirst ? '👑 ' : ''}${p.name}
            </span> 
            <span style="font-weight: bold; color: white;">${p.pts} Balls</span>`;
        list.appendChild(li);
    });
});

Render.run(render);
Runner.run(Runner.create(), engine);