const { Engine, Render, Runner, Bodies, World, Events } = Matter;

const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0.7;

const render = Render.create({
    element: document.getElementById('canvas-container'),
    engine: engine,
    options: { width: 600, height: 700, wireframes: false, background: 'transparent' }
});

// Walls
World.add(world, [
    Bodies.rectangle(5, 350, 10, 700, { isStatic: true, render: { visible: false } }),
    Bodies.rectangle(595, 350, 10, 700, { isStatic: true, render: { visible: false } })
]);

// Pegs (Triangle like image 2)
for (let i = 0; i < 14; i++) {
    for (let j = 0; j <= i; j++) {
        const x = 300 + (j - i / 2) * 35;
        const y = 50 + i * 40;
        World.add(world, Bodies.circle(x, y, 3, { 
            isStatic: true, 
            render: { fillStyle: '#fff' } 
        }));
    }
}

// 11 Square Buckets Match the UI
const bucketValues = [100, 50, 20, 10, 5, -5, 5, 10, 20, 50, 100];
const bWidth = 580 / bucketValues.length;

bucketValues.forEach((val, i) => {
    const x = 10 + (i * bWidth) + (bWidth / 2);
    const sensor = Bodies.rectangle(x, 640, bWidth - 5, 40, {
        isStatic: true,
        isSensor: true,
        label: `bucket-${val}`,
        render: { visible: false }
    });
    World.add(world, sensor);
});

function dropBall(username) {
    const ball = Bodies.circle(300 + (Math.random() * 10 - 5), 10, 8, {
        restitution: 0.5,
        friction: 0.01,
        label: 'ball',
        render: { fillStyle: '#4dfc18' }
    });
    ball.username = username;
    World.add(world, ball);
}

Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const isBucket = (b) => b.label && b.label.startsWith('bucket-');
        if (isBucket(bodyA) || isBucket(bodyB)) {
            const bucket = isBucket(bodyA) ? bodyA : bodyB;
            const ball = isBucket(bodyA) ? bodyB : bodyA;
            if (ball.label === 'ball' && ball.username) {
                const amount = parseInt(bucket.label.split('-')[1]);
                updateFirebaseBalls(ball.username, amount);
                World.remove(world, ball);
            }
        }
    });
});

function updateFirebaseBalls(username, amount) {
    const userRef = database.ref(`users/${username.toLowerCase()}`);
    userRef.transaction((data) => {
        if (!data) return { balls: 10 + amount, wins: amount > 0 ? amount : 0 };
        data.balls = (data.balls || 0) + amount;
        if (amount > 0) data.wins = (data.wins || 0) + amount;
        return data;
    });
}

// Listen for bot drops
database.ref('drops').on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (data?.username) {
        dropBall(data.username);
        database.ref('drops/' + snapshot.key).remove();
    }
});

// Update Leaderboard
database.ref('users').orderByChild('balls').limitToLast(5).on('value', (snapshot) => {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    let players = [];
    snapshot.forEach(c => players.push({ name: c.key, balls: c.val().balls || 0 }));
    players.reverse().forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span style="color:#4dfc18">@${p.name}</span>: ${p.balls} Balls`;
        list.appendChild(li);
    });
});

Render.run(render);
Runner.run(Runner.create(), engine);