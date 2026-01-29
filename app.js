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
    if (!container) return; // Safety check
    
    const noti = document.createElement('div');
    noti.className = `noti ${type}`;
    noti.innerHTML = text;
    container.appendChild(noti);

    // Auto-remove after animation ends (matches CSS)
    setTimeout(() => { noti.remove(); }, 5000);
}

// --- PEGS ---
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
        isStatic: true,
        isSensor: true,
        label: `bucket-${val}`,
        render: { visible: false }
    });
    World.add(world, sensor);
});

// --- DROP BALL ---
function dropBall(username) {
    const ball = Bodies.circle(300 + (Math.random() * 4 - 2), 20, 8, {
        restitution: 0.2, 
        friction: 0.1,    
        frictionAir: 0.02, 
        label: 'ball',
        render: { fillStyle: '#53fc18', strokeStyle: '#fff', lineWidth: 2 }
    });
    ball.username = username;
    World.add(world, ball);
}

// --- COLLISIONS & WIN NOTIFICATIONS ---
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const isBucket = (b) => b.label && b.label.startsWith('bucket-');
        
        if (isBucket(bodyA) || isBucket(bodyB)) {
            const bucket = isBucket(bodyA) ? bodyA : bodyB;
            const ball = isBucket(bodyA) ? bodyB : bodyA;
            
            if (ball.label === 'ball' && ball.username) {
                const amount = parseInt(bucket.label.split('-')[1]);
                
                // Trigger On-Screen Notification for Wins
                const winType = amount >= 35 ? 'noti-bigwin' : '';
                showNoti(`🎰 @${ball.username} landed on ${amount}!`, winType);

                const userRef = database.ref(`users/${ball.username.toLowerCase()}`);
                userRef.transaction((data) => {
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

// --- DROP LISTENER ---
database.ref('drops').on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (data?.username) {
        dropBall(data.username);
        database.ref('drops/' + snapshot.key).remove();
    }
});

// --- UI UPDATER ---
database.ref('users').orderByChild('points').limitToLast(5).on('value', (snapshot) => {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = '';
    let players = [];
    snapshot.forEach(c => players.push({ name: c.key, pts: c.val().points || 0 }));
    players.reverse().forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span style="color:#53fc18">@${p.name}</span> $${p.pts}`;
        list.appendChild(li);
    });
});

// --- ADMIN COMMAND LISTENER + NOTIFICATIONS ---
database.ref('admin_commands').on('child_added', (snapshot) => {
    const cmd = snapshot.val();
    if (cmd && cmd.username && cmd.amount !== undefined) {
        
        // Trigger On-Screen Notification for Admin Action
        const label = cmd.type === 'set' ? 'SET TO' : 'ADDED';
        showNoti(`🛠️ ADMIN: ${label} ${cmd.amount} Balls for @${cmd.username}`, 'noti-admin');

        const userRef = database.ref(`users/${cmd.username.toLowerCase()}`);
        userRef.transaction((currentData) => {
            if (cmd.type === 'set') {
                return { 
                    ...currentData, 
                    points: cmd.amount,
                    wins: currentData ? currentData.wins : 0 
                };
            } else if (cmd.type === 'add') {
                if (!currentData) {
                    return { points: cmd.amount, wins: 0 };
                } else {
                    currentData.points = (currentData.points || 0) + cmd.amount;
                    return currentData;
                }
            }
        });

        console.log(`Admin action processed for ${cmd.username}`);
        database.ref('admin_commands/' + snapshot.key).remove();
    }
});

Render.run(render);
Runner.run(Runner.create(), engine);