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

// --- PEGS (Row 1 Removed for Mouth) ---
for (let i = 1; i < 15; i++) {
    for (let j = 0; j <= i; j++) {
        const x = 300 + (j - i / 2) * 36;
        const y = 80 + i * 40;
        World.add(world, Bodies.circle(x, y, 3, { 
            isStatic: true, 
            render: { fillStyle: '#ffffff' } 
        }));
    }
}

// --- BUCKET SENSORS ---
const bucketValues = [100, 50, 35, 20, 10, 5, 1, -1, -2, -1, 1, 5, 10, 20, 35, 50, 100];
const bWidth = 590 / bucketValues.length;
bucketValues.forEach((val, i) => {
    const x = 5 + (i * bWidth) + (bWidth / 2);
    const sensor = Bodies.rectangle(x, 740, bWidth - 4, 40, {
        isStatic: true, isSensor: true, label: `bucket-${val}`, render: { visible: false }
    });
    World.add(world, sensor);
});

// --- DROP BALL (Heavy Physics) ---
function dropBall(username) {
    const ball = Bodies.circle(300 + (Math.random() * 4 - 2), 20, 8, {
        restitution: 0.2, friction: 0.1, frictionAir: 0.02, label: 'ball',
        render: { fillStyle: '#53fc18', strokeStyle: '#fff', lineWidth: 2 }
    });
    ball.username = username;
    World.add(world, ball);
}

// --- COLLISIONS ---
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const isBucket = (b) => b.label && b.label.startsWith('bucket-');
        if (isBucket(bodyA) || isBucket(bodyB)) {
            const bucket = isBucket(bodyA) ? bodyA : bodyB;
            const ball = isBucket(bodyA) ? bodyB : bodyA;
            if (ball.label === 'ball' && ball.username) {
                const amount = parseInt(bucket.label.split('-')[1]);
                showNoti(`🎉 @${ball.username} landed on ${amount} Balls!`, amount >= 35 ? 'noti-bigwin' : '');
                
                database.ref(`users/${ball.username.toLowerCase()}`).transaction((data) => {
                    if (!data) return { points: 100 + amount, wins: amount };
                    data.points = (data.points || 0) + amount;
                    data.wins = (data.wins || 0) + amount;
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
    if (data?.username) { dropBall(data.username); database.ref('drops/' + snapshot.key).remove(); }
});

database.ref('admin_commands').on('child_added', (snapshot) => {
    const cmd = snapshot.val();
    if (cmd && cmd.username) {
        showNoti(`🛠️ ADMIN: ${cmd.type === 'set' ? 'SET' : 'ADD'} ${cmd.amount} Balls for @${cmd.username}`, 'noti-admin');
        database.ref(`users/${cmd.username.toLowerCase()}/points`).transaction((pts) => 
            cmd.type === 'set' ? cmd.amount : (pts || 0) + cmd.amount
        );
        database.ref('admin_commands/' + snapshot.key).remove();
    }
});
database.ref('admin_commands').on('child_added', (snapshot) => {
    const cmd = snapshot.val();
    if (cmd && cmd.username) {
        let message = "";
        let type = "noti-admin";

        if (cmd.giftedBy) {
            // It's a gift from another user
            message = `🎁 GIFT: @${cmd.giftedBy} sent ${cmd.amount} Balls to @${cmd.username}`;
            type = "noti-bigwin"; // Give it the pink/fancy border
        } else {
            // It's a standard admin command
            const label = cmd.type === 'set' ? 'SET' : 'ADD';
            message = `🛠️ ADMIN: ${label} ${cmd.amount} Balls for @${cmd.username}`;
        }

        showNoti(message, type);
        
        // Note: The bot handled the math in Firebase, 
        // but we still clean up the command queue here.
        database.ref('admin_commands/' + snapshot.key).remove();
    }
});
// --- LEADERBOARD TOP 10 ---
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
            <span style="color: #888; width: 20px;">${i + 1}.</span> 
            <span class="${isFirst ? 'top-player' : ''}" style="color: ${isFirst ? '#ffd700' : '#53fc18'}; flex: 1;">
                ${isFirst ? '👑 ' : ''}${p.name}
            </span> 
            <span style="font-weight: bold;">${p.pts} Balls</span>`;
        list.appendChild(li);
    });
});

Render.run(render);
Runner.run(Runner.create(), engine);