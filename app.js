const { Engine, Render, Runner, Bodies, World, Events, Body } = Matter;

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://cajjcndpvmrngtmjhgdh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhampjbmRwdm1ybmd0bWpoZ2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3MzMsImV4cCI6MjA4NTE5OTczM30.VXk2pJoAjobVVsNuLiIKyShgXX3uIrylU4xaYi9j6f8';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0.5;

const render = Render.create({
    element: document.getElementById('canvas-container'),
    engine: engine,
    options: { width: 600, height: 600, wireframes: false, background: 'transparent' }
});

// --- CREATE PEGS ---
for (let i = 0; i < 10; i++) {
    for (let j = 0; j <= i; j++) {
        const x = 300 + (j - i / 2) * 40;
        const y = 100 + i * 40;
        World.add(world, Bodies.circle(x, y, 4, { isStatic: true, render: { fillStyle: '#53fc18' } }));
    }
}

// --- CREATE BUCKETS ---
const bucketValues = [5, 2, 0.5, 0.2, 0.2, 0.5, 2, 5];
const bucketWidth = 600 / bucketValues.length;
bucketValues.forEach((val, i) => {
    const x = i * bucketWidth + bucketWidth / 2;
    World.add(world, Bodies.rectangle(x, 580, bucketWidth - 5, 40, {
        isStatic: true,
        label: `bucket-${val}`,
        render: { fillStyle: val >= 2 ? '#ff4d4d' : '#444' }
    }));
});

// --- DROP BALL FUNCTION ---
function dropBall(username) {
    console.log(`🎰 Dropping ball for: ${username}`);
    const ball = Bodies.circle(300 + (Math.random() * 10 - 5), 20, 8, {
        restitution: 0.5,
        label: 'ball',
        render: { fillStyle: '#000000' }
    });
    ball.username = username;
    World.add(world, ball);
}

// --- LISTENER ---
// --- FIREBASE REALTIME LISTENER ---
database.ref('drops').on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (data && data.username) {
        console.log("🎲 Firebase Drop received for:", data.username);
        
        // Trigger your existing dropBall function
        dropBall(data.username);

        // Optional: Remove the record after dropping so the DB stays empty
        database.ref('drops/' + snapshot.key).remove();
    }
});

Render.run(render);
Runner.run(Runner.create(), engine);