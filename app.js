const { Engine, Render, Runner, Bodies, World, Events } = Matter;

const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0.6;

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

// --- WALLS ---
World.add(world, [
    Bodies.rectangle(5, 300, 10, 600, { isStatic: true, render: { visible: false } }),
    Bodies.rectangle(595, 300, 10, 600, { isStatic: true, render: { visible: false } })
]);

// --- NEON PEGS ---
for (let i = 0; i < 10; i++) {
    for (let j = 0; j <= i; j++) {
        const x = 300 + (j - i / 2) * 45;
        const y = 100 + i * 42;
        World.add(world, Bodies.circle(x, y, 4, { 
            isStatic: true, 
            render: { fillStyle: '#ffffff', strokeStyle: '#53fc18', lineWidth: 2 } 
        }));
    }
}

// --- BUCKET SENSORS ---
const bucketValues = [5, 2, 0.5, 0.2, 0.2, 0.5, 2, 5];
const bucketWidth = 600 / bucketValues.length;

bucketValues.forEach((val, i) => {
    const x = i * bucketWidth + bucketWidth / 2;
    const sensor = Bodies.rectangle(x, 580, bucketWidth - 10, 40, {
        isStatic: true,
        isSensor: true,
        label: `bucket-${val}`,
        render: { visible: false } // Hidden because we use CSS labels
    });
    World.add(world, sensor);
});

// --- DROP BALL ---
function dropBall(username) {
    const ball = Bodies.circle(300 + (Math.random() * 10 - 5), 20, 9, {
        restitution: 0.5,
        friction: 0.02,
        label: 'ball',
        render: { fillStyle: '#53fc18', strokeStyle: '#ffffff', lineWidth: 2 }
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
                const mult = parseFloat(bucket.label.split('-')[1]);
                reportWin(ball.username, 50 * mult);
                World.remove(world, ball);
            }
        }
    });
});

function reportWin(username, amount) {
    const userRef = database.ref(`users/${username.toLowerCase()}`);
    userRef.transaction((data) => {
        if (!data) return { points: 100 + amount, wins: amount };
        data.points = (data.points || 0) + amount;
        data.wins = (data.wins || 0) + amount;
        return data;
    });
}

// --- LISTENERS ---
database.ref('drops').on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (data?.username) {
        dropBall(data.username);
        database.ref('drops/' + snapshot.key).remove();
    }
});

database.ref('users').orderByChild('wins').limitToLast(5).on('value', (snapshot) => {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    let players = [];
    snapshot.forEach(c => players.push({ name: c.key, wins: c.val().wins || 0 }));
    players.reverse().forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span style="color:#53fc18">@${p.name}</span> $${p.wins.toFixed(0)}`;
        list.appendChild(li);
    });
});

Render.run(render);
Runner.run(Runner.create(), engine);