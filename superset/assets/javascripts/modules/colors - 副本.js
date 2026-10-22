import d3 from 'd3';

export const brandColor = '#00A699';
export const colorPrimary = { r: 0, g: 122, b: 135, a: 1 };

// Color related utility functions go in this object
export const bnbColors = [
  // '#C92126',
  '#C5B8A5',
  // '#ff5a5f', // rausch
  '#7b0051', // hackb
  '#0581f1',
  '#007A87', // kazan
  'rgba(225,241,6,0.63)',
  // '#b4a76c', // barol
  '#9e07d0',
  '#55d12e',
  'rgba(246,109,109,0.99)',
  '#c7f3aa',
  '#f66707',
  '#493993',
  '#11eaea',
  '#cfb6da',
  '#6305f3',
  '#045b4b',
  '#313131',
];

export const lyftColors = [
  '#ea0bb6',
  '#6C838E',
  '#29ABE2',
  '#33D9C1',
  '#9DACB9',
  '#7560AA',
  '#2D5584',
  '#831C4A',
  '#5ada15',
  '#660488',
];

const d3Category10 = d3.scale.category10().range();
d3Category10.splice(3, 1);
const d3Category20 = d3.scale.category20().range();
d3Category20.splice(6, 1);
const d3Category20b = d3.scale.category20b().range();
const d3Category20c = d3.scale.category20c().range();
d3Category20c.splice(4, 1);
const googleCategory10c = [
  '#3366cc',
  '#ff9900',
  '#109618',
  '#990099',
  '#0099c6',
  '#dd4477',
  'rgba(6,228,236,0.6)',
  '#a45858',
  '#316395',
];
const googleCategory20c = [
  '#3366cc',
  '#807876',
  '#ff9900',
  '#109618',
  '#990099',
  '#6003ec',
  '#dd4477',
  '#c8ea96',
  // '#b82e2e',
  '#ac89cc',
  '#f6c67f',
  '#22aa99',
  '#aaaa11',
  '#02d7f1',
  '#643303',
  // '#8b0707',
  '#651067',
  '#329262',
  '#5574a6',
  'rgba(230,246,4,0.96)',
];
const lele1 = [
// '#EA1C24',
'#092935',
'#007A87',
'#FFC000',
'#7f7f7f',
'#74C476',
'#9B95C9',
'#5B9BD5',
'#9E480E',
'#E0A09E',
'#f47920',
'#c77eb5',
'#2468a2',
'#007947',
];
const lele2 = [
// '#FF0000',
'#8064A2',
'#00B050',
'#0000FF',
'#F79646',
'#7f7f7f',
'#092935',
'#007A87',
'#5B9BD5',
'#9E480E',
'#E0A09E',
];

const hugeColor = [
  '#ff5a5f', // rausch
  '#7b0051', // hackb
  '#493993',
  '#007A87', // kazan
  '#ffc000',
  '#b4a76c', // barol
  '#ff1ab1',
  '#55d12e',
  '#5b9bd5',
  '#a5a5a5',
  '#c0dbae',
  '#9e480e',
  '#9ec9c9',
  '#cfb6da',
  '#4472c4',
  '#00ffcc',
  '#313131',
  '#4CAF50',
  '#2979FF',
  '#FFC107',
  '#FF5733',
  '#673AB7',
  '#f3ab49',
  '#accb89',
  '#03A9F4',
  '#FFEB3B',
  '#607D8B',
  '#aa772c',
  '#4ea8ef',
  '#F44336',
  '#9E9E9E',
  '#FFCDD2',
  '#009688',
  '#3F51B5',
  '#FF5722',
  '#795548',
  '#6f1088',
  '#FF8A65',
  '#00E5FF',
  '#FFD600',
  '#410e4b',
  '#61f105',
  '#FF6F00',
  '#03A9F4',
  '#C2185B',
  '#e5cb7e',
  '#673AB7',
  '#92c594',
  '#FF3D00',
  '#1976D2',
  '#FFAB00',
  '#009688',
  '#FF6F00',
  '#8BC34A',
  '#E91E63',
  '#607D8B',
  '#f1d6af',
  '#4CAF50',
  '#e88079',
  '#00BCD4',
  '#9E9E9E',
  '#FFC107',
  '#3F51B5',
  '#C2185B',
  '#cc6f54',
  '#03A9F4',
  '#795548',
  '#FFD740',
  '#FF5252',
  '#FFCDD2',
  '#023259',
  '#cc7a01',
  '#8E24AA',
  '#607D8B',
  '#f3ae0d',
  '#009688',
  '#f19070',
  '#0259af',
  '#FFB300',
  '#9C27B0',
  '#358601',
  '#CDDC39',
  '#00E5FF',
  '#FF5722',
  '#795548',
  '#4CAF50',
  '#673Ab7',
  '#FF5252',
  '#945853',
  '#2196F3',
  '#375713',
  '#FFD600',
  '#3F51B5',
  '#E91E63',
  '#FFCDD2',
  '#607D8B',
  '#FF6F00',
  '#1976D2',
  '#FF3D00',
  '#8E24AA',
  '#9E9E9E',
  '#FFA726',
  '#00BCD4'
];

