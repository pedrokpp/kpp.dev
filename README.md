# kpedro.dev

site pessoal. hospedado no firebase.

## stack

SvelteKit (adapter-static) + pnpm.

## comandos

```sh
pnpm install
pnpm dev      # dev server
pnpm check    # svelte-check
pnpm build    # build estático
pnpm ship     # build + firebase deploy
```

## estrutura

- `src/lib/writeups/` — writeups por plataforma (`<platform>/<slug>.md` + `slug.ts`)
- `src/lib/writeups.ts` — registro dos writeups
- `src/routes/` — páginas
