import type { SpotSummary } from "@/lib/solutions/types";

export const manifest: SpotSummary[] = [
  {
    "id": "btn-bb-qjh",
    "title": "BTN vs BB",
    "subtitle": "Single raised · QJ2 two-tone",
    "lesson": "Broadway with a flush draw. Small bets still get through, but the large size belongs to strong made hands and nutted draws. Weak top pair checks back more than it does on a dry king.",
    "source": "study-model",
    "stackBb": 100,
    "hero": "BTN",
    "villain": "BB",
    "potBb": 5.5,
    "effectiveStackBb": 97.5,
    "board": [
      "Qs",
      "Jh",
      "2h"
    ],
    "texture": [
      "Dynamic",
      "Two-tone",
      "SRP"
    ],
    "treeLabel": "Check / 33% / 75%",
    "street": "flop",
    "preflopLine": "BTN raises 2.5bb, BB calls",
    "nodeCount": 4
  },
  {
    "id": "btn-bb-k72",
    "title": "BTN vs BB",
    "subtitle": "Single raised · K72 rainbow",
    "lesson": "Dry king-high rainbow. The in-position range uses a small bet at a high frequency. The big size is for value and a few ace-high bluffs, not the default.",
    "source": "study-model",
    "stackBb": 100,
    "hero": "BTN",
    "villain": "BB",
    "potBb": 5.5,
    "effectiveStackBb": 97.5,
    "board": [
      "Kd",
      "7c",
      "2s"
    ],
    "texture": [
      "Dry",
      "Rainbow",
      "SRP"
    ],
    "treeLabel": "Check / 33% / 75%",
    "street": "flop",
    "preflopLine": "BTN raises 2.5bb, BB calls",
    "nodeCount": 4
  },
  {
    "id": "btn-bb-994",
    "title": "BTN vs BB",
    "subtitle": "Single raised · paired 994",
    "lesson": "Paired middle board. A small c-bet is still the workhorse. Large bets are reserved for trips and full houses; most one-pair hands do not need a big size.",
    "source": "study-model",
    "stackBb": 100,
    "hero": "BTN",
    "villain": "BB",
    "potBb": 5.5,
    "effectiveStackBb": 97.5,
    "board": [
      "9s",
      "9d",
      "4c"
    ],
    "texture": [
      "Paired",
      "Dry",
      "SRP"
    ],
    "treeLabel": "Check / 33% / 75%",
    "street": "flop",
    "preflopLine": "BTN raises 2.5bb, BB calls",
    "nodeCount": 4
  },
  {
    "id": "co-btn-876",
    "title": "CO vs BTN",
    "subtitle": "3-bet pot · 876 two-tone",
    "lesson": "Connected, flush-possible, and in a 3-bet pot. Nobody has a clean range bet. Check the vulnerable middle, and bet large with nutted value and combo draws.",
    "source": "study-model",
    "stackBb": 100,
    "hero": "BTN",
    "villain": "CO",
    "potBb": 21.5,
    "effectiveStackBb": 90,
    "board": [
      "8h",
      "7h",
      "6c"
    ],
    "texture": [
      "Wet",
      "Connected",
      "3-bet"
    ],
    "treeLabel": "Check / 33% / 75%",
    "street": "flop",
    "preflopLine": "CO raises 2.5bb, BTN 3-bets to 10bb, CO calls",
    "nodeCount": 3
  },
  {
    "id": "btn-bb-river-ak",
    "title": "BTN vs BB",
    "subtitle": "River · A K 9 4 2",
    "lesson": "The turn bet got called and the river bricks. Value is top pair with a good kicker and better. Bluffs want a queen or jack that blocks the calling range; empty low cards mostly give up.",
    "source": "study-model",
    "stackBb": 100,
    "hero": "BTN",
    "villain": "BB",
    "potBb": 22.7,
    "effectiveStackBb": 88.9,
    "board": [
      "As",
      "Kd",
      "9c",
      "4h",
      "2s"
    ],
    "texture": [
      "River",
      "Rainbow",
      "SRP"
    ],
    "treeLabel": "Check / 66% / 150%",
    "street": "river",
    "preflopLine": "Flop 33% called, turn 75% called. River is a blank.",
    "nodeCount": 2
  }
];
