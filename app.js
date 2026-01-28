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

// Create Pegs (Triangle)
for (let i = 0; i < 10; i++) {
    for (let j = 0; j <= i; j++) {
        const x = 300 + (j - i / 2) * 40;
        const y = 100 + i * 40;
        World.add(world, Bodies.circle(x, y, 4, { isStatic: true, render: { fillStyle: '#53fc18' } }));
    }
}

// Drop Ball Function
function dropBall(username) {
    const ball = Bodies.circle(300 + (Math.random() * 10 - 5), 20, 8, {
        restitution: 0.5,
        render: { fillStyle: '#ffffff' }
    });
    ball.username = username;
    World.add(world, ball);
}

// Realtime Listener for the Bot
_supabase
  .channel('public:drops') // This 'channel' name can be anything
  .on(
    'postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'drops' }, 
    (payload) => {
      console.log('Change received!', payload);
      dropBall(payload.new.username); // This triggers the physics engine
    }
  )
  .subscribe();
Render.run(render);
Runner.run(Runner.create(), engine);