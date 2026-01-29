const { Engine, Render, Runner, Bodies, World, Events, Body } = Matter;

const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0.6; // Slightly heavier gravity for faster gameplay

const render = Render.create({
    element: document.getElementById('canvas-container'),
    engine: engine,
    options: { 
        width: 600, 
        height: 600, 
        wireframes: false, 
        background: 'transparent' 
    }
});

// --- PEGS WITH GLOW EFFECT ---
for (let i = 0; i < 11; i++) {
    for (let j = 0; j <= i; j++) {
        const x = 300 + (j - i / 2) * 45;
        const y = 80 + i * 42;
        World.add(world, Bodies.circle(x, y, 4, { 
            isStatic: true, 
            render: { fillStyle: '#ffffff', strokeStyle: '#53fc18', lineWidth: 2 } 
        }));
    }
}

// --- BUCKETS (Original Multi-Color Gradient) ---
const bucketValues = [5, 2, 0.5, 0.2, 0.2, 0.5, 2, 5];
const colors = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#00ff00', '#ffff00', '#ff8800', '#ff0000'];
const bucketWidth = 580 / bucketValues.length;

bucketValues.forEach((val, i) => {
    const x = 40 + i * bucketWidth;
    // The bucket sensor
    const sensor = Bodies.rectangle(x + bucketWidth / 2, 560, bucketWidth - 10, 20, {
        isStatic: true,
        isSensor: true, // Ball passes through it
        label: `bucket-${val}`,
        render: { fillStyle: 'transparent' }
    });
    
    // The visual bucket box
    const visual = Bodies.rectangle(x + bucketWidth / 2, 580, bucketWidth - 5, 30, {
        isStatic: true,
        render: { fillStyle: colors[i] }
    });

    World.add(world, [sensor, visual]);
});
// Walls
World.add(world, [
    Bodies.rectangle(0, 300, 40, 600, { isStatic: true, render: { visible: false } }),
    Bodies.rectangle(600, 300, 40, 600, { isStatic: true, render: { visible: false } })
]);

// --- DROP BALL FUNCTION ---
function dropBall(username) {
    const ball = Bodies.circle(300 + (Math.random() * 20 - 10), 20, 9, {
        restitution: 0.6,
        friction: 0.05,
        label: 'ball',
        render: { 
            fillStyle: '#53fc18', // Kick Green
            strokeStyle: '#ffffff',
            lineWidth: 2
        }
    });
    ball.username = username; 
    World.add(world, ball);
}

// --- COLLISION LOGIC ---
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const isBucket = (body) => body.label && body.label.startsWith('bucket-');
        
        if (isBucket(bodyA) || isBucket(bodyB)) {
            const bucket = isBucket(bodyA) ? bodyA : bodyB;
            const ball = isBucket(bodyA) ? bodyB : bodyA;

            if (ball.label === 'ball' && ball.username) {
                const multiplier = parseFloat(bucket.label.split('-')[1]);
                reportWinToFirebase(ball.username, 50 * multiplier);
                World.remove(world, ball); // Remove ball on impact
            }
        }
    });
});

// --- FIREBASE FUNCTIONS ---
function reportWinToFirebase(username, amount) {
    const userRef = database.ref(`users/${username.toLowerCase()}`);
    userRef.transaction((data) => {
        if (!data) return { points: 100 + amount, wins: amount };
        data.points = (data.points || 0) + amount;
        data.wins = (data.wins || 0) + amount;
        return data;
    });
}

database.ref('drops').on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (data?.username) {
        dropBall(data.username);
        database.ref('drops/' + snapshot.key).remove();
    }
});

// --- UI UPDATE ---
database.ref('users').orderByChild('wins').limitToLast(5).on('value', (snapshot) => {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = '';
    let players = [];
    snapshot.forEach(c => players.push({ name: c.key, wins: c.val().wins || 0 }));
    players.reverse().forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<b style="color:#53fc18">${p.name}</b>: $${p.wins.toFixed(0)}`;
        list.appendChild(li);
    });
});

Render.run(render);
Runner.run(Runner.create(), engine);