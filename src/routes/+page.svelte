<script lang="ts">
  import { onMount } from "svelte";

  const greetings = [
    "olá",
    "hello",
    "hola",
    "bonjour",
    "ciao",
    "hallo",
    "こんにちは",
    "你好",
    "привет",
    // "안녕하세요", // requer noto-fonts-cjk
    "नमस्ते",
    "مرحبا",
    "γεια σου",
    "שלום",
    "hej",
  ];

  type Line =
    | { kind: "prompt"; time: string }
    | { kind: "out"; text: string; color?: string }
    | { kind: "idle" };

  type Egg = { cmd: string; output: { text: string; color?: string }[] };

  const eggs: Egg[] = [
    {
      cmd: "cat flag.txt",
      output: [{ text: "flag{n0t_4_r34l_fl4g_g00d_try}", color: "#4ade80" }],
    },
    {
      cmd: "sudo rm -rf /",
      output: [
        { text: "[sudo] password for guest:", color: "#fbbf24" },
        { text: "rm: cannot remove '/': Permission denied", color: "#f87171" },
      ],
    },
    {
      cmd: "nmap -p 80,1337 kpp.dev",
      output: [
        { text: "80/tcp   open  http", color: "#4ade80" },
        { text: "1337/tcp open  waste", color: "#4ade80" },
      ],
    },
    {
      cmd: ":(){ :|:& };:",
      output: [
        {
          text: "bash: fork: Resource temporarily unavailable",
          color: "#f87171",
        },
      ],
    },
  ];

  let headerTime = $state(now());
  let lines = $state<Line[]>([]);
  let typing = $state("");
  let showTyping = $state(false);
  let committed = $state(false);
  let clearing = $state(false);
  let eggCmd = $state<string | null>(null);
  let boosted = $state(false);

  let lastGreetings: string[] = [];
  function pick() {
    const pool = greetings.filter((g) => !lastGreetings.includes(g));
    const g = pool[Math.floor(Math.random() * pool.length)];
    lastGreetings = [...lastGreetings, g].slice(-2);
    return g;
  }

  let lastEggs: number[] = [];
  function pickEgg(): Egg {
    const indices = eggs.map((_, i) => i).filter((i) => !lastEggs.includes(i));
    const i = indices[Math.floor(Math.random() * indices.length)];
    lastEggs = [...lastEggs, i].slice(-2);
    return eggs[i];
  }

  function now() {
    return new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  async function typeCmd(cmd: string) {
    showTyping = true;
    typing = "";
    for (const ch of cmd) {
      typing += ch;
      // pausa maior antes de '$' (hesitação) e em espaços; burst no resto
      const delay =
        ch === "$"
          ? 120 + Math.random() * 80
          : ch === " "
            ? 50 + Math.random() * 30
            : 35 + Math.random() * 40;
      await sleep(delay);
    }
  }

  async function loop() {
    while (true) {
      lines = [];
      clearing = false;
      committed = false;
      showTyping = false;
      typing = "";
      eggCmd = null;
      headerTime = now();

      await sleep(600 + Math.random() * 400);

      if (Math.random() < (boosted ? 0.85 : 0.01)) {
        const egg = pickEgg();
        await typeCmd(egg.cmd);
        committed = true;
        eggCmd = egg.cmd;
        lines = egg.output.map((o) => ({
          kind: "out" as const,
          text: o.text,
          color: o.color,
        }));
      } else {
        await typeCmd("echo $GREETING");
        committed = true;
        const greeting = pick();
        lines = [{ kind: "out", text: greeting }];
      }

      showTyping = false;
      typing = "";

      await sleep(300 + Math.random() * 600);

      lines = [...lines, { kind: "prompt", time: now() }, { kind: "idle" }];

      await sleep(900 + Math.random() * 500);

      clearing = true;
      await sleep(80);
    }
  }

  onMount(() => loop());
</script>

<svelte:head>
  <title>kp</title>
  <link rel="canonical" href="https://kpp.dev" />
  <meta name="description" content="pedro kozlowski — dev & cybersec" />
  <meta property="og:title" content="kp" />
  <meta property="og:description" content="pedro kozlowski — dev & cybersec" />
  <meta property="og:url" content="https://kpp.dev" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://github.com/pedrokpp.png" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="kp" />
  <meta name="twitter:description" content="pedro kozlowski — dev & cybersec" />
  <meta name="twitter:image" content="https://github.com/pedrokpp.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin="anonymous"
  />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="ambient">
  <div class="blob b1"></div>
  <div class="blob b2"></div>
  <div class="blob b3"></div>
</div>

<main>
  <div class="card">
    <div
      class="avatar-wrap"
      onclick={() => (boosted = true)}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.key === "Enter" && (boosted = true)}
      aria-label="avatar"
    >
      <img
        src="https://github.com/pedrokpp.png"
        alt="pedro kozlowski"
        class="avatar"
      />
    </div>

    <div class="identity">
      <h1>pedro kozlowski</h1>
      <p class="role">dev & cybersec</p>
    </div>

    <nav class="links">
      <a
        href="https://github.com/pedrokpp"
        target="_blank"
        rel="noopener noreferrer"
        class="link"
      >
        <svg
          width="15"
          height="15"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.79-.26.79-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.7.8.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"
          />
        </svg>
        github
      </a>

      <a
        href="https://linkedin.com/in/pedrokp"
        target="_blank"
        rel="noopener noreferrer"
        class="link"
      >
        <svg
          width="15"
          height="15"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM6.78 20.45H3.89V9h2.89v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"
          />
        </svg>
        linkedin
      </a>

      <a href="mailto:pedrkp@proton.me" class="link">
        <svg
          width="15"
          height="15"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"
          />
        </svg>
        email
      </a>
    </nav>

    <a href="/writeups" class="writeups-link">
      <span class="writeups-label">
        <svg
          width="14"
          height="14"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-5 8v-2h8v2H8zm0-4v-2h8v2H8z"
          />
        </svg>
        write-ups
      </span>
      <svg
        width="14"
        height="14"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
      </svg>
    </a>

    <footer class="terminal" aria-label="terminal simulado">
      <!-- linha 1: prompt — nunca some -->
      <div class="t-row t-prompt">
        <span
          ><span class="t-user">guest</span><span class="t-at">@kpp.dev</span
          ><span class="t-path">:~</span></span
        >
        <span class="t-time">{headerTime}</span>
      </div>

      <!-- linha 2: $ — nunca some, mostra typing / cmd / idle -->
      <div class="t-row">
        <span class="t-dollar">$</span>
        {#if showTyping}
          {#if typing.includes("$")}
            <span class="t-cmd-text"
              >{typing.split("$")[0]}<span class="t-var"
                >${typing.split("$")[1]}</span
              ></span
            ><span class="cursor" aria-hidden="true"></span>
          {:else}
            <span class="t-cmd-text">{typing}</span><span
              class="cursor"
              aria-hidden="true"
            ></span>
          {/if}
        {:else if committed}
          {#if eggCmd}
            <span class="t-cmd-text">{eggCmd}</span>
          {:else}
            <span class="t-cmd-text"
              >echo <span class="t-var">$GREETING</span></span
            >
          {/if}
        {:else}
          <span class="cursor" aria-hidden="true"></span>
        {/if}
      </div>

      <!-- conteúdo que limpa com ctrl+l: output + segundo prompt + idle -->
      <div class="t-content" class:clearing>
        {#each lines as line}
          {#if line.kind === "prompt"}
            <div class="t-row t-prompt">
              <span
                ><span class="t-user">guest</span><span class="t-at"
                  >@kpp.dev</span
                ><span class="t-path">:~</span></span
              >
              <span class="t-time">{line.time}</span>
            </div>
          {:else if line.kind === "out"}
            <div class="t-row t-out" style={line.color ? `color: ${line.color}` : ""}>{line.text}</div>
          {:else if line.kind === "idle"}
            <div class="t-row">
              <span class="t-dollar">$</span>
            </div>
          {/if}
        {/each}
      </div>
    </footer>
  </div>
</main>

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      sans-serif;
    background: #0a0a0f;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #e4e4e7;
  }

  /* ambient blobs */
  .ambient {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.08), transparent);
    animation: drift 20s ease-in-out infinite;
  }

  .b1 {
    width: 300px;
    height: 300px;
    top: -150px;
    left: -150px;
    animation-delay: 0s;
  }

  .b2 {
    width: 400px;
    height: 400px;
    bottom: -200px;
    right: -200px;
    animation-delay: 7s;
  }

  .b3 {
    width: 250px;
    height: 250px;
    top: 50%;
    right: -125px;
    animation-delay: 14s;
  }

  @keyframes drift {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    33% {
      transform: translate(30px, -30px) scale(1.1);
    }
    66% {
      transform: translate(-20px, 20px) scale(0.9);
    }
  }

  /* card */
  main {
    position: relative;
    z-index: 1;
    padding: 1rem;
  }

  .card {
    width: 340px;
    background: rgba(14, 10, 20, 0.72);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(139, 92, 246, 0.14);
    border-radius: 20px;
    padding: 2rem 1.75rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    box-shadow:
      0 8px 40px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(139, 92, 246, 0.04) inset;
    animation: rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* avatar */
  .avatar-wrap {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(139, 92, 246, 0.25);
    box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.06);
    margin-bottom: 1.1rem;
    flex-shrink: 0;
    cursor: pointer;
    transition:
      border-color 0.3s,
      box-shadow 0.3s;
  }

  .avatar-wrap:hover {
    border-color: rgba(139, 92, 246, 0.45);
    box-shadow:
      0 0 0 4px rgba(139, 92, 246, 0.1),
      0 0 20px rgba(139, 92, 246, 0.15);
  }

  .avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.1);
    transform-origin: center center;
  }

  /* identity */
  .identity {
    text-align: center;
    margin-bottom: 1.6rem;
  }

  h1 {
    font-size: 1.35rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    background: linear-gradient(
      135deg,
      #c4b5fd,
      #a78bfa,
      #8b5cf6,
      #7c3aed,
      #a78bfa,
      #c4b5fd
    );
    background-size: 300% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.3rem;
    animation: gradient-cycle 24s linear infinite;
  }

  @keyframes gradient-cycle {
    0% {
      background-position: 0% center;
    }
    100% {
      background-position: 300% center;
    }
  }

  .role {
    font-size: 0.8rem;
    font-weight: 400;
    color: #52525b;
    letter-spacing: 0.03em;
    text-transform: lowercase;
  }

  /* social links */
  .links {
    display: flex;
    gap: 0.35rem;
    margin-bottom: 0.75rem;
    width: 100%;
    justify-content: space-between;
  }

  .link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.8rem;
    border-radius: 8px;
    text-decoration: none;
    font-size: 0.78rem;
    font-weight: 500;
    color: #a1a1aa;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    transition:
      color 0.2s,
      background 0.2s,
      border-color 0.2s,
      transform 0.15s;
    letter-spacing: 0.01em;
  }

  .link:hover {
    color: #e4e4e7;
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.28);
    transform: translateY(-1px);
  }

  /* writeups link */
  .writeups-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.65rem 0.9rem;
    border-radius: 10px;
    text-decoration: none;
    border: 1px solid rgba(139, 92, 246, 0.16);
    background: rgba(139, 92, 246, 0.05);
    color: #a78bfa;
    transition:
      background 0.2s,
      border-color 0.2s,
      color 0.2s,
      transform 0.15s;
    margin-bottom: 1.4rem;
  }

  .writeups-link:hover {
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.35);
    color: #c4b5fd;
    transform: translateY(-1px);
  }

  .writeups-label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.8rem;
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  /* terminal */
  .terminal {
    width: 100%;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    font-family: "Fira Code", "Courier New", monospace;
    font-size: 0.75rem;
    line-height: 1.6;
    height: 7.2rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 0;
    transition: opacity 0.1s ease;
  }

  .t-content {
    display: flex;
    flex-direction: column;
  }

  .t-content.clearing {
    visibility: hidden;
  }

  .t-row {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    white-space: pre;
  }

  .t-prompt {
    display: flex;
    justify-content: space-between;
    width: 100%;
  }

  .t-user {
    color: #4ade80;
  }
  .t-at {
    color: #4ade80;
    opacity: 0.7;
  }
  .t-path {
    color: #71717a;
  }
  .t-time {
    color: #3f3f46;
    font-size: 0.7rem;
  }

  .t-dollar {
    color: #52525b;
    flex-shrink: 0;
  }
  .t-cmd-text {
    color: #e4e4e7;
  }
  .t-var {
    color: #fbbf24;
  }

  .t-out {
    color: #a78bfa;
    padding-left: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .cursor {
    display: inline-block;
    width: 7px;
    height: 0.85em;
    background: #e4e4e7;
    border-radius: 1px;
    animation: blink 0.75s step-end infinite;
    vertical-align: text-bottom;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  @media (min-width: 600px) {
    .card {
      zoom: 1.5;
    }
  }

  @media (max-width: 400px) {
    .card {
      width: calc(100vw - 2rem);
      padding: 1.75rem 1.25rem 1.25rem;
    }

    .links {
      gap: 0.25rem;
    }

    .link {
      padding: 0.4rem 0.6rem;
      font-size: 0.74rem;
    }
  }
</style>
