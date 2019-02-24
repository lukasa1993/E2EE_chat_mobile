import { ec as EC, eddsa as EdDSA } from 'elliptic';
import keccak from 'keccakjs';
import _ from 'lodash';
import moment from 'moment';
import { NativeModules } from 'react-native';
import utils from './utils';

const fetch = require('node-fetch');

let debug = require('debug');
debug.enable('socket.io-client');

const AES = NativeModules.Aes;

const TIMEOUT  = 5000;
const CURVE    = 'curve25519';
const CURVE_ED = 'ed25519';

const CONNECTION_STATES = {
  'auth':           'AUTH',
  'wait_recipient': 'WAITING_RECIPIENT',
  'connected':      'CONNECTED',
};

module.exports = {
  async getID() {
    return _.isEmpty(this.id) ? (this.id = await AES.randomUuid()) : this.id;
  },
  setID(id) {
    this.id = id;
  },
  getEC() {
    return _.isEmpty(this.ec) ? (this.ec = new EC(CURVE)) : this.ec;
  },
  getED() {
    return _.isEmpty(this.ed) ? (this.ed = new EdDSA(CURVE_ED)) : this.ed;
  },
  async getKeys() {
    return _.isEmpty(this.keys) ? (this.keys = this.getEC().genKeyPair({ entropy: await AES.randomKey(256) })) : this.keys;
  },
  async getEDKeys() {
    return _.isEmpty(this.ed_keys) ? (this.ed_keys = this.getED().keyFromSecret(await AES.randomKey(32))) : this.ed_keys;
  },
  getConnectionState() {
    return _.isEmpty(this.connectionState) ? (this.connectionState = CONNECTION_STATES['auth']) : this.connectionState;
  },
  setConnectionState(state) {
    if (CONNECTION_STATES.hasOwnProperty(state) === false) {
      console.log(JSON.stringify(CONNECTION_STATES));
      throw new Error('Unknown Connection State: ' + state);
    }
    this.connectionState = CONNECTION_STATES[state];
  },
  setEndpoint(endpoint) {
    this.endpoint = endpoint;
  },
  setRecipient(recipient) {
    this.recipient = recipient;
  },
  setMessageCB(cb) {
    if (_.isFunction(cb)) {
      this.message_cb = cb;
      _.forEach(this.message_queue, message => cb(message));
      this.clearQueue();
    }
  },
  removeSocket() {
    clearInterval(this.checkInterval);
  },
  async initSocket(connectCB) {
    if (_.isEmpty(this.checkInterval) === false) {
      return;
    }
    const cb = _.once(() => connectCB());

    const check = async () => {
      let req = null;
      try {req = await fetch(this.endpoint + '/dequeue/' + (await this.getID()), { timeout: TIMEOUT });} catch (e) {}
      if (_.isEmpty(req)) {
        return null;
      }
      const deqeueu = await req.json();
      cb();

      if (_.isEmpty(deqeueu)) {
        return null;
      }
      console.log('checkInterval', deqeueu);

      let payload = _.isArray(deqeueu) ? _.first(deqeueu).message : deqeueu.message;
      if (_.isString(payload)) {
        payload = JSON.parse(payload);
        if (payload.hasOwnProperty('message') && _.isString(payload.message)) {
          payload.message = JSON.parse(payload.message);
        }
      }
      if (this.verifySender(payload)) {
        if (_.isFunction(this.message_cb) === false || (await this.message_cb(payload)) === false) {
          if (_.isEmpty(this.message_queue)) {
            this.message_queue = [];
          }
          this.message_queue.push(payload);
        }
      }
    };

    console.log('Set Interval');
    this.checkInterval = setInterval(check, 100);
    connectCB();
  },
  clearQueue() {
    this.message_queue = [];
  },
  sendMessage(message) {
    console.log('sendMessage', message);
    return fetch(this.endpoint + '/enqueue/' + message.recipient, {
      method:  'post',
      timeout: TIMEOUT,
      body:    _.isString(message) ? message : JSON.stringify(message),
      headers: { 'Content-Type': 'application/json' },
    });
  },
  verifySender(payload) {
    if (payload.hasOwnProperty('sender') === false || payload.hasOwnProperty('signature') === false) {
      console.log('Empty Payload');
      return false;
    }
    if (_.isEmpty(this.recipient_pubkey)) {
      this.recipient_pubkey = payload.signature.key;
    }

    const ED   = new EdDSA(CURVE_ED);
    const keys = ED.keyFromPublic(this.recipient_pubkey);

    const withoutSignature = _.cloneDeep(payload);
    delete withoutSignature.signature;

    const msg = JSON.stringify(withoutSignature);

    const msgHash = new keccak().update(msg).digest('hex');
    return keys.verify(msgHash, payload.signature.sign);
  },

  async defaultPayload(recipient) {
    if (_.isEmpty(recipient)) {
      if (_.isEmpty(this.recipient) === false) {
        recipient = this.recipient;
      } else if (_.isEmpty(recipient)) {
        throw new Error('Empty Recipient');
      }
    }

    return {
      sender: await this.getID(),
      recipient,
      action: 'auth',
    };
  },

  async auth(endpoint) {
    await this.removeSocket();
    this.endpoint = endpoint;
    return new Promise(resolve => this.initSocket(resolve));
  },

  async messageSignature(msg) {
    if (_.isEmpty(msg)) {
      throw new Error('Empty Payload');
    }

    const msgHash = new keccak().update(msg).digest('hex');
    const keys    = await this.getEDKeys();
    return {
      sign: keys.sign(msgHash).toHex(),
      key:  keys.getPublic('hex'),
    };
  },

  async signMessage(payload, recipient) {
    payload.date      = moment().format('x');
    payload.signature = await this.messageSignature(JSON.stringify(payload), recipient);

    return payload;
  },

  async sendHandshakeInit() {
    const keys    = await this.getKeys();
    const payload = await this.defaultPayload();

    payload.action      = 'handshake_init';
    payload.message     = {
      message_type: 'handshake',
      key_public:   keys.getPublic('hex'),
    };
    const signedPayload = await this.signMessage(payload, payload.recipient);
    console.log(this.recipient, 'handshakeinit');
    return this.sendMessage(signedPayload);
  },

  async sendHandshakeFinish() {
    const payload   = await this.defaultPayload();
    payload.action  = 'handshake_finish';
    payload.message = await this.encryptMessage({ message_type: 'handshake_finish' });

    const signedPayload = await this.signMessage(payload, payload.recipient);
    return this.sendMessage(signedPayload);
  },

  async sendTextMessage(msg) {
    const payload   = await this.defaultPayload();
    payload.action  = 'message';
    payload.message = await this.encryptMessage({
      message_type: 'text',
      msg,
    });

    const signedPayload = await this.signMessage(payload, payload.recipient);
    await this.sendMessage(signedPayload);
  },

  async encryptMessage(msg) {
    if (_.isEmpty(this.aes_key)) {
      throw new Error('Cant Finish Handshake');
    }
    const key = utils.hexToBase64(this.aes_key);
    msg.hmac  = await AES.hmac256(JSON.stringify(msg), key);

    const iv           = await AES.randomKey(32);
    const encryptedMSG = await AES.encrypt(JSON.stringify(msg), key, iv);

    return {
      iv,
      msg: encryptedMSG,
    };
  },

  async decryptMessage(msg) {
    if (_.isEmpty(this.aes_key) || _.isEmpty(msg.msg) || _.isEmpty(msg.iv)) {
      throw new Error('Cant Finish Handshake');
    }

    const key          = utils.hexToBase64(this.aes_key);
    const decryptedMSG = await AES.decrypt(msg.msg, key, msg.iv);
    const msgParsed    = JSON.parse(decryptedMSG);
    if (_.isEmpty(msgParsed)) {
      return null;
    }
    const withoutHMAC = _.cloneDeep(msgParsed);
    delete withoutHMAC.hmac;
    const confirmHMAC = await AES.hmac256(JSON.stringify(withoutHMAC), key);
    if (msgParsed.hmac !== confirmHMAC) {
      return null;
    }

    return msgParsed;
  },

  async waitHandshake() {
    return new Promise(resolve => {
      this.setMessageCB(payload => {
        if (payload.action === 'handshake_init' && payload.sender === this.recipient && payload.recipient === this.id && payload.message.message_type === 'handshake') {
          resolve(payload.message);
        } else {
          console.log('bad_handshake_init', payload);
        }
      });
    });
  },

  async waitHandshakeFinish() {
    return new Promise(resolve => {
      this.setMessageCB(async payload => {
        if (payload.action === 'handshake_finish' && payload.sender === this.recipient && payload.recipient === this.id) {
          try {
            const decryptedMessage = await this.decryptMessage(payload.message);
            if (_.isEmpty(decryptedMessage) === false) {
              resolve(decryptedMessage);
            }
          } catch (e) {
            console.log('bad_handshake_finish_fail', payload, e);
          }
        } else {
          console.log('bad_handshake_finish_bad', payload);
        }
      });

    });
  },

  async handshake() {
    if (_.isEmpty(this.endpoint) || _.isEmpty(this.recipient)) {
      throw new Error('Can Not Handshake');
    }
    console.log('Start Handshake');

    await this.sendHandshakeInit();
    const initResponse = await this.waitHandshake();
    this.message_cb    = null;
    this.sendHandshakeInit();

    const keys       = await this.getKeys();
    const ec         = this.getEC();
    const pkey       = ec.keyFromPublic(initResponse.key_public, 'hex');
    const messageKey = keys.derive(pkey.getPublic());
    this.aes_key     = messageKey.toString(16);

    await this.sendHandshakeFinish();
    const messageFinish = await this.waitHandshakeFinish();
    this.message_cb     = null;
    await this.sendHandshakeFinish();
    return messageFinish.hasOwnProperty('message_type') && messageFinish.message_type === 'handshake_finish';
  },
};