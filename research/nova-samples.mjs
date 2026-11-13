// Transcribed directly from the user's distinct daily examples, not market OHLC.
// All these examples informed the candidate; this is NOT an independent validation set.
export const samples=[
 {symbol:'NVDA',date:'2026-11-11',observed:1,close:173.69,ema8:186.44,ema13:193.95,ema21:201.52,ema55:211.63,macd:-11.925,signal:-7.697,k:11.2,d:13.4,source:'02-1000031921.jpg'},
 {symbol:'PLTR',date:'2026-11-11',observed:4,close:172.98,ema8:171.71,ema13:176.08,ema21:180.40,ema55:179.72,macd:-6.383,signal:-3.569,k:32.5,d:25,source:'08-1000031927.jpg'},
 {symbol:'AMD',date:'2026-11-11',observed:5,close:546.57,ema8:503.95,ema13:509.40,ema21:521.00,ema55:531.09,macd:-18.165,signal:-19.074,k:64.9,d:47.1,source:'06-1000031931.jpg'},
 {symbol:'CEG',date:'2026-11-11',observed:6,close:272.99,ema8:261.82,ema13:261.48,ema21:263.02,ema55:267.48,macd:-2.641,signal:-4.210,k:81.8,d:63.4,source:'06-1000031913.jpg'},
 {symbol:'TTWO',date:'2026-11-11',observed:7,close:230.37,ema8:214.16,ema13:210.43,ema21:208.43,ema55:211.84,macd:2.677,signal:-.864,k:83.2,d:82.8,source:'04-1000031917.jpg'}
];

// Read only after the candidate formula was fixed. Screenshot dates are not explicit.
export const heldout=[
 {symbol:'WRB',date:null,observed:7,close:75.64,ema8:75.30,ema13:74.76,ema21:73.99,ema55:72.13,macd:1.282,signal:1.178,k:61.3,d:73.3,source:'01-1000031340.jpg'},
 {symbol:'CHPT',date:null,observed:9,close:12.02,ema8:10.68,ema13:10.09,ema21:9.56,ema55:8.57,macd:.839,signal:.462,k:89.6,d:89.5,source:'04-1000031344.jpg'},
 {symbol:'DIS',date:null,observed:7,close:118.42,ema8:115.43,ema13:114.01,ema21:112.38,ema55:108.68,macd:2.661,signal:2.055,k:73.4,d:76.5,source:'01-1000031358.jpg'}
];

// Additional historical screenshots read after the original formula was fixed.
// Dates aren't shown; repeated screenshots of the same output are counted once.
export const historical=[
 {symbol:'CAH',observed:7,close:274.75,ema8:263.37,ema13:259.09,ema21:254.21,ema55:243.59,macd:7.963,signal:6.130,k:67.7,d:69.8,source:'02-1000031364.jpg'},
 {symbol:'FIVE',observed:7,close:250.45,ema8:242.72,ema13:238.94,ema21:235.13,ema55:230.16,macd:5.811,signal:3.541,k:68.7,d:70.9,source:'02-1000031382.jpg'},
 {symbol:'NFLX',observed:3,close:63.58,ema8:64.14,ema13:64.66,ema21:65.80,ema55:69.77,macd:-1.977,signal:-2.203,k:34.0,d:35.4,source:'01-1000031380.jpg'},
 {symbol:'JPM',observed:6,close:339.94,ema8:340.70,ema13:339.89,ema21:339.19,ema55:339.83,macd:.858,signal:.155,k:36.6,d:51.4,source:'01-1000031390.jpg'},
 {symbol:'ZETA',observed:5,close:31.92,ema8:31.46,ema13:31.76,ema21:31.94,ema55:30.71,macd:-.185,signal:.135,k:28.1,d:25.1,source:'03-1000031384.jpg'},
 {symbol:'BX',observed:5,close:122.90,ema8:120.28,ema13:118.73,ema21:117.59,ema55:119.52,macd:1.455,signal:.086,k:75.1,d:78.3,source:'07-1000031352.jpg'}
];

