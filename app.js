// --- MATTER.JS SETUP ---
const { Engine, Render, Runner, Bodies, World, Events, Body } = Matter;

// --- CONFIGURATION ---
// These match your verified project settings
const SUPABASE_URL = 'https://cajjcndpvmrngtmjhgdh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhampjbmRwdm1ybmd0bWpoZ2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3MzMsImV4cCI6MjA4NTE5OTczM30.VXk2pJoAjobVVsNuLiIKyShgXX3uIrylU4xaYi9j6f8';

// Initialize Supabase Client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Physics Engine Setup
const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0.5;

console.log("🚀 Plinko Overlay: App.js is officially running!");

// Create Renderer
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

// Create Pegs in a Triangle Pattern
for (let i = 0; i < 10; i++) {
    for (let j = 0; j <= i; j++) {
        const x = 300 + (j - i / 2) * 40;
        const y = 100 + i * 40;
        World.add(world, Bodies.circle(x, y, 4, { 
            isStatic: true, 
            render: { fillStyle: '#53fc18' } 
        }));
    }
}

// --- CORE FUNCTIONS ---

/**
 * Creates and drops a ball into the world
 * @param {string} username - The user who triggered the drop
 */
function dropBall(username) {
    console.log(`🎰 Dropping ball for: ${username}`);
    const ball = Bodies.circle(300 + (Math.random() * 10 - 5), 20, 8, {
        restitution: 0.5,
        friction: 0.01,
        render: { fillStyle: '#ffffff' }
    });
    ball.username = username;
    World.add(world, ball);
}

// --- SUPABASE REALTIME LISTENER ---

const channel = _supabase
  .channel('plinko-drops')
  .on(
    'postgres_changes', 
    { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'drops' 
    }, 
    (payload) => {
      console.log('🔥 NEW DB INSERT DETECTED:', payload.new.username);
      dropBall(payload.new.username);
    }
  )
  .subscribe((status, err) => {
    console.log("🔗 Connection Status:", status);
    if (err) {
        console.error("❌ Subscription Error:", err);
    }
    if (status === 'SUBSCRIBED') {
        console.log("✅ Listening for drops from Kick chat...");
    }
  });

// --- START ENGINES ---
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);