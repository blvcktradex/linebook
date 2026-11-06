# Linebook

A No-Limit Hold'em cash study desk. Browse a library of precomputed spots, drill one combo at a time, compare ranges, and grade a pasted line.

The app does **not** run a solver. It reads solved trees. The five spots shipped with the app are a study library: equity is calculated against the opposing range, and the frequencies come from a documented study model so the desk is usable before you have a dump. They are not a CFR equilibrium. Drop in TexasSolver output when you want real solves.

## Stack

TanStack Start (React, file routes) + TypeScript + Tailwind. One deployable app serves the UI and the precomputed spots. There is no separate API process. Spots live in `src/data/spots/` as typed modules.

Progress (drills you marked in-mix) stays in the browser.

## Library

| Spot | Texture | Pot |
| --- | --- | --- |
| BTN vs BB, Qs Jh 2h | Two-tone broadway, single raised | 5.5bb |
| BTN vs BB, Kd 7c 2s | Dry rainbow king | 5.5bb |
| BTN vs BB, 9s 9d 4c | Paired | 5.5bb |
| CO vs BTN, 8h 7h 6c | Wet 3-bet pot | 21.5bb |
| BTN vs BB, As Kd 9c 4h 2s | River after flop and turn barrels | 22.7bb |

Open a spot to walk the tree. Pick a hand, then a specific combo: on two-tone boards the suits inside one cell do not share a strategy. Drill from the library card or the Trainer. Review accepts a short hand history; suits can be isomorphic to the library board.

## Scripts

```bash
npm install
npm run dev
npm run spots:generate    # rebuild the study library
npm run spots:convert -- --check
```

`spots:generate` reruns the equity pass and the study model. It is deterministic aside from the seeded Monte Carlo equity (the seed is fixed per node).

## TexasSolver pipeline

TexasSolver is the open-source postflop CFR solver this desk imports ([bupticybee/TexasSolver](https://github.com/bupticybee/TexasSolver)). Build the console binary yourself — it is GPL and is not vendored here.

```bash
./console_solver -i solver/inputs/btn_bb_qjh.txt
npm run spots:convert -- \
  --input output_result.json \
  --output src/data/spots/btn-bb-qjh-solved.ts \
  --id btn-bb-qjh-solved \
  --title "BTN vs BB" \
  --board Qs,Jh,2h \
  --oop BB --ip BTN \
  --pot 5.5 --stack 100 \
  --hero BTN
```

Then register the id in `src/lib/solutions/load.ts` and add a summary row. The simplest way to refresh the library index is to append the new spot to `src/data/manifest.ts` (same fields as the existing entries) or to re-export it from the generator if you add the file to the study set.

The converter accepts two dump shapes:

- The viewer format: `type`, `player`, `valid_actions`, `childrens`, and `strategy.card_strings` / `reach_probs` / `strategy_probs`.
- The object format: `strategy.strategy["AhKd"] = [freq, ...]`, with `actions` or `valid_actions`.

Player 0 is OOP, player 1 is IP. Combos that share a card with the board are dropped (TexasSolver can emit those on later streets with a flat `1/n` strategy). Chance nodes are not expanded — `set_dump_rounds 1` keeps the file on the street you solved. Solve a turn or river as its own spot when you want that street in the desk.

Input templates live in `solver/inputs/`.

### Adding a spot without a solver

1. Add a draft to `solver/generate.ts`.
2. Run `npm run spots:generate`.
3. The generator rewrites `src/data/spots/*.ts` and `src/data/manifest.ts`. New ids also need a loader line in `src/lib/solutions/load.ts`.

Keep the study model in `src/lib/poker/study.ts`. It is a softmax over a realization model, keyed by hand class (set, nut flush draw, top pair, air, and so on) and texture. Do not describe its output as GTO. The spot badge in the UI says "Study model" for that reason. Solver imports are badged by `source: "texassolver"`.

### Swapping solvers later

Anything that can emit the `SpotSolution` type in `src/lib/solutions/types.ts` can replace a file in `src/data/spots/`. A second converter can sit next to `solver/convert_texassolver.ts`. The UI only reads that type: actions aligned with `freq[]` / `evs[]`, 169 hand cells, combo lines, and a node tree linked by `nextNodeId`.

## Hand history format

```
Hero: BTN AhKd
Board: Qs Jh 2h
BB checks
BTN bets 33%
```

Actions before the `Board:` line are ignored (raises and blind posts). Sizes can be `33%`, `75%`, `bet`, `raise`, `all-in`.

## Deploy

The production build is a single TanStack Start app. `npm run build` emits the server bundle; host it the way you would any other Node/Vercel TanStack Start project. Spots are compiled into the bundle, so the host does not need a writable disk or a solver installed. Do not point the app at a local TexasSolver process in production — solve offline, commit or upload the converted module, and redeploy.

## Layout

```
src/lib/poker/         cards, evaluator, ranges, equity, study model, history
src/lib/solutions/     SpotSolution types and loaders
src/data/spots/        precomputed spots
src/data/manifest.ts   library index
src/components/        range grid, cards, shell
src/routes/            library, spot, trainer, ranges, review
solver/generate.ts     study-library builder
solver/convert_texassolver.ts
solver/inputs/         TexasSolver command files
```