export const historical2=[
 {symbol:'TSLA',observed:4,close:370.13,ema8:376.81,ema13:379.51,ema21:379.22,ema55:373.49,macd:1.044,signal:4.916,k:29.7,d:38.6,source:'10-1000031378.jpg'},
 {symbol:'AVGO',observed:3,close:313.03,ema8:318.53,ema13:324.21,ema21:330.78,ema55:347.78,macd:-10.848,signal:-8.510,k:24.9,d:23.6,source:'08-1000031374.jpg'},
 {symbol:'TTD',observed:5,close:14.44,ema8:13.20,ema13:13.02,ema21:12.91,ema55:13.55,macd:.128,signal:-.050,k:59.3,d:61.2,source:'09-1000031376.jpg'},
 {symbol:'COHR',observed:3,close:212.34,ema8:205.13,ema13:214.30,ema21:228.41,ema55:262.73,macd:-23.336,signal:-22.126,k:36.8,d:23.6,source:'10-1000031362.jpg'},
 {symbol:'ISRG',observed:7,close:458.57,ema8:454.94,ema13:449.60,ema21:441.48,ema55:420.07,macd:13.759,signal:13.185,k:73.7,d:76.7,source:'08-1000031350.jpg'},
 {symbol:'WELL',observed:7,close:246.72,ema8:241.93,ema13:239.65,ema21:237.51,ema55:234.45,macd:3.301,signal:1.865,k:89.4,d:89.5,source:'05-1000031368.jpg'}
];

// Transcribed only after candidate formulas and comparison selection were fixed.
export const newHoldout=[
 {symbol:'INCY',observed:6,close:120.70,ema8:118.92,ema13:118.11,ema21:117.66,ema55:118.04,macd:.543,signal:-.285,k:67.8,d:69.5,source:'06-1000031370.jpg'},
 {symbol:'DCTH',observed:9,close:19.16,ema8:15.65,ema13:15.32,ema21:15.21,ema55:15.12,macd:.159,signal:-.182,k:68.1,d:62.1,source:'03-1000031360.jpg'},
 {symbol:'QMCO',observed:3,close:15.94,ema8:16.70,ema13:17.85,ema21:19.48,ema55:21.16,macd:-2.574,signal:-2.263,k:26.4,d:19.2,source:'04-1000031386.jpg'}
];

// Extracted after compressed candidate was adopted. Symbols AMD and NVDA also occur
// elsewhere with different values; dates aren't legible, so they aren't independent symbols.
export const laterHoldout=[
 {symbol:'AMD',observed:3,close:491.34,ema8:485.69,ema13:501.56,ema21:518.99,ema55:531.16,macd:-26.679,signal:-18.239,k:30.2,d:22.7,source:'06-1000031354.jpg'},
 {symbol:'NVDA',observed:1,close:175.48,ema8:195.57,ema13:201.73,ema21:207.65,ema55:214.60,macd:-9.251,signal:-5.563,k:16,d:17.3,source:'09-1000031356.jpg'},
 {symbol:'EWY',observed:1,close:139.78,ema8:146.83,ema13:150.63,ema21:155.53,ema55:166.06,macd:-8.069,signal:-6.905,k:20.1,d:24.1,source:'03-1000031346.jpg'}
];

// New uploads; these examples were not used to select the current daily candidate.
export const novemberUploads=[
 {symbol:'NFLX',observed:3,close:63.67,ema8:63.89,ema13:64.35,ema21:65.40,ema55:69.32,macd:-1.842,signal:-2.088,k:30.2,d:30.4,source:'01-1000031951.jpg'},
 {symbol:'NBIS',observed:5,close:153,ema8:144.44,ema13:150.43,ema21:161.11,ema55:186.88,macd:-17.867,signal:-18.273,k:41.5,d:32.3,source:'08-1000031969.jpg'},
 {symbol:'BE',observed:3,close:206.46,ema8:196.60,ema13:202.57,ema21:212.42,ema55:230.86,macd:-16.019,signal:-15.574,k:48.6,d:37.5,source:'04-1000031977.jpg'},
 {symbol:'MSFT',observed:5,close:527.15,ema8:533.49,ema13:532.48,ema21:530.25,ema55:513,macd:4.329,signal:5.031,k:57.3,d:60.1,source:'01-1000031967.jpg'}
];