export const zahfColors = [
  '#ff0000',
  '#9900ff',
  '#ffcc00',
  '#00ff00',
  '#0000ff',
  '#b4a76c',
  '#ff1ab1',
  '#bae7ac',
  '#5b9bd5',
  '#a5a5a5',
  '#c0dbae',
  '#9e480e',
  '#9ec9c9',
  '#cfb6da',
  '#44b1c4',
  '#00ffcc',
  '#313131',
];
export const ALL_COLOR_SCHEMES = {
  bnbColors,
  d3Category10,
  d3Category20,
  d3Category20b,
  d3Category20c,
  googleCategory10c,
  googleCategory20c,
  lyftColors,
  lele1,
  lele2,
  hugeColor,
  zahfColors,
};

export const spectrums = {
  blue_white_yellow: [
    '#00d1c1',
    'white',
    '#ffb400',
  ],
  fire: [
    'white',
    'yellow',
    'red',
    'black',
  ],
  white_black: [
    'white',
    'black',
  ],
  black_white: [
    'black',
    'white',
  ],
  dark_blue: [
    '#EBF5F8',
    '#6BB1CC',
    '#357E9B',
    '#1B4150',
    '#092935',
  ],
  pink_grey: [
    '#E70B81',
    '#FAFAFA',
    '#666666',
  ],
  green_red: [
    'green',
    'red',
  ],
  green_white_red: [
    'green',
    '#EDEDED',
    'red',
  ],
  white_red: [
    '#e0f3f8',
    '#ffffbf',
    '#fee090',
    '#fdae61',
    '#f46d43',
    '#d73027',
    '#a50026',
  ],
  cyanine_aqua: [
    'aqua',
    'lime',
    'yellow',
    'orange',
    '#ff3333',
  ],
};

/**
 * Get a color from a scheme specific palette (scheme)
 * The function cycles through the palette while memoizing labels
 * association to colors. If the function is called twice with the
 * same string, it will return the same color.
 *
 * @param {string} s - The label for which we want to get a color
 * @param {string} scheme - The palette name, or "scheme"
 * @param {string} forcedColor - A color that the caller wants to
    forcibly associate to a label.
 */
export const getColorFromScheme = (function () {
  const seen = {};
  const forcedColors = {};
  return function (s, scheme, forcedColor) {
    if (!s) {
      return;
    }
    if (forcedColor) {
      return forcedColor;
    }
    const selectedScheme = scheme ? ALL_COLOR_SCHEMES[scheme] : ALL_COLOR_SCHEMES.bnbColors;
    let stringifyS = String(s).toLowerCase();
    // next line is for superset series that should have the same color
    stringifyS = stringifyS.replace('---', '');

    if (forcedColor && !forcedColors[stringifyS]) {
      forcedColors[stringifyS] = forcedColor;
    }
    if (forcedColors[stringifyS]) {
      return forcedColors[stringifyS];
    }

    if (seen[selectedScheme] === undefined) {
      seen[selectedScheme] = {};
    }
    if (seen[selectedScheme][stringifyS] === undefined) {
      seen[selectedScheme][stringifyS] = Object.keys(seen[selectedScheme]).length;
    }
    /* eslint consistent-return: 0 */
    return selectedScheme[seen[selectedScheme][stringifyS] % selectedScheme.length];
  };
}());

export const colorScalerFactory = function (colors, data, accessor, extents) {
  // Returns a linear scaler our of an array of color
  if (!Array.isArray(colors)) {
    /* eslint no-param-reassign: 0 */
    colors = spectrums[colors];
  }
  let ext = [0, 1];
  if (extents) {
    ext = extents;
  }
  if (data) {
    ext = d3.extent(data, accessor);
  }
  const chunkSize = (ext[1] - ext[0]) / (colors.length - 1);
  const points = colors.map((col, i) => ext[0] + (i * chunkSize));
  return d3.scale.linear().domain(points).range(colors).clamp(true);
};

export function hexToRGB(hex, alpha = 255) {
  if (!hex) {
    return [0, 0, 0, alpha];
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, alpha];
}

export function generateRandomColor() {
  var color = '#';
  for (let i = 0; i < 6; i++) {
    color += Math.floor(Math.random() * 16).toString(16);
  }
  return color;
}

