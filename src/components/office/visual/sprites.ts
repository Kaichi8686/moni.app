/** ドット絵定義（1セル＝同一規格。場面で拡大縮小しない） */

export const PAL = {
  night: "#17142b",
  wall: "#3a3068",
  wallDark: "#241e45",
  roof: "#2a1d10",
  wood: "#6b4a30",
  window: "#5eead4",
  windowDark: "#2a6070",
  sign: "#ffb347",
  signInk: "#2a1d10",
  light: "#ffd27a",
  paper: "#fff4dc",
  ink: "#2a1d10",
  skin: "#f0c8a0",
  hair: "#3a2a1a",
  mint: "#5eead4",
  rose: "#e8a0b0",
  blue: "#7ab0e8",
  green: "#7ad0a0",
  purple: "#b08ae0",
  coin: "#ffd27a",
  coinDark: "#c99030",
  star: "#ffd27a",
  alert: "#ff6b6b",
  ground: "#1a1630",
} as const;

export const SPRITE_SHOP = {
  palette: {
    W: PAL.wall,
    D: PAL.wallDark,
    R: PAL.roof,
    O: PAL.wood,
    G: PAL.window,
    N: PAL.windowDark,
    S: PAL.sign,
    I: PAL.signInk,
    L: PAL.light,
    P: PAL.paper,
    B: PAL.ground,
    X: "#0e0c18",
  },
  grid: [
    "................XXXXXXXX................",
    "..............XXRRRRRRRRXX..............",
    "............XXRRRRRRRRRRRRXX............",
    "..........XXRRRRRRRRRRRRRRRRXX..........",
    "........XXSSSSSSSSSSSSSSSSSSSSXX........",
    "........XSIIIIIIIIIIIIIIIIIIIIIX........",
    "........XSSSSSSSSSSSSSSSSSSSSSSX........",
    "......XXWWWWWWWWWWWWWWWWWWWWWWWWXX......",
    "......XWWDDDDDDWWWWWWWWDDDDDDWWWX......",
    "......XWDNGGGGNDWWWWWWDNGGGGNDWWX......",
    "......XWDNGGGGNDWWWWWWDNGGGGNDWWX......",
    "......XWDNGGGGNDWWLLLLDNGGGGNDWWX......",
    "......XWWDDDDDDWWWOOOWWDDDDDDWWWX......",
    "......XWWWWWWWWWWWOOOWWWWWWWWWWWX......",
    "......XWWWWWWWWWWWOOOWWWWWWWWWWWX......",
    "......XWWWWWWWWWWWOOOWWWWWWWWWWWX......",
    "BBBBBBXWWWWWWWWWWWOOOWWWWWWWWWWWXBBBBBB",
    "BBBBBBXXXXXXXXXXXXXXXXXXXXXXXXXXBBBBBB",
  ],
};

/** 客（色違い4種）— 体色キー C を差し替え */
const CUSTOMER_GRID = [
  "......HH......",
  ".....HHHH.....",
  "....HSSSSH....",
  "....HSHSSH....",
  "....HSSSSH....",
  ".....SSSS.....",
  "....CCCCCC....",
  "...CCCCCCCC...",
  "...CC....CC...",
  "...CC....CC...",
  "....K....K....",
  "....KK..KK....",
];

export function customerSprite(body: string) {
  return {
    palette: {
      H: PAL.hair,
      S: PAL.skin,
      C: body,
      K: "#2a2038",
    },
    grid: CUSTOMER_GRID,
  };
}

export const SPRITE_CUSTOMERS = [
  customerSprite(PAL.rose),
  customerSprite(PAL.blue),
  customerSprite(PAL.green),
  customerSprite(PAL.purple),
];

export const SPRITE_STAFF = {
  palette: {
    H: "#5a4030",
    S: PAL.skin,
    C: "#ffb347",
    K: "#2a2038",
    A: PAL.mint,
  },
  grid: [
    "......HHHH......",
    ".....HHHHHH.....",
    "....HHSSSSHH....",
    "....HSHSSSHH....",
    "....HSSSSSSH....",
    ".....SSSSSS.....",
    "....CCCCCCCC....",
    "...CCCCCCCCCC...",
    "...CCAAAAAACC...",
    "...CCCCCCCCCC...",
    "...CC......CC...",
    "....K......K....",
    "....KK....KK....",
  ],
};

export const SPRITE_SECRETARY = {
  palette: {
    H: PAL.hair,
    S: PAL.skin,
    C: PAL.mint,
    W: PAL.paper,
    K: "#2a2038",
  },
  grid: [
    "......HHHH......",
    ".....HHHHHH.....",
    "....HHSSSSHH....",
    "....HSHSSSHH....",
    "....HSSSSSSH....",
    ".....SSSSSS.....",
    "....CCCCCCCC....",
    "...CCCCCCCCCC...",
    "...CCWWWWWWCC...",
    "...CCCCCCCCCC...",
    "...CC......CC...",
    "....K......K....",
    "....KK....KK....",
  ],
};

export const SPRITE_COIN = {
  palette: {
    C: PAL.coin,
    D: PAL.coinDark,
    H: PAL.light,
  },
  grid: [
    "..CCCC..",
    ".CHDDDC.",
    "CHDDDDDC",
    "CDDDDDDC",
    "CDDDDDHC",
    "CDDDDHC.",
    ".CHHHC..",
    "..CCCC..",
  ],
};

export const SPRITE_STAR = {
  palette: {
    S: PAL.star,
    D: PAL.coinDark,
  },
  grid: [
    "...S...",
    "...S...",
    "SSSSSSS",
    ".SSSSS.",
    "..SDS..",
    ".S...S.",
    "S.....S",
  ],
};

export const SPRITE_BANG = {
  palette: {
    B: PAL.paper,
    R: PAL.alert,
    I: PAL.ink,
  },
  grid: [
    "..BBBB..",
    ".BIIIIB.",
    ".BIRRIB.",
    ".BIRRIB.",
    ".BIRRIB.",
    ".BIBIB..",
    ".BIIIIB.",
    "..BIIB..",
    "...BB...",
  ],
};
