import crypto from 'crypto';
import _ from 'lodash';
import fetch from 'node-fetch';

module.exports = {
  async getKeys() {
    if (_.isEmpty(this.exchange)) {
      this.exchange = crypto.createDiffieHellman(4096);
    }
    if (_.isEmpty(this.keys)) {
      this.keys = this.exchange.generateKeys();
    }
    console.log(this.keys);
  },

  async auth(endpoint) {
    const response = await fetch(endpoint);

  },
};