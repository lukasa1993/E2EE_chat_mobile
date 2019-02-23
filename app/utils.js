const tableStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const table    = tableStr.split('');

function atob(base64) {
  let bin = [];
  let i   = 0;
  let len = base64.length / 4;
  let j   = 0;
  if (/(=[^=]+|={3,})$/.test(base64)) {
    throw new Error('String contains an invalid character');
  }
  base64  = base64.replace(/=/g, '');
  const n = base64.length & 3;
  if (n === 1) {
    throw new Error('String contains an invalid character');
  }
  for (; i < len; ++i) {
    const a = tableStr.indexOf(base64[j++] || 'A'),
          b = tableStr.indexOf(base64[j++] || 'A'),
          c = tableStr.indexOf(base64[j++] || 'A'),
          d = tableStr.indexOf(base64[j++] || 'A');
    if ((a | b | c | d) < 0) {
      throw new Error('String contains an invalid character');
    }
    bin[bin.length] = ((a << 2) | (b >> 4)) & 255;
    bin[bin.length] = ((b << 4) | (c >> 2)) & 255;
    bin[bin.length] = ((c << 6) | d) & 255;
  }

  return String.fromCharCode.apply(null, bin).substr(0, bin.length + n - 4);
}

function btoa(bin) {
  let base64 = [];
  let len    = bin.length / 3;
  let i      = 0;
  let j      = 0;
  for (; i < len; ++i) {
    const a = bin.charCodeAt(j++),
          b = bin.charCodeAt(j++),
          c = bin.charCodeAt(j++);
    if ((a | b | c) > 255) {
      throw new Error('String contains an invalid character');
    }
    base64[base64.length] = table[a >> 2] + table[((a << 4) & 63) | (b >> 4)] +
                            (isNaN(b) ? '=' : table[((b << 2) & 63) | (c >> 6)]) +
                            (isNaN(b + c) ? '=' : table[c & 63]);
  }
  return base64.join('');
}

function hexToBase64(str) {
  return btoa(String.fromCharCode.apply(null,
    str.replace(/\r|\n/g, '').replace(/([\da-fA-F]{2}) ?/g, '0x$1 ').replace(/ +$/, '').split(' ')),
  );
}

function base64ToHex(str) {
  let hex = [];
  let i   = 0;
  let bin = atob(str.replace(/[ \r\n]+$/, ''));
  for (; i < bin.length; ++i) {
    let tmp = bin.charCodeAt(i).toString(16);
    if (tmp.length === 1) {
      tmp = '0' + tmp;
    }
    hex[hex.length] = tmp;
  }
  return hex.join(' ');
}

module.exports = {
  hexToBase64: hexToBase64,
  base64ToHex: base64ToHex,
};