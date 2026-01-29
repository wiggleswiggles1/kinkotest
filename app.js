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
    // Narrower funnel to guide balls into the center-top row
    Bodies.rectangle(180, 50, 200, 10, { isStatic: true, angle: Math.PI / 6, render: { visible: false } }),
    Bodies.rectangle(420, 50, 200, 10, { isStatic: true, angle: -Math.PI / 6, render: { visible: false } })
]);

// --- PEGS (Trapezoid Top Layout) ---
const rows = 16; 
for (let i = 0; i < rows; i++) {
    const pegsInRow = i + 3; 
    for (let j = 0; j < pegsInRow; j++) {
        const x = 300 + (j - (pegsInRow - 1) / 2) * 32; 
        const y = 120 + i * 38; 
        
        World.add(world, Bodies.circle(x, y, 3, { 
            isStatic: true, 
            restitution: 0.4, // Controlled bounce
            render: { fillStyle: '#ffffff' } 
        }));
    }
}

// --- BUCKET SENSORS & COLORS ---
const bucketValues = [100, 50, 35, 20, 10, 5, 1, -1, -2, -1, 1, 5, 10, 20, 35, 50, 100];
const totalWidth = 600;
const bWidth = totalWidth / bucketValues.length;

bucketValues.forEach((val, i) => {
    const x = (i * bWidth) + (bWidth / 2);
    const sensor = Bodies.rectangle(x, 750, bWidth, 60, {
        isStatic: true, isSensor: true, label: `bucket-${val}`, render: { visible: false }
    });
    World.add(world, sensor);
});

// --- DROP BALL (Balanced Physics) ---
function dropBall(username) {
    // Tight drop zone (±5) to favor center but allow deviation
    const spawnX = 300 + (Math.random() * 10 - 5); 
    const ball = Bodies.circle(spawnX, 10, 8, {
        restitution: 0.3,   // Predictable bounciness
        friction: 0.05,     // Some grip for natural rolling
        frictionAir: 0.04,  // Higher air resistance keeps it from flying to edges
        label: 'ball',
        render: { fillStyle: '#53fc18', strokeStyle: '#fff', lineWidth: 2 }
    });
    ball.username = username;
    World.add(world, ball);

    // Minor nudge to ensure balls don't get perfectly stuck
    const force = (Math.random() - 0.5) * 0.0008;
    Matter.Body.applyForce(ball, ball.position, { x: force, y: 0 });
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

// --- COLLISIONS ---
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const isBucket = (b) => b.label && b.label.startsWith('bucket-');
        
        if (isBucket(bodyA) || isBucket(bodyB)) {
            const bucket = isBucket(bodyA) ? bodyA : bodyB;
            const ball = isBucket(bodyA) ? bodyB : bodyA;
            
            if (ball.label === 'ball' && ball.username) {
                const amount = parseInt(bucket.label.slice(7));
                
                if (amount < 0) {
                    showNoti(`💀 @${ball.username} lost ${Math.abs(amount)} Balls!`, 'noti-admin');
                } else {
                    showNoti(`🎉 @${ball.username} landed on ${amount} Balls!`, amount >= 25 ? 'noti-bigwin' : '');
                }
                
                database.ref(`users/${ball.username.toLowerCase()}`).transaction((data) => {
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

// --- OUTLINED RENDERING ---
Events.on(render, 'afterRender', () => {
    const { context } = render;
    context.font = "bold 18px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";

    bucketValues.forEach((val, i) => {
        const x = (i * bWidth) + (bWidth / 2);
        const y = 750; 

        // Black Stroke
        context.strokeStyle = "#000000";
        context.lineWidth = 4;
        context.strokeText(val, x, y);

        // White Fill
        context.fillStyle = "#ffffff";
        context.fillText(val, x, y);
    });
});

Render.run(render);
Runner.run(Runner.create(), engine);