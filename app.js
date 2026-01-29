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

// --- WALLS & FUNNEL (Keeps balls on board) ---
const wallOptions = { isStatic: true, render: { visible: false } };
World.add(world, [
    // Left boundary wall
    Bodies.rectangle(-5, 400, 10, 800, wallOptions),
    // Right boundary wall
    Bodies.rectangle(605, 400, 10, 800, wallOptions),
    // Funnel Left (Diagonals at the top)
    Bodies.rectangle(160, 40, 220, 10, { isStatic: true, angle: Math.PI / 5, render: { visible: false } }),
    // Funnel Right
    Bodies.rectangle(440, 40, 220, 10, { isStatic: true, angle: -Math.PI / 5, render: { visible: false } })
]);


// --- PEGS ---
// --- PEGS (Wider to match buckets) ---
for (let i = 1; i < 15; i++) {
    for (let j = 0; j <= i; j++) {
        // 41.5 spacing ensures the bottom row spreads out to the edges
        const x = 300 + (j - i / 2) * 41.5; 
        const y = 80 + i * 44; // Slightly increased vertical spacing for a smoother roll
        
        World.add(world, Bodies.circle(x, y, 3, { 
            isStatic: true, 
            render: { fillStyle: '#ffffff' } 
        }));
    }
}

// --- BUCKET SENSORS (Width Synced to 600px) ---
const bucketValues = [100, 50, 25, 15, 10, 5, 1, -1, -2, -1, 1, 5, 10, 15, 25, 50, 100];
const totalWidth = 600;
const bWidth = totalWidth / bucketValues.length;

bucketValues.forEach((val, i) => {
    const x = (i * bWidth) + (bWidth / 2);
    const sensor = Bodies.rectangle(x, 750, bWidth, 60, {
        isStatic: true,
        isSensor: true,
        label: `bucket-${val}`,
        render: { visible: false }
    });
    World.add(world, sensor);
});

// --- DROP BALL (Tight Center Start) ---
function dropBall(username) {
    // Very tight spawn makes edge hits rare
    const spawnX = 300 + (Math.random() * 6 - 3); 
    
    const ball = Bodies.circle(spawnX, 10, 8, {
        restitution: 0.15, // A tiny bit more bounce makes the movement look natural
        friction: 0.05,
        frictionAir: 0.025,
        label: 'ball',
        render: { fillStyle: '#53fc18', strokeStyle: '#fff', lineWidth: 2 }
    });
    ball.username = username;
    World.add(world, ball);
}

// --- COLLISIONS ---
// --- COLLISIONS (FIXED FOR NEGATIVES) ---
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const isBucket = (b) => b.label && b.label.startsWith('bucket-');
        
        if (isBucket(bodyA) || isBucket(bodyB)) {
            const bucket = isBucket(bodyA) ? bodyA : bodyB;
            const ball = isBucket(bodyA) ? bodyB : bodyA;
            
            if (ball.label === 'ball' && ball.username) {
                // Fix: slice(7) removes 'bucket-' and keeps the rest, including the minus sign
                const amount = parseInt(bucket.label.slice(7));
                
                // Better notification text for losses vs wins
                if (amount < 0) {
                    showNoti(`💀 @${ball.username} lost ${Math.abs(amount)} Balls!`, 'noti-admin');
                } else {
                    showNoti(`🎉 @${ball.username} landed on ${amount} Balls!`, amount >= 35 ? 'noti-bigwin' : '');
                }
                
                // Update Firebase
                database.ref(`users/${ball.username.toLowerCase()}`).transaction((data) => {
                    if (!data) return { points: 100 + amount, wins: (amount > 0 ? amount : 0) };
                    
                    // Math.max(0, ...) ensures they don't go below 0 balls total
                    data.points = Math.max(0, (data.points || 0) + amount);
                    
                    // Only add to 'wins' if it was a positive result
                    if (amount > 0) {
                        data.wins = (data.wins || 0) + amount;
                    }
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
        const stagger = Math.random() * 500; 
        setTimeout(() => { dropBall(data.username); }, stagger);
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
            
            // Only handle the transaction if it's NOT a gift (bot handles gifts)
            database.ref(`users/${cmd.username.toLowerCase()}/points`).transaction((pts) => 
                cmd.type === 'set' ? cmd.amount : (pts || 0) + cmd.amount
            );
        }

        showNoti(message, type);
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