const { Engine, Render, Runner, Bodies, World, Events } = Matter;

const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0.8; // Snappy physics

const render = Render.create({
    element: document.getElementById('canvas-container'),
    engine: engine,
    options: { width: 600, height: 750, wireframes: false, background: 'transparent' }
});

// Pegs - High Density Triangle
for (let i = 0; i < 16; i++) {
    for (let j = 0; j <= i; j++) {
        const x = 300 + (j - i / 2) * 32; // Tighter spacing
        const y = 40 + i * 38;
        World.add(world, Bodies.circle(x, y, 3, { 
            isStatic: true, 
            render: { fillStyle: '#ffffff' } 
        }));
    }
}

// 17 Precision Sensors for the Buckets
const bucketValues = [100, 50, 35, 20, 10, 5, 1, -1, -2, -1, 1, 5, 10, 20, 35, 50, 100];
const bWidth = 590 / bucketValues.length;

bucketValues.forEach((val, i) => {
    const x = 5 + (i * bWidth) + (bWidth / 2);
    const sensor = Bodies.rectangle(x, 680, bWidth - 4, 40, {
        isStatic: true,
        isSensor: true,
        label: `bucket-${val}`,
        render: { visible: false }
    });
    World.add(world, sensor);
});

function dropBall(username) {
    const ball = Bodies.circle(300 + (Math.random() * 6 - 3), 10, 7, {
        restitution: 0.5,
        friction: 0.01,
        label: 'ball',
        render: { fillStyle: '#4dfc18', strokeStyle: '#fff', lineWidth: 2 }
    });
    ball.username = username;
    World.add(world, ball);
}

// Collision Logic (Original Data)
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const isBucket = (b) => b.label && b.label.startsWith('bucket-');
        if (isBucket(bodyA) || isBucket(bodyB)) {
            const bucket = isBucket(bodyA) ? bodyA : bodyB;
            const ball = isBucket(bodyA) ? bodyB : bodyA;
            if (ball.label === 'ball' && ball.username) {
                const winValue = parseInt(bucket.label.split('-')[1]);
                const userRef = database.ref(`users/${ball.username.toLowerCase()}`);
                userRef.transaction((data) => {
                    if (!data) return { points: 100 + winValue, wins: winValue };
                    data.points = (data.points || 0) + winValue;
                    data.wins = (data.wins || 0) + winValue;
                    return data;
                });
                World.remove(world, ball);
            }
        }
    });
});

// Drop Listener
database.ref('drops').on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (data?.username) {
        dropBall(data.username);
        database.ref('drops/' + snapshot.key).remove();
    }
});

// Leaderboard Logic
database.ref('users').orderByChild('points').limitToLast(5).on('value', (snapshot) => {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    let players = [];
    snapshot.forEach(c => players.push({ name: c.key, points: c.val().points || 0 }));
    players.reverse().forEach(p => {
        const li = document.createElement('li');
        li.style.color = "white";
        li.style.padding = "5px 0";
        li.innerHTML = `<span style="color:#4dfc18">@${p.name}</span>: $${p.points}`;
        list.appendChild(li);
    });
});

Render.run(render);
Runner.run(Runner.create(), engine);